import axios from 'axios';
import { getAuthHeader } from '@/helper/helper';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

// Extra code on a unit (maker's EAN, full-box code...). qty = pieces sold per scan.
export interface ProductBarcodeDTO {
  code: string;
  qty: number;
  label?: string;
}

// A received lot. Stock of a unit with batches = sum of batch quantities.
export interface ProductBatchDTO {
  _id?: string;
  batchNo?: string;
  barcode?: string;
  quantity: number;
  initialQuantity?: number;
  costPrice?: number;
  expiryDate?: string;
  receivedAt?: string;
  note?: string;
  branch?: string | null;
}

export interface ProductVariantDTO {
  variantId?: string;
  color: string;
  size: string;
  attributes?: Record<string, string>;
  price: number;
  stock: number;
  sku?: string;
  costPrice?: number;
  discountedPrice?: number;
  shortCode?: string;
  barcodes?: ProductBarcodeDTO[];
  batches?: ProductBatchDTO[];
  totalStock?: number;
  branchStock?: Array<{ branch: string; stock: number }>;
}

// GET /products/codes/check
export interface CodeCheckResult {
  code: string;
  available: boolean;
  usedBy?: { productId: string; name: string };
}

export interface ColorMediaData {
  thumbnailUrl?: string;
  bannerUrls: string[];
  thumbName?: string;
  videoUrl?: string;
}

export interface ProductDTO {
  _id: string;
  name: string;
  slug?: string;
  category: string;
  price: number;
  discountedPrice?: number;
  costPrice?: number;
  stock: number;
  status: 'published' | 'draft' | 'out_of_stock';
  featured?: boolean;
  thumbnailUrl?: string;
  bannerUrls?: string[];
  videoUrl?: string;
  description?: string;
  shortDescription?: string;
  features?: string;
  productType?: 'single' | 'variant';
  variants?: ProductVariantDTO[];
  colorMedia?: Record<string, ColorMediaData>;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  metaSchema?: string;
  preorderEnabled?: boolean;
  preorderMessage?: string;
  guidelineId?: string;
  guidelineImageUrl?: string;
  showGuidelines?: boolean;
  sku?: string;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
  relatedProducts?: string[];
  createdAt?: string;
  // Barcodes / boxes / batches (single products; variant products keep them per variant)
  shortCode?: string;
  barcodes?: ProductBarcodeDTO[];
  batches?: ProductBatchDTO[];
  piecesPerBox?: number;
  totalStock?: number;
  // Branch that owns the product (only that branch sees it); null = shared.
  ownerBranch?: string | null;
}

export interface ProductUI {
  id: string;
  name: string;
  slug?: string;
  category: string;
  price: number;
  discountedPrice?: number;
  costPrice?: number;
  stock: number;
  status: 'published' | 'draft' | 'out_of_stock';
  featured?: boolean;
  thumbnailUrl?: string;
  bannerUrls?: string[];
  videoUrl?: string;
  description?: string;
  shortDescription?: string;
  features?: string;
  productType?: 'single' | 'variant';
  variants?: ProductVariantDTO[];
  colorMedia?: Record<string, ColorMediaData>;
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  metaSchema?: string;
  preorderEnabled?: boolean;
  preorderMessage?: string;
  guidelineId?: string;
  guidelineImageUrl?: string;
  showGuidelines?: boolean;
  sku?: string;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
  relatedProducts?: string[];
  createdAt?: string;
  // Barcodes / boxes / batches (single products; variant products keep them per variant)
  shortCode?: string;
  barcodes?: ProductBarcodeDTO[];
  batches?: ProductBatchDTO[];
  piecesPerBox?: number;
  totalStock?: number;
  // Branch that owns the product (only that branch sees it); null = shared.
  ownerBranch?: string | null;
}

