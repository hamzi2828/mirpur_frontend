// Sticker printing + stock receiving + code lookup.
// Backend docs: pos_backend/docs/BARCODES_BOXES_BATCHES.md
import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = (process.env.NEXT_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');

// ---------- types ----------

/** Sticker types the UI offers (`barcode` exists in the backend but is not shown). */
export type StickerType = 'unit' | 'box' | 'full-box' | 'batch';
export type StickerSize = '38x25' | '40x30' | '50x25' | '50x30' | '60x40' | 'a4';

export const STICKER_TYPES: StickerType[] = ['unit', 'box', 'full-box', 'batch'];

export const STICKER_SIZES: { key: StickerSize; label: string }[] = [
  { key: '38x25', label: '38 × 25 mm (small roll)' },
  { key: '50x25', label: '50 × 25 mm (roll)' },
  { key: '50x30', label: '50 × 30 mm (roll)' },
  { key: '40x30', label: '40 × 30 mm (roll)' },
  { key: '60x40', label: '60 × 40 mm (big roll)' },
  { key: 'a4', label: 'A4 sheet (24 stickers per page)' },
];

export interface LabelBatch {
  batchNo: string;
  barcode: string | null;
  quantity: number;
  expiryDate: string | null;
  suggestedCopies: number;
}

export interface LabelUnit {
  /** null for a single (non-variant) product */
  variantId: string | null;
  /** variant name, e.g. "Black / 128GB" ('' for single products) */
  label: string;
  shortCode: string | null;
  sku: string | null;
  /** the code printed on piece / box stickers (shortCode, else SKU) */
  printCode: string | null;
  price: number;
  regularPrice: number;
  stock: number;
  barcodes: { code: string; qty: number; label: string }[];
  fullBoxCode: string | null;
  batches: LabelBatch[];
  suggested: { unit: number; box: number | null; fullBox: number | null };
}

export interface LabelData {
  product: { id: string; name: string; productType: 'single' | 'variant'; piecesPerBox: number };
  shop: { name: string; currency: string };
  stockBranch: string | null;
  units: LabelUnit[];
  types: string[];
  sizes: { key: string; label: string; widthMm: number; heightMm: number; kind: 'thermal' | 'sheet'; perPage: number }[];
  defaultSize: string;
  maxLabels: number;
}

export interface LabelPrintItem {
  productId: string;
  variantId?: string;
  type: StickerType;
  batchNo?: string;
  copies?: number;
}

export interface LabelPrintOptions {
  size: StickerSize;
  showPrice: boolean;
  autoPrint?: boolean;
}

export interface ReceiveStockBody {
  variantId?: string;
  quantity?: number;
  boxes?: number;
  loosePieces?: number;
  batch?: { costPrice?: number; expiryDate?: string; note?: string };
  /** Shown in the stock history (e.g. supplier name or bill no.) */
  note?: string;
}

export interface ReceiveStockResult {
  received: number;
  variantId: string | null;
  branchId: string | null;
  /** branch name parsed from the backend message ("... in Branch 1") */
  branchName: string | null;
  batch: { batchNo: string; barcode?: string; quantity?: number; expiryDate?: string | null } | null;
  message: string;
}

export interface CodeLookupResult {
  product: { _id: string; name: string; productType?: string };
  match: {
    variantId: string | null;
    batchNo: string | null;
    qty: number;
    kind: 'sku' | 'shortCode' | 'barcode' | 'batch';
    code: string;
    variantLabel: string;
    available: number;
  };
}

// ---------- helpers ----------

const UNIT_KEY_PRODUCT = '__product';
/** Stable key for a unit (the product itself, or one variant). */
export const unitKey = (u: { variantId: string | null }) => u.variantId || UNIT_KEY_PRODUCT;

/** Best human-readable message from an axios / fetch error. */
export function errorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    const data = err.response?.data as { message?: string; error?: string } | string | undefined;
    const msg = typeof data === 'string' ? data : data?.message || data?.error;
    if (status === 403) {
      return `${msg || 'You do not have permission for this action'}. Ask the owner to give you this permission.`;
    }
    if (msg) return msg;
    if (!err.response) return 'Cannot reach the server. Check your internet connection.';
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** Turn a non-OK fetch Response (JSON error body) into an Error with the backend message. */
async function fetchError(res: Response, fallback: string): Promise<Error> {
  let msg = '';
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text) as { message?: string };
      msg = json.message || '';
    } catch {
      msg = text.length < 300 ? text : '';
    }
  } catch {
    /* ignore */
  }
  if (res.status === 403) {
    return new Error(`${msg || 'You do not have permission for this action'}. Ask the owner to give you this permission.`);
  }
  return new Error(msg || fallback);
}

