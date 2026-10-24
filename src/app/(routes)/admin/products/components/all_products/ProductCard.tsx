"use client";
import React, { useState, useMemo } from "react";
import Image from "next/image";
import { Edit2, Trash2, Star, Layers, Package, AlertTriangle, ChevronLeft, ChevronRight, Tag, Copy, Eye, X, Printer, PackagePlus, Barcode, Loader2 } from "lucide-react";
import { Product } from "../AllProducts";
import { useCurrency } from "@/context/CurrencyContext";
import { useAccess } from "@/context/AccessContext";
import type { CodeSummary } from "../../services/labelService";

interface ProductCardProps {
  product: Product;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  onCopy?: (id: string) => void;
  onToggleStatus?: (id: string, newStatus: 'published' | 'draft') => Promise<void>;
  onToggleFeatured?: (id: string) => void;
  togglingStatus: Set<string>;
  copyingProduct?: Set<string>;
  deletingProduct?: Set<string>;
  featuringProduct?: Set<string>;
  handleToggleStatus: (productId: string, currentStatus: 'published' | 'draft' | 'out_of_stock') => Promise<void>;
  /** short code / box / batches info for the badges */
  codeSummary?: CodeSummary;
  onStickers?: (id: string) => void;
  onReceiveStock?: (id: string) => void;
}

