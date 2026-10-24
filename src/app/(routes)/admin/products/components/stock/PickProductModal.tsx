'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2, Package, Search, X } from 'lucide-react';
import { productService, type ProductUI } from '../../services/productService';

interface Props {
  onPick: (product: { id: string; name: string }) => void;
  onClose: () => void;
}

// "Add stock": search a product (name, short code or barcode), then the
// Receive stock form opens for it.
export default function PickProductModal({ onPick, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ProductUI[]>([]);
  const [loading, setLoading] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    const id = ++reqRef.current;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const list = await productService.listProducts({ search: query.trim() || undefined, page: 1, limit: 20 });
        if (id === reqRef.current) setResults(list);
      } catch {
        if (id === reqRef.current) setResults([]);
      } finally {
        if (id === reqRef.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden mt-10 sm:mt-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h3 className="text-base font-semibold text-gray-900">Add stock: choose a product</h3>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type product name, short code or scan barcode"
              className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-gray-900 focus:border-gray-900"
            />
          </div>
          <div className="max-h-[50vh] overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
            {loading && !results.length ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : !results.length ? (
              <p className="py-8 text-center text-sm text-gray-500">No products found</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick({ id: p.id, name: p.name })}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-gray-50"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <Package className="h-4 w-4 flex-shrink-0 text-gray-400" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-gray-900">{p.name}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {p.category}
                        {p.shortCode ? ` · code ${p.shortCode}` : ''}
                        {p.productType === 'variant' ? ` · ${p.variants?.length || 0} variants` : ''}
                      </span>
                    </span>
                  </span>
                  <span className="flex-shrink-0 text-xs text-gray-600">
                    In stock: <strong className="text-gray-900">{p.stock}</strong>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