function mapToUI(dto: ProductDTO): ProductUI {
  const absolutize = (u?: string) => {
    if (!u) return u;
    // Fix corrupted URLs with /https:// or /http://
    if (u.startsWith('/https://') || u.startsWith('/http://')) {
      return u.substring(1);
    }
    if (/^https?:\/\//i.test(u)) return u;
    // ensure API_BASE_URL present and single slash join
    const base = (API_BASE_URL || '').replace(/\/$/, '');
    const path = u.startsWith('/') ? u : `/${u}`;
    return `${base}${path}`;
  };
  const absBanners = (dto.bannerUrls ?? []).map((u) => absolutize(u)!) as string[];
  return {
    id: dto._id,
    name: dto.name,
    slug: dto.slug,
    category: dto.category,
    price: dto.price,
    discountedPrice: dto.discountedPrice,
    costPrice: dto.costPrice,
    stock: dto.stock,
    status: dto.status,
    featured: dto.featured,
    thumbnailUrl: absolutize(dto.thumbnailUrl),
    bannerUrls: absBanners,
    videoUrl: absolutize(dto.videoUrl),
    description: dto.description,
    shortDescription: dto.shortDescription,
    features: dto.features,
    productType: dto.productType,
    variants: dto.variants ?? [],
    // Process colorMedia URLs through absolutize
    colorMedia: dto.colorMedia ? Object.fromEntries(
      Object.entries(dto.colorMedia).map(([color, media]) => [
        color,
        {
          ...media,
          thumbnailUrl: media.thumbnailUrl ? absolutize(media.thumbnailUrl) : undefined,
          bannerUrls: (media.bannerUrls || []).map((url: string) => absolutize(url)!),
          videoUrl: media.videoUrl ? absolutize(media.videoUrl) : undefined,
        }
      ])
    ) : undefined,
    metaTitle: dto.metaTitle,
    metaDescription: dto.metaDescription,
    metaKeywords: dto.metaKeywords,
    metaSchema: dto.metaSchema,
    preorderEnabled: dto.preorderEnabled,
    preorderMessage: dto.preorderMessage,
    guidelineId: dto.guidelineId,
    guidelineImageUrl: dto.guidelineImageUrl,
    showGuidelines: dto.showGuidelines,
    sku: dto.sku,
    dimensionLength: dto.dimensionLength,
    dimensionWidth: dto.dimensionWidth,
    dimensionHeight: dto.dimensionHeight,
    weight: dto.weight,
    relatedProducts: dto.relatedProducts,
    createdAt: dto.createdAt,
    shortCode: dto.shortCode,
    barcodes: dto.barcodes ?? [],
    batches: dto.batches ?? [],
    piecesPerBox: dto.piecesPerBox,
    totalStock: dto.totalStock,
    ownerBranch: dto.ownerBranch ?? null,
  };
}

export interface ProductFilters {
  status?: string;
  category?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductListResponse {
  products: ProductUI[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const productService = {
  async listProducts(filters?: ProductFilters): Promise<ProductUI[]> {
    try {
      // Build query string from filters
      const params = new URLSearchParams();
      if (filters?.status && filters.status !== 'all') {
        params.append('status', filters.status);
      }
      if (filters?.category && filters.category !== 'all') {
        params.append('category', filters.category);
      }
      if (filters?.search) {
        params.append('search', filters.search);
      }
      if (filters?.page) {
        params.append('page', filters.page.toString());
      }
      if (filters?.limit) {
        params.append('limit', filters.limit.toString());
      }

      const queryString = params.toString();
      const url = `${API_BASE_URL}/products${queryString ? `?${queryString}` : ''}`;

      const res = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? res.data ?? [];
      if (Array.isArray(data)) {
        return (data as ProductDTO[]).map(mapToUI);
      }
      return [];
    } catch (err) {
      console.error('Error fetching products:', err);
      throw err;
    }
  },
  async getProductById(id: string): Promise<ProductUI> {
    try {
      const res = await axios.get(`${API_BASE_URL}/products/${id}`, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader(),
        },
      });
      const data = res.data?.data ?? res.data;
      if (!data || typeof data !== 'object') throw new Error('Unexpected getProductById response');
      return mapToUI(data as ProductDTO);
    } catch (err) {
      console.error(`Error fetching product ${id}:`, err);
      throw err;
    }
  },
  // Is this code (short code / barcode) free? excludeId = product being edited.
  async checkCode(code: string, excludeId?: string): Promise<CodeCheckResult> {
    const params = new URLSearchParams({ code });
    if (excludeId) params.append('excludeId', excludeId);
    const res = await axios.get(`${API_BASE_URL}/products/codes/check?${params.toString()}`, {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader(),
      },
    });
    const data = res.data?.data ?? res.data;
    return {
      code: data?.code ?? code,
      available: data?.available !== false,
      usedBy: data?.usedBy,
    };
  },
  async createProduct(formData: FormData): Promise<ProductUI> {
    const res = await axios.post(`${API_BASE_URL}/products`, formData, {
      headers: {
        ...getAuthHeader(),
        // Let axios set the correct multipart boundary automatically
        'Content-Type': 'multipart/form-data',
      },
    });
    const data = res.data?.data ?? res.data;
    if (!data || typeof data !== 'object') throw new Error('Unexpected createProduct response');
    return mapToUI(data as ProductDTO);
  },
  async updateProduct(id: string, formData: FormData): Promise<ProductUI> {
    const res = await axios.put(`${API_BASE_URL}/products/${id}`, formData, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'multipart/form-data',
      },
    });
    const data = res.data?.data ?? res.data;
    if (!data || typeof data !== 'object') throw new Error('Unexpected updateProduct response');
    return mapToUI(data as ProductDTO);
  },
  async deleteProduct(id: string): Promise<void> {
    await axios.delete(`${API_BASE_URL}/products/${id}`, {
      headers: {
        ...getAuthHeader(),
      },
    });
  },
  async toggleProductStatus(id: string, status: 'published' | 'draft'): Promise<ProductUI> {
    try {
      // Try the PATCH endpoint first
      const res = await axios.patch(`${API_BASE_URL}/products/${id}/status`, 
        { status }, 
        {
          headers: {
            'Content-Type': 'application/json',
            ...getAuthHeader(),
          },
        }
      );
      const data = res.data?.data ?? res.data;
      if (!data || typeof data !== 'object') throw new Error('Unexpected toggleProductStatus response');
      return mapToUI(data as ProductDTO);
    } catch (error: any) {
      // If PATCH /status endpoint doesn't exist, try using the general PUT update endpoint
      if (error.response?.status === 404) {
        console.log('Status endpoint not found, trying general update endpoint');
        const formData = new FormData();
        formData.append('status', status);
        
        const res = await axios.put(`${API_BASE_URL}/products/${id}`, formData, {
          headers: {
            ...getAuthHeader(),
            'Content-Type': 'multipart/form-data',
          },
        });
        const data = res.data?.data ?? res.data;
        if (!data || typeof data !== 'object') throw new Error('Unexpected updateProduct response');
        return mapToUI(data as ProductDTO);
      }
      throw error;
    }
  },
  async toggleFeatured(id: string, featured: boolean): Promise<ProductUI> {
    const formData = new FormData();
    formData.append('featured', featured.toString());

    const res = await axios.put(`${API_BASE_URL}/products/${id}`, formData, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'multipart/form-data',
      },
    });
    const data = res.data?.data ?? res.data;
    if (!data || typeof data !== 'object') throw new Error('Unexpected toggleFeatured response');
    return mapToUI(data as ProductDTO);
  },

  async duplicateProduct(id: string): Promise<ProductUI> {
    // Fetch the original product
    const original = await this.getProductById(id);

    // Create FormData for the new product
    const formData = new FormData();

    // Set name with "Copy of" prefix
    formData.append('name', `Copy of ${original.name}`);

    // Generate new slug
    const newSlug = original.slug
      ? `copy-of-${original.slug}-${Date.now()}`
      : `copy-of-${original.name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;
    formData.append('slug', newSlug);

    // Copy all other fields
    formData.append('category', original.category);
    formData.append('price', original.price.toString());
    if (original.discountedPrice) {
      formData.append('discountedPrice', original.discountedPrice.toString());
    }
    formData.append('stock', original.stock.toString());
    formData.append('status', 'draft'); // Always create as draft
    formData.append('featured', 'false'); // Don't copy featured status

    if (original.description) {
      formData.append('description', original.description);
    }
    if (original.shortDescription) {
      formData.append('shortDescription', original.shortDescription);
    }
    if (original.features) {
      formData.append('features', original.features);
    }

    // Copy product type and variants
    formData.append('productType', original.productType || 'single');
    if (original.variants && original.variants.length > 0) {
      // Clear variant IDs and SKUs to generate new ones
      const variantsWithoutIds = original.variants.map(v => ({
        color: v.color,
        size: v.size,
        price: v.price,
        costPrice: v.costPrice,
        stock: v.stock,
        discountedPrice: v.discountedPrice,
      }));
      formData.append('variants', JSON.stringify(variantsWithoutIds));
    }

    // Copy SKU (generate new one by appending -copy)
    // Note: SKU should typically be unique, so we don't copy it directly
    // The backend should generate a new one or the user should set it

    // Copy costPrice
    if (original.costPrice !== undefined && original.costPrice !== null) {
      formData.append('costPrice', original.costPrice.toString());
    }

    // Copy existing image/video URLs directly (backend supports these fields)
    if (original.thumbnailUrl) {
      formData.append('thumbnailUrl', original.thumbnailUrl);
    }
    if (original.bannerUrls && original.bannerUrls.length > 0) {
      formData.append('bannerUrls', JSON.stringify(original.bannerUrls));
    }
    if (original.videoUrl) {
      formData.append('videoUrl', original.videoUrl);
    }
    if (original.colorMedia && Object.keys(original.colorMedia).length > 0) {
      formData.append('colorMedia', JSON.stringify(original.colorMedia));
    }

    // Copy SEO fields
    if (original.metaTitle) {
      formData.append('metaTitle', original.metaTitle);
    }
    if (original.metaDescription) {
      formData.append('metaDescription', original.metaDescription);
    }
    if (original.metaKeywords) {
      formData.append('metaKeywords', original.metaKeywords);
    }
    if (original.metaSchema) {
      formData.append('metaSchema', original.metaSchema);
    }

    // Create the duplicated product
    const res = await axios.post(`${API_BASE_URL}/products`, formData, {
      headers: {
        ...getAuthHeader(),
        'Content-Type': 'multipart/form-data',
      },
    });
    const data = res.data?.data ?? res.data;
    if (!data || typeof data !== 'object') throw new Error('Unexpected duplicateProduct response');
    return mapToUI(data as ProductDTO);
  },
};