export default function ProductCard({
  product,
  onEdit,
  onDelete,
  onCopy,
  onToggleStatus,
  onToggleFeatured,
  togglingStatus,
  copyingProduct = new Set(),
  deletingProduct = new Set(),
  featuringProduct = new Set(),
  handleToggleStatus,
  codeSummary,
  onStickers,
  onReceiveStock
}: ProductCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showStockModal, setShowStockModal] = useState(false);
  const { formatPrice } = useCurrency();
  const access = useAccess();
  const ownerBranchLabel = product.ownerBranch
    ? (access.branches || []).find((b) => b.id === String(product.ownerBranch))?.name ||
      access.branch?.name ||
      "Branch"
    : "";
  const isToggling = togglingStatus.has(product.id);
  const isCopying = copyingProduct.has(product.id);
  const isDeleting = deletingProduct.has(product.id);
  const isFeaturing = featuringProduct.has(product.id);
  // Any server action running on this card blocks the others (e.g. no delete while duplicating)
  const cardBusy = isToggling || isCopying || isDeleting || isFeaturing;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-700";
      case "draft":
        return "bg-yellow-100 text-yellow-700";
      case "out_of_stock":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const formatStatus = (status: string) =>
    status
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

  // Get all images for the slider
  const productImages = useMemo(() => {
    const images: { url: string; color?: string }[] = [];

    if (product.productType === "variant" && product.colorMedia) {
      // For variant products, collect all color thumbnails
      Object.entries(product.colorMedia).forEach(([color, media]) => {
        if (media.thumbnailUrl) {
          images.push({ url: media.thumbnailUrl, color });
        }
      });
    } else {
      // For single products
      if (product.thumbnailUrl) {
        images.push({ url: product.thumbnailUrl });
      } else if (product.bannerUrls && product.bannerUrls.length > 0) {
        product.bannerUrls.forEach(url => images.push({ url }));
      } else if (product.image) {
        images.push({ url: product.image });
      }
    }

    return images;
  }, [product]);

  const hasMultipleImages = productImages.length > 1;
  const variantCount = product.variants?.length || 0;
  const colorCount = product.colorMedia ? Object.keys(product.colorMedia).length : 0;

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? productImages.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev === productImages.length - 1 ? 0 : prev + 1));
  };

  const currentImage = productImages[currentImageIndex];

  return (
    <div className="bg-white rounded border border-gray-200 overflow-hidden hover:shadow-sm transition-all duration-200 group">
      {/* Product Image */}
      <div className="relative aspect-square bg-gray-100">
        {productImages.length > 0 && currentImage ? (
          <>
            <Image
              src={currentImage.url.startsWith('/') ? `${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001'}${currentImage.url}` : currentImage.url}
              alt={`${product.name}${currentImage.color ? ` - ${currentImage.color}` : ''}`}
              fill
              className="object-cover"
            />
            {hasMultipleImages && (
              <>
                <button onClick={handlePrevImage} className="absolute left-0.5 top-1/2 -translate-y-1/2 p-0.5 bg-white/80 hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <ChevronLeft className="h-2.5 w-2.5 text-gray-700" />
                </button>
                <button onClick={handleNextImage} className="absolute right-0.5 top-1/2 -translate-y-1/2 p-0.5 bg-white/80 hover:bg-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <ChevronRight className="h-2.5 w-2.5 text-gray-700" />
                </button>
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5 px-1 py-px bg-black/40 rounded-full z-10">
                  {productImages.map((_, index) => (
                    <button key={index} onClick={(e) => { e.stopPropagation(); setCurrentImageIndex(index); }} className={`w-1 h-1 rounded-full ${index === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <Package className="h-5 w-5 text-gray-300" />
          </div>
        )}
        {product.productType === "variant" && (
          <div className={`absolute ${hasMultipleImages ? 'bottom-6' : 'bottom-1'} left-1 flex items-center gap-0.5 px-1 py-px bg-purple-600 text-white text-[8px] font-medium rounded-full`}>
            <Layers className="h-2 w-2" />
            {colorCount > 0 ? `${colorCount}C` : `${variantCount}V`}
          </div>
        )}
        {product.featured && (
          <div className="absolute top-1 left-1 p-0.5 bg-yellow-500 rounded-full">
            <Star className="h-2 w-2 text-white fill-current" />
          </div>
        )}
        <div className={`absolute top-1 right-1 px-1 py-px text-[7px] font-medium rounded ${getStatusColor(product.status)}`}>
          {product.status === 'published' ? 'Live' : product.status === 'draft' ? 'Draft' : 'OOS'}
        </div>
        {product.stock > 0 && product.stock <= 5 && !hasMultipleImages && (
          <div className="absolute bottom-1 right-1 px-1 py-px bg-red-500 text-white text-[7px] font-medium rounded">Low</div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-1.5">
        <h3 className="text-[10px] font-medium text-gray-900 truncate" title={product.name}>{product.name}</h3>
        {ownerBranchLabel && (
          <span
            className="inline-block mt-0.5 px-1 py-px rounded bg-amber-50 text-amber-700 border border-amber-200 text-[8px] font-medium"
            title="Only this branch (and the super admin) can see this product"
          >
            {ownerBranchLabel} only
          </span>
        )}
        <div className="flex items-center justify-between mt-0.5">
          <span className="text-[8px] text-gray-500 truncate max-w-[60%]">{product.category}</span>
          <span className="text-[8px] text-gray-400">{product.stock}</span>
        </div>
        {codeSummary && (codeSummary.shortCode || codeSummary.piecesPerBox > 1 || codeSummary.hasBatches) && (
          <div className="flex flex-wrap items-center gap-0.5 mt-0.5">
            {codeSummary.shortCode && (
              <span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-gray-100 text-gray-700 font-mono text-[8px] font-semibold" title="Short code (type or scan this at the till)">
                <Barcode className="h-2 w-2" />
                {codeSummary.shortCode}
              </span>
            )}
            {codeSummary.piecesPerBox > 1 && (
              <span className="px-1 py-px rounded bg-amber-50 text-amber-700 text-[8px] font-medium">Box of {codeSummary.piecesPerBox}</span>
            )}
            {codeSummary.hasBatches && (
              <span className="px-1 py-px rounded bg-blue-50 text-blue-700 text-[8px] font-medium">Batches</span>
            )}
          </div>
        )}
        <div className="mt-0.5">
          {product.productType === "variant" && product.variants && product.variants.length > 0 ? (
            <span className="text-[10px] font-semibold text-gray-900">{formatPrice(Math.min(...product.variants.map(v => v.price)))}</span>
          ) : (
            <span className="text-[10px] font-semibold text-gray-900">{formatPrice(product.price)}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-1 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-0.5">
            {/* Status Toggle */}
            {onToggleStatus && product.status !== 'out_of_stock' && (
              <button
                onClick={() => handleToggleStatus(product.id, product.status)}
                disabled={cardBusy}
                aria-busy={isToggling}
                className={`
                  relative inline-flex h-4 w-7 items-center rounded-full transition-colors focus:outline-none
                  ${product.status === 'published' ? 'bg-green-500' : 'bg-gray-300'}
                  cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed
                `}
                title={isToggling ? 'Updating status…' : `Click to ${product.status === 'published' ? 'unpublish' : 'publish'}`}
              >
                <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform ${product.status === 'published' ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                {isToggling && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-2.5 w-2.5 animate-spin text-white" />
                  </div>
                )}
              </button>
            )}
            {/* Featured Toggle */}
            <button
              title={isFeaturing ? "Saving…" : product.featured ? "Remove from featured" : "Make featured"}
              onClick={() => onToggleFeatured?.(product.id)}
              disabled={cardBusy}
              aria-busy={isFeaturing}
              className={`p-0.5 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${product.featured ? "text-yellow-500 bg-yellow-50 hover:bg-yellow-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}
            >
              {isFeaturing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Star className={`h-3 w-3 ${product.featured ? 'fill-current' : ''}`} />}
            </button>
          </div>
          <div className="flex items-center">
            {product.productType === "variant" && product.variants && product.variants.length > 0 && (
              <button className="p-0.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" onClick={() => setShowStockModal(true)} title="View variant stock">
                <Eye className="h-3 w-3" />
              </button>
            )}
            <button
              className="p-0.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => onCopy?.(product.id)}
              disabled={cardBusy}
              aria-busy={isCopying}
              title={isCopying ? "Duplicating…" : "Duplicate product"}
            >
              {isCopying ? <Loader2 className="h-3 w-3 animate-spin text-blue-500" /> : <Copy className="h-3 w-3" />}
            </button>
            <button className="p-0.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed" onClick={() => onEdit?.(product.id)} disabled={isDeleting} title="Edit product">
              <Edit2 className="h-3 w-3" />
            </button>
            <button
              className="p-0.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={() => onDelete?.(product.id)}
              disabled={cardBusy}
              aria-busy={isDeleting}
              title={isDeleting ? "Deleting…" : "Delete product"}
            >
              {isDeleting ? <Loader2 className="h-3 w-3 animate-spin text-red-500" /> : <Trash2 className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {/* Stickers / stock */}
        {(onStickers || onReceiveStock) && (
          <div className="grid grid-cols-2 gap-0.5 mt-1">
            {onStickers && (
              <button
                onClick={() => onStickers(product.id)}
                className="inline-flex items-center justify-center gap-0.5 py-0.5 text-[8px] font-medium text-honey-600 bg-honey-50 hover:bg-honey-100 rounded transition-colors"
                title="Print barcode stickers"
              >
                <Printer className="h-2.5 w-2.5" />
                Stickers
              </button>
            )}
            {onReceiveStock && (
              <button
                onClick={() => onReceiveStock(product.id)}
                className="inline-flex items-center justify-center gap-0.5 py-0.5 text-[8px] font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                title="Add new stock (a delivery)"
              >
                <PackagePlus className="h-2.5 w-2.5" />
                Receive
              </button>
            )}
          </div>
        )}
      </div>

      {/* Variant Stock Modal */}
      {showStockModal && product.variants && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowStockModal(false)}>
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-gray-900">Variant Stock</h3>
                <p className="text-xs sm:text-sm text-gray-500 truncate max-w-[250px]">{product.name}</p>
              </div>
              <button
                onClick={() => setShowStockModal(false)}
                className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-3 sm:p-4 overflow-y-auto max-h-[60vh]">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="pb-2">Color</th>
                    <th className="pb-2">Size</th>
                    <th className="pb-2 text-right">Stock</th>
                    <th className="pb-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {product.variants.map((variant, index) => (
                    <tr key={index} className="text-sm">
                      <td className="py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-gray-200"
                            style={{ backgroundColor: variant.color?.toLowerCase() }}
                          />
                          {variant.color}
                        </span>
                      </td>
                      <td className="py-2 text-gray-600">{variant.size}</td>
                      <td className="py-2 text-right">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          variant.stock === 0
                            ? 'bg-red-100 text-red-700'
                            : variant.stock <= 5
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                        }`}>
                          {variant.stock}
                        </span>
                      </td>
                      <td className="py-2 text-right text-gray-900 font-medium">
                        {formatPrice(variant.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Total Stock */}
              <div className="mt-4 pt-3 border-t border-gray-200 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-700">Total Stock</span>
                <span className="text-lg font-semibold text-gray-900">
                  {product.variants.reduce((sum, v) => sum + (v.stock || 0), 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
