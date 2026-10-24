"use client";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Image from "next/image";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "react-hot-toast";
import { FiPlus, FiX } from "react-icons/fi";
import type { Product, ProductVariant } from "./AllProducts";
import type { Category } from "./CategoriesTab";
import { slugify, buildVariantCombos, syncVariants, type Variant } from "../services/productCreateService";
import { productService, type ProductUI } from "../services/productService";
import { categoryService } from "../services/categoryService";
import { useCurrency } from "@/context/CurrencyContext";
import { useAccess } from "@/context/AccessContext";
import { ChevronDown, Hash, Loader2 } from "lucide-react";
import PackagingStockCard from "./packaging/PackagingStockCard";
import VariantCodesRow from "./packaging/VariantCodesRow";
import {
  type PackagingState,
  type ProductCodeFields,
  type VariantCodeFields,
  appendPackagingFields,
  computedStock,
  initPackaging,
  normalizeCode,
  readBackendError,
  validatePackaging,
  variantPayload,
} from "./packaging/packagingUtils";

// Guideline type
interface Guideline {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  active: boolean;
}

// Extended Product type with SEO and description fields
interface ExtendedProduct extends Product {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  metaSchema?: string;
  description?: string;
  shortDescription?: string;
  guidelineId?: string;
  sku?: string;
  costPrice?: number;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
  relatedProducts?: string[];
  createdAt?: string;
}

export interface ProductFormData extends Omit<Product, "id"> {
  metaTitle?: string;
  metaDescription?: string;
  metaKeywords?: string;
  metaSchema?: string;
  description?: string;
  shortDescription?: string;
  guidelineId?: string;
  subCategory?: string;
  sku?: string;
  costPrice?: number;
  videoUrl?: string;
  dimensionLength?: string;
  dimensionWidth?: string;
  dimensionHeight?: string;
  weight?: string;
  relatedProducts?: string[];
  compatibleCars?: string[];
}

interface ProductFormProps {
  mode: "create" | "edit";
  initialData?: Product;
  categories: Category[];
  colorOptions: string[];
  sizeOptions: string[];
  guidelines?: Guideline[];
  onSubmit?: (data: ProductFormData) => void;
  onCancel?: () => void;
  // Gets the saved product (create: use its id to open the stickers page)
  onSuccess?: (product?: ProductUI) => void;
  onManageAttributes?: () => void;
}

type VariantWithCodes = ProductVariant & VariantCodeFields;

interface ColorMediaData {
  thumbnailUrl?: string;
  bannerUrls: string[];
  thumbFile?: File;
  bannerFiles?: File[];
  videoUrl?: string;
  videoFile?: File;
  modified?: boolean;
}

const META_TITLE_LIMIT = 60;

