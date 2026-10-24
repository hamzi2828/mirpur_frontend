'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck, Info, Layers, Loader2, PackagePlus, Printer, RefreshCw, X } from 'lucide-react';
import { useCurrency } from '@/context/CurrencyContext';
import {
  labelService,
  errorMessage,
  unitKey,
  type LabelData,
  type ReceiveStockBody,
  type ReceiveStockResult,
} from '../../services/labelService';

interface ReceiveStockModalProps {
  productId: string;
  productName?: string;
  /** pre-select this variant (variant products) */
  initialVariantId?: string | null;
  /** `changed` = stock was added while the modal was open (refresh your list) */
  onClose: (changed: boolean) => void;
}

type Mode = 'pieces' | 'boxes';

const toInt = (v: string) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export default function ReceiveStockModal({ productId, productName, initialVariantId, onClose }: ReceiveStockModalProps) {
  const router = useRouter();

  const [data, setData] = useState<LabelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string | null>(null);

  const [unitId, setUnitId] = useState<string>('');
  const [mode, setMode] = useState<Mode>('pieces');
  const [quantity, setQuantity] = useState('');
  const [boxes, setBoxes] = useState('');
  const [loose, setLoose] = useState('');
  const [asBatch, setAsBatch] = useState(false);
  const [costPrice, setCostPrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [note, setNote] = useState('');
  // Prices per piece for this delivery; prefilled from the product, saved to it when changed.
  const [salePrice, setSalePrice] = useState('');
  const [pricesChanged, setPricesChanged] = useState(false);
  const { currency } = useCurrency();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReceiveStockResult | null>(null);
  const [lastMode, setLastMode] = useState<Mode>('pieces');
  // Synchronous locks: a second click / Enter before re-render must not send a second request
  const savingRef = useRef(false);
  const loadingRef = useRef(false);

  const load = async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setLoadError(null);
    try {
      const d = await labelService.getLabelData(productId);
      setData(d);
      const start =
        (initialVariantId && d.units.find((u) => u.variantId === initialVariantId)) ||
        (d.product.productType === 'variant' ? null : d.units[0]) ||
        (d.units.length === 1 ? d.units[0] : null);
      setUnitId(start ? unitKey(start) : '');
      if (d.product.piecesPerBox > 1) setMode('boxes');
    } catch (e) {
      setLoadError(errorMessage(e, 'Could not load this product.'));
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    labelService
      .getReceiveBranchName()
      .then(setBranchName)
      .catch(() => setBranchName(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !saving) onClose(!!result);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, result, saving]);

  const isVariant = data?.product.productType === 'variant';
  const ppb = data?.product.piecesPerBox ?? 1;
  const unit = useMemo(() => data?.units.find((u) => unitKey(u) === unitId) || null, [data, unitId]);
  const mustBatch = !!unit && unit.batches.length > 0;
  const batchOn = mustBatch || asBatch;
  const boxMode = ppb > 1 && mode === 'boxes';
  const totalPieces = boxMode ? toInt(boxes) * ppb + toInt(loose) : toInt(quantity);
  const name = data?.product.name || productName || 'Product';

  // Fill the price boxes with the chosen item's current prices.
  useEffect(() => {
    if (!unit) return;
    setSalePrice(unit.price ? String(unit.price) : '');
    setCostPrice(unit.costPrice != null ? String(unit.costPrice) : '');
  }, [unit]);
  const priceNum = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const newSale = priceNum(salePrice);
  const newCost = priceNum(costPrice);
  const saleChanged = !!unit && newSale !== undefined && newSale !== unit.price;
  const costChanged = !!unit && newCost !== undefined && newCost !== (unit.costPrice ?? undefined);
  const lossWarning = newSale !== undefined && newCost !== undefined && newCost > newSale;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (savingRef.current) return;
    setError(null);
    if (!data) return;
    if (isVariant && !unit) {
      setError('Please choose which item (variant) you received.');
      return;
    }
    if (totalPieces <= 0) {
      setError(boxMode ? 'Enter how many boxes (or loose pieces) you received.' : 'Enter how many pieces you received.');
      return;
    }
    if ((newSale !== undefined && !(newSale >= 0)) || (newCost !== undefined && !(newCost >= 0))) {
      setError('Prices must be 0 or more.');
      return;
    }
    const body: ReceiveStockBody = {};
    if (unit?.variantId) body.variantId = unit.variantId;
    if (newSale !== undefined) body.salePrice = newSale;
    if (newCost !== undefined) body.costPrice = newCost;
    if (boxMode) {
      body.boxes = toInt(boxes);
      body.loosePieces = toInt(loose);
    } else {
      body.quantity = toInt(quantity);
    }
    if (batchOn) {
      const batch: NonNullable<ReceiveStockBody['batch']> = {};
      const cost = Number(costPrice);
      if (costPrice.trim() !== '' && Number.isFinite(cost) && cost >= 0) batch.costPrice = cost;
      if (expiryDate) batch.expiryDate = expiryDate;
      if (note.trim()) batch.note = note.trim();
      body.batch = batch;
    }
    if (note.trim()) body.note = note.trim();
    savingRef.current = true;
    setSaving(true);
    try {
      const r = await labelService.receiveStock(productId, body);
      setPricesChanged(saleChanged || costChanged);
      setLastMode(boxMode ? 'boxes' : 'pieces');
      setResult(r);
    } catch (err) {
      setError(errorMessage(err, 'Could not add the stock.'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const stickerUrl = () => {
    if (!result) return `/admin/products/stickers/${productId}`;
    const q = new URLSearchParams();
    const v = result.variantId || unit?.variantId;
    if (v) q.set('variantId', v);
    if (result.batch?.batchNo) {
      q.set('type', 'batch');
      q.set('batchNo', result.batch.batchNo);
    } else if (lastMode === 'boxes' && ppb > 1) {
      q.set('type', 'box');
      q.set('copies', String(Math.max(1, Math.ceil(result.received / ppb))));
    } else {
      q.set('type', 'unit');
      q.set('copies', String(Math.max(1, result.received)));
    }
    return `/admin/products/stickers/${productId}?${q.toString()}`;
  };

  const inputCls =
    'mt-1 h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose(!!result)} />
      <div className="relative bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <PackagePlus className="h-5 w-5 text-honey-500" />
              Receive stock
            </h3>
            <p className="text-xs sm:text-sm text-gray-500 truncate max-w-[320px]">{name}</p>
          </div>
          <button
            onClick={() => onClose(!!result)}
            disabled={saving}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : loadError || !data ? (
          <div className="p-6 text-center">
            <CircleAlert className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-sm text-red-700">{loadError}</p>
            <button
              onClick={load}
              disabled={loading}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : result ? (
          /* Success */
          <div className="p-5 space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 p-3">
              <CircleCheck className="h-6 w-6 flex-shrink-0 text-green-600" />
              <div className="text-sm text-green-800">
                <p className="font-semibold">
                  Added {result.received} piece{result.received === 1 ? '' : 's'}
                  {result.branchName ? ` to ${result.branchName}` : ''}.
                </p>
                {pricesChanged && (
                  <p className="mt-0.5">
                    Prices updated: sale {currency.symbol}
                    {newSale ?? '-'}, cost {currency.symbol}
                    {newCost ?? '-'} per piece.
                  </p>
                )}
                {result.batch && (
                  <p className="mt-0.5">
                    New batch <span className="font-mono font-semibold">{result.batch.batchNo}</span>. Its stickers have
                    their own code.
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => onClose(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Done
              </button>
              <button
                onClick={() => {
                  const url = stickerUrl();
                  onClose(true);
                  router.push(url);
                }}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 shadow-md"
              >
                <Printer className="h-4 w-4" />
                Print stickers for this delivery
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={submit} aria-busy={saving}>
           <fieldset disabled={saving} className="min-w-0 p-4 space-y-4">
            <p className="flex items-center gap-1.5 text-xs text-gray-500">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              Stock will be added to {branchName ? <strong className="text-gray-700">{branchName}</strong> : 'your current branch'}.
            </p>

            {isVariant && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Which item?</label>
                <select value={unitId} onChange={(e) => setUnitId(e.target.value)} className={inputCls}>
                  <option value="">Choose a variant…</option>
                  {data.units.map((u) => (
                    <option key={unitKey(u)} value={unitKey(u)}>
                      {u.label || u.sku || 'Variant'}
                      {u.shortCode ? ` · code ${u.shortCode}` : ''} · {u.stock} in stock
                    </option>
                  ))}
                </select>
              </div>
            )}

            {unit && (
              <p className="text-xs text-gray-500">
                Now in stock: <strong className="text-gray-800">{unit.stock} pieces</strong>
                {ppb > 1 && ` (box of ${ppb})`}
              </p>
            )}

            {/* Prices per piece (before the quantity) */}
            {unit && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Cost price per piece ({currency.symbol})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className={`${inputCls} ${costChanged ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}
                      placeholder="0"
                    />
                    {costChanged && (
                      <p className="mt-1 text-xs text-amber-700">
                        Was {unit.costPrice != null ? `${currency.symbol}${unit.costPrice}` : 'not set'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Sale price per piece ({currency.symbol})
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      inputMode="decimal"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className={`${inputCls} ${saleChanged ? 'border-amber-400 ring-1 ring-amber-300' : ''}`}
                      placeholder="0"
                    />
                    {saleChanged && (
                      <p className="mt-1 text-xs text-amber-700">
                        Was {currency.symbol}
                        {unit.price}
                      </p>
                    )}
                  </div>
                </div>
                {lossWarning && (
                  <p className="mt-2 text-xs font-medium text-red-600">Cost price is higher than the sale price.</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  {saleChanged || costChanged
                    ? 'The new price will be saved on the product when you add the stock.'
                    : 'Change a price here if this delivery came at a different price.'}
                </p>
              </div>
            )}

            {/* Mode */}
            {ppb > 1 && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-100 p-1">
                {(['boxes', 'pieces'] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-1.5 text-sm font-medium rounded-md transition-colors ${
                      mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {m === 'boxes' ? 'Boxes' : 'Pieces'}
                  </button>
                ))}
              </div>
            )}

            {boxMode ? (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Boxes</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={boxes}
                      onChange={(e) => setBoxes(e.target.value)}
                      className={inputCls}
                      placeholder="0"
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Loose pieces</label>
                    <input
                      type="number"
                      min={0}
                      inputMode="numeric"
                      value={loose}
                      onChange={(e) => setLoose(e.target.value)}
                      className={inputCls}
                      placeholder="0"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">
                  1 box = {ppb} pieces. Total: <strong className="text-gray-800">{totalPieces} pieces</strong>
                </p>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700">Pieces received</label>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. 24"
                  autoFocus
                />
              </div>
            )}

            {!batchOn && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Note (optional)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className={inputCls}
                  placeholder="e.g. supplier name or bill no."
                  maxLength={300}
                />
                <p className="mt-1 text-xs text-gray-500">Shown in the stock history.</p>
              </div>
            )}

            {/* Batch: only for old items that already use batches */}
            {mustBatch && (
            <div className="rounded-lg border border-gray-200 p-3 space-y-3">
              <label className={`flex items-start gap-2 ${mustBatch ? 'cursor-default' : 'cursor-pointer'}`}>
                <input
                  type="checkbox"
                  checked={batchOn}
                  disabled={mustBatch}
                  onChange={(e) => setAsBatch(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
                />
                <span>
                  <span className="flex items-center gap-1 text-sm font-medium text-gray-900">
                    <Layers className="h-4 w-4 text-gray-400" /> Add as a new batch
                  </span>
                  <span className="block text-xs text-gray-500">
                    {mustBatch
                      ? 'This item already uses batches, so every delivery is saved as a new batch. This keeps each lot’s stock, cost and expiry date separate.'
                      : 'Use this for items with an expiry date or a different cost price. The batch gets its own sticker code.'}
                  </span>
                </span>
              </label>
              {batchOn && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700">Expiry date (optional)</label>
                    <input
                      type="date"
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-700">Note (optional)</label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      className={inputCls}
                      placeholder="e.g. supplier name or bill no."
                    />
                  </div>
                </div>
              )}
            </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <CircleAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onClose(false)}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || totalPieces <= 0 || (isVariant && !unit)}
                aria-busy={saving}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed shadow-md"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding stock…
                  </>
                ) : (
                  <>
                    <PackagePlus className="h-4 w-4" />
                    Add {totalPieces > 0 ? `${totalPieces} piece${totalPieces === 1 ? '' : 's'}` : 'stock'}
                  </>
                )}
              </button>
            </div>
           </fieldset>
          </form>
        )}
      </div>
    </div>
  );
}
