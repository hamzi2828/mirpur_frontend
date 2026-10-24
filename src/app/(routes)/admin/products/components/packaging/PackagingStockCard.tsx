"use client";
import React from "react";
import { Info, Layers, LayoutGrid, Package, Plus, Trash2 } from "lucide-react";
import {
  type PackagingState,
  type SoldAs,
  batchStockOf,
  boxStockOf,
  emptyBatchRow,
  piecesPerBoxOf,
} from "./packagingUtils";

interface PackagingStockCardProps {
  value: PackagingState;
  onChange: (next: PackagingState) => void;
  mode: "create" | "edit";
  productId?: string;
  errors?: Record<string, string>;
  currencySymbol: string;
  // Product cost price: default cost for a new batch row
  defaultCostPrice?: number;
  // Stock currently saved (edit): kept as "Opening stock" when batches are turned on
  savedStock?: number;
  // Box items: prices are typed here, per piece (the top price fields are locked)
  salePrice?: number;
  costPrice?: number;
  onPricesChange?: (prices: { salePrice?: number; costPrice?: number }) => void;
  priceErrors?: { salePrice?: string; costPrice?: string };
}

const inputClass = (hasError?: boolean) =>
  `block w-full rounded-lg border px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors ${
    hasError ? "border-red-300" : "border-gray-300"
  }`;

const cellInputClass =
  "block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900";

