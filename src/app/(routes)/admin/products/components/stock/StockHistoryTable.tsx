'use client';

import { useEffect, useRef, useState } from 'react';
import { History, Loader2, Search } from 'lucide-react';
import TablePagination from '@/components/admin/TablePagination';
import { useAccess } from '@/context/AccessContext';
import { useCurrency } from '@/context/CurrencyContext';
import {
  stockHistoryService,
  STOCK_TYPE_LABELS,
  type StockEntry,
  type StockEntryType,
  type StockHistoryFilters,
} from '../../services/stockHistoryService';

interface Props {
  /** Show one product's history only (hides the product search). */
  productId?: string;
  variantId?: string;
  /** Change this number to reload (e.g. after stock was added). */
  reloadKey?: number;
}

const TYPE_STYLE: Record<StockEntryType, string> = {
  opening: 'bg-blue-50 text-blue-700',
  received: 'bg-green-50 text-green-700',
  adjustment: 'bg-amber-50 text-amber-700',
  transfer_in: 'bg-purple-50 text-purple-700',
  transfer_out: 'bg-gray-100 text-gray-700',
};

const fmtDate = (s: string) => {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString(undefined, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function StockHistoryTable({ productId, variantId, reloadKey = 0 }: Props) {
  const { isSuperAdmin, currentBranchId } = useAccess();
  const { formatPrice } = useCurrency();
  const [rows, setRows] = useState<StockEntry[]>([]);
  const [summary, setSummary] = useState({ piecesIn: 0, piecesOut: 0 });
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [type, setType] = useState<StockHistoryFilters['type']>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Back to page 1 when a filter changes.
  useEffect(() => setPage(1), [debounced, type, startDate, endDate, productId, variantId]);

  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setLoading(true);
    stockHistoryService
      .list({ productId, variantId, type, search: productId ? '' : debounced, startDate, endDate, page, limit }, ctrl.signal)
      .then((r) => {
        setRows(r.rows);
        setSummary(r.summary);
        setTotal(r.pagination.total);
        setPages(r.pagination.totalPages);
      })
      .catch((err) => {
        if (axiosCancelled(err)) return;
        console.error('Stock history failed', err);
        setRows([]);
      })
      .finally(() => {
        if (abortRef.current === ctrl) setLoading(false);
      });
    return () => ctrl.abort();
  }, [productId, variantId, type, debounced, startDate, endDate, page, limit, reloadKey, currentBranchId]);

  const showBranch = isSuperAdmin;
  const inputCls =
    'w-full px-3 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-gray-900 focus:border-gray-900';

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        {!productId && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product..."
              className={`${inputCls} pl-9`}
            />
          </div>
        )}
        <select value={type} onChange={(e) => setType(e.target.value as StockHistoryFilters['type'])} className={inputCls}>
          <option value="">All changes</option>
          <option value="in">Stock added (all)</option>
          <option value="out">Stock removed (all)</option>
          {(Object.keys(STOCK_TYPE_LABELS) as StockEntryType[]).map((t) => (
            <option key={t} value={t}>
              {STOCK_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputCls} title="From date" />
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputCls} title="To date" />
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 rounded-lg bg-green-50 text-green-700 font-medium">Added: {summary.piecesIn} pcs</span>
        <span className="px-2 py-1 rounded-lg bg-gray-100 text-gray-700 font-medium">Removed: {summary.piecesOut} pcs</span>
        <span className="px-2 py-1 rounded-lg bg-gray-50 text-gray-500">{total} entries</span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading && !rows.length ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : !rows.length ? (
          <div className="py-12 text-center">
            <History className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No stock history yet</p>
          </div>
        ) : (
          <div className={`overflow-x-auto ${loading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  <th className="px-3 py-2.5">Date</th>
                  {!productId && <th className="px-3 py-2.5">Product</th>}
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5 text-right">Qty</th>
                  <th className="px-3 py-2.5 text-right">Stock after</th>
                  <th className="px-3 py-2.5">Details</th>
                  {showBranch && <th className="px-3 py-2.5">Branch</th>}
                  <th className="px-3 py-2.5">By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r._id} className="hover:bg-gray-50 align-top">
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{fmtDate(r.date)}</td>
                    {!productId && (
                      <td className="px-3 py-2.5">
                        <div className="font-medium text-gray-900">{r.productName || '-'}</div>
                        {r.variantLabel && <div className="text-xs text-gray-500">{r.variantLabel}</div>}
                      </td>
                    )}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_STYLE[r.type] || 'bg-gray-100 text-gray-700'}`}>
                        {STOCK_TYPE_LABELS[r.type] || r.type}
                      </span>
                      {productId && r.variantLabel && <div className="mt-1 text-xs text-gray-500">{r.variantLabel}</div>}
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${r.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {r.quantity > 0 ? `+${r.quantity}` : r.quantity}
                      {r.boxes ? (
                        <div className="text-[11px] font-normal text-gray-500">
                          {r.boxes} box{r.boxes === 1 ? '' : 'es'}
                          {r.loosePieces ? ` + ${r.loosePieces}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right text-gray-700">{r.stockAfter ?? '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 min-w-[160px]">
                      {r.otherBranch && (
                        <div>
                          {r.type === 'transfer_out' ? 'To' : 'From'} {r.otherBranch.name}
                        </div>
                      )}
                      {r.batchNo && <div>Batch {r.batchNo}</div>}
                      {r.costPrice != null && r.type !== 'transfer_in' && r.type !== 'transfer_out' && (
                        <div>Cost {formatPrice(r.costPrice)}</div>
                      )}
                      {r.expiryDate && <div>Expiry {new Date(r.expiryDate).toLocaleDateString()}</div>}
                      {r.note && <div className="text-gray-500">{r.note}</div>}
                    </td>
                    {showBranch && <td className="px-3 py-2.5 whitespace-nowrap text-gray-700">{r.branch?.name || '-'}</td>}
                    <td className="px-3 py-2.5 whitespace-nowrap text-gray-600">{r.createdByName || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 && (
        <TablePagination
          page={page}
          pages={pages}
          total={total}
          limit={limit}
          onPageChange={setPage}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          label="entries"
          loading={loading}
        />
      )}
    </div>
  );
}

function axiosCancelled(err: unknown): boolean {
  const e = err as { name?: string; code?: string } | null;
  return !!e && (e.name === 'CanceledError' || e.code === 'ERR_CANCELED' || e.name === 'AbortError');
}
