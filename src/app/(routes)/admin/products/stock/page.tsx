'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { RefreshCw, Package, AlertTriangle, Search, ShoppingCart, Printer, PackagePlus, History, X } from 'lucide-react';
import { productService } from '../services/productService';
import ReceiveStockModal from '../components/stock/ReceiveStockModal';
import StockHistoryTable from '../components/stock/StockHistoryTable';
import PickProductModal from '../components/stock/PickProductModal';
import { useAccess } from '@/context/AccessContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useCodeSummaries } from '../components/stock/useCodeSummaries';
import { getPOSOrders } from '../../pos/services/posOrderService';
import toast from 'react-hot-toast';

interface ProductVariant {
  color: string;
  size: string;
  stock: number;
  price: number;
  discountedPrice?: number;
  variantId?: string;
  shortCode?: string;
}

interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  price: number;
  discountedPrice?: number;
  status: 'published' | 'draft' | 'out_of_stock';
  productType?: 'single' | 'variant';
  variants?: ProductVariant[];
  thumbnailUrl?: string;
  colorMedia?: Record<string, { thumbnailUrl?: string; bannerUrls?: string[] }>;
}

interface StockRow {
  productId: string;
  productName: string;
  category: string;
  color: string;
  size: string;
  stock: number;
  sold: number;
  isVariant: boolean;
  status: string;
  imageUrl: string;
  price: number;
  discountedPrice?: number;
  variantId?: string;
  shortCode?: string | null;
  piecesPerBox: number;
  hasBatches: boolean;
}

// Type for tracking sold quantities
interface SoldQuantities {
  // For single products: productId -> quantity
  // For variants: productId-color-size -> quantity
  [key: string]: number;
}

const StockPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [soldQuantities, setSoldQuantities] = useState<SoldQuantities>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [receiveFor, setReceiveFor] = useState<{ id: string; name: string; variantId?: string } | null>(null);
  const codeSummaries = useCodeSummaries(products);
  const { can } = useAccess();
  const { formatPrice } = useCurrency();
  const canReceive = can('stock_receive', 'create');
  const [tab, setTab] = useState<'levels' | 'history'>('levels');
  const [picking, setPicking] = useState(false);
  const [historyFor, setHistoryFor] = useState<{ id: string; name: string; variantId?: string; label?: string } | null>(null);
  const [historyReload, setHistoryReload] = useState(0);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch products and POS sales in parallel
      const [productList, ordersResponse] = await Promise.all([
        productService.listProducts(),
        getPOSOrders(undefined, 1000) // All POS orders, not just today's
      ]);

      setProducts(productList as unknown as Product[]);

      // Calculate sold quantities from POS orders. Labour and outsource lines
      // carry no product, so they are skipped.
      const sold: SoldQuantities = {};
      for (const order of ordersResponse?.orders || []) {
        for (const item of order.items) {
          if (item.isLabour || item.isOutsource) continue;

          const productId = typeof item.product === 'object'
            ? item.product?._id
            : item.product;
          if (!productId) continue;

          // Create key for variant or single product
          const key = item.color && item.size
            ? `${productId}-${item.color}-${item.size}`
            : productId;

          sold[key] = (sold[key] || 0) + item.quantity;

          // Also track total for the product (for single products lookup)
          if (key !== productId) {
            sold[productId] = (sold[productId] || 0) + item.quantity;
          }
        }
      }
      setSoldQuantities(sold);
    } catch (e) {
      console.error('Failed to load products', e);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // Synchronous lock so a double click can't start two reloads
  const refreshLockRef = useRef(false);
  const handleRefresh = async () => {
    if (refreshLockRef.current) return;
    refreshLockRef.current = true;
    setRefreshing(true);
    try {
      await loadProducts();
    } finally {
      refreshLockRef.current = false;
      setRefreshing(false);
    }
  };

  // Helper to get image URL
  const getImageUrl = (url?: string) => {
    if (!url) return '/images/placeholder.png';
    if (url.startsWith('http')) return url;
    return `${process.env.NEXT_PUBLIC_BACKEND_URL || ''}${url}`;
  };

  // Flatten products and variants into rows
  const stockRows: StockRow[] = products.flatMap((product): StockRow[] => {
    const codes = codeSummaries[product.id];
    const piecesPerBox = codes?.piecesPerBox ?? 1;
    const hasBatches = !!codes?.hasBatches;
    if (product.productType === 'variant' && product.variants && product.variants.length > 0) {
      return product.variants.map((variant): StockRow => {
        // Get color-specific image if available
        let imageUrl = product.thumbnailUrl;
        if (variant.color && product.colorMedia?.[variant.color]?.thumbnailUrl) {
          imageUrl = product.colorMedia[variant.color].thumbnailUrl;
        }
        // Get sold quantity for this variant
        const variantKey = `${product.id}-${variant.color}-${variant.size}`;
        const sold = soldQuantities[variantKey] || 0;
        return {
          productId: product.id,
          productName: product.name,
          category: product.category,
          color: variant.color,
          size: variant.size,
          stock: variant.stock,
          sold,
          isVariant: true,
          status: product.status,
          imageUrl: getImageUrl(imageUrl),
          price: variant.price,
          discountedPrice: variant.discountedPrice,
          variantId: variant.variantId,
          shortCode: variant.shortCode || null,
          piecesPerBox,
          hasBatches,
        };
      });
    }
    // Get sold quantity for single product
    const sold = soldQuantities[product.id] || 0;
    return [{
      productId: product.id,
      productName: product.name,
      category: product.category,
      color: '',
      size: '',
      stock: product.stock,
      sold,
      isVariant: false,
      status: product.status,
      imageUrl: getImageUrl(product.thumbnailUrl),
      price: product.price,
      discountedPrice: product.discountedPrice,
      shortCode: codes?.shortCode ?? null,
      piecesPerBox,
      hasBatches,
    }];
  });

  // Filter rows
  const filteredRows = stockRows.filter((row) => {
    // Search filter
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery ||
      row.productName.toLowerCase().includes(searchLower) ||
      row.category.toLowerCase().includes(searchLower) ||
      (row.shortCode?.toLowerCase().includes(searchLower)) ||
      (row.color?.toLowerCase().includes(searchLower)) ||
      (row.size?.toLowerCase().includes(searchLower));

    // Stock filter
    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = row.stock > 0 && row.stock <= 5;
    } else if (stockFilter === 'out') {
      matchesStock = row.stock === 0;
    }

    return matchesSearch && matchesStock;
  });

  // Stats
  const totalItems = stockRows.length;
  const outOfStock = stockRows.filter(r => r.stock === 0).length;
  const lowStock = stockRows.filter(r => r.stock > 0 && r.stock <= 5).length;
  const inStock = stockRows.filter(r => r.stock > 5).length;
  const totalSold = stockRows.reduce((sum, r) => sum + r.sold, 0);

  const getStockBadge = (stock: number) => {
    if (stock === 0) {
      return <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-700 rounded-full">Out of Stock</span>;
    }
    if (stock <= 5) {
      return <span className="px-2 py-1 text-xs font-medium bg-amber-100 text-amber-700 rounded-full">Low Stock</span>;
    }
    return <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">In Stock</span>;
  };

  return (
    <div className="space-y-3 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Stock</h1>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-gray-500">
            Stock levels, add new stock, and the history of every stock change
          </p>
        </div>
        <div className="flex items-center gap-2">
        {canReceive && (
          <button
            onClick={() => setPicking(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-semibold text-white bg-[#dc2626] rounded-lg hover:bg-[#b91c1c] shadow-sm"
          >
            <PackagePlus className="h-4 w-4" />
            Add stock
          </button>
        )}
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          aria-busy={refreshing}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
        </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex rounded-lg bg-gray-100 p-1">
        {([
          ['levels', 'Stock levels'],
          ['history', 'Stock history'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 sm:px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' ? (
        <StockHistoryTable reloadKey={historyReload} />
      ) : (
      <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-4">
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-blue-100 rounded-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-gray-900">{totalItems}</p>
              <p className="text-[10px] sm:text-sm text-gray-500">Total</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-purple-100 rounded-lg">
              <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-purple-600">{totalSold}</p>
              <p className="text-[10px] sm:text-sm text-gray-500">Sold</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-green-100 rounded-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-green-600">{inStock}</p>
              <p className="text-[10px] sm:text-sm text-gray-500">In Stock</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-amber-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-amber-600">{lowStock}</p>
              <p className="text-[10px] sm:text-sm text-gray-500">Low</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-2 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="p-1.5 sm:p-2 bg-red-100 rounded-lg">
              <Package className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
            </div>
            <div>
              <p className="text-lg sm:text-xl font-bold text-red-600">{outOfStock}</p>
              <p className="text-[10px] sm:text-sm text-gray-500">Out</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by product, code, category, color, size..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-honey-500 focus:border-honey-500"
            />
          </div>
          {/* Stock Filter */}
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setStockFilter('all')}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                stockFilter === 'all'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStockFilter('low')}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                stockFilter === 'low'
                  ? 'bg-amber-500 text-white'
                  : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
              }`}
            >
              <span className="hidden sm:inline">Low Stock</span>
              <span className="sm:hidden">Low</span>
            </button>
            <button
              onClick={() => setStockFilter('out')}
              className={`px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors ${
                stockFilter === 'out'
                  ? 'bg-red-500 text-white'
                  : 'bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              <span className="hidden sm:inline">Out of Stock</span>
              <span className="sm:hidden">Out</span>
            </button>
          </div>
        </div>
      </div>

      {/* Stock Table */}
      <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="h-6 w-6 sm:h-8 sm:w-8 animate-spin text-gray-400" />
              <span className="text-xs sm:text-sm text-gray-500">Loading stock data...</span>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="flex items-center justify-center py-12 sm:py-20">
            <div className="text-center">
              <Package className="h-10 w-10 sm:h-12 sm:w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-xs sm:text-sm text-gray-500">No items found</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-16">
                    Image
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Color
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Size
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Sold
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredRows.map((row, index) => (
                  <tr key={`${row.productId}-${row.color || ''}-${row.size || ''}-${index}`} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                        <Image
                          src={row.imageUrl || '/images/placeholder.png'}
                          alt={row.productName}
                          width={48}
                          height={48}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{row.productName}</span>
                      {(row.piecesPerBox > 1 || row.hasBatches) && (
                        <div className="mt-0.5 flex gap-1">
                          {row.piecesPerBox > 1 && (
                            <span className="px-1.5 py-px rounded bg-amber-50 text-amber-700 text-[10px] font-medium">Box of {row.piecesPerBox}</span>
                          )}
                          {row.hasBatches && (
                            <span className="px-1.5 py-px rounded bg-blue-50 text-blue-700 text-[10px] font-medium">Batches</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {row.shortCode ? (
                        <span className="px-1.5 py-0.5 rounded bg-gray-100 font-mono text-xs font-semibold text-gray-800">{row.shortCode}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{row.category}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{row.color || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-sm text-gray-600">{row.size || '-'}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex flex-col items-end">
                        {row.discountedPrice ? (
                          <>
                            <span className="text-sm font-medium text-gray-900">{formatPrice(row.discountedPrice)}</span>
                            <span className="text-xs text-gray-400 line-through">{formatPrice(row.price)}</span>
                          </>
                        ) : (
                          <span className="text-sm font-medium text-gray-900">{formatPrice(row.price)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`text-sm font-bold ${
                        row.stock === 0 ? 'text-red-600' : row.stock <= 5 ? 'text-amber-600' : 'text-green-600'
                      }`}>
                        {row.stock}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      <span className={`text-sm font-bold ${row.sold > 0 ? 'text-purple-600' : 'text-gray-400'}`}>
                        {row.sold}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-center">
                      {getStockBadge(row.stock)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <Link
                          href={`/admin/products/stickers/${row.productId}${row.variantId ? `?variantId=${encodeURIComponent(row.variantId)}` : ''}`}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-honey-600 bg-honey-50 rounded-lg hover:bg-honey-100 transition-colors"
                          title="Print barcode stickers"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Stickers
                        </Link>
                        {canReceive && (
                          <button
                            onClick={() => setReceiveFor({ id: row.productId, name: row.productName, variantId: row.variantId })}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Add new stock (a delivery)"
                          >
                            <PackagePlus className="h-3.5 w-3.5" />
                            Add stock
                          </button>
                        )}
                        <button
                          onClick={() =>
                            setHistoryFor({
                              id: row.productId,
                              name: row.productName,
                              variantId: row.variantId,
                              label: [row.color, row.size].filter(Boolean).join(' / '),
                            })
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                          title="See every stock change of this item, with dates"
                        >
                          <History className="h-3.5 w-3.5" />
                          History
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary */}
      {!loading && filteredRows.length > 0 && (
        <div className="text-xs sm:text-sm text-gray-500 text-center">
          Showing {filteredRows.length} of {totalItems} items
        </div>
      )}
      </>
      )}

      {picking && (
        <PickProductModal
          onClose={() => setPicking(false)}
          onPick={(p) => {
            setPicking(false);
            setReceiveFor({ id: p.id, name: p.name });
          }}
        />
      )}

      {historyFor && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/50 p-3 sm:p-6" onClick={() => setHistoryFor(null)}>
          <div className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-200 bg-white">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-gray-900">Stock history</h3>
                <p className="text-sm text-gray-500 truncate">
                  {historyFor.name}
                  {historyFor.label ? ` · ${historyFor.label}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {canReceive && (
                  <button
                    onClick={() => setReceiveFor({ id: historyFor.id, name: historyFor.name, variantId: historyFor.variantId })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-[#dc2626] rounded-lg hover:bg-[#b91c1c]"
                  >
                    <PackagePlus className="h-4 w-4" />
                    Add stock
                  </button>
                )}
                <button onClick={() => setHistoryFor(null)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-4">
              <StockHistoryTable productId={historyFor.id} variantId={historyFor.variantId} reloadKey={historyReload} />
            </div>
          </div>
        </div>
      )}

      {receiveFor && (
        <ReceiveStockModal
          productId={receiveFor.id}
          productName={receiveFor.name}
          initialVariantId={receiveFor.variantId}
          onClose={(changed) => {
            setReceiveFor(null);
            if (changed) {
              loadProducts();
              setHistoryReload((n) => n + 1);
            }
          }}
        />
      )}
    </div>
  );
};

export default StockPage;