const jsonHeaders = () => ({ 'Content-Type': 'application/json', ...getAuthHeader() });

// ---------- loose product helpers (for list badges) ----------

type LooseBatch = { quantity?: number };
type LooseVariant = { variantId?: string; shortCode?: string; batches?: LooseBatch[]; stock?: number; sku?: string };
export type LooseProduct = {
  id?: string;
  _id?: string;
  productType?: string;
  shortCode?: string;
  piecesPerBox?: number;
  batches?: LooseBatch[];
  variants?: LooseVariant[];
};

export interface CodeSummary {
  /** product shortCode, or the first variant's */
  shortCode: string | null;
  piecesPerBox: number;
  hasBatches: boolean;
}

/** Code / box / batch summary of a raw (or mapped) product object. */
export function summarizeCodes(p: LooseProduct): CodeSummary {
  const variants = Array.isArray(p.variants) ? p.variants : [];
  const shortCode = p.shortCode || variants.find((v) => v && v.shortCode)?.shortCode || null;
  const hasBatches =
    (Array.isArray(p.batches) && p.batches.length > 0) ||
    variants.some((v) => Array.isArray(v?.batches) && v.batches.length > 0);
  return { shortCode, piecesPerBox: Math.max(1, Math.floor(Number(p.piecesPerBox) || 1)), hasBatches };
}

/** True when the object carries the code fields (productService may not map them yet). */
export const hasCodeFields = (p: LooseProduct) => p.piecesPerBox !== undefined || p.shortCode !== undefined;

// ---------- API ----------