export default function PackagingStockCard({
  value,
  onChange,
  mode,
  productId,
  errors = {},
  currencySymbol,
  defaultCostPrice,
  savedStock = 0,
  salePrice,
  costPrice,
  onPricesChange,
  priceErrors = {},
}: PackagingStockCardProps) {
  const toNum = (v: string) => (v === "" ? undefined : Number(v));

  const set = (patch: Partial<PackagingState>) => onChange({ ...value, ...patch });
  const isBox = value.soldAs === "box";
  const hasSavedBatches = value.batches.some((b) => !!b.saved);
  const ppb = piecesPerBoxOf(value);

  const setSoldAs = (soldAs: SoldAs) => {
    if (soldAs === value.soldAs) return;
    set({ soldAs, addFullBoxBarcode: soldAs === "box" ? value.addFullBoxBarcode : false });
  };

  const toggleBatches = () => {
    if (value.trackBatches) {
      if (hasSavedBatches) return; // saved batches cannot be switched off here
      set({ trackBatches: false, batches: [] });
    } else {
      set({ trackBatches: true, batches: value.batches.length ? value.batches : [emptyBatchRow(defaultCostPrice)] });
    }
  };

  const updateBatch = (key: string, patch: Partial<PackagingState["batches"][number]>) =>
    set({ batches: value.batches.map((b) => (b.key === key ? { ...b, ...patch } : b)) });

  const removeBatch = (key: string) => {
    const row = value.batches.find((b) => b.key === key);
    if (row?.saved) {
      const label = row.saved.batchNo ? `batch ${row.saved.batchNo}` : "this batch";
      if (!window.confirm(`Remove ${label}? Its ${row.quantity || 0} pieces will be removed from stock.`)) return;
    }
    set({ batches: value.batches.filter((b) => b.key !== key) });
  };

  const batchTotal = batchStockOf(value);
  const boxTotal = boxStockOf(value);

  return (
    <div
      className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-6"
      // A barcode scanner presses Enter after the code: never submit the form from here.
      onKeyDown={(e) => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault();
      }}
    >
      <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-1">Packaging &amp; Stock</h4>
      <p className="text-xs text-gray-500 mb-3 sm:mb-4">Stock is always counted in pieces.</p>

      {/* How is it sold? */}
      <label className="block text-sm font-medium text-gray-700 mb-2">How is it sold?</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {([
          { key: "loose", title: "Loose pieces", desc: "Sold one by one (pens, cables, covers)", icon: LayoutGrid },
          { key: "box", title: "Box", desc: "Comes in boxes, sold by piece or full box", icon: Package },
        ] as const).map((opt) => {
          const active = value.soldAs === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSoldAs(opt.key)}
              className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                active ? "border-gray-900 bg-gray-50" : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${active ? "bg-honey-50 text-honey-500" : "bg-gray-100 text-gray-400"}`}>
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-medium text-gray-900">{opt.title}</span>
                <span className="block text-xs text-gray-500">{opt.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Box fields */}
      {isBox && (
        <div className="mt-3 sm:mt-4 rounded-lg border border-gray-200 bg-gray-50/60 p-3 sm:p-4">
          <div className={`grid grid-cols-1 gap-3 sm:gap-4 ${value.trackBatches ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Pieces in one box <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="2"
                step="1"
                placeholder="e.g., 12"
                className={inputClass(!!errors.piecesPerBox)}
                value={value.piecesPerBox}
                onChange={(e) => set({ piecesPerBox: e.target.value })}
              />
              {errors.piecesPerBox && <p className="mt-1 text-xs text-red-600">{errors.piecesPerBox}</p>}
            </div>
            {!value.trackBatches && mode !== "edit" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Boxes in stock</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className={inputClass(!!errors.boxes)}
                    value={value.boxes}
                    onChange={(e) => set({ boxes: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loose pieces</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    className={inputClass(!!errors.boxes)}
                    value={value.loosePieces}
                    onChange={(e) => set({ loosePieces: e.target.value })}
                  />
                  <p className="mt-1 text-xs text-gray-500">Pieces from an open box</p>
                </div>
              </>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total stock</label>
              <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-900">
                {mode === "edit" && !value.trackBatches ? savedStock : value.trackBatches ? batchTotal : boxTotal} pieces
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {mode === "edit"
                  ? "Add stock from Products → Stock → Add stock"
                  : value.trackBatches
                  ? "From the batches below"
                  : `${Number(value.boxes) || 0} × ${ppb} + ${Number(value.loosePieces) || 0}`}
              </p>
            </div>
          </div>
          {errors.boxes && <p className="mt-2 text-xs text-red-600">{errors.boxes}</p>}

          {/* Prices per piece */}
          {onPricesChange && (
            <div className="mt-3 sm:mt-4 grid grid-cols-1 gap-3 sm:gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale price per piece ({currencySymbol}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputClass(!!priceErrors.salePrice)}
                  value={salePrice ?? ""}
                  onChange={(e) => onPricesChange({ salePrice: toNum(e.target.value), costPrice })}
                />
                {priceErrors.salePrice && <p className="mt-1 text-xs text-red-600">{priceErrors.salePrice}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cost price per piece ({currencySymbol}) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  className={inputClass(!!priceErrors.costPrice)}
                  value={costPrice ?? ""}
                  onChange={(e) => onPricesChange({ salePrice, costPrice: toNum(e.target.value) })}
                />
                {priceErrors.costPrice && <p className="mt-1 text-xs text-red-600">{priceErrors.costPrice}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">One full box</label>
                <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-900">
                  {ppb > 1 && salePrice
                    ? `Sells for ${currencySymbol}${(salePrice * ppb).toLocaleString()}`
                    : "-"}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  {ppb > 1 && costPrice ? `Costs ${currencySymbol}${(costPrice * ppb).toLocaleString()}` : `${ppb > 1 ? ppb : "?"} pieces × price per piece`}
                </p>
              </div>
            </div>
          )}

          <label className="mt-3 sm:mt-4 flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-honey-500 focus:ring-honey-500"
              checked={value.addFullBoxBarcode}
              onChange={(e) => set({ addFullBoxBarcode: e.target.checked })}
            />
            <span>
              <span className="block text-sm text-gray-800">Also create a full-box barcode (one scan sells the whole box)</span>
              <span className="block text-xs text-gray-500">
                {value.shortCode ? `Code ${value.shortCode}-BOX` : "Code will be <short code>-BOX"} sells {ppb > 1 ? ppb : "all"} pieces in one scan.
              </span>
            </span>
          </label>
        </div>
      )}

    </div>
  );
}
