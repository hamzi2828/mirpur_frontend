import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || '';

export type StockEntryType = 'opening' | 'received' | 'adjustment' | 'transfer_in' | 'transfer_out';

export interface StockEntry {
  _id: string;
  product: string;
  productName: string;
  variantId: string | null;
  variantLabel: string;
  branch: { _id: string; name: string; code?: string } | null;
  otherBranch: { _id: string; name: string; code?: string } | null;
  type: StockEntryType;
  quantity: number;
  stockAfter: number | null;
  boxes: number | null;
  loosePieces: number | null;
  piecesPerBox: number | null;
  batchNo: string | null;
  costPrice: number | null;
  expiryDate: string | null;
  note: string;
  createdByName: string;
  date: string;
}

export interface StockHistoryFilters {
  productId?: string;
  variantId?: string;
  type?: StockEntryType | 'in' | 'out' | '';
  search?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface StockHistoryResult {
  rows: StockEntry[];
  summary: { piecesIn: number; piecesOut: number };
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export const STOCK_TYPE_LABELS: Record<StockEntryType, string> = {
  opening: 'Opening stock',
  received: 'Received',
  adjustment: 'Changed in product',
  transfer_in: 'Transfer in',
  transfer_out: 'Transfer out',
};

export const stockHistoryService = {
  async list(filters: StockHistoryFilters = {}, signal?: AbortSignal): Promise<StockHistoryResult> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && String(v) !== '') params.append(k, String(v));
    });
    const res = await axios.get(`${API_BASE_URL}/admin/stock-history?${params.toString()}`, {
      headers: { 'Content-Type': 'application/json', ...getAuthHeader() },
      signal,
    });
    const d = res.data || {};
    return {
      rows: Array.isArray(d.data) ? d.data : [],
      summary: d.summary || { piecesIn: 0, piecesOut: 0 },
      pagination: d.pagination || { total: 0, page: 1, limit: filters.limit || 25, totalPages: 1 },
    };
  },
};