export const labelService = {
  async getLabelData(productId: string): Promise<LabelData> {
    const res = await axios.get(`${API_BASE_URL}/products/${productId}/label-data`, { headers: jsonHeaders() });
    const data = res.data?.data ?? res.data;
    if (!data || !Array.isArray(data.units)) throw new Error('Unexpected label data response');
    return data as LabelData;
  },

  /**
   * Sticker page HTML for one or more lines (POST /products/labels/print), so every
   * line can have its own number of copies.
   */
  async getStickersHtml(items: LabelPrintItem[], opts: LabelPrintOptions): Promise<{ html: string; count: number }> {
    const res = await fetch(`${API_BASE_URL}/products/labels/print`, {
      method: 'POST',
      headers: jsonHeaders(),
      body: JSON.stringify({
        items,
        size: opts.size,
        showPrice: opts.showPrice,
        autoPrint: !!opts.autoPrint,
      }),
      cache: 'no-store',
    });
    if (!res.ok) throw await fetchError(res, 'Could not make the stickers');
    const html = await res.text();
    const count = Number(res.headers.get('X-Label-Count')) || 0;
    return { html, count };
  },

  /** Sticker page HTML for one product (GET /products/:id/labels). */
  async getProductStickersHtml(
    productId: string,
    params: { variantId?: string; type?: StickerType; batchNo?: string; copies?: number } & LabelPrintOptions
  ): Promise<string> {
    const q = new URLSearchParams();
    if (params.variantId) q.set('variantId', params.variantId);
    if (params.type) q.set('type', params.type);
    if (params.batchNo) q.set('batchNo', params.batchNo);
    if (params.copies) q.set('copies', String(params.copies));
    q.set('size', params.size);
    q.set('showPrice', params.showPrice ? '1' : '0');
    if (params.autoPrint) q.set('autoPrint', '1');
    const res = await fetch(`${API_BASE_URL}/products/${productId}/labels?${q.toString()}`, {
      headers: getAuthHeader(),
      cache: 'no-store',
    });
    if (!res.ok) throw await fetchError(res, 'Could not make the stickers');
    return res.text();
  },

  async receiveStock(productId: string, body: ReceiveStockBody): Promise<ReceiveStockResult> {
    const res = await axios.post(`${API_BASE_URL}/products/${productId}/stock/receive`, body, { headers: jsonHeaders() });
    const d = res.data || {};
    const message: string = d.message || '';
    const m = /\bin (.+)$/.exec(message);
    return {
      received: Number(d.received) || 0,
      variantId: d.variantId ?? null,
      branchId: d.branchId ?? null,
      branchName: m ? m[1] : null,
      batch: d.batch || null,
      message,
    };
  },

  async lookupCode(code: string): Promise<CodeLookupResult> {
    const res = await axios.get(`${API_BASE_URL}/products/codes/lookup/${encodeURIComponent(code.trim())}`, {
      headers: jsonHeaders(),
    });
    return { product: res.data?.data, match: res.data?.match };
  },

  /**
   * Name of the branch that receives stock for this login (GET /me/access):
   * staff -> own branch; super admin -> picked branch, else the main branch.
   */
  async getReceiveBranchName(): Promise<string | null> {
    const res = await axios.get(`${API_BASE_URL}/me/access`, { headers: jsonHeaders() });
    const d = res.data?.data;
    if (!d) return null;
    if (d.branch?.name) return String(d.branch.name);
    const list: { id?: string; _id?: string; name?: string; isMain?: boolean }[] = Array.isArray(d.branches)
      ? d.branches
      : [];
    const cur = d.currentBranchId
      ? list.find((b) => String(b.id ?? b._id) === String(d.currentBranchId))
      : undefined;
    return (cur || list.find((b) => b.isMain))?.name || null;
  },

  /**
   * Raw product list, only used to read shortCode / piecesPerBox / batches when the
   * mapped list from productService does not carry them.
   */
  async listRawProducts(): Promise<LooseProduct[]> {
    const res = await axios.get(`${API_BASE_URL}/products`, { headers: jsonHeaders() });
    const data = res.data?.data ?? res.data ?? [];
    return Array.isArray(data) ? (data as LooseProduct[]) : [];
  },
};

/**
 * Open sticker HTML in a new tab and print it. Call `openPrintWindow()` straight
 * from the click handler (before any await) so the browser does not block the popup.
 */
export function openPrintWindow(): Window | null {
  try {
    const w = window.open('', '_blank');
    if (w) {
      w.document.title = 'Preparing stickers…';
      w.document.body.innerHTML =
        '<p style="font-family:sans-serif;padding:24px;color:#374151">Preparing stickers…</p>';
    }
    return w;
  } catch {
    return null;
  }
}

export function showHtmlInWindow(w: Window, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  w.location.href = url;
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Fallback when popups are blocked: print through a hidden iframe on this page. */
export function printHtmlInHiddenFrame(html: string): Promise<void> {
  return new Promise((resolve) => {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    frame.onload = () => {
      setTimeout(() => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } finally {
          setTimeout(() => frame.remove(), 60_000);
          resolve();
        }
      }, 300);
    };
    // Strip the auto-print script: we call print() ourselves.
    frame.srcdoc = html.replace(/<script>window\.addEventListener\("load"[\s\S]*?<\/script>/, '');
    document.body.appendChild(frame);
  });
}