// Helper to validate URLs before passing to Image component
const isValidUrl = (url: string | undefined): url is string => {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
const META_DESC_LIMIT = 155;

const initialFormData: ProductFormData = {
  name: "",
  category: "",
  subCategory: "",
  price: 0,
  discountedPrice: undefined,
  costPrice: undefined,
  stock: 0,
  status: "draft",
  thumbnailUrl: "",
  bannerUrls: [],
  videoUrl: "",
  productType: "single",
  variants: [],
  metaTitle: "",
  metaDescription: "",
  metaKeywords: "",
  metaSchema: "",
  description: "",
  shortDescription: "",
  features: "",
  preorderEnabled: false,
  preorderMessage: "",
  guidelineId: "",
  sku: "",
  dimensionLength: "",
  dimensionWidth: "",
  dimensionHeight: "",
  weight: "",
  relatedProducts: [],
  compatibleCars: []
};

// Valid tab keys
// Description, SEO & Meta, Compatible Cars, Pre-Order and Guidelines were removed
// from the form (not used by this shop). Saved values on old products are kept.
type TabKey = "content" | "variant" | "related";
const VALID_TABS: TabKey[] = ["content", "variant", "related"];

export default function ProductForm({
  mode,
  initialData,
  categories: categoriesProp,
  colorOptions,
  sizeOptions,
  guidelines = [],
  onSubmit,
  onCancel,
  onSuccess,
  onManageAttributes
}: ProductFormProps) {
  const { currency } = useCurrency();
  // Categories can be reloaded here after one is added in another tab ("+" button).
  const [categories, setCategories] = useState<Category[]>(categoriesProp);
  useEffect(() => setCategories(categoriesProp), [categoriesProp]);
  const categoriesRef = useRef<Category[]>(categoriesProp);
  categoriesRef.current = categories;
  const waitingForCategoryRef = useRef(false);
  useEffect(() => {
    const onFocus = async () => {
      if (!waitingForCategoryRef.current) return;
      waitingForCategoryRef.current = false;
      try {
        const fresh = ((await categoryService.listCategories()) as unknown as Category[]).filter(
          (c) => c.active !== false
        );
        const known = new Set(categoriesRef.current.map((c) => c.name));
        const added = fresh.filter((c) => !c.parentId && !known.has(c.name));
        setCategories(fresh);
        // Pick the new main category when none is chosen yet.
        if (added.length === 1) {
          setForm((prev) => (prev.category ? prev : { ...prev, category: added[0].name }));
          toast.success(`Category "${added[0].name}" added`);
        }
      } catch {
        toast.error("Could not reload categories");
      }
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // Get valid tabs based on mode (related tab only in edit mode)
  const wasVariant = mode === "edit" && (initialData as { productType?: string } | undefined)?.productType === "variant";
  const effectiveValidTabs: TabKey[] =
    mode === "edit" ? (wasVariant ? VALID_TABS : VALID_TABS.filter((t) => t !== "variant")) : ["content"];

  // Get initial tab from URL or default to "content"
  const getInitialTab = (): TabKey => {
    const tabParam = searchParams.get("tab");
    if (tabParam && effectiveValidTabs.includes(tabParam as TabKey)) {
      return tabParam as TabKey;
    }
    return "content";
  };

  const [form, setForm] = useState<ProductFormData>(initialData ? {
    ...initialData,
    // Add backend URL prefix to image URLs for display (if not already present)
    thumbnailUrl: initialData.thumbnailUrl
      ? (initialData.thumbnailUrl.startsWith('http')
          ? initialData.thumbnailUrl
          : `${process.env.NEXT_PUBLIC_BACKEND_URL}${initialData.thumbnailUrl}`)
      : initialData.thumbnailUrl,
    bannerUrls: Array.isArray(initialData.bannerUrls)
      ? initialData.bannerUrls.map((url: string) =>
          url.startsWith('http')
            ? url
            : `${process.env.NEXT_PUBLIC_BACKEND_URL}${url}`)
      : initialData.bannerUrls,
    metaTitle: (initialData as ExtendedProduct)?.metaTitle || "",
    metaDescription: (initialData as ExtendedProduct)?.metaDescription || "",
    metaKeywords: (initialData as ExtendedProduct)?.metaKeywords || "",
    metaSchema: (initialData as ExtendedProduct)?.metaSchema || "",
    description: (initialData as ExtendedProduct)?.description || "",
    shortDescription: (initialData as ExtendedProduct)?.shortDescription || "",
    features: (initialData as ExtendedProduct)?.features || "",
    preorderEnabled: initialData.preorderEnabled || false,
    preorderMessage: initialData.preorderMessage || "",
    guidelineId: (initialData as ExtendedProduct)?.guidelineId || "",
    subCategory: (initialData as any)?.subCategory || "",
    sku: (initialData as ExtendedProduct)?.sku || "",
    costPrice: (initialData as ExtendedProduct)?.costPrice,
    videoUrl: (initialData as any)?.videoUrl || "",
    dimensionLength: (initialData as ExtendedProduct)?.dimensionLength || "",
    dimensionWidth: (initialData as ExtendedProduct)?.dimensionWidth || "",
    dimensionHeight: (initialData as ExtendedProduct)?.dimensionHeight || "",
    weight: (initialData as ExtendedProduct)?.weight || "",
    relatedProducts: (initialData as ExtendedProduct)?.relatedProducts || []
  } : initialFormData);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<TabKey>(getInitialTab);
  const [isLoading, setIsLoading] = useState(false);
  // Synchronous lock: Enter + click (or a double click) must not create/update the product twice
  const submittingRef = useRef(false);

  // Packaging / barcodes / batches (single products). Edit: loaded from the product.
  const [packaging, setPackaging] = useState<PackagingState>(() =>
    initPackaging(initialData && initialData.productType !== "variant" ? (initialData as unknown as ProductCodeFields) : null)
  );
  // Errors from the backend for a code (409 duplicate / 400 invalid short code)
  const [codeErrors, setCodeErrors] = useState<Record<string, string>>({});
  // Variant rows with the "options & barcodes" row open (key = color|size)
  const [openVariantRows, setOpenVariantRows] = useState<Record<string, boolean>>({});
  const productId = mode === "edit" ? (initialData as Product | undefined)?.id : undefined;
  const savedStock = Number((initialData as Product | undefined)?.stock) || 0;

  // Update URL when tab changes
  const handleTabChange = useCallback((tab: TabKey) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [searchParams, router, pathname]);

  // Sync tab state with URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && effectiveValidTabs.includes(tabParam as TabKey) && tabParam !== activeTab) {
      setActiveTab(tabParam as TabKey);
    }
  }, [searchParams, effectiveValidTabs]);
  
  // File handling state
  const [thumbFile, setThumbFile] = useState<File | null>(null);
  const [bannerFiles, setBannerFiles] = useState<File[]>([]);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  // Removed unused thumbName state

  // Compatible cars (no longer edited here): send back what the product already had
  const selectedCarVariants: string[] = (initialData as any)?.compatibleCars || [];

  // Variant state
  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [colorMedia, setColorMedia] = useState<Record<string, ColorMediaData>>({});

  // Show Guidelines (no longer edited here): keep the product's saved value
  const guidelineEnabled = !!(initialData as any)?.showGuidelines;

  // Product type change confirmation modal
  const [showTypeChangeModal, setShowTypeChangeModal] = useState<{ show: boolean; targetType: 'single' | 'variant' }>({ show: false, targetType: 'single' });

  // Category dropdown state (Select2 style)
  const [categoryDropdownOpen, setCategoryDropdownOpen] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState("");
  const categoryDropdownRef = useRef<HTMLDivElement>(null);

  // Subcategory dropdown state (Select2 style)
  const [subCategoryDropdownOpen, setSubCategoryDropdownOpen] = useState(false);
  const [subCategorySearchQuery, setSubCategorySearchQuery] = useState("");
  const subCategoryDropdownRef = useRef<HTMLDivElement>(null);

  // Variant colors multi-select dropdown state (Select2 style)
  const [variantColorDropdownOpen, setVariantColorDropdownOpen] = useState(false);
  const [variantColorSearchQuery, setVariantColorSearchQuery] = useState("");
  const variantColorDropdownRef = useRef<HTMLDivElement>(null);

  // Variant sizes multi-select dropdown state (Select2 style)
  const [variantSizeDropdownOpen, setVariantSizeDropdownOpen] = useState(false);
  const [variantSizeSearchQuery, setVariantSizeSearchQuery] = useState("");
  const variantSizeDropdownRef = useRef<HTMLDivElement>(null);

  // Related products search state
  const [relatedProductSearch, setRelatedProductSearch] = useState("");
  const [availableProducts, setAvailableProducts] = useState<Array<{ id: string; name: string; thumbnailUrl?: string }>>([]);
  const [relatedProductsLoading, setRelatedProductsLoading] = useState(false);
  const [relatedProductDropdownOpen, setRelatedProductDropdownOpen] = useState(false);
  const relatedProductDropdownRef = useRef<HTMLDivElement>(null);

  // Top-level (parent) categories for Category Select2
  const parentCategories = useMemo(
    () => categories.filter((c) => !c.parentId && c.active !== false),
    [categories]
  );

  const filteredParentCategories = useMemo(() => {
    const q = categorySearchQuery.toLowerCase().trim();
    if (!q) return parentCategories;
    return parentCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [parentCategories, categorySearchQuery]);

  // Children of the currently selected Category, for Subcategory Select2
  const childCategories = useMemo(() => {
    if (!form.category) return [];
    const parent = categories.find((c) => c.name === form.category);
    if (!parent) return [];
    return categories.filter((c) => c.parentId === parent.id && c.active !== false);
  }, [categories, form.category]);

  const filteredChildCategories = useMemo(() => {
    const q = subCategorySearchQuery.toLowerCase().trim();
    if (!q) return childCategories;
    return childCategories.filter((c) => c.name.toLowerCase().includes(q));
  }, [childCategories, subCategorySearchQuery]);

  // Filter colors for variant multi-select
  const filteredVariantColorOptions = useMemo(() => {
    if (!variantColorSearchQuery.trim()) return colorOptions;
    return colorOptions.filter(color =>
      color.toLowerCase().includes(variantColorSearchQuery.toLowerCase())
    );
  }, [colorOptions, variantColorSearchQuery]);

  // Filter sizes for variant multi-select
  const filteredVariantSizeOptions = useMemo(() => {
    if (!variantSizeSearchQuery.trim()) return sizeOptions;
    return sizeOptions.filter(size =>
      size.toLowerCase().includes(variantSizeSearchQuery.toLowerCase())
    );
  }, [sizeOptions, variantSizeSearchQuery]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target as Node)) {
        setCategoryDropdownOpen(false);
        setCategorySearchQuery("");
      }
      if (subCategoryDropdownRef.current && !subCategoryDropdownRef.current.contains(event.target as Node)) {
        setSubCategoryDropdownOpen(false);
        setSubCategorySearchQuery("");
      }
      if (variantColorDropdownRef.current && !variantColorDropdownRef.current.contains(event.target as Node)) {
        setVariantColorDropdownOpen(false);
        setVariantColorSearchQuery("");
      }
      if (variantSizeDropdownRef.current && !variantSizeDropdownRef.current.contains(event.target as Node)) {
        setVariantSizeDropdownOpen(false);
        setVariantSizeSearchQuery("");
      }
      if (relatedProductDropdownRef.current && !relatedProductDropdownRef.current.contains(event.target as Node)) {
        setRelatedProductDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load available products for related products selector
  useEffect(() => {
    const loadProducts = async () => {
      if (mode !== "edit") return;
      setRelatedProductsLoading(true);
      try {
        const products = await productService.listProducts({ limit: 100 });
        // Exclude the current product from the list
        const filtered = products.filter(p => p.id !== initialData?.id);
        setAvailableProducts(filtered.map(p => ({ id: p.id, name: p.name, thumbnailUrl: p.thumbnailUrl })));
      } catch (err) {
        console.error("Error loading products for related products:", err);
      } finally {
        setRelatedProductsLoading(false);
      }
    };
    loadProducts();
  }, [mode, initialData?.id]);

  // Filter available products based on search
  const filteredAvailableProducts = useMemo(() => {
    if (!relatedProductSearch.trim()) return availableProducts;
    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(relatedProductSearch.toLowerCase())
    );
  }, [availableProducts, relatedProductSearch]);

  // Get selected related products with details
  const selectedRelatedProducts = useMemo(() => {
    const relatedIds = form.relatedProducts || [];
    return availableProducts.filter(p => relatedIds.includes(p.id));
  }, [availableProducts, form.relatedProducts]);

  // Handle adding a related product
  const addRelatedProduct = (productId: string) => {
    const current = form.relatedProducts || [];
    if (!current.includes(productId)) {
      setForm(prev => ({ ...prev, relatedProducts: [...current, productId] }));
    }
    setRelatedProductSearch("");
    setRelatedProductDropdownOpen(false);
  };

  // Handle removing a related product
  const removeRelatedProduct = (productId: string) => {
    const current = form.relatedProducts || [];
    setForm(prev => ({ ...prev, relatedProducts: current.filter(id => id !== productId) }));
  };

  // Refs
  const thumbInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const colorThumbRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const colorBannerRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const colorVideoRefs = useRef<Record<string, HTMLInputElement | null>>({});
  
  const isVariant = form.productType === "variant";

  // Branch that gets the stock typed in this form. Super admin picks it (create);
  // branch staff always use their own branch (shown read-only).
  const access = useAccess();
  const branchOptions = access.branches || [];
  const [stockBranchId, setStockBranchId] = useState<string>("");
  useEffect(() => {
    if (stockBranchId || !branchOptions.length) return;
    const preferred =
      access.currentBranchId ||
      branchOptions.find((b) => b.isMain)?.id ||
      branchOptions[0]?.id ||
      "";
    setStockBranchId(preferred);
  }, [access.currentBranchId, branchOptions, stockBranchId]);
  // New single product: pick a free 5-digit short code now, so the form can show
  // the real short code + SKU before saving (backend re-checks on save).
  const pickingCodeRef = useRef(false);
  const [pickingCode, setPickingCode] = useState(false);
  useEffect(() => {
    if (mode !== "create" || isVariant || packaging.shortCode || pickingCodeRef.current) return;
    pickingCodeRef.current = true;
    setPickingCode(true);
    (async () => {
      let picked = "";
      for (let i = 0; i < 8 && !picked; i++) {
        const code = String(10000 + Math.floor(Math.random() * 90000));
        try {
          const res = await productService.checkCode(code);
          if (res.available) picked = code;
        } catch {
          break; // offline / no permission: the backend makes one on save
        }
      }
      if (picked) setPackaging((prev) => (prev.shortCode ? prev : { ...prev, shortCode: picked }));
      pickingCodeRef.current = false;
      setPickingCode(false);
    })();
  }, [mode, isVariant, packaging.shortCode]);
  const nameInitials = (form.name || "")
    .split(" ")
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const autoSku =
    mode === "create" && !isVariant && packaging.shortCode
      ? `${nameInitials || "P"}-${packaging.shortCode}`
      : form.sku || "";

  // Who sees this product. Branch staff: always their own branch only (set by
  // the server). Super admin: "" = every branch (shared) or one branch only.
  const [ownerBranchId, setOwnerBranchId] = useState<string>(() => {
    const raw = (initialData as { ownerBranch?: unknown } | undefined)?.ownerBranch;
    if (!raw) return "";
    if (typeof raw === "object" && raw !== null && "_id" in raw) return String((raw as { _id: unknown })._id);
    return String(raw);
  });
  const ownerBranchName = ownerBranchId
    ? branchOptions.find((b) => b.id === ownerBranchId)?.name || "One branch"
    : "";

  const lockedBranchName = !access.isSuperAdmin
    ? access.branch?.name || access.currentBranch?.name || "Your branch"
    : null;
  const slug = useMemo(() => slugify(form.name), [form.name]);
  
  
  // Helper to clean URL for sending to backend (remove domain, keep relative path)
  const cleanUrlForBackend = (url: string): string => {
    if (!url) return url;
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
    let cleanUrl = url;
    if (backendUrl && cleanUrl.startsWith(backendUrl)) {
      cleanUrl = cleanUrl.replace(backendUrl, '');
    }
    // Don't add '/' prefix to absolute URLs (http/https)
    if (cleanUrl.startsWith('http://') || cleanUrl.startsWith('https://')) {
      return cleanUrl;
    }
    return cleanUrl.startsWith('/') ? cleanUrl : `/${cleanUrl}`;
  };
  // Helper to resolve URLs from backend (handles absolute URLs and corrupted /https:// URLs)
  const resolveBackendUrl = (url: string, backendUrl: string): string => {
    if (!url) return url;
    // Fix corrupted URLs that have /https:// or /http://
    if (url.startsWith('/https://') || url.startsWith('/http://')) {
      return url.substring(1); // Remove the leading /
    }
    // Don't modify absolute URLs
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    // Prepend backendUrl to relative URLs
    return backendUrl ? `${backendUrl}${url}` : url;
  };

  // Initialize form data from initialData for edit mode
  useEffect(() => {
    if (mode === "edit" && initialData) {
      // Extract variants information to set selected colors and sizes
      if (initialData.productType === "variant" && initialData.variants) {
        const colors = Array.from(new Set((initialData.variants as ProductVariant[]).map(v => v.color).filter(Boolean)));
        const sizes = Array.from(new Set((initialData.variants as ProductVariant[]).map(v => v.size).filter(Boolean)));
        setSelectedColors(colors);
        setSelectedSizes(sizes);

        // Initialize colorMedia from existing product data
        if (initialData.colorMedia && typeof initialData.colorMedia === 'object') {
          const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || '';
          const colorMediaData: Record<string, ColorMediaData> = {};
          Object.entries(initialData.colorMedia).forEach(([color, media]) => {
            if (media && typeof media === 'object') {
              colorMediaData[color] = {
                thumbnailUrl: media.thumbnailUrl ? resolveBackendUrl(media.thumbnailUrl, backendUrl) : undefined,
                bannerUrls: Array.isArray(media.bannerUrls)
                  ? media.bannerUrls.map((url: string) => resolveBackendUrl(url, backendUrl))
                  : [],
                bannerFiles: [], // No files initially since these are existing URLs
                videoUrl: (media as any).videoUrl ? resolveBackendUrl((media as any).videoUrl, backendUrl) : undefined,
                modified: false // Mark as not modified initially
              };
            }
          });
          console.log('Initializing colorMedia for edit mode:', colorMediaData);
          setColorMedia(colorMediaData);
        }
      }
    }
  }, [mode, initialData]);
  
  // Build all color-size combinations
  const variantCombos = useMemo(
    () => buildVariantCombos(selectedColors, selectedSizes),
    [selectedColors, selectedSizes]
  );
  
  // Keep form.variants in sync with selections
  useEffect(() => {
    if (!isVariant) return;

    // In edit mode, protect existing variant data by only syncing when actually needed
    if (mode === "edit" && initialData?.variants && Array.isArray(initialData.variants)) {
      const currentVariants = form.variants || [];

      // If we have no current variants but should have them from initialData,
      // or if variantCombos length is 0 (indicating initialization phase), skip
      if (variantCombos.length === 0 || currentVariants.length === 0) {
        return;
      }

      // Check if current variants match the variant combos exactly
      const hasAllCombos = variantCombos.every(combo =>
        currentVariants.some(v => v.color === combo.color && v.size === combo.size)
      );
      const hasExtraVariants = currentVariants.some(v =>
        !variantCombos.some(combo => combo.color === v.color && combo.size === v.size)
      );

      // Only sync if the combinations don't match (user changed color/size selections)
      if (!hasAllCombos || hasExtraVariants) {
        const next = syncVariants((form.variants || []) as unknown as Variant[], variantCombos);
        if (JSON.stringify(next) !== JSON.stringify(form.variants || [])) {
          setField("variants", next as ProductVariant[]);
        }
      }
    } else if (mode === "create") {
      // For create mode, always sync when combinations change
      const next = syncVariants((form.variants || []) as unknown as Variant[], variantCombos);
      if (JSON.stringify(next) !== JSON.stringify(form.variants || [])) {
        setField("variants", next as ProductVariant[]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variantCombos, isVariant, mode]);
  
  const safeRevoke = useCallback((url?: string) => {
    if (url && url.startsWith("blob:")) {
      try { URL.revokeObjectURL(url); } catch {}
    }
  }, []);
  
  const validate = (): { isValid: boolean; errors: Record<string, string> } => {
    const e: Record<string, string> = {};

    // Basic validations
    if (!form.name?.trim()) e.name = "Name is required";
    if (!form.category) e.category = "Category is required";

    if (!isVariant) {
      if (form.stock < 0) e.stock = "Stock cannot be negative";
      // Thumbnail is optional so simple items (pens, cables) can be added quickly.
      // Required fields for single products (SKU is optional: the short code is the main code)
      if (form.costPrice === undefined || form.costPrice === null) e.costPrice = "Cost Price is required";
      if (form.discountedPrice === undefined || form.discountedPrice === null || Number(form.discountedPrice) <= 0) e.discountedPrice = "Sale Price is required";
      // Boxes / batches / short code
      Object.assign(e, validatePackaging(packaging, mode));
    } else {
      if (selectedColors.length === 0 && selectedSizes.length === 0 && (form.variants || []).length === 0) {
        e.colors = "Select at least one color or one size";
      }
    }

    // Dimensions and weight are optional

    setErrors(e);
    return { isValid: Object.keys(e).length === 0, errors: e };
  };

  // Navigation helpers
  const currentTabIndex = effectiveValidTabs.indexOf(activeTab);
  const isLastTab = currentTabIndex === effectiveValidTabs.length - 1;
  const isFirstTab = activeTab === "content";

  const goToNextTab = () => {
    if (currentTabIndex < effectiveValidTabs.length - 1) {
      handleTabChange(effectiveValidTabs[currentTabIndex + 1]);
    }
  };

  const goToPreviousTab = () => {
    if (currentTabIndex > 0) {
      handleTabChange(effectiveValidTabs[currentTabIndex - 1]);
    }
  };
  
  const setField = useCallback(<K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) => {
    setForm((prev) => {
      if (key === 'name' && typeof value === 'string') {
        const metaTitle = prev.metaTitle ? prev.metaTitle : value.slice(0, META_TITLE_LIMIT);
        return { ...prev, [key]: value, metaTitle };
      }
      return { ...prev, [key]: value };
    });
  }, []);

  // Box / batch mode: stock is computed (boxes x pieces + loose, or sum of batches)
  useEffect(() => {
    if (isVariant) return;
    const c = computedStock(packaging);
    if (c !== null && c !== form.stock) setField("stock", c);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packaging, isVariant]);

  const updatePackaging = useCallback((next: PackagingState) => {
    setPackaging(next);
    setCodeErrors((prev) => (prev.shortCode || prev.barcodes ? { ...prev, shortCode: "", barcodes: "" } : prev));
  }, []);

  const updateVariantAt = (index: number, patch: Partial<VariantWithCodes>) => {
    const newVariants = [...((form.variants as VariantWithCodes[]) || [])];
    newVariants[index] = { ...newVariants[index], ...patch };
    setField("variants", newVariants as ProductVariant[]);
    if (codeErrors[`variant-${index}`]) setCodeErrors((prev) => ({ ...prev, [`variant-${index}`]: "" }));
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: "thumbnail" | "banner") => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    
    if (type === "thumbnail") {
      if (form.thumbnailUrl && form.thumbnailUrl.toString().startsWith("blob:")) {
        safeRevoke(form.thumbnailUrl.toString());
      }
      const url = URL.createObjectURL(file);
      setThumbFile(file);
      // Removed setThumbName since it was unused
      setField("thumbnailUrl", url);
      setErrors(prev => ({ ...prev, thumbnail: "" }));
    } else {
      const existing = form.bannerUrls || [];
      if (existing.length >= 10) {
        toast.error("Maximum 10 banner images allowed");
        return;
      }
      const url = URL.createObjectURL(file);
      setField("bannerUrls", [...existing, url]);
      setBannerFiles(prev => [...prev, file]);
    }
  };
  
  const handleMultipleBannerFiles = (files: FileList) => {
    const existing = form.bannerUrls || [];
    const spaceLeft = 5 - existing.length;
    const filesToAdd = Array.from(files).slice(0, spaceLeft);
    
    if (filesToAdd.length < files.length) {
      toast.error(`Only ${spaceLeft} more banner images can be added`);
    }
    
    filesToAdd.forEach(file => {
      if (file.type.startsWith("image/")) {
        const url = URL.createObjectURL(file);
        setField("bannerUrls", [...(form.bannerUrls || []), url]);
        setBannerFiles(prev => [...prev, file]);
      }
    });
  };
  
  const removeBanner = (index: number) => {
    const banners = [...(form.bannerUrls || [])];
    const [removed] = banners.splice(index, 1);
    if (removed) safeRevoke(removed.toString());
    setField("bannerUrls", banners);
    setBannerFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file");
      return;
    }

    // Revoke old video URL if exists
    if (form.videoUrl && form.videoUrl.toString().startsWith("blob:")) {
      safeRevoke(form.videoUrl.toString());
    }
    const url = URL.createObjectURL(file);
    setVideoFile(file);
    setField("videoUrl", url);
  };

  const removeVideo = () => {
    if (form.videoUrl) safeRevoke(form.videoUrl.toString());
    setVideoFile(null);
    setField("videoUrl", "");
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const handleColorVideoFile = (color: string, files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      toast.error("Please upload a video file");
      return;
    }

    setColorMedia((prev) => {
      const prevUrl = prev[color]?.videoUrl;
      if (prevUrl && prevUrl.startsWith("blob:")) {
        safeRevoke(prevUrl);
      }
      const url = URL.createObjectURL(file);
      return {
        ...prev,
        [color]: {
          ...prev[color],
          videoUrl: url,
          videoFile: file,
          bannerUrls: prev[color]?.bannerUrls || [],
          modified: true
        },
      };
    });
  };

  const removeColorVideo = (color: string) => {
    setColorMedia((prev) => {
      const curr = prev[color];
      if (curr?.videoUrl) safeRevoke(curr.videoUrl);
      return {
        ...prev,
        [color]: {
          ...prev[color],
          videoUrl: undefined,
          videoFile: undefined,
          modified: true
        }
      };
    });
    if (colorVideoRefs.current[color]) colorVideoRefs.current[color]!.value = "";
  };

  const handleColorThumbFiles = (color: string, files: FileList | File[]) => {
    const file = Array.from(files)[0];
    if (!file) return;
    
    setColorMedia((prev) => {
      const prevUrl = prev[color]?.thumbnailUrl;
      if (prevUrl && prevUrl.startsWith("blob:")) {
        safeRevoke(prevUrl);
      }
      const url = URL.createObjectURL(file);
      return {
        ...prev,
        [color]: {
          ...prev[color],
          thumbnailUrl: url,
          thumbFile: file,
          bannerUrls: prev[color]?.bannerUrls || [],
          modified: true
        },
      };
    });
  };
  
  const handleColorBannerFiles = (color: string, files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    
    setColorMedia((prev) => {
      const curr = prev[color] || { bannerUrls: [], bannerFiles: [] };
      const existing = curr.bannerUrls || [];
      const existingFiles = curr.bannerFiles || [];
      const spaceLeft = 10 - existing.length;
      const toAdd = incoming.slice(0, Math.max(0, spaceLeft));
      const urls = toAdd.map((f) => URL.createObjectURL(f));
      
      return { 
        ...prev, 
        [color]: { 
          ...curr, 
          bannerUrls: [...existing, ...urls],
          bannerFiles: [...existingFiles, ...toAdd],
          modified: true 
        } 
      };
    });
  };
  
  const removeColorBanner = (color: string, index: number) => {
    setColorMedia((prev) => {
      const banners = [...(prev[color]?.bannerUrls || [])];
      const files = [...(prev[color]?.bannerFiles || [])];
      const [removed] = banners.splice(index, 1);
      files.splice(index, 1);
      if (removed) safeRevoke(removed);
      return { 
        ...prev, 
        [color]: { 
          ...prev[color], 
          bannerUrls: banners,
          bannerFiles: files,
          modified: true 
        } 
      };
    });
  };
  
  const clearColorMedia = (color: string) => {
    setColorMedia((prev) => {
      const curr = prev[color];
      if (curr?.thumbnailUrl) safeRevoke(curr.thumbnailUrl);
      (curr?.bannerUrls || []).forEach(safeRevoke);
      if (curr?.videoUrl) safeRevoke(curr.videoUrl);
      return {
        ...prev,
        [color]: { bannerUrls: [], bannerFiles: [], videoUrl: undefined, videoFile: undefined, modified: true }
      };
    });
    if (colorThumbRefs.current[color]) colorThumbRefs.current[color]!.value = "";
    if (colorBannerRefs.current[color]) colorBannerRefs.current[color]!.value = "";
    if (colorVideoRefs.current[color]) colorVideoRefs.current[color]!.value = "";
  };
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    const validation = validate();
    if (!validation.isValid) {
      const errs = validation.errors;
      // Navigate to the tab with the first error
      if (errs.colors || errs.sizes) {
        handleTabChange("variant");
        toast.error(errs.colors || errs.sizes);
      } else if (errs.name || errs.category || errs.price || errs.stock || errs.costPrice || errs.discountedPrice || errs.piecesPerBox || errs.boxes || errs.batches || errs.shortCode) {
        handleTabChange("content");
        toast.error("Please fix the errors in Product Details tab");
      } else if (errs.thumbnail) {
        handleTabChange(isVariant ? "variant" : "content");
        toast.error(errs.thumbnail);
      }
      return;
    }
    
    submittingRef.current = true;
    setIsLoading(true);
    try {
      const fallbackMetaTitle = (form.metaTitle || form.name || "").slice(0, META_TITLE_LIMIT);
      
      const formData = new FormData();
      
      // Basic fields
      formData.append("name", form.name);
      formData.append("slug", slug);
      formData.append("category", form.category);
      if (form.subCategory) {
        formData.append("subCategory", form.subCategory);
      }
      // Only "Sale Price" is typed: it is both the price and the sale price.
      formData.append("price", String(form.discountedPrice ?? form.price ?? 0));
      if (form.discountedPrice !== undefined && form.discountedPrice !== null) {
        formData.append("discountedPrice", String(form.discountedPrice));
      }
      // Super admin creating a product: stock goes to the branch picked in the form
      if (mode === "create" && access.isSuperAdmin && stockBranchId) {
        formData.append("stockBranchId", stockBranchId);
      }
      // Super admin: shared ("") or one branch only. Ignored by the server for staff.
      if (access.isSuperAdmin) {
        formData.append("ownerBranch", ownerBranchId);
      }
      formData.append("stock", String(form.stock ?? 0));
      formData.append("status", form.status);
      formData.append("productType", form.productType || "single");

      // Compatible cars (always send, even empty array, so edit can clear them)
      formData.append("compatibleCars", JSON.stringify(selectedCarVariants));

      // Description fields
      formData.append("description", form.description || "");
      formData.append("shortDescription", form.shortDescription || "");

      // Features as a simple string
      formData.append("features", form.features || "");

      // Preorder fields
      formData.append("preorderEnabled", String(form.preorderEnabled || false));
      formData.append("preorderMessage", form.preorderMessage || "");

      formData.append("showGuidelines", String(guidelineEnabled));

      // SKU: on create the one shown in the form (name initials + short code);
      // on edit the saved one is sent back unchanged.
      if (!isVariant && mode === "create" && autoSku) {
        formData.append("sku", autoSku);
      } else if (!isVariant && mode === "edit" && form.sku?.trim()) {
        formData.append("sku", form.sku.trim());
      }

      // Boxes / batches / barcodes / short code (single products).
      // Overrides `stock` when it is computed from boxes or batches.
      if (!isVariant) {
        appendPackagingFields(formData, packaging, mode);
      }

      // Cost Price for single products
      if (!isVariant && form.costPrice !== undefined && form.costPrice !== null) {
        formData.append("costPrice", String(form.costPrice));
      }


      // SEO fields
      formData.append("metaTitle", fallbackMetaTitle);
      formData.append("metaDescription", form.metaDescription || "");
      formData.append("metaKeywords", form.metaKeywords || "");
      formData.append("metaSchema", form.metaSchema || "");

      // Related products (only in edit mode)
      if (mode === "edit" && form.relatedProducts && form.relatedProducts.length > 0) {
        formData.append("relatedProducts", JSON.stringify(form.relatedProducts));
      }

      if (isVariant && form.variants) {
        // Handle variant products
        const variantStock = form.variants.reduce((sum, v) => sum + (Number((v as ProductVariant).stock) || 0), 0);
        const basePrice = (form.variants[0] as ProductVariant)?.discountedPrice ?? (form.variants[0] as ProductVariant)?.price ?? 0;
        formData.set("stock", String(variantStock));
        formData.set("price", String(basePrice));
        // Drop view-only fields (branchStock / totalStock) and clean options + barcodes
        formData.append("variants", JSON.stringify((form.variants as VariantWithCodes[]).map((v) => variantPayload(v as unknown as Record<string, unknown>))));
        
        // Handle color-specific media
        console.log('Processing colorMedia for submission:', colorMedia);
        
        // If no colorMedia exists but we have variants, ensure each color gets processed
        if (Object.keys(colorMedia).length === 0 && selectedColors.length > 0) {
          console.log('No colorMedia found, but have selected colors:', selectedColors);
          // Initialize empty colorMedia for each selected color
          selectedColors.forEach(color => {
            if (!colorMedia[color]) {
              colorMedia[color] = { bannerUrls: [], modified: false };
            }
          });
        }
        
        for (const [color, media] of Object.entries(colorMedia)) {
          console.log(`Processing color ${color}:`, media);
          
          // Always process media in edit mode, regardless of modified status
          if (mode === "edit" || media.modified) {
            // Send new thumbnail file if uploaded
            if (media.thumbFile) {
              const thumbFileName = `${color}_${media.thumbFile.name}`;
              const renamedThumbFile = new File([media.thumbFile], thumbFileName, { type: media.thumbFile.type });
              formData.append("colorThumbnail", renamedThumbFile);
            } else if (media.thumbnailUrl && !media.thumbnailUrl.startsWith('blob:')) {
              // Keep existing thumbnail if no new file uploaded
              const cleanUrl = cleanUrlForBackend(media.thumbnailUrl);
              formData.append("existingColorThumbnails", JSON.stringify({ color, url: cleanUrl }));
            }
            
            // Send new banner files if uploaded
            if (media.bannerFiles && media.bannerFiles.length > 0) {
              media.bannerFiles.forEach((file, index) => {
                const bannerFileName = `${color}_${index}_${file.name}`;
                const renamedBannerFile = new File([file], bannerFileName, { type: file.type });
                formData.append("colorBanner", renamedBannerFile);
              });
            }

            // Always send existing banner URLs in edit mode
            const existingBanners = (media.bannerUrls || []).filter(url =>
              typeof url === 'string' && !url.startsWith('blob:')
            );
            if (existingBanners.length > 0) {
              const cleanUrls = existingBanners.map(cleanUrlForBackend);
              formData.append("existingColorBanners", JSON.stringify({ color, urls: cleanUrls }));
            }

            // Send new video file if uploaded
            if (media.videoFile) {
              const videoFileName = `${color}_${media.videoFile.name}`;
              const renamedVideoFile = new File([media.videoFile], videoFileName, { type: media.videoFile.type });
              formData.append("colorVideo", renamedVideoFile);
            } else if (media.videoUrl && !media.videoUrl.startsWith('blob:')) {
              // Keep existing video if no new file uploaded
              const cleanUrl = cleanUrlForBackend(media.videoUrl);
              formData.append("existingColorVideos", JSON.stringify({ color, url: cleanUrl }));
            }
          }
        }
      } else {
        // Handle single products
        if (thumbFile) formData.append("thumbnail", thumbFile);
        bannerFiles.forEach((f) => formData.append("banners", f));
        if (videoFile) formData.append("video", videoFile);
      }
      
      // For edit mode, preserve existing images and video
      if (mode === "edit" && initialData) {
        if (!isVariant) {
          if (!thumbFile && initialData.thumbnailUrl) {
            // Clean the thumbnail URL to get relative path
            const cleanThumbUrl = cleanUrlForBackend(form.thumbnailUrl || initialData.thumbnailUrl);
            formData.append("existingThumbnail", cleanThumbUrl);
          }
          // Send the current banner URLs (which may have been modified by removal)
          // Filter out blob URLs and only keep actual server URLs
          const existingServerBanners = (form.bannerUrls || []).filter(url =>
            typeof url === 'string' && !url.startsWith('blob:')
          ).map(cleanUrlForBackend);
          if (existingServerBanners.length > 0 || bannerFiles.length > 0) {
            formData.append("existingBanners", JSON.stringify(existingServerBanners));
          }
          // Preserve existing video if no new video uploaded
          if (!videoFile && form.videoUrl && !form.videoUrl.startsWith('blob:')) {
            const cleanVideoUrl = cleanUrlForBackend(form.videoUrl);
            formData.append("existingVideo", cleanVideoUrl);
          }
        }
      }
      
      let saved: ProductUI;
      if (mode === "create") {
        saved = await productService.createProduct(formData);
      } else {
        saved = await productService.updateProduct((initialData as Product).id, formData);
      }
      
      if (onSubmit) {
        const submitData: ProductFormData = {
          ...form,
          slug,
          metaTitle: fallbackMetaTitle,
          metaDescription: form.metaDescription || "",
          metaKeywords: form.metaKeywords || "",
          metaSchema: form.metaSchema || ""
        };
        onSubmit(submitData);
      }
      
      toast.success(mode === "create" ? "Product successfully added and saved." : "Product successfully updated and saved.");

      if (mode === "create") {
        // Reset form
        setForm(initialFormData);
        setSelectedColors([]);
        setSelectedSizes([]);
        setColorMedia({});
        setThumbFile(null);
        setBannerFiles([]);
        setVideoFile(null);
        // Removed setThumbName since it was unused
        if (thumbInputRef.current) thumbInputRef.current.value = "";
        if (bannerInputRef.current) bannerInputRef.current.value = "";
        if (videoInputRef.current) videoInputRef.current.value = "";
        setPackaging(initPackaging(null));
      }
      setCodeErrors({});
      
      if (onSuccess) onSuccess(saved);
      
    } catch (error) {
      console.error(`Error ${mode === "create" ? "creating" : "updating"} product:`, error);
      const be = readBackendError(error);
      const dupCode = normalizeCode(be?.duplicateCode);
      if (
        be && be.status === 409 && mode === "create" && !isVariant && dupCode &&
        (dupCode === normalizeCode(packaging.shortCode) || dupCode === normalizeCode(autoSku))
      ) {
        setPackaging((prev) => ({ ...prev, shortCode: "" })); // effect above picks a new one
        toast.error("That code was just used by another product. A new code was picked - please click Create Product again.");
      } else if (be && (be.status === 409 || be.code === "INVALID_SHORT_CODE") && (be.duplicateCode || be.code === "INVALID_SHORT_CODE")) {
        // Show the message next to the field that holds the code
        const dup = normalizeCode(be.duplicateCode);
        const next: Record<string, string> = {};
        let tab: TabKey = "content";
        if (be.code === "INVALID_SHORT_CODE") {
          next.shortCode = be.message || "Short code must be 3 to 8 digits";
        } else if (!isVariant) {
          if (dup && normalizeCode(packaging.shortCode) === dup) next.shortCode = be.message;
          else if (packaging.barcodes.some((b) => normalizeCode(b.code) === dup)) next.barcodes = be.message;
          else if (dup && normalizeCode(form.sku) === dup) next.sku = be.message;
          else if (packaging.trackBatches) next.batches = be.message;
          else next.barcodes = be.message;
        } else {
          tab = "variant";
          const idx = ((form.variants as VariantWithCodes[]) || []).findIndex(
            (v) =>
              normalizeCode(v.shortCode) === dup ||
              normalizeCode(v.sku) === dup ||
              (v.barcodes || []).some((b) => normalizeCode(b.code) === dup)
          );
          if (idx >= 0) {
            next[`variant-${idx}`] = be.message;
            const v = (form.variants as VariantWithCodes[])[idx];
            setOpenVariantRows((prev) => ({ ...prev, [`${v.color}|${v.size}`]: true }));
          }
        }
        setCodeErrors(next);
        handleTabChange(tab);
        toast.error(be.message || "This code is already used by another product");
      } else if (be && be.message && be.status && be.status < 500) {
        toast.error(be.message);
      } else {
        toast.error(`Failed to ${mode} product`);
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };
  
  
  return (
    <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200">
      <form onSubmit={handleSubmit} aria-busy={isLoading}>
       {/* While saving, every field / tab / button in the form is disabled */}
       <fieldset disabled={isLoading} className="min-w-0">
        {/* Tabs Navigation (hidden when there is only one step) */}
        {effectiveValidTabs.length > 1 && (
        <div className="border-b border-gray-200">
          <nav className="flex gap-1 px-2 sm:px-3 md:px-4 pt-2 sm:pt-3 md:pt-4 overflow-x-auto" aria-label="Tabs">
            {[
              {
                key: "content",
                label: "Product Details",
                icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4",
              },
              {
                key: "variant",
                label: "Product Variant",
                icon: "M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z",
              },
              ...(mode === "edit" ? [{
                key: "related",
                label: "Related Products",
                icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
              }] : []),
            ].filter((t) => effectiveValidTabs.includes(t.key as TabKey)).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTabChange(t.key as TabKey)}
                className={`group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 text-xs sm:text-sm font-medium rounded-t-lg transition-all duration-200 whitespace-nowrap ${
                  activeTab === t.key
                    ? "text-gray-900 bg-gray-100 border-b-2 border-gray-900"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                <svg className={`w-4 h-4 ${activeTab === t.key ? 'text-gray-900' : 'text-gray-400 group-hover:text-gray-500'}`}
                     fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={t.icon} />
                </svg>
                <span>{t.label}</span>
              </button>
            ))}
          </nav>
        </div>
        )}

        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">

        {/* CONTENT TAB */}
        {activeTab === "content" && (
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            {/* Basic Info Section */}
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3 md:mb-4">Basic Information</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Premium Compression T-Shirt"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    URL Slug
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={slug}
                    className="block w-full rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500"
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-generated from product name</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700">
                      Category <span className="text-red-500">*</span>
                    </label>
                    {access.can("product_categories", "create") && (
                      <a
                        href="/admin/products/categories/create?from=product"
                        target="_blank"
                        rel="noopener"
                        onClick={() => {
                          waitingForCategoryRef.current = true;
                        }}
                        title="Add a new category (opens in a new tab, your product form stays here)"
                        className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-2 py-0.5 text-xs font-medium text-gray-700 hover:border-gray-900 hover:text-gray-900"
                      >
                        <FiPlus className="h-3.5 w-3.5" />
                        Add
                      </a>
                    )}
                  </div>
                  <div className="relative" ref={categoryDropdownRef}>
                    <div
                      className={`flex items-center justify-between w-full rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                        categoryDropdownOpen
                          ? 'border-gray-900 ring-1 ring-gray-900'
                          : errors.category
                            ? 'border-red-300'
                            : 'border-gray-300 hover:border-gray-400'
                      }`}
                      onClick={() => setCategoryDropdownOpen(!categoryDropdownOpen)}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {form.category ? (
                          <span className="text-sm text-gray-900 truncate">{form.category}</span>
                        ) : (
                          <span className="text-sm text-gray-400">Select a category</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {form.category && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setField("category", "");
                              setField("subCategory", "");
                            }}
                            className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                          >
                            <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${categoryDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {categoryDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                        <div className="p-2 border-b border-gray-100">
                          <div className="relative">
                            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                            <input
                              type="text"
                              placeholder="Search categories..."
                              value={categorySearchQuery}
                              onChange={(e) => setCategorySearchQuery(e.target.value)}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                              autoFocus
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto">
                          {filteredParentCategories.length > 0 ? (
                            filteredParentCategories.map((cat) => (
                              <div
                                key={cat.id}
                                className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                  form.category === cat.name
                                    ? 'bg-honey-50 text-gray-900'
                                    : 'hover:bg-gray-50 text-gray-700'
                                }`}
                                onClick={() => {
                                  if (form.category !== cat.name) {
                                    setField("category", cat.name);
                                    setField("subCategory", "");
                                  }
                                  setCategoryDropdownOpen(false);
                                  setCategorySearchQuery("");
                                }}
                              >
                                <span className="text-sm flex-1">{cat.name}</span>
                                {form.category === cat.name && (
                                  <svg className="w-4 h-4 text-honey-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                              No categories found
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
                </div>

                {form.category && childCategories.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Subcategory
                    </label>
                    <div className="relative" ref={subCategoryDropdownRef}>
                      <div
                        className={`flex items-center justify-between w-full rounded-lg border px-3 py-2.5 cursor-pointer transition-all duration-200 ${
                          subCategoryDropdownOpen
                            ? 'border-gray-900 ring-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => setSubCategoryDropdownOpen(!subCategoryDropdownOpen)}
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {form.subCategory ? (
                            <span className="text-sm text-gray-900 truncate">{form.subCategory}</span>
                          ) : (
                            <span className="text-sm text-gray-400">Select a subcategory</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {form.subCategory && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setField("subCategory", "");
                              }}
                              className="p-0.5 hover:bg-gray-100 rounded-full transition-colors"
                            >
                              <svg className="w-4 h-4 text-gray-400 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          <svg
                            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${subCategoryDropdownOpen ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </div>

                      {subCategoryDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search subcategories..."
                                value={subCategorySearchQuery}
                                onChange={(e) => setSubCategorySearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                                autoFocus
                              />
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            {filteredChildCategories.length > 0 ? (
                              filteredChildCategories.map((cat) => (
                                <div
                                  key={cat.id}
                                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                    form.subCategory === cat.name
                                      ? 'bg-honey-50 text-gray-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={() => {
                                    setField("subCategory", cat.name);
                                    setSubCategoryDropdownOpen(false);
                                    setSubCategorySearchQuery("");
                                  }}
                                >
                                  <span className="text-sm flex-1">{cat.name}</span>
                                  {form.subCategory === cat.name && (
                                    <svg className="w-4 h-4 text-honey-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                No subcategories found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Pricing Section */}
            <div className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-6">
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-2 sm:mb-3 md:mb-4">Pricing & Stock</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Sale Price ({currency.symbol}) {!isVariant && <span className="text-red-500">*</span>}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currency.symbol}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={isVariant || packaging.soldAs === "box"}
                      placeholder="0.00"
                      className={`block w-full rounded-lg border pl-7 pr-3 py-2 text-sm ${
                        isVariant || packaging.soldAs === "box"
                          ? 'bg-gray-50 text-gray-400 cursor-not-allowed border-gray-300'
                          : errors.discountedPrice ? 'border-red-300 text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900' : 'border-gray-300 text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                      }`}
                      value={isVariant ? "" : (form.discountedPrice ?? "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        const n = val === "" ? undefined : Number(val);
                        setForm((prev) => ({ ...prev, discountedPrice: n, price: n ?? 0 }));
                      }}
                    />
                  </div>
                  {errors.discountedPrice && <p className="mt-1 text-sm text-red-600">{errors.discountedPrice}</p>}
                  {isVariant && <p className="mt-1 text-xs text-gray-500">Set prices per variant</p>}
                  {!isVariant && packaging.soldAs === "box" && <p className="mt-1 text-xs text-gray-500">Set per piece in the Box section below</p>}
                </div>

                {!isVariant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Cost Price ({currency.symbol}) <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">{currency.symbol}</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        disabled={packaging.soldAs === "box"}
                        className={`block w-full rounded-lg border pl-7 pr-3 py-2 text-sm placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors ${errors.costPrice ? 'border-red-300' : 'border-gray-300'} ${packaging.soldAs === "box" ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : 'text-gray-900'}`}
                        value={form.costPrice ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          setField("costPrice", val === "" ? undefined : Number(val));
                        }}
                      />
                    </div>
                    {errors.costPrice && <p className="mt-1 text-sm text-red-600">{errors.costPrice}</p>}
                    {packaging.soldAs === "box" && <p className="mt-1 text-xs text-gray-500">Set per piece in the Box section below</p>}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Stock Quantity
                  </label>
                  {(() => {
                    // Box / batch mode: stock is calculated in "Packaging & Stock" below
                    const stockLocked = isVariant || computedStock(packaging) !== null;
                    return (
                      <>
                        <input
                          type="number"
                          min="0"
                          disabled={stockLocked}
                          placeholder="0"
                          className={`block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm ${
                            stockLocked
                              ? 'bg-gray-50 text-gray-400 cursor-not-allowed'
                              : 'text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900'
                          }`}
                          value={isVariant ? 0 : form.stock}
                          onChange={(e) => setField("stock", Number(e.target.value))}
                        />
                        {errors.stock && <p className="mt-1 text-sm text-red-600">{errors.stock}</p>}
                        {isVariant && <p className="mt-1 text-xs text-gray-500">Auto-calculated from variants</p>}
                        {!isVariant && stockLocked && (
                          <p className="mt-1 text-xs text-gray-500">
                            {packaging.trackBatches ? "Total of this item's saved batches" : "Calculated from boxes below"}
                          </p>
                        )}
                        {!isVariant && !stockLocked && mode === "edit" && (
                          <p className="mt-1 text-xs text-gray-500">Pieces in the branch you are working in</p>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-colors"
                    value={form.status}
                    onChange={(e) => setField("status", e.target.value as ProductFormData["status"])}
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>

              </div>

              {/* Branch / SKU / Short code (SKU + short code are made automatically) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Branch</label>
                  {mode === "create" && access.isSuperAdmin ? (
                    <select
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      value={stockBranchId}
                      onChange={(e) => setStockBranchId(e.target.value)}
                    >
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name || b.code || "Branch"}{b.isMain ? " (main)" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                      value={
                        lockedBranchName ||
                        access.currentBranch?.name ||
                        (mode === "edit" ? "All branches (pick one in the header to edit its stock)" : "")
                      }
                    />
                  )}
                  <p className="mt-1 text-xs text-gray-500">The stock you enter goes to this branch</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Who can see this product</label>
                  {access.isSuperAdmin ? (
                    <select
                      className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                      value={ownerBranchId}
                      onChange={(e) => setOwnerBranchId(e.target.value)}
                    >
                      <option value="">All branches</option>
                      {branchOptions.map((b) => (
                        <option key={b.id} value={b.id}>
                          {(b.name || b.code || "Branch") + " only"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      readOnly
                      className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600 cursor-not-allowed"
                      value={
                        mode === "create" || ownerBranchId
                          ? `${lockedBranchName || "Your branch"} only`
                          : "All branches"
                      }
                    />
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    {access.isSuperAdmin
                      ? ownerBranchId
                        ? `Only ${ownerBranchName} and you can see it`
                        : "Every branch can see and sell it"
                      : "Products you add are only seen by your branch"}
                  </p>
                </div>

                {!isVariant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                    <input
                      type="text"
                      readOnly
                      className="block w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-mono text-gray-600 cursor-not-allowed"
                      value={autoSku || (pickingCode ? "Creating…" : "Created when saved")}
                    />
                  </div>
                )}

                {!isVariant && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Short code</label>
                    <div className="flex h-[38px] items-center gap-2">
                      {packaging.shortCode ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-honey-200 bg-honey-50 px-2.5 py-1 text-sm font-mono font-semibold text-honey-600">
                          <Hash className="h-3.5 w-3.5" />
                          {packaging.shortCode}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-sm text-gray-500">
                          {pickingCode && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          {pickingCode ? "Creating…" : "Created when saved"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Printed under the barcode on the sticker</p>
                  </div>
                )}
              </div>

              {/* Packaging & Stock: boxes, batches, barcodes, short code (single products) */}
              {!isVariant && (
                <div className="mt-3 sm:mt-4 md:mt-6">
                  <PackagingStockCard
                    value={packaging}
                    onChange={updatePackaging}
                    mode={mode}
                    productId={productId}
                    errors={{
                      piecesPerBox: errors.piecesPerBox || "",
                      boxes: errors.boxes || "",
                      batches: errors.batches || codeErrors.batches || "",
                      shortCode: errors.shortCode || codeErrors.shortCode || "",
                      barcodes: codeErrors.barcodes || "",
                    }}
                    currencySymbol={currency.symbol}
                    defaultCostPrice={form.costPrice}
                    savedStock={savedStock}
                    salePrice={form.discountedPrice}
                    costPrice={form.costPrice}
                    onPricesChange={({ salePrice, costPrice }) =>
                      setForm((prev) => ({ ...prev, discountedPrice: salePrice, price: salePrice ?? 0, costPrice }))
                    }
                    priceErrors={{ salePrice: errors.discountedPrice, costPrice: errors.costPrice }}
                  />
                </div>
              )}

              {/* Single Product Images */}
              {!isVariant && (
                <div className="border-t border-gray-200 pt-3 sm:pt-4 md:pt-6 space-y-3 sm:space-y-4 md:space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-4">
                    {/* Thumbnail */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-sm font-medium text-gray-700">
                          Thumbnail <span className="text-gray-400 font-normal">(Optional)</span>
                        </label>
                      </div>
                      <input
                        ref={thumbInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(e, "thumbnail")}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => thumbInputRef.current?.click()}
                        className={`relative w-full aspect-[4/5] rounded-lg border border-dashed transition-colors overflow-hidden group ${
                          errors.thumbnail
                            ? 'border-red-300 bg-red-50'
                            : 'border-gray-300 hover:border-gray-900 bg-gray-50 hover:bg-white'
                        }`}
                      >
                        {isValidUrl(form.thumbnailUrl?.toString()) ? (
                          <>
                            <Image
                              src={form.thumbnailUrl!.toString()}
                              alt="Thumbnail"
                              fill
                              className="object-cover"
                              unoptimized
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                              <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                                Change
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-900 transition-colors">
                            <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs">Upload</span>
                          </div>
                        )}
                      </button>
                      <p className="mt-1 text-[11px] text-gray-400">380 × 480px</p>
                      {errors.thumbnail && <p className="mt-1 text-xs text-red-600">{errors.thumbnail}</p>}
                    </div>

                  </div>

                </div>
              )}

              {/* Date Added (shown only in edit mode) */}
              {mode === "edit" && (initialData as ExtendedProduct)?.createdAt && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Date Added
                  </label>
                  <input
                    type="text"
                    disabled
                    className="block w-full sm:w-1/3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
                    value={new Date((initialData as ExtendedProduct).createdAt!).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  />
                  <p className="mt-1 text-xs text-gray-500">Auto-generated when product was created</p>
                </div>
              )}

            </div>
          </div>
        )}

        {/* PRODUCT VARIANT TAB */}
        {activeTab === "variant" && (
          <div className="space-y-3 sm:space-y-4 md:space-y-6">

            {/* Product Type Section */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-4">Product Type</h4>
              {mode === 'edit' && (
                <p className="mb-3 text-xs text-amber-600">
                  {isVariant
                    ? 'Switching to single product will remove all variants'
                    : 'Switching to variant product will require adding color/size variants'}
                </p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`relative flex rounded-lg border p-3 transition-all cursor-pointer ${
                  !isVariant
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="productType"
                    value="single"
                    checked={!isVariant}
                    onChange={() => {
                      if (mode === 'edit' && isVariant) {
                        setShowTypeChangeModal({ show: true, targetType: 'single' });
                      } else {
                        setField("productType", "single");
                        setSelectedColors([]);
                        setSelectedSizes([]);
                        setField("variants", []);
                      }
                    }}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                      !isVariant ? 'border-gray-900' : 'border-gray-300'
                    }`}>
                      {!isVariant && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Single Product</div>
                      <div className="text-xs text-gray-500">One price, one stock level</div>
                    </div>
                  </div>
                </label>
                <label className={`relative flex rounded-lg border p-3 transition-all cursor-pointer ${
                  isVariant
                    ? 'border-gray-900 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                  }`}>
                  <input
                    type="radio"
                    name="productType"
                    value="variant"
                    checked={isVariant}
                    onChange={() => {
                      if (mode === 'edit' && !isVariant) {
                        setShowTypeChangeModal({ show: true, targetType: 'variant' });
                      } else {
                        setField("productType", "variant");
                      }
                    }}
                    className="sr-only"
                  />
                  <div className="flex items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                      isVariant ? 'border-gray-900' : 'border-gray-300'
                    }`}>
                      {isVariant && <div className="w-2 h-2 bg-gray-900 rounded-full" />}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">Variant Product</div>
                      <div className="text-xs text-gray-500">Multiple colors & sizes</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Variant Configuration */}
            {isVariant && (
              <div className="border-t border-gray-200 pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Variant Options</h4>
                  <p className="mt-0.5 text-xs text-gray-500">Pick colors, sizes, or both. Phones: pick colors, then set Storage / RAM per variant with the options button.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Colors</label>
                      {onManageAttributes && (
                        <button
                          type="button"
                          onClick={onManageAttributes}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                    {/* Select2-style multi-select for colors */}
                    <div className="relative" ref={variantColorDropdownRef}>
                      <div
                        className={`min-h-[42px] flex flex-wrap items-center gap-1.5 w-full rounded-lg border px-2 py-1.5 cursor-pointer transition-all duration-200 ${
                          variantColorDropdownOpen
                            ? 'border-gray-900 ring-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => setVariantColorDropdownOpen(!variantColorDropdownOpen)}
                      >
                        {selectedColors.length > 0 ? (
                          <>
                            {selectedColors.map((color) => (
                              <span
                                key={color}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-honey-100 text-charcoal text-sm rounded-md"
                              >
                                <span
                                  className="w-3 h-3 rounded-full border border-gray-200 flex-shrink-0"
                                  style={{ backgroundColor: color.toLowerCase() }}
                                />
                                {color}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedColors(selectedColors.filter(c => c !== color));
                                  }}
                                  className="hover:text-red-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 py-1">Select colors...</span>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${variantColorDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Dropdown menu */}
                      {variantColorDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                          {/* Search input */}
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search colors..."
                                value={variantColorSearchQuery}
                                onChange={(e) => setVariantColorSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Options list */}
                          <div className="max-h-60 overflow-y-auto">
                            {filteredVariantColorOptions.length > 0 ? (
                              filteredVariantColorOptions.map((color) => (
                                <div
                                  key={color}
                                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                    selectedColors.includes(color)
                                      ? 'bg-honey-50 text-gray-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedColors.includes(color)) {
                                      setSelectedColors(selectedColors.filter(c => c !== color));
                                    } else {
                                      setSelectedColors([...selectedColors, color]);
                                    }
                                  }}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    selectedColors.includes(color) ? 'border-honey-500 bg-honey-500' : 'border-gray-300'
                                  }`}>
                                    {selectedColors.includes(color) && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span
                                    className="w-5 h-5 rounded-full border border-gray-200 flex-shrink-0"
                                    style={{ backgroundColor: color.toLowerCase() }}
                                  />
                                  <span className="text-sm">{color}</span>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                No colors found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.colors && <p className="mt-1 text-sm text-red-600">{errors.colors}</p>}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-sm font-medium text-gray-700">Sizes</label>
                      {onManageAttributes && (
                        <button
                          type="button"
                          onClick={onManageAttributes}
                          className="text-xs text-gray-600 hover:text-gray-900"
                        >
                          Manage
                        </button>
                      )}
                    </div>
                    {/* Select2-style multi-select for sizes */}
                    <div className="relative" ref={variantSizeDropdownRef}>
                      <div
                        className={`min-h-[42px] flex flex-wrap items-center gap-1.5 w-full rounded-lg border px-2 py-1.5 cursor-pointer transition-all duration-200 ${
                          variantSizeDropdownOpen
                            ? 'border-gray-900 ring-1 ring-gray-900'
                            : 'border-gray-300 hover:border-gray-400'
                        }`}
                        onClick={() => setVariantSizeDropdownOpen(!variantSizeDropdownOpen)}
                      >
                        {selectedSizes.length > 0 ? (
                          <>
                            {selectedSizes.map((size) => (
                              <span
                                key={size}
                                className="inline-flex items-center gap-1.5 px-2 py-1 bg-honey-100 text-charcoal text-sm rounded-md"
                              >
                                {size}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedSizes(selectedSizes.filter(s => s !== size));
                                  }}
                                  className="hover:text-red-600 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </span>
                            ))}
                          </>
                        ) : (
                          <span className="text-sm text-gray-400 py-1">Select sizes...</span>
                        )}
                        <svg
                          className={`w-5 h-5 text-gray-400 ml-auto flex-shrink-0 transition-transform duration-200 ${variantSizeDropdownOpen ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      {/* Dropdown menu */}
                      {variantSizeDropdownOpen && (
                        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg overflow-hidden">
                          {/* Search input */}
                          <div className="p-2 border-b border-gray-100">
                            <div className="relative">
                              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                              <input
                                type="text"
                                placeholder="Search sizes..."
                                value={variantSizeSearchQuery}
                                onChange={(e) => setVariantSizeSearchQuery(e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-400"
                                autoFocus
                              />
                            </div>
                          </div>

                          {/* Options list */}
                          <div className="max-h-60 overflow-y-auto">
                            {filteredVariantSizeOptions.length > 0 ? (
                              filteredVariantSizeOptions.map((size) => (
                                <div
                                  key={size}
                                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                                    selectedSizes.includes(size)
                                      ? 'bg-honey-50 text-gray-900'
                                      : 'hover:bg-gray-50 text-gray-700'
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (selectedSizes.includes(size)) {
                                      setSelectedSizes(selectedSizes.filter(s => s !== size));
                                    } else {
                                      setSelectedSizes([...selectedSizes, size]);
                                    }
                                  }}
                                >
                                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                                    selectedSizes.includes(size) ? 'border-honey-500 bg-honey-500' : 'border-gray-300'
                                  }`}>
                                    {selectedSizes.includes(size) && (
                                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                  <span className="text-sm">{size}</span>
                                </div>
                              ))
                            ) : (
                              <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                No sizes found
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                    {errors.sizes && <p className="mt-1 text-sm text-red-600">{errors.sizes}</p>}
                  </div>
                </div>

                {/* Variants Table */}
                {variantCombos.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Variant Pricing & Stock</label>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Color</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Size</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Cost ({currency.symbol})</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Sale Price ({currency.symbol})</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stock</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Options &amp; Codes</th>
                            <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {(form.variants as ProductVariant[] || []).map((variant: ProductVariant, index: number) => {
                            const vc = variant as VariantWithCodes;
                            const rowKey = `${variant.color}|${variant.size}`;
                            const rowOpen = !!openVariantRows[rowKey] || !!codeErrors[`variant-${index}`];
                            const hasBatches = (vc.batches || []).length > 0;
                            const optionText = Object.values(vc.attributes || {}).filter(Boolean).join(" / ");
                            const extraCount = (vc.barcodes || []).filter((b) => b.label !== "full-box").length;
                            return (
                            <React.Fragment key={rowKey}>
                            <tr>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                                {variant.color || <span className="text-gray-400">—</span>}
                                {vc.shortCode && (
                                  <span className="mt-1 flex w-fit items-center gap-0.5 rounded bg-honey-50 px-1.5 py-0.5 text-[11px] font-mono font-semibold text-honey-600">
                                    <Hash className="h-3 w-3" />{vc.shortCode}
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">{variant.size || <span className="text-gray-400">—</span>}</td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <span className="text-xs font-mono text-gray-500">{variant.sku || "Auto"}</span>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  value={(variant as any).costPrice ?? ""}
                                  onChange={(e) => {
                                    const newVariants = [...(form.variants as ProductVariant[] || [])];
                                    newVariants[index] = { ...variant, costPrice: e.target.value ? Number(e.target.value) : undefined } as ProductVariant;
                                    setField("variants", newVariants);
                                  }}
                                  className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                />
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={variant.discountedPrice || ""}
                                  onChange={(e) => {
                                    const newVariants = [...(form.variants as ProductVariant[] || [])];
                                    const newDiscountedPrice = e.target.value ? Number(e.target.value) : undefined;
                                    newVariants[index] = { ...variant, discountedPrice: newDiscountedPrice, price: newDiscountedPrice ?? 0 };
                                    setField("variants", newVariants);
                                  }}
                                  className="w-20 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm"
                                />
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="0"
                                  value={variant.stock || ""}
                                  disabled={hasBatches}
                                  title={hasBatches ? "Stock comes from this variant's batches" : undefined}
                                  onChange={(e) => {
                                    const newVariants = [...(form.variants as ProductVariant[] || [])];
                                    newVariants[index] = { ...variant, stock: Number(e.target.value) };
                                    setField("variants", newVariants);
                                  }}
                                  className={`w-16 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 text-sm ${hasBatches ? 'bg-gray-50 text-gray-400 cursor-not-allowed' : ''}`}
                                />
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setOpenVariantRows((prev) => ({ ...prev, [rowKey]: !rowOpen }))}
                                  className={`inline-flex max-w-[180px] items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors ${
                                    rowOpen ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                                  }`}
                                >
                                  <span className="truncate">
                                    {optionText || (extraCount ? `${extraCount} barcode${extraCount > 1 ? 's' : ''}` : 'Add')}
                                  </span>
                                  <ChevronDown className={`h-3.5 w-3.5 flex-shrink-0 transition-transform ${rowOpen ? 'rotate-180' : ''}`} />
                                </button>
                              </td>
                              <td className="px-3 py-3 whitespace-nowrap">
                                {index === 0 && (form.variants as ProductVariant[] || []).length > 1 && (
                                  <button
                                    type="button"
                                    title="Apply all values to other variants"
                                    onClick={() => {
                                      const firstVariant = (form.variants as ProductVariant[])[0] as any;
                                      const newVariants = (form.variants as ProductVariant[]).map((v) => ({
                                        ...v,
                                        price: firstVariant.price,
                                        costPrice: firstVariant.costPrice,
                                        discountedPrice: firstVariant.discountedPrice,
                                        stock: firstVariant.stock,
                                      }));
                                      setField("variants", newVariants);
                                    }}
                                    className="p-2 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M8 2a1 1 0 000 2h2a1 1 0 100-2H8z" />
                                      <path d="M3 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v6h-4.586l1.293-1.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L10.414 13H15v3a2 2 0 01-2 2H5a2 2 0 01-2-2V5zM15 11h2a1 1 0 110 2h-2v-2z" />
                                    </svg>
                                  </button>
                                )}
                              </td>
                            </tr>
                            {rowOpen && (
                              <VariantCodesRow
                                colSpan={8}
                                variant={vc}
                                productId={productId}
                                error={codeErrors[`variant-${index}`]}
                                otherCodesInForm={((form.variants as VariantWithCodes[]) || [])
                                  .filter((_, i) => i !== index)
                                  .flatMap((o) => [o.shortCode || "", o.sku || "", ...(o.barcodes || []).map((b) => b.code)])
                                  .filter(Boolean)}
                                onChange={(patch) => updateVariantAt(index, patch)}
                              />
                            )}
                            </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Color-specific images for variant products */}
                {selectedColors.length > 0 && (
                  <div className="border-t border-gray-200 pt-6 space-y-4">
                    <h4 className="text-sm font-medium text-gray-900">Color-Specific Images</h4>
                    {selectedColors.map((color) => (
                      <div key={color} className="border border-gray-200 rounded-lg p-4 bg-white">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-gray-700 flex items-center gap-2 text-sm">
                            <span className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: color.toLowerCase() }}></span>
                            {color}
                          </h5>
                          <button
                            type="button"
                            onClick={() => clearColorMedia(color)}
                            className="text-xs text-red-500 hover:text-red-700 font-medium"
                          >
                            Clear all
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-4">
                          {/* Thumbnail */}
                          <div>
                            <label className="text-xs font-medium text-gray-600 mb-1 block">Thumbnail</label>
                            <input
                              ref={(el) => { colorThumbRefs.current[color] = el; }}
                              type="file"
                              accept="image/*"
                              onChange={(e) => { if (e.target.files) handleColorThumbFiles(color, e.target.files); }}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => colorThumbRefs.current[color]?.click()}
                              className="relative w-full aspect-[4/5] rounded-lg border border-dashed border-gray-300 hover:border-gray-900 bg-gray-50 hover:bg-white transition-colors overflow-hidden group"
                            >
                              {isValidUrl(colorMedia[color]?.thumbnailUrl) ? (
                                <>
                                  <Image src={colorMedia[color].thumbnailUrl!} alt={`${color} thumbnail`} fill className="object-cover" unoptimized />
                                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                                    <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity">Change</span>
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-900 transition-colors">
                                  <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  <span className="text-xs">Upload</span>
                                </div>
                              )}
                            </button>
                            <p className="mt-1 text-[11px] text-gray-400">380 × 480px</p>
                          </div>

                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>
        )}

        {/* RELATED PRODUCTS TAB */}
        {activeTab === "related" && mode === "edit" && (
          <div className="space-y-3 sm:space-y-4 md:space-y-6">
            <div>
              <h4 className="text-xs sm:text-sm font-medium text-gray-900 mb-1.5 sm:mb-2">Related Products</h4>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4">
                Select products that are related to this product. These will be displayed as suggestions to customers.
              </p>

              {/* Search and Select Products */}
              <div ref={relatedProductDropdownRef} className="relative">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search Products
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search products..."
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
                    value={relatedProductSearch}
                    onChange={(e) => {
                      setRelatedProductSearch(e.target.value);
                      setRelatedProductDropdownOpen(true);
                    }}
                    onFocus={() => setRelatedProductDropdownOpen(true)}
                  />
                  <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Dropdown */}
                {relatedProductDropdownOpen && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {relatedProductsLoading ? (
                      <div className="p-3 text-center text-sm text-gray-500">Loading products...</div>
                    ) : filteredAvailableProducts.length === 0 ? (
                      <div className="p-3 text-center text-sm text-gray-500">
                        {relatedProductSearch ? "No products found" : "No products available"}
                      </div>
                    ) : (
                      filteredAvailableProducts
                        .filter(p => !(form.relatedProducts || []).includes(p.id))
                        .slice(0, 10)
                        .map((product) => (
                          <button
                            key={product.id}
                            type="button"
                            onClick={() => addRelatedProduct(product.id)}
                            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 text-left"
                          >
                            {product.thumbnailUrl ? (
                              <Image
                                src={product.thumbnailUrl}
                                alt={product.name}
                                width={32}
                                height={32}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <span className="text-sm text-gray-900 truncate">{product.name}</span>
                          </button>
                        ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Related Products */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Products ({selectedRelatedProducts.length})
                </label>
                {selectedRelatedProducts.length === 0 ? (
                  <div className="border border-dashed border-gray-300 rounded-lg p-6 text-center">
                    <svg className="mx-auto w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm text-gray-500">No related products selected</p>
                    <p className="text-xs text-gray-400 mt-1">Use the search above to add products</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedRelatedProducts.map((product) => (
                      <div
                        key={product.id}
                        className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg group"
                      >
                        {product.thumbnailUrl ? (
                          <Image
                            src={product.thumbnailUrl}
                            alt={product.name}
                            width={40}
                            height={40}
                            className="rounded object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center flex-shrink-0">
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                        <span className="text-sm text-gray-900 truncate flex-1">{product.name}</span>
                        <button
                          type="button"
                          onClick={() => removeRelatedProduct(product.id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Remove"
                        >
                          <FiX className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        </div>

        {/* Actions */}
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg sm:rounded-b-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3 md:gap-4">
            <p className="text-xs sm:text-sm text-gray-500">
              {isLastTab
                ? (mode === "create" ? "Fill in the details and create your product" : "Update the product information")
                : `Step ${currentTabIndex + 1} of ${effectiveValidTabs.length}: ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
            </p>
            <div className="flex items-center gap-2 sm:gap-3">
              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isLoading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  Cancel
                </button>
              )}
              {/* Previous Button */}
              {!isFirstTab && (
                <button
                  type="button"
                  onClick={goToPreviousTab}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>
              )}
              {/* Next Button - shown when not on last tab (create mode only) */}
              {!isLastTab && mode === "create" && (
                <button
                  type="button"
                  onClick={goToNextTab}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  Next
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              )}
              {/* Create/Update Button - shown on last tab (create) or every tab (edit) */}
              {(isLastTab || mode === "edit") && (
                <button
                  type="submit"
                  disabled={isLoading}
                  aria-busy={isLoading}
                  className="inline-flex items-center gap-2 px-6 py-2 text-sm font-semibold text-white bg-honey-500 rounded-lg hover:bg-honey-600 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {mode === "create" ? "Creating product…" : "Updating product…"}
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mode === "create" ? "M12 6v6m0 0v6m0-6h6m-6 0H6" : "M5 13l4 4L19 7"} />
                      </svg>
                      {mode === "create" ? "Create Product" : "Update Product"}
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
       </fieldset>
      </form>

      {/* Product Type Change Confirmation Modal */}
      {showTypeChangeModal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowTypeChangeModal({ show: false, targetType: 'single' })}
          />
          <div className="relative bg-white rounded-lg sm:rounded-xl shadow-2xl max-w-md w-full mx-4 p-3 sm:p-4 md:p-6 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <svg className="w-4 h-4 sm:w-5 sm:h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                {showTypeChangeModal.targetType === 'single' ? 'Switch to Single Product?' : 'Switch to Variant Product?'}
              </h3>
            </div>
            <p className="text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
              {showTypeChangeModal.targetType === 'single'
                ? 'This will permanently remove all color/size variants and their associated images. This action cannot be undone.'
                : 'This will convert the product to a variant product. You will need to add color and size options.'}
            </p>
            <div className="flex gap-2 sm:gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowTypeChangeModal({ show: false, targetType: 'single' })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (showTypeChangeModal.targetType === 'single') {
                    setField("productType", "single");
                    setSelectedColors([]);
                    setSelectedSizes([]);
                    setField("variants", []);
                    setColorMedia({});
                  } else {
                    setField("productType", "variant");
                  }
                  setShowTypeChangeModal({ show: false, targetType: 'single' });
                }}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                  showTypeChangeModal.targetType === 'single'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {showTypeChangeModal.targetType === 'single' ? 'Yes, Remove Variants' : 'Yes, Switch to Variant'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}