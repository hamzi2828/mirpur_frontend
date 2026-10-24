'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Activity, Loader2, Search, X, ChevronLeft, ChevronRight, RefreshCw,
  LogIn, ShoppingCart, Heart, Package, Star, UserCog, Trash2, MapPin,
  Car, MessageSquare, Mail, Ticket, Undo2, CreditCard, Shield, Eye,
  BookOpen, Wrench, FileText, Globe, LayoutGrid,
  Users, BarChart3, Zap, AlertTriangle, Clock, TrendingUp, Database,
} from 'lucide-react';
import { getAuthHeader } from '@/helper/helper';

const API = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';

interface AuditLog {
  _id: string;
  userId: { _id: string; firstName: string; lastName: string; email: string } | null;
  action: string;
  method: string;
  path: string;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  browser: string | null;
  os: string | null;
  device: string | null;
  referer: string | null;
  queryParams: Record<string, unknown> | null;
  resourceId: string | null;
  errorMessage: string | null;
  cacheStatus: string | null;
  responseSize: number | null;
  severity: 'info' | 'warn' | 'critical' | null;
  statusCode: number | null;
  durationMs: number | null;
  createdAt: string;
}

interface ActionBreakdown { _id: string; count: number; }

interface Analytics {
  range: string;
  since: string;
  overview: {
    total: number;
    failed: number;
    uniqueUsers: number;
    guestEvents: number;
    avgDuration: number;
    maxDuration: number;
  };
  topUsers: Array<{
    _id: string;
    count: number;
    lastAt: string;
    actionCount: number;
    firstName?: string;
    lastName?: string;
    email?: string;
  }>;
  topProducts: Array<{ _id: string; count: number; uniqueUsers: number }>;
  topBlogs: Array<{ _id: string; count: number }>;
  topPaths: Array<{
    method: string;
    path: string;
    count: number;
    avgDuration: number;
    maxDuration?: number;
    hitAvgDuration?: number | null;
    hitMaxDuration?: number | null;
    missAvgDuration?: number | null;
    missMaxDuration?: number | null;
    failCount: number;
    cacheHits?: number;
    cacheMisses?: number;
    criticalCount?: number;
    warnCount?: number;
    uniqueUsers?: number;
    avgSize?: number | null;
    lastAt?: string;
    lastError?: string | null;
  }>;
  actionBreakdown: ActionBreakdown[];
  methodBreakdown: Array<{ _id: string; count: number }>;
  statusBreakdown: Array<{ _id: string; count: number }>;
  slowestPaths: Array<{
    method: string;
    path: string;
    count: number;
    avgDuration: number;
    maxDuration: number;
    minDuration?: number;
    hitAvgDuration?: number | null;
    hitMaxDuration?: number | null;
    missAvgDuration?: number | null;
    missMaxDuration?: number | null;
    failCount?: number;
    cacheHits?: number;
    cacheMisses?: number;
    criticalCount?: number;
    warnCount?: number;
    avgSize?: number | null;
    uniqueUsers?: number;
    lastAt?: string;
    lastError?: string | null;
  }>;
  timeline: Array<{ _id: string; count: number; failed: number }>;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Activity; color: string }> = {
  login:                    { label: 'Login',                 icon: LogIn,         color: 'text-green-600 bg-green-50' },
  signup:                   { label: 'Signup',                icon: LogIn,         color: 'text-green-600 bg-green-50' },
  google_login:             { label: 'Google Login',          icon: LogIn,         color: 'text-green-600 bg-green-50' },
  stack_auth_sync:          { label: 'Auth Sync',             icon: LogIn,         color: 'text-green-600 bg-green-50' },
  google_oauth_callback:    { label: 'Google OAuth',          icon: LogIn,         color: 'text-green-600 bg-green-50' },
  update_profile:           { label: 'Update Profile',        icon: UserCog,       color: 'text-blue-600 bg-blue-50' },
  view_profile:             { label: 'View Profile',          icon: UserCog,       color: 'text-blue-600 bg-blue-50' },
  delete_account:           { label: 'Delete Account',        icon: Trash2,        color: 'text-red-600 bg-red-50' },
  add_address:              { label: 'Add Address',           icon: MapPin,        color: 'text-blue-600 bg-blue-50' },
  update_address:           { label: 'Update Address',        icon: MapPin,        color: 'text-blue-600 bg-blue-50' },
  delete_address:           { label: 'Delete Address',        icon: MapPin,        color: 'text-red-600 bg-red-50' },
  view_addresses:           { label: 'View Addresses',        icon: MapPin,        color: 'text-blue-600 bg-blue-50' },
  add_car:                  { label: 'Add Car',               icon: Car,           color: 'text-indigo-600 bg-indigo-50' },
  update_car:               { label: 'Update Car',            icon: Car,           color: 'text-indigo-600 bg-indigo-50' },
  remove_car:               { label: 'Remove Car',            icon: Car,           color: 'text-red-600 bg-red-50' },
  view_cars:                { label: 'View Cars',             icon: Car,           color: 'text-indigo-600 bg-indigo-50' },
  add_to_cart:              { label: 'Add to Cart',           icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  update_cart:              { label: 'Update Cart',           icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  update_cart_item:         { label: 'Update Cart Item',      icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  remove_from_cart:         { label: 'Remove from Cart',      icon: ShoppingCart,  color: 'text-red-600 bg-red-50' },
  clear_cart:               { label: 'Clear Cart',            icon: ShoppingCart,  color: 'text-red-600 bg-red-50' },
  merge_guest_cart:         { label: 'Merge Guest Cart',      icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  view_cart:                { label: 'View Cart',             icon: ShoppingCart,  color: 'text-amber-600 bg-amber-50' },
  add_to_wishlist:          { label: 'Add to Wishlist',       icon: Heart,         color: 'text-pink-600 bg-pink-50' },
  toggle_wishlist:          { label: 'Toggle Wishlist',       icon: Heart,         color: 'text-pink-600 bg-pink-50' },
  remove_from_wishlist:     { label: 'Remove from Wishlist',  icon: Heart,         color: 'text-red-600 bg-red-50' },
  view_wishlist:            { label: 'View Wishlist',         icon: Heart,         color: 'text-pink-600 bg-pink-50' },
  place_order:              { label: 'Place Order',           icon: Package,       color: 'text-purple-600 bg-purple-50' },
  initiate_checkout:        { label: 'Start Checkout',        icon: CreditCard,    color: 'text-purple-600 bg-purple-50' },
  view_orders:              { label: 'View Orders',           icon: Package,       color: 'text-purple-600 bg-purple-50' },
  view_order_detail:        { label: 'View Order Detail',     icon: Package,       color: 'text-purple-600 bg-purple-50' },
  view_product:             { label: 'View Product',          icon: Eye,           color: 'text-gray-600 bg-gray-100' },
  browse_products:          { label: 'Browse Products',       icon: LayoutGrid,    color: 'text-gray-600 bg-gray-100' },
  browse_categories:        { label: 'Browse Categories',     icon: LayoutGrid,    color: 'text-gray-600 bg-gray-100' },
  create_review:            { label: 'Create Review',         icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  update_review:            { label: 'Update Review',         icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  delete_review:            { label: 'Delete Review',         icon: Star,          color: 'text-red-600 bg-red-50' },
  view_reviews:             { label: 'View Reviews',          icon: Star,          color: 'text-yellow-600 bg-yellow-50' },
  create_return:            { label: 'Create Return',         icon: Undo2,         color: 'text-orange-600 bg-orange-50' },
  view_returns:             { label: 'View Returns',          icon: Undo2,         color: 'text-orange-600 bg-orange-50' },
  create_preorder:          { label: 'Create Preorder',       icon: Package,       color: 'text-purple-600 bg-purple-50' },
  cancel_preorder:          { label: 'Cancel Preorder',       icon: Package,       color: 'text-red-600 bg-red-50' },
  view_preorders:           { label: 'View Preorders',        icon: Package,       color: 'text-purple-600 bg-purple-50' },
  submit_contact:           { label: 'Submit Contact',        icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
  newsletter_subscribe:     { label: 'Subscribe',             icon: Mail,          color: 'text-teal-600 bg-teal-50' },
  newsletter_unsubscribe:   { label: 'Unsubscribe',           icon: Mail,          color: 'text-gray-600 bg-gray-100' },
  apply_discount:           { label: 'Apply Discount',        icon: Ticket,        color: 'text-emerald-600 bg-emerald-50' },
  post_blog_comment:        { label: 'Blog Comment',          icon: MessageSquare, color: 'text-teal-600 bg-teal-50' },
  browse_blogs:             { label: 'Browse Blogs',          icon: BookOpen,      color: 'text-gray-600 bg-gray-100' },
  view_blog:                { label: 'Read Blog',             icon: BookOpen,      color: 'text-gray-600 bg-gray-100' },
  view_services:            { label: 'View Services',         icon: Wrench,        color: 'text-gray-600 bg-gray-100' },
  view_page:                { label: 'View Page',             icon: FileText,      color: 'text-gray-600 bg-gray-100' },
  view_settings:            { label: 'Load Settings',         icon: Globe,         color: 'text-gray-500 bg-gray-100' },
  browse_car_makes:         { label: 'Browse Car Makes',      icon: Car,           color: 'text-gray-600 bg-gray-100' },
  admin_update_user_status: { label: 'Admin: Status Change',  icon: Shield,        color: 'text-red-600 bg-red-50' },
  admin_update_user_role:   { label: 'Admin: Role Change',    icon: Shield,        color: 'text-red-600 bg-red-50' },
  admin_delete_user:        { label: 'Admin: Delete User',    icon: Shield,        color: 'text-red-600 bg-red-50' },
  admin_view_users:         { label: 'Admin: View Users',     icon: Shield,        color: 'text-gray-600 bg-gray-100' },
};

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-blue-100 text-blue-700',
  POST: 'bg-green-100 text-green-700',
  PUT: 'bg-amber-100 text-amber-700',
  DELETE: 'bg-red-100 text-red-700',
  PATCH: 'bg-purple-100 text-purple-700',
};

const STATUS_COLORS: Record<string, string> = {
  '2xx': 'bg-green-100 text-green-700 border-green-200',
  '3xx': 'bg-blue-100 text-blue-700 border-blue-200',
  '4xx': 'bg-amber-100 text-amber-700 border-amber-200',
  '5xx': 'bg-red-100 text-red-700 border-red-200',
  unknown: 'bg-gray-100 text-gray-600 border-gray-200',
};

const RANGES: Array<{ id: Range; label: string }> = [
  { id: '1h',  label: 'Last hour' },
  { id: '24h', label: 'Last 24h' },
  { id: '7d',  label: 'Last 7d' },
  { id: '30d', label: 'Last 30d' },
];

type Range = '1h' | '24h' | '7d' | '30d';
type Tab = 'feed' | 'users' | 'insights' | 'cache';

function timeAgo(dateStr: string) {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDetails(details: Record<string, unknown> | null) {
  if (!details) return null;
  return Object.entries(details)
    .filter(([k, v]) => k !== 'changes' && v != null && v !== '' && typeof v !== 'object')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ');
}

// Old -> new values saved with every update (details.changes, see backend helper/changeLog.js).
interface ChangeField { field: string; from: unknown; to: unknown }
interface ChangeRecord { model: string; id: string; label?: string; fields: ChangeField[] }

const showValue = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '(empty)';
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 80 ? `${s.slice(0, 80)}…` : s;
};

function ChangeList({ details }: { details: Record<string, unknown> | null }) {
  const changes = (details && Array.isArray(details.changes) ? details.changes : []) as ChangeRecord[];
  if (!changes.length) return null;
  return (
    <details className="mt-1 text-[11px] lg:text-xs">
      <summary className="cursor-pointer text-blue-600 hover:text-blue-800 select-none">
        {changes.reduce((n, c) => n + (c.fields?.length || 0), 0)} change(s)
      </summary>
      <div className="mt-1 space-y-1.5 max-w-[420px]">
        {changes.map((c, i) => (
          <div key={`${c.id}-${i}`} className="rounded border border-gray-200 bg-gray-50 px-2 py-1">
            <p className="font-semibold text-gray-700">
              {c.model}
              {c.label ? `: ${c.label}` : ''}
            </p>
            <ul className="mt-0.5 space-y-0.5">
              {(c.fields || []).map((f) => (
                <li key={f.field} className="text-gray-600 break-words">
                  <span className="font-mono text-gray-800">{f.field}</span>:{' '}
                  <span className="text-red-600 line-through">{showValue(f.from)}</span>{' '}
                  → <span className="text-green-700">{showValue(f.to)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

function formatMs(ms: number | null | undefined) {
  if (!ms && ms !== 0) return '—';
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function speedClass(ms: number | null | undefined) {
  if (!ms && ms !== 0) return 'text-gray-400';
  if (ms < 200) return 'text-green-600';
  if (ms < 800) return 'text-amber-600';
  return 'text-red-600';
}

// Mirrors cache(ttl, tag) usage in backend/src/routes/allRoutes.js.
// ttlSeconds matches backend TTL so we can surface cache status/duration in insights.
// resetReason is shown in the Cache tab tooltip — describes which admin action invalidates the tag.
const CACHE_ROUTES: Array<{ method: string; match: 'exact' | 'prefix'; path: string; ttlSeconds: number; tags: string[]; resetReason: string }> = [
  { method: 'GET', match: 'exact',  path: '/categories/featured-with-products', ttlSeconds: 7 * 24 * 3600, tags: ['categories:featured-with-products'], resetReason: 'Resets when you create, update, delete, reorder, or change featured products in /admin/products/categories.' },
  { method: 'GET', match: 'exact',  path: '/categories/public',                 ttlSeconds: 7 * 24 * 3600, tags: ['categories:public'], resetReason: 'Resets on any category CRUD (create, update, reorder, delete, set featured) in /admin/products/categories.' },
  { method: 'GET', match: 'exact',  path: '/blogs/featured',                    ttlSeconds: 3600,          tags: ['blogs:featured'], resetReason: 'Resets when a blog is created, updated, featured-toggled, or deleted in /admin/blogs.' },
  { method: 'GET', match: 'exact',  path: '/settings/public',                   ttlSeconds: 7 * 24 * 3600, tags: ['settings:public'], resetReason: 'Resets on any save in /admin/settings — General, Logo, Social Links, SMTP, footer logo, favicon, or reset.' },
  { method: 'GET', match: 'exact',  path: '/hero-slides/active',                ttlSeconds: 7 * 24 * 3600, tags: ['hero-slides:active'], resetReason: 'Resets on any hero-slide CRUD (create, update, status toggle, reorder, delete) in /admin/hero-slides.' },
  { method: 'GET', match: 'exact',  path: '/api/public/products/featured',      ttlSeconds: 7 * 24 * 3600, tags: ['products:featured'], resetReason: 'Resets on any product create, update, or delete in /admin/products (including toggling the Featured flag).' },
];

function getCacheInfo(method: string, path: string): { cached: true; ttlLabel: string } | { cached: false } {
  const cleanPath = (path || '').split('?')[0];
  const entry = CACHE_ROUTES.find((r) =>
    r.method === method && (r.match === 'exact' ? r.path === cleanPath : cleanPath.startsWith(r.path))
  );
  if (!entry) return { cached: false };
  return { cached: true, ttlLabel: formatTtl(entry.ttlSeconds) };
}

function formatTtl(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) {
    const h = seconds / 3600;
    return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
  }
  const d = seconds / 86400;
  return Number.isInteger(d) ? `${d}d` : `${d.toFixed(1)}d`;
}

function SeverityBadge({ severity }: { severity: AuditLog['severity'] }) {
  if (!severity || severity === 'info') return null;
  const cls =
    severity === 'critical'
      ? 'text-red-700 bg-red-50 border-red-200'
      : 'text-amber-700 bg-amber-50 border-amber-200';
  return (
    <span className={`text-[10px] lg:text-xs font-bold uppercase tracking-wide border px-1 py-0.5 rounded ${cls}`}>
      {severity}
    </span>
  );
}

function DeviceChip({ log }: { log: AuditLog }) {
  const parts = [log.browser, log.os].filter(Boolean).join(' · ');
  if (!parts) return null;
  return (
    <span
      className="text-[10px] lg:text-xs font-medium text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded"
      title={log.userAgent || ''}
    >
      {log.device && log.device !== 'desktop' ? `${log.device} · ` : ''}{parts}
    </span>
  );
}

function ServerCacheBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const hit = status.toUpperCase() === 'HIT';
  return (
    <span
      title={`Server cache: ${status}`}
      className={`text-[10px] lg:text-xs font-bold px-1 py-0.5 rounded border ${
        hit
          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
          : 'text-gray-600 bg-gray-50 border-gray-200'
      }`}
    >
      {status.toUpperCase()}
    </span>
  );
}

function formatBytes(n: number | null | undefined) {
  if (n == null) return '—';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function CacheBadge({ info }: { info: ReturnType<typeof getCacheInfo> }) {
  if (info.cached) {
    return (
      <span
        title={`Cached for ${info.ttlLabel}`}
        className="text-[10px] lg:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded"
      >
        cache {info.ttlLabel}
      </span>
    );
  }
  return (
    <span
      title="No server cache on this endpoint"
      className="text-[10px] lg:text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded"
    >
      no cache
    </span>
  );
}

const VALID_TABS: Tab[] = ['users', 'feed', 'insights', 'cache'];

export default function ActivityLogPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const urlTab = searchParams.get('tab') as Tab | null;
  const tab: Tab = urlTab && VALID_TABS.includes(urlTab) ? urlTab : 'users';
  const userId = searchParams.get('userId');

  const setTab = useCallback((next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('userId');
    if (next === 'users') params.delete('tab');
    else params.set('tab', next);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const openUser = useCallback((id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('tab');
    params.set('userId', id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const clearUser = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('userId');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  // User detail view takes over the page
  if (userId) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <UserDetailView userId={userId} onBack={clearUser} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
        <div className="mb-4">
          <h1 className="text-xl lg:text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-xs lg:text-sm text-gray-500 mt-0.5">
            Monitor every request, user, and API endpoint across the platform
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-4 bg-white border border-gray-200 rounded-lg p-1 w-fit">
          <TabButton icon={Users}     label="Users"     active={tab === 'users'}    onClick={() => setTab('users')} />
          <TabButton icon={Activity}  label="Live Feed" active={tab === 'feed'}     onClick={() => setTab('feed')} />
          <TabButton icon={BarChart3} label="Insights"  active={tab === 'insights'} onClick={() => setTab('insights')} />
          <TabButton icon={Database}  label="Cache"     active={tab === 'cache'}    onClick={() => setTab('cache')} />
        </div>

        {tab === 'feed' && <FeedTab />}
        {tab === 'users' && <UsersTab onUserClick={openUser} />}
        {tab === 'insights' && <InsightsTab />}
        {tab === 'cache' && <CacheTab />}
      </div>
    </div>
  );
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: typeof Activity; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 lg:px-4 lg:py-2 text-xs lg:text-sm font-medium rounded-md transition-colors ${
        active ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
      }`}
    >
      <Icon className="w-3.5 h-3.5 lg:w-4 lg:h-4" />
      {label}
    </button>
  );
}

/* ---------------- FEED TAB ---------------- */

function FeedCacheCounter({ logs }: { logs: AuditLog[] }) {
  const { hits, misses, eligible } = useMemo(() => {
    let hits = 0;
    let misses = 0;
    let eligible = 0;
    for (const log of logs) {
      if (!log.cacheStatus) continue;
      const s = log.cacheStatus.toUpperCase();
      if (s === 'HIT') { hits += 1; eligible += 1; }
      else if (s === 'MISS') { misses += 1; eligible += 1; }
    }
    return { hits, misses, eligible };
  }, [logs]);

  if (eligible === 0) {
    return (
      <span className="text-[11px] lg:text-xs text-gray-400" title="No cached routes in the current page">
        no cached routes in view
      </span>
    );
  }

  const hitRate = Math.round((hits / eligible) * 100);
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11px] lg:text-xs font-medium text-gray-600"
      title={`Of ${eligible} cached-route requests in the loaded page: ${hits} served from memory, ${misses} hit the database`}
    >
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700">
        <Zap className="w-3 h-3" />
        <b>{hits}</b> cache
      </span>
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700">
        <Database className="w-3 h-3" />
        <b>{misses}</b> db
      </span>
      <span className="text-gray-400">{hitRate}% hit</span>
    </span>
  );
}

function FeedTab() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [searchTerm, setSearchTerm] = useState('');
  const [methodFilter, setMethodFilter] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '40' });
      if (methodFilter) params.set('method', methodFilter);
      if (searchTerm) params.set('search', searchTerm);

      const res = await fetch(`${API}/admin/audit-logs?${params}`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();

      setLogs(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);
      setPage(json.pagination.page);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [methodFilter, searchTerm]);

  useEffect(() => { fetchLogs(1); }, [fetchLogs]);

  useEffect(() => {
    const id = setInterval(() => fetchLogs(page), 10000);
    return () => clearInterval(id);
  }, [fetchLogs, page]);

  const action = useBusyAction<'refresh' | 'prev' | 'next'>();

  return (
    <>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <p className="text-xs text-gray-500">
          {total.toLocaleString()} total events · Auto-refreshes every 10s
        </p>
        <div className="flex items-center gap-2">
          <FeedCacheCounter logs={logs} />
          <button
            onClick={() => action.run('refresh', () => fetchLogs(page))}
            disabled={action.busy !== null}
            aria-busy={action.busy === 'refresh'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {action.busy === 'refresh' ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" />Refreshing…</>
            ) : (
              <><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh</>
            )}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search actions or paths..."
            className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <select
          value={methodFilter}
          onChange={(e) => setMethodFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-gray-300"
        >
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
        </select>
        <div className="flex items-center gap-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('all')}
            className={`px-2.5 py-1 text-xs lg:text-sm font-medium rounded-md transition-colors ${
              viewMode === 'all' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Routes
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={`px-2.5 py-1 text-xs lg:text-sm font-medium rounded-md transition-colors ${
              viewMode === 'grouped' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Grouped Routes
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No activity logs found</p>
          </div>
        ) : viewMode === 'grouped' ? (
          <GroupedRouteTable logs={logs} />
        ) : (
          <>
            <div className="sm:hidden divide-y divide-gray-100">
              {logs.map((log) => {
                const cfg = ACTION_CONFIG[log.action] || { label: log.action, icon: Activity, color: 'text-gray-600 bg-gray-100' };
                const Icon = cfg.icon;
                const failed = log.statusCode && log.statusCode >= 400;
                const cacheInfo = getCacheInfo(log.method, log.path);
                return (
                  <div key={log._id} className="p-3 flex gap-2.5">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-900">{cfg.label}</span>
                        <SeverityBadge severity={log.severity} />
                        {failed && <span className="px-1 py-0.5 text-[8px] font-bold bg-red-100 text-red-600 rounded">{log.statusCode}</span>}
                        <CacheBadge info={cacheInfo} />
                        <ServerCacheBadge status={log.cacheStatus} />
                        <span className="text-[11px] lg:text-xs text-gray-400 ml-auto">{timeAgo(log.createdAt)}</span>
                      </div>
                      <p className="text-[11px] lg:text-xs text-gray-500 truncate">
                        {log.userId ? `${log.userId.firstName} ${log.userId.lastName}` : 'Guest'} · {log.path}
                        {log.durationMs != null && <span className={`ml-1 ${speedClass(log.durationMs)}`}>· {formatMs(log.durationMs)}</span>}
                      </p>
                      {failed && log.errorMessage && (
                        <p className="mt-0.5 text-[11px] lg:text-xs text-red-600 truncate" title={log.errorMessage}>
                          {log.errorMessage}
                        </p>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <DeviceChip log={log} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <table className="hidden sm:table w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Action</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">User</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden md:table-cell">Method</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden lg:table-cell">Path</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden xl:table-cell">Client</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden lg:table-cell">Details</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs w-20">Speed</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs w-24">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => {
                  const cfg = ACTION_CONFIG[log.action] || { label: log.action, icon: Activity, color: 'text-gray-600 bg-gray-100' };
                  const Icon = cfg.icon;
                  const failed = log.statusCode && log.statusCode >= 400;
                  const detailStr = formatDetails(log.details);
                  const cacheInfo = getCacheInfo(log.method, log.path);

                  return (
                    <tr key={log._id} className={`hover:bg-gray-50 transition-colors ${failed ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 flex-wrap">
                              <span className="text-xs font-semibold text-gray-900">{cfg.label}</span>
                              <SeverityBadge severity={log.severity} />
                              {failed && (
                                <span className="px-1 py-0.5 text-[10px] lg:text-xs font-bold bg-red-100 text-red-600 rounded">
                                  {log.statusCode}
                                </span>
                              )}
                            </div>
                            {failed && log.errorMessage && (
                              <p className="text-[11px] lg:text-xs text-red-600 truncate max-w-[220px]" title={log.errorMessage}>
                                {log.errorMessage}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {log.userId ? (
                          <div>
                            <p className="text-xs font-medium text-gray-900 truncate max-w-[140px]">
                              {log.userId.firstName} {log.userId.lastName}
                            </p>
                            <p className="text-[11px] lg:text-xs text-gray-400 truncate max-w-[140px]">{log.userId.email}</p>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Guest</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[log.method] || 'bg-gray-100 text-gray-600'}`}>
                          {log.method}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 max-w-[240px] flex-wrap">
                          <span className="text-xs lg:text-sm text-gray-500 font-mono truncate block">{log.path}</span>
                          <CacheBadge info={cacheInfo} />
                          <ServerCacheBadge status={log.cacheStatus} />
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden xl:table-cell">
                        <div className="flex flex-col gap-0.5">
                          <DeviceChip log={log} />
                          {log.ipAddress && (
                            <span className="text-[10px] lg:text-xs text-gray-400 font-mono truncate max-w-[130px]">
                              {log.ipAddress}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 hidden lg:table-cell">
                        <span className="text-[11px] lg:text-xs text-gray-400 truncate block max-w-[180px]">{detailStr || (log.details?.changes ? '' : '—')}</span>
                        <ChangeList details={log.details} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[11px] lg:text-xs font-semibold ${speedClass(log.durationMs)}`}>
                          {formatMs(log.durationMs)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] lg:text-xs text-gray-400">{timeAgo(log.createdAt)}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Page {page} of {totalPages} · <span className="font-medium">{total.toLocaleString()}</span> events
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => action.run('prev', () => fetchLogs(page - 1))}
              disabled={page <= 1 || action.busy !== null}
              aria-busy={action.busy === 'prev'}
              className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {action.busy === 'prev' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={() => action.run('next', () => fetchLogs(page + 1))}
              disabled={page >= totalPages || action.busy !== null}
              aria-busy={action.busy === 'next'}
              className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {action.busy === 'next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------------- GROUPED ROUTE TABLE ---------------- */

function normalizePath(path: string) {
  return path
    .replace(/\/[a-f0-9]{24}(?=\/|$)/g, '/:id')
    .replace(/\/\d+(?=\/|$)/g, '/:id');
}

interface RouteGroup {
  key: string;
  method: string;
  path: string;
  action: string;
  count: number;
  uniqueUsers: Set<string>;
  totalDuration: number;
  durationSamples: number;
  maxDuration: number;
  failCount: number;
  lastAt: string;
}

function GroupedRouteTable({ logs }: { logs: AuditLog[] }) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const groups = useMemo(() => {
    const map = new Map<string, RouteGroup>();
    for (const log of logs) {
      const normPath = normalizePath(log.path);
      const key = `${log.method} ${normPath} ${log.action}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          method: log.method,
          path: normPath,
          action: log.action,
          count: 0,
          uniqueUsers: new Set(),
          totalDuration: 0,
          durationSamples: 0,
          maxDuration: 0,
          failCount: 0,
          lastAt: log.createdAt,
        };
        map.set(key, g);
      }
      g.count += 1;
      if (log.userId?._id) g.uniqueUsers.add(log.userId._id);
      if (log.durationMs != null) {
        g.totalDuration += log.durationMs;
        g.durationSamples += 1;
        if (log.durationMs > g.maxDuration) g.maxDuration = log.durationMs;
      }
      if (log.statusCode && log.statusCode >= 400) g.failCount += 1;
      if (new Date(log.createdAt) > new Date(g.lastAt)) g.lastAt = log.createdAt;
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [logs]);

  // Clear selection if the selected route has aged out of the current page of logs.
  useEffect(() => {
    if (selectedKey && !groups.some((g) => g.key === selectedKey)) {
      setSelectedKey(null);
    }
  }, [groups, selectedKey]);

  const selectedGroup = selectedKey ? groups.find((g) => g.key === selectedKey) ?? null : null;

  if (selectedGroup) {
    const matchingLogs = logs.filter(
      (l) => `${l.method} ${normalizePath(l.path)} ${l.action}` === selectedGroup.key,
    );
    return (
      <RouteDrilldown group={selectedGroup} logs={matchingLogs} onBack={() => setSelectedKey(null)} />
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="bg-gray-50 border-b border-gray-200 text-left">
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Action</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Method</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Route</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Calls</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden md:table-cell">Users</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden md:table-cell">Avg</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden lg:table-cell">Max</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden lg:table-cell">Fails</th>
          <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Last Seen</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {groups.map((g) => {
          const cfg = ACTION_CONFIG[g.action] || { label: g.action, icon: Activity, color: 'text-gray-600 bg-gray-100' };
          const Icon = cfg.icon;
          const avg = g.durationSamples > 0 ? g.totalDuration / g.durationSamples : null;
          const cacheInfo = getCacheInfo(g.method, g.path);
          return (
            <tr
              key={g.key}
              onClick={() => setSelectedKey(g.key)}
              className={`cursor-pointer hover:bg-gray-50 ${g.failCount > 0 ? 'bg-red-50/30' : ''}`}
              title="View only this route"
            >
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-gray-900">{cfg.label}</span>
                </div>
              </td>
              <td className="px-4 py-2.5">
                <span className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[g.method] || 'bg-gray-100 text-gray-600'}`}>
                  {g.method}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <div className="flex items-center gap-1.5 max-w-[300px]">
                  <span className="text-xs lg:text-sm text-gray-600 font-mono truncate block">{g.path}</span>
                  <CacheBadge info={cacheInfo} />
                </div>
              </td>
              <td className="px-4 py-2.5">
                <span className="text-sm font-bold text-gray-900">{g.count}</span>
              </td>
              <td className="px-4 py-2.5 hidden md:table-cell">
                <span className="text-xs text-gray-600">{g.uniqueUsers.size}</span>
              </td>
              <td className="px-4 py-2.5 hidden md:table-cell">
                <span className={`text-xs lg:text-sm font-semibold ${speedClass(avg)}`}>{formatMs(avg)}</span>
              </td>
              <td className="px-4 py-2.5 hidden lg:table-cell">
                <span className={`text-[11px] lg:text-xs ${speedClass(g.maxDuration)}`}>{formatMs(g.maxDuration || null)}</span>
              </td>
              <td className="px-4 py-2.5 hidden lg:table-cell">
                {g.failCount > 0 ? (
                  <span className="text-[11px] lg:text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{g.failCount}</span>
                ) : (
                  <span className="text-[11px] lg:text-xs text-gray-300">0</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span className="text-[11px] lg:text-xs text-gray-400">{timeAgo(g.lastAt)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/* ---------------- ROUTE DRILL-DOWN ---------------- */

function RouteDrilldown({
  group,
  logs,
  onBack,
}: {
  group: RouteGroup;
  logs: AuditLog[];
  onBack: () => void;
}) {
  const cfg = ACTION_CONFIG[group.action] || { label: group.action, icon: Activity, color: 'text-gray-600 bg-gray-100' };
  const Icon = cfg.icon;
  const avg = group.durationSamples > 0 ? group.totalDuration / group.durationSamples : null;
  const cacheInfo = getCacheInfo(group.method, group.path);

  return (
    <div>
      {/* Drill-down header */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-gray-200 bg-gray-50">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to all routes
        </button>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs font-semibold text-gray-900">{cfg.label}</span>
        <span className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[group.method] || 'bg-gray-100 text-gray-600'}`}>
          {group.method}
        </span>
        <span className="text-xs lg:text-sm text-gray-600 font-mono truncate max-w-[320px]">{group.path}</span>
        <CacheBadge info={cacheInfo} />

        <div className="flex items-center gap-3 ml-auto text-xs lg:text-sm text-gray-600">
          <span><b className="text-gray-900">{group.count}</b> calls</span>
          <span><b className="text-gray-900">{group.uniqueUsers.size}</b> users</span>
          <span className={speedClass(avg)}>avg {formatMs(avg)}</span>
          <span className={speedClass(group.maxDuration)}>max {formatMs(group.maxDuration || null)}</span>
          {group.failCount > 0 && (
            <span className="font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
              {group.failCount} fail{group.failCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Filtered events */}
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-left">
            <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">User</th>
            <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Status</th>
            <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden lg:table-cell">Path</th>
            <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden lg:table-cell">Details</th>
            <th className="px-4 py-2.5 font-medium text-gray-600 text-xs w-20">Speed</th>
            <th className="px-4 py-2.5 font-medium text-gray-600 text-xs w-24">Time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {logs.map((log) => {
            const failed = log.statusCode && log.statusCode >= 400;
            const detailStr = formatDetails(log.details);
            return (
              <tr key={log._id} className={`hover:bg-gray-50 ${failed ? 'bg-red-50/30' : ''}`}>
                <td className="px-4 py-2.5">
                  {log.userId ? (
                    <div>
                      <p className="text-xs font-medium text-gray-900 truncate max-w-[160px]">
                        {log.userId.firstName} {log.userId.lastName}
                      </p>
                      <p className="text-[11px] lg:text-xs text-gray-400 truncate max-w-[160px]">{log.userId.email}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Guest</span>
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${
                      failed ? 'bg-red-100 text-red-600' : 'bg-green-50 text-green-700 border border-green-200'
                    }`}
                  >
                    {log.statusCode ?? '—'}
                  </span>
                </td>
                <td className="px-4 py-2.5 hidden lg:table-cell">
                  <span className="text-xs lg:text-sm text-gray-500 font-mono truncate block max-w-[220px]">{log.path}</span>
                </td>
                <td className="px-4 py-2.5 hidden lg:table-cell">
                  <span className="text-[11px] lg:text-xs text-gray-400 truncate block max-w-[220px]">{detailStr || (log.details?.changes ? '' : '—')}</span>
                  <ChangeList details={log.details} />
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-[11px] lg:text-xs font-semibold ${speedClass(log.durationMs)}`}>
                    {formatMs(log.durationMs)}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="text-[11px] lg:text-xs text-gray-400">{timeAgo(log.createdAt)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------- ANALYTICS HOOK ---------------- */

function useAnalytics(range: Range) {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/audit-logs/analytics?range=${range}`, { headers: getAuthHeader() });
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setData(json.data);
    } catch (err) {
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, refetch: fetchData };
}

/* ---------------- BUSY ACTION HOOK ---------------- */

/**
 * Runs one user-triggered async action at a time. A ref lock blocks repeat
 * clicks before React re-renders; `busy` names the running action so only
 * that button shows a spinner while the others are disabled.
 */
function useBusyAction<K extends string>() {
  const lockRef = useRef(false);
  const [busy, setBusy] = useState<K | null>(null);
  const run = useCallback(async (key: K, fn: () => unknown) => {
    if (lockRef.current) return;
    lockRef.current = true;
    setBusy(key);
    try {
      await fn();
    } finally {
      lockRef.current = false;
      setBusy(null);
    }
  }, []);
  return { busy, run };
}

function RangeTabs({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  return (
    <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-0.5">
      {RANGES.map((r) => (
        <button
          key={r.id}
          onClick={() => onChange(r.id)}
          className={`px-2.5 py-1 text-xs lg:text-sm font-medium rounded-md transition-colors ${
            range === r.id ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------- USER DETAIL VIEW ---------------- */

interface UserSummary {
  totalActions: number;
  lastActivity: string | null;
  lastAction: string | null;
  breakdown: Array<{ _id: string; count: number; lastAt: string }>;
}

function UserDetailView({ userId, onBack }: { userId: string; onBack: () => void }) {
  const [summary, setSummary] = useState<UserSummary | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [userInfo, setUserInfo] = useState<{ firstName?: string; lastName?: string; email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('');

  const fetchAll = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const logParams = new URLSearchParams({ page: String(p), limit: '40' });
      if (actionFilter) logParams.set('action', actionFilter);

      const [summaryRes, logsRes] = await Promise.all([
        fetch(`${API}/admin/audit-logs/user/${userId}/summary`, { headers: getAuthHeader() }),
        fetch(`${API}/admin/audit-logs/user/${userId}?${logParams}`, { headers: getAuthHeader() }),
      ]);

      if (summaryRes.ok) setSummary((await summaryRes.json()).data);
      if (logsRes.ok) {
        const j = await logsRes.json();
        setLogs(j.data);
        setTotal(j.pagination.total);
        setTotalPages(j.pagination.totalPages);
        setPage(j.pagination.page);
      }

      // Try to pull user identity from the first log that has populated userId, else from feed endpoint
      const feedRes = await fetch(`${API}/admin/audit-logs?userId=${userId}&limit=1`, { headers: getAuthHeader() });
      if (feedRes.ok) {
        const fj = await feedRes.json();
        const u = fj.data?.[0]?.userId;
        if (u) setUserInfo({ firstName: u.firstName, lastName: u.lastName, email: u.email });
      }
    } catch (err) {
      console.error('User detail fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId, actionFilter]);

  useEffect(() => { fetchAll(1); }, [fetchAll]);

  const action = useBusyAction<'refresh' | 'prev' | 'next'>();

  const name = userInfo?.firstName || userInfo?.lastName
    ? `${userInfo.firstName || ''} ${userInfo.lastName || ''}`.trim()
    : 'User';

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          Back to Users
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
          <p className="text-xs text-gray-500">{userInfo?.email || userId}</p>
        </div>
        <button
          onClick={() => action.run('refresh', () => fetchAll(page))}
          disabled={action.busy !== null}
          aria-busy={action.busy === 'refresh'}
          aria-label={action.busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {action.busy === 'refresh' ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          )}
        </button>
      </div>

      {loading && !summary ? (
        <div className="flex items-center justify-center py-20 bg-white border border-gray-200 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
            <StatCard
              icon={TrendingUp}
              label="Total Events"
              value={(summary?.totalActions ?? 0).toLocaleString()}
              sub="lifetime"
              color="text-blue-600 bg-blue-50"
            />
            <StatCard
              icon={Clock}
              label="Last Active"
              value={summary?.lastActivity ? timeAgo(summary.lastActivity) : '—'}
              sub={summary?.lastAction ? ACTION_CONFIG[summary.lastAction]?.label || summary.lastAction : ''}
              color="text-amber-600 bg-amber-50"
            />
            <StatCard
              icon={Activity}
              label="Distinct Actions"
              value={String(summary?.breakdown?.length ?? 0)}
              sub="different activities"
              color="text-purple-600 bg-purple-50"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Action breakdown */}
            <div className="lg:col-span-1">
              <Card title="Action Breakdown" subtitle="Filter the timeline by action">
                <div className="space-y-1">
                  <button
                    onClick={() => setActionFilter('')}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors ${
                      !actionFilter ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <span className="font-semibold">All</span>
                    <span className="text-[11px] lg:text-xs opacity-75">{summary?.totalActions ?? 0}</span>
                  </button>
                  {summary?.breakdown.map((b) => {
                    const cfg = ACTION_CONFIG[b._id] || { label: b._id, icon: Activity, color: 'text-gray-600 bg-gray-100' };
                    const Icon = cfg.icon;
                    const active = actionFilter === b._id;
                    return (
                      <button
                        key={b._id}
                        onClick={() => setActionFilter(active ? '' : b._id)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                          active ? 'bg-gray-900 text-white' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center ${active ? 'bg-white/10' : cfg.color}`}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <span className="flex-1 text-left truncate">{cfg.label}</span>
                        <span className="text-[11px] lg:text-xs opacity-75">{b.count}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </div>

            {/* Timeline */}
            <div className="lg:col-span-2">
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Activity Timeline</h3>
                    <p className="text-[11px] lg:text-xs text-gray-400 mt-0.5">
                      {total.toLocaleString()} events
                      {actionFilter && ` · filtered by ${ACTION_CONFIG[actionFilter]?.label || actionFilter}`}
                    </p>
                  </div>
                </div>

                {logs.length === 0 ? (
                  <div className="text-center py-16">
                    <Activity className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">No activity for this filter</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {logs.map((log) => {
                      const cfg = ACTION_CONFIG[log.action] || { label: log.action, icon: Activity, color: 'text-gray-600 bg-gray-100' };
                      const Icon = cfg.icon;
                      const failed = log.statusCode && log.statusCode >= 400;
                      const detailStr = formatDetails(log.details);
                      return (
                        <div key={log._id} className={`px-4 py-2.5 flex items-start gap-2.5 ${failed ? 'bg-red-50/30' : ''}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-semibold text-gray-900">{cfg.label}</span>
                              <span className={`px-1.5 py-0.5 text-[10px] lg:text-xs font-bold rounded ${METHOD_COLORS[log.method] || 'bg-gray-100 text-gray-600'}`}>
                                {log.method}
                              </span>
                              {failed && (
                                <span className="px-1 py-0.5 text-[10px] lg:text-xs font-bold bg-red-100 text-red-600 rounded">{log.statusCode}</span>
                              )}
                              <span className={`text-[11px] lg:text-xs font-semibold ${speedClass(log.durationMs)}`}>{formatMs(log.durationMs)}</span>
                              <span className="text-[11px] lg:text-xs text-gray-400 ml-auto">{timeAgo(log.createdAt)}</span>
                            </div>
                            <p className="text-[11px] lg:text-xs text-gray-500 font-mono truncate mt-0.5">{log.path}</p>
                            {detailStr && <p className="text-[11px] lg:text-xs text-gray-400 truncate">{detailStr}</p>}
                            <ChangeList details={log.details} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-2.5 border-t border-gray-200">
                    <p className="text-xs lg:text-sm text-gray-500">
                      Page {page} of {totalPages}
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => action.run('prev', () => fetchAll(page - 1))}
                        disabled={page <= 1 || action.busy !== null}
                        aria-busy={action.busy === 'prev'}
                        className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {action.busy === 'prev' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronLeft className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => action.run('next', () => fetchAll(page + 1))}
                        disabled={page >= totalPages || action.busy !== null}
                        aria-busy={action.busy === 'next'}
                        className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        {action.busy === 'next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- USERS TAB ---------------- */

interface TopUser {
  _id: string;
  count: number;
  lastAt: string;
  actionCount: number;
  failed: number;
  firstName?: string;
  lastName?: string;
  email?: string;
}

function UsersTab({ onUserClick }: { onUserClick: (id: string) => void }) {
  const [range, setRange] = useState<Range>('24h');
  const [page, setPage] = useState(1);
  const [limit] = useState(25);
  const [rows, setRows] = useState<TopUser[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [totalsInRange, setTotalsInRange] = useState<{ unique: number; guest: number } | null>(null);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/admin/audit-logs/top-users?range=${range}&page=${p}&limit=${limit}`,
        { headers: getAuthHeader() }
      );
      if (!res.ok) throw new Error('Failed');
      const json = await res.json();
      setRows(json.data);
      setTotal(json.pagination.total);
      setTotalPages(json.pagination.totalPages);
      setPage(json.pagination.page);
    } catch (err) {
      console.error('Top users fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [range, limit]);

  // Totals from lightweight analytics overview (only for the header caption)
  useEffect(() => {
    let cancelled = false;
    fetch(`${API}/admin/audit-logs/analytics?range=${range}`, { headers: getAuthHeader() })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.data?.overview) {
          setTotalsInRange({ unique: j.data.overview.uniqueUsers, guest: j.data.overview.guestEvents });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [range]);

  useEffect(() => { fetchPage(1); }, [fetchPage]);

  const action = useBusyAction<'refresh' | 'prev' | 'next'>();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          Most active users{totalsInRange && <> · <span className="font-medium">{totalsInRange.unique.toLocaleString()}</span> unique · <span className="font-medium">{totalsInRange.guest.toLocaleString()}</span> guest events</>}
        </p>
        <div className="flex items-center gap-2">
          <RangeTabs range={range} onChange={(r) => { setRange(r); setPage(1); }} />
          <button
            onClick={() => action.run('refresh', () => fetchPage(page))}
            disabled={action.busy !== null}
            aria-busy={action.busy === 'refresh'}
            aria-label={action.busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {action.busy === 'refresh' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            )}
          </button>
        </div>
      </div>

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center py-20 bg-white border border-gray-200 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : rows.length === 0 ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No user activity in this range</p>
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">#</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">User</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Events</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden md:table-cell">Distinct Actions</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs hidden md:table-cell">Failures</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Last Seen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((u, i) => {
                  const rank = (page - 1) * limit + i + 1;
                  return (
                    <tr
                      key={u._id}
                      onClick={() => onUserClick(u._id)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 text-xs text-gray-400 w-8">{rank}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs font-semibold text-gray-900">
                          {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : 'Unknown user'}
                        </p>
                        <p className="text-[11px] lg:text-xs text-gray-400">{u.email || u._id}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="text-sm font-bold text-gray-900">{u.count.toLocaleString()}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        <span className="text-xs text-gray-600">{u.actionCount}</span>
                      </td>
                      <td className="px-4 py-2.5 hidden md:table-cell">
                        {u.failed > 0 ? (
                          <span className="text-[11px] lg:text-xs font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">{u.failed}</span>
                        ) : (
                          <span className="text-[11px] lg:text-xs text-gray-300">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[11px] lg:text-xs text-gray-400">{timeAgo(u.lastAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-gray-500">
                Page {page} of {totalPages} · <span className="font-medium">{total.toLocaleString()}</span> users
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => action.run('prev', () => fetchPage(page - 1))}
                  disabled={page <= 1 || loading || action.busy !== null}
                  aria-busy={action.busy === 'prev'}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {action.busy === 'prev' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => action.run('next', () => fetchPage(page + 1))}
                  disabled={page >= totalPages || loading || action.busy !== null}
                  aria-busy={action.busy === 'next'}
                  className="p-1.5 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {action.busy === 'next' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ---------------- INSIGHTS TAB ---------------- */

function InsightsTab() {
  const [range, setRange] = useState<Range>('24h');
  const { data, loading, refetch } = useAnalytics(range);
  const [clearing, setClearing] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const clearLockRef = useRef(false);
  const action = useBusyAction<'refresh'>();

  const handleClearAll = useCallback(async () => {
    if (clearLockRef.current) return;
    clearLockRef.current = true;
    setClearing(true);
    setClearError(null);
    try {
      const res = await fetch(`${API}/admin/audit-logs`, {
        method: 'DELETE',
        headers: getAuthHeader(),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message || 'Failed to clear logs');
      }
      setShowConfirm(false);
      refetch();
    } catch (err) {
      setClearError(err instanceof Error ? err.message : 'Failed to clear logs');
    } finally {
      clearLockRef.current = false;
      setClearing(false);
    }
  }, [refetch]);

  const statusMap = useMemo(() => {
    const m: Record<string, number> = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0, unknown: 0 };
    data?.statusBreakdown.forEach((s) => { m[s._id] = s.count; });
    return m;
  }, [data]);

  const maxTimeline = useMemo(() => {
    if (!data?.timeline?.length) return 1;
    return Math.max(...data.timeline.map((t) => t.count));
  }, [data]);

  // Cache vs DB totals across all cached routes — same dedupe logic as the Cache tab.
  const cacheTotals = useMemo(() => {
    if (!data) return { hits: 0, misses: 0, missWeightedDur: 0, missMaxDur: 0 };
    const seen = new Set<string>();
    const sources = [...(data.topPaths || []), ...(data.slowestPaths || [])];
    let hits = 0;
    let misses = 0;
    let missWeightedDur = 0;
    let missMaxDur = 0;
    for (const p of sources) {
      const key = `${p.method} ${p.path}`;
      if (seen.has(key)) continue;
      const isCached = CACHE_ROUTES.some((r) => matchesCacheRoute(r, p.method, p.path));
      if (!isCached) continue;
      seen.add(key);
      hits += p.cacheHits || 0;
      misses += p.cacheMisses || 0;
      if (p.missAvgDuration != null && p.cacheMisses) {
        missWeightedDur += p.missAvgDuration * p.cacheMisses;
      }
      if (p.missMaxDuration != null && p.missMaxDuration > missMaxDur) {
        missMaxDur = p.missMaxDuration;
      }
    }
    return { hits, misses, missWeightedDur, missMaxDur };
  }, [data]);

  const dbAvg = cacheTotals.misses > 0 ? cacheTotals.missWeightedDur / cacheTotals.misses : 0;
  const hitRatePct =
    cacheTotals.hits + cacheTotals.misses > 0
      ? Math.round((cacheTotals.hits / (cacheTotals.hits + cacheTotals.misses)) * 100)
      : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">API performance and traffic insights</p>
        <div className="flex items-center gap-2">
          <RangeTabs range={range} onChange={setRange} />
          <button
            onClick={() => action.run('refresh', refetch)}
            disabled={action.busy !== null}
            aria-busy={action.busy === 'refresh'}
            aria-label={action.busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {action.busy === 'refresh' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            )}
          </button>
          <button
            onClick={() => { setClearError(null); setShowConfirm(true); }}
            disabled={clearing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear All Logs
          </button>
        </div>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900">Clear all audit logs?</h3>
                <p className="text-xs text-gray-500 mt-1">
                  This permanently deletes every audit log entry in the database. This action cannot be undone.
                </p>
                {clearError && (
                  <p className="text-xs text-red-600 mt-2">{clearError}</p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={clearing}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                disabled={clearing}
                aria-busy={clearing}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                {clearing ? 'Clearing…' : 'Yes, clear all'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 bg-white border border-gray-200 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : !data ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-lg">
          <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No data in this range</p>
        </div>
      ) : (
        <>
          {/* Overview stat cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-4">
            <StatCard
              icon={TrendingUp}
              label="Total Events"
              value={data.overview.total.toLocaleString()}
              sub={`${data.overview.uniqueUsers} users · ${data.overview.guestEvents} guest`}
              color="text-blue-600 bg-blue-50"
            />
            <StatCard
              icon={AlertTriangle}
              label="Failed Requests"
              value={data.overview.failed.toLocaleString()}
              sub={data.overview.total > 0 ? `${((data.overview.failed / data.overview.total) * 100).toFixed(1)}% fail rate` : '0%'}
              color="text-red-600 bg-red-50"
            />
            <StatCard
              icon={Clock}
              label="Avg Response"
              value={formatMs(data.overview.avgDuration)}
              sub={`Max ${formatMs(data.overview.maxDuration)}`}
              color="text-amber-600 bg-amber-50"
            />
            <StatCard
              icon={Zap}
              label="Peak Traffic"
              value={maxTimeline.toLocaleString()}
              sub="events per bucket"
              color="text-purple-600 bg-purple-50"
            />
            <StatCard
              icon={Zap}
              label="Cache Hits"
              value={cacheTotals.hits.toLocaleString()}
              sub={hitRatePct !== null ? `${hitRatePct}% of cached requests` : 'served from memory'}
              color="text-emerald-600 bg-emerald-50"
            />
            <StatCard
              icon={Database}
              label="DB Hits"
              value={cacheTotals.misses.toLocaleString()}
              sub="cache misses — hit the database"
              color="text-rose-600 bg-rose-50"
            />
            <StatCard
              icon={Clock}
              label="DB Avg"
              value={cacheTotals.misses > 0 ? formatMs(dbAvg) : '—'}
              sub={cacheTotals.misses > 0 ? `Max ${formatMs(cacheTotals.missMaxDur)}` : 'no DB hits in range'}
              color="text-rose-600 bg-rose-50"
            />
          </div>

          {/* Timeline chart */}
          <Card title="Traffic Timeline" subtitle={`${data.timeline.length} buckets`}>
            {data.timeline.length === 0 ? (
              <p className="text-xs text-gray-400 py-6 text-center">No events yet</p>
            ) : (
              <>
              <div className="flex items-end gap-0.5 h-32">
                {data.timeline.map((t) => {
                  const h = maxTimeline > 0 ? Math.max(2, (t.count / maxTimeline) * 100) : 0;
                  const failRatio = t.count > 0 ? t.failed / t.count : 0;
                  return (
                    <div
                      key={t._id}
                      className="flex-1 min-w-[4px] h-full flex flex-col justify-end"
                      title={`${new Date(t._id).toLocaleString()}\n${t.count} events · ${t.failed} failed`}
                    >
                      <div className="w-full bg-gray-900 rounded-t hover:bg-gray-700 transition-colors" style={{ height: `${h}%` }}>
                        {failRatio > 0 && (
                          <div className="w-full bg-red-500 rounded-t" style={{ height: `${failRatio * 100}%` }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center justify-between mt-2 text-[10px] lg:text-xs text-gray-400">
                <span>{data.timeline[0] ? new Date(data.timeline[0]._id).toLocaleString() : ''}</span>
                <span>Peak: {maxTimeline.toLocaleString()} events</span>
                <span>{data.timeline[data.timeline.length - 1] ? new Date(data.timeline[data.timeline.length - 1]._id).toLocaleString() : 'now'}</span>
              </div>
              </>
            )}
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
            {/* Status breakdown */}
            <Card title="Status Codes">
              <div className="space-y-2">
                {(['2xx', '3xx', '4xx', '5xx'] as const).map((s) => {
                  const count = statusMap[s] || 0;
                  const pct = data.overview.total > 0 ? (count / data.overview.total) * 100 : 0;
                  return (
                    <div key={s} className="flex items-center gap-3">
                      <span className={`px-2 py-0.5 text-[11px] lg:text-xs font-bold rounded border ${STATUS_COLORS[s]} w-14 text-center`}>
                        {s}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full ${s === '2xx' ? 'bg-green-500' : s === '3xx' ? 'bg-blue-500' : s === '4xx' ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-20 text-right">
                        {count.toLocaleString()} <span className="text-gray-400 text-[11px] lg:text-xs">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Method breakdown */}
            <Card title="HTTP Methods">
              <div className="space-y-2">
                {data.methodBreakdown.map((m) => {
                  const pct = data.overview.total > 0 ? (m.count / data.overview.total) * 100 : 0;
                  return (
                    <div key={m._id} className="flex items-center gap-3">
                      <span className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[m._id] || 'bg-gray-100 text-gray-600'} w-14 text-center`}>
                        {m._id}
                      </span>
                      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gray-900" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-20 text-right">
                        {m.count.toLocaleString()} <span className="text-gray-400 text-[11px] lg:text-xs">({pct.toFixed(1)}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Most called paths */}
            <Card title="Most Called Endpoints" subtitle="Where is traffic going?">
              <div className="space-y-2">
                {data.topPaths.slice(0, 10).map((p, i) => {
                  const cacheInfo = getCacheInfo(p.method, p.path);
                  const hitRate = (p.cacheHits || p.cacheMisses)
                    ? Math.round(((p.cacheHits || 0) / ((p.cacheHits || 0) + (p.cacheMisses || 0))) * 100)
                    : null;
                  return (
                    <div
                      key={`${p.method}-${p.path}-${i}`}
                      className="flex flex-col gap-1 py-1.5 border-b border-gray-100 last:border-0"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] lg:text-xs text-gray-300 w-5">{i + 1}</span>
                        <span className={`px-1.5 py-0.5 text-[10px] lg:text-xs font-bold rounded ${METHOD_COLORS[p.method] || 'bg-gray-100 text-gray-600'}`}>
                          {p.method}
                        </span>
                        <span className="text-xs lg:text-sm font-mono text-gray-700 flex-1 truncate">{p.path}</span>
                        <CacheBadge info={cacheInfo} />
                        <span className={`text-[11px] lg:text-xs font-semibold ${speedClass(p.avgDuration)} w-12 text-right`}>
                          {formatMs(p.avgDuration)}
                        </span>
                        <span className="text-[11px] lg:text-xs font-bold text-gray-900 w-12 text-right">{p.count.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap pl-7">
                        {hitRate !== null && (
                          <span
                            title={`${p.cacheHits} HIT · ${p.cacheMisses} MISS`}
                            className={`text-[10px] lg:text-xs font-semibold px-1 py-0.5 rounded border ${
                              hitRate >= 70
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : hitRate >= 30
                                ? 'text-amber-700 bg-amber-50 border-amber-200'
                                : 'text-gray-600 bg-gray-50 border-gray-200'
                            }`}
                          >
                            {hitRate}% cache hit
                          </span>
                        )}
                        {!!p.uniqueUsers && (
                          <span className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded">
                            {p.uniqueUsers} users
                          </span>
                        )}
                        {p.maxDuration != null && p.maxDuration > 0 && (
                          <span className={`text-[10px] lg:text-xs px-1 py-0.5 rounded border ${speedClass(p.maxDuration)} border-gray-200 bg-white`}>
                            max {formatMs(p.maxDuration)}
                          </span>
                        )}
                        {p.avgSize != null && p.avgSize > 0 && (
                          <span className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded">
                            avg {formatBytes(p.avgSize)}
                          </span>
                        )}
                        {!!p.criticalCount && (
                          <span className="text-[10px] lg:text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded">
                            {p.criticalCount} CRITICAL
                          </span>
                        )}
                        {!!p.warnCount && (
                          <span className="text-[10px] lg:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
                            {p.warnCount} WARN
                          </span>
                        )}
                        {!!p.failCount && (
                          <span className="text-[10px] lg:text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded">
                            {p.failCount} fail
                          </span>
                        )}
                      </div>
                      {p.lastError && (
                        <p className="pl-7 text-[11px] lg:text-xs text-red-600 truncate" title={p.lastError}>
                          ↳ {p.lastError}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Slowest paths — DB-hit only (cache misses). Endpoints with no DB hits in the range are hidden. */}
            <Card title="Slowest Endpoints (DB hits only)" subtitle="Ranked by DB-hit avg response time — cache hits are excluded">
              {(() => {
                const dbSlow = data.slowestPaths
                  .filter((p) => (p.cacheMisses || 0) > 0 && (p.missAvgDuration ?? 0) > 0)
                  .sort((a, b) => (b.missAvgDuration ?? 0) - (a.missAvgDuration ?? 0));

                if (dbSlow.length === 0) {
                  return (
                    <p className="text-xs text-gray-400 py-6 text-center">
                      No DB hits recorded in this range (everything was served from cache).
                    </p>
                  );
                }

                return (
                <div className="space-y-2">
                  {dbSlow.map((p, i) => {
                    const cacheInfo = getCacheInfo(p.method, p.path);
                    const hitRate = (p.cacheHits || p.cacheMisses)
                      ? Math.round(((p.cacheHits || 0) / ((p.cacheHits || 0) + (p.cacheMisses || 0))) * 100)
                      : null;
                    const dbAvg = p.missAvgDuration ?? 0;
                    const dbMax = p.missMaxDuration ?? 0;
                    return (
                      <div
                        key={`${p.method}-${p.path}-${i}`}
                        className="flex flex-col gap-1 py-1.5 border-b border-gray-100 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] lg:text-xs text-gray-300 w-5">{i + 1}</span>
                          <span className={`px-1.5 py-0.5 text-[10px] lg:text-xs font-bold rounded ${METHOD_COLORS[p.method] || 'bg-gray-100 text-gray-600'}`}>
                            {p.method}
                          </span>
                          <span className="text-xs lg:text-sm font-mono text-gray-700 flex-1 truncate">{p.path}</span>
                          <CacheBadge info={cacheInfo} />
                          <span
                            className="text-[11px] lg:text-xs text-rose-600 w-20 text-right"
                            title="Slowest DB-hit request in this range"
                          >
                            db max {formatMs(dbMax)}
                          </span>
                          <span
                            className={`text-[11px] lg:text-xs font-bold ${speedClass(dbAvg)} w-20 text-right`}
                            title="Average DB-hit response time"
                          >
                            db avg {formatMs(dbAvg)}
                          </span>
                          <span
                            className="text-[11px] lg:text-xs font-semibold text-rose-700 w-12 text-right"
                            title="DB hits (cache misses) in this range"
                          >
                            {p.cacheMisses}×
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap pl-7">
                          {hitRate !== null && (
                            <span
                              title={`${p.cacheHits} HIT · ${p.cacheMisses} MISS`}
                              className={`text-[10px] lg:text-xs font-semibold px-1 py-0.5 rounded border ${
                                hitRate >= 70
                                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : hitRate >= 30
                                  ? 'text-amber-700 bg-amber-50 border-amber-200'
                                  : 'text-gray-600 bg-gray-50 border-gray-200'
                              }`}
                            >
                              {hitRate}% cache hit
                            </span>
                          )}
                          <span
                            className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded"
                            title="Overall avg (includes cache hits)"
                          >
                            overall {formatMs(p.avgDuration)}
                          </span>
                          <span
                            className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded"
                            title="Total requests in the range"
                          >
                            {p.count}× total
                          </span>
                          {!!p.uniqueUsers && (
                            <span className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded">
                              {p.uniqueUsers} users
                            </span>
                          )}
                          {p.avgSize != null && p.avgSize > 0 && (
                            <span className="text-[10px] lg:text-xs text-gray-500 bg-gray-50 border border-gray-200 px-1 py-0.5 rounded">
                              avg {formatBytes(p.avgSize)}
                            </span>
                          )}
                          {!!p.criticalCount && (
                            <span className="text-[10px] lg:text-xs font-bold text-red-700 bg-red-50 border border-red-200 px-1 py-0.5 rounded">
                              {p.criticalCount} CRITICAL
                            </span>
                          )}
                          {!!p.warnCount && (
                            <span className="text-[10px] lg:text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.5 rounded">
                              {p.warnCount} WARN
                            </span>
                          )}
                          {!!p.failCount && (
                            <span className="text-[10px] lg:text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-1 py-0.5 rounded">
                              {p.failCount} fail
                            </span>
                          )}
                        </div>
                        {p.lastError && (
                          <p className="pl-7 text-[11px] lg:text-xs text-red-600 truncate" title={p.lastError}>
                            ↳ {p.lastError}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                );
              })()}
            </Card>

            {/* Top products */}
            <Card title="Most Viewed Products" subtitle="What shoppers are browsing">
              {data.topProducts.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No product views in this range</p>
              ) : (
                <div className="space-y-1.5">
                  {data.topProducts.map((p, i) => (
                    <div key={p._id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                      <span className="text-[11px] lg:text-xs text-gray-300 w-5">{i + 1}</span>
                      <Eye className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs lg:text-sm font-mono text-gray-700 flex-1 truncate">{p._id}</span>
                      <span className="text-[11px] lg:text-xs text-gray-400 w-16 text-right">{p.uniqueUsers} users</span>
                      <span className="text-xs lg:text-sm font-bold text-gray-900 w-10 text-right">{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Top blogs */}
            <Card title="Most Read Blogs" subtitle="Content engagement">
              {data.topBlogs.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No blog views in this range</p>
              ) : (
                <div className="space-y-1.5">
                  {data.topBlogs.map((b, i) => (
                    <div key={b._id} className="flex items-center gap-2 py-1 border-b border-gray-100 last:border-0">
                      <span className="text-[11px] lg:text-xs text-gray-300 w-5">{i + 1}</span>
                      <BookOpen className="w-3 h-3 text-gray-400 flex-shrink-0" />
                      <span className="text-xs lg:text-sm font-mono text-gray-700 flex-1 truncate">{b._id}</span>
                      <span className="text-xs lg:text-sm font-bold text-gray-900 w-10 text-right">{b.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof Activity; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1.5">
        <div className={`w-7 h-7 rounded-md flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span className="text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl lg:text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-[11px] lg:text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/* ---------------- CACHE TAB ---------------- */

interface CacheRouteStats {
  method: string;
  path: string;
  ttlLabel: string;
  ttlSeconds: number;
  count: number;
  cacheHits: number;
  cacheMisses: number;
  avgDuration: number;
  maxDuration: number;
  hitAvgDuration: number;
  hitMaxDuration: number;
  missAvgDuration: number;
  missMaxDuration: number;
  uniqueUsers: number;
  failCount: number;
  lastAt: string | null;
  hasData: boolean;
  resetReason: string;
  resetAt: string | null;
  lastResetAt: string | null;
}

function formatAbsoluteTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCountdown(iso: string) {
  const diffMs = new Date(iso).getTime() - Date.now();
  if (diffMs <= 0) return 'expired — next request will refill';
  const s = Math.floor(diffMs / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `in ${d}d ${h}h`;
  if (h > 0) return `in ${h}h ${m}m`;
  if (m > 0) return `in ${m}m`;
  return `in ${s}s`;
}

function matchesCacheRoute(
  entry: { method: string; match: 'exact' | 'prefix'; path: string },
  method: string,
  path: string,
) {
  if (entry.method !== method) return false;
  const clean = (path || '').split('?')[0];
  return entry.match === 'exact' ? entry.path === clean : clean.startsWith(entry.path);
}

function CacheResetInfo({ row, onOpen }: { row: CacheRouteStats; onOpen: (r: CacheRouteStats) => void }) {
  return (
    <button
      type="button"
      aria-label="Show cache reset details"
      title="View cache reset details"
      onClick={(e) => { e.stopPropagation(); onOpen(row); }}
      className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-colors"
    >
      <Eye className="w-3.5 h-3.5" />
    </button>
  );
}

function CacheResetModal({ row, onClose }: { row: CacheRouteStats; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const hitRate =
    row.cacheHits + row.cacheMisses > 0
      ? Math.round((row.cacheHits / (row.cacheHits + row.cacheMisses)) * 100)
      : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cache-reset-modal-title"
    >
      <div
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[row.method] || 'bg-gray-100 text-gray-600'}`}>
                {row.method}
              </span>
              <span className="text-[11px] lg:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                TTL {row.ttlLabel}
              </span>
            </div>
            <h3 id="cache-reset-modal-title" className="text-sm font-semibold text-gray-900 font-mono truncate">
              {row.path}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-md text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          <section>
            <div className="text-[11px] lg:text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Next natural reset
            </div>
            {row.lastAt && row.resetAt ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-base font-bold text-gray-900 font-mono">
                  {formatCountdown(row.resetAt)}
                </div>
                <div className="text-xs lg:text-sm text-gray-500 mt-0.5">
                  {formatAbsoluteTime(row.resetAt)}
                </div>
                <div className="text-[11px] lg:text-xs text-gray-400 mt-2">
                  Last filled {timeAgo(row.lastAt)} · entry lives for {row.ttlLabel} from then.
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-700">
                  Cache is empty
                </div>
                <div className="text-xs lg:text-sm text-gray-500 mt-0.5">
                  No traffic in the selected range — the first request will populate it and start the {row.ttlLabel} timer.
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="text-[11px] lg:text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Last reset
            </div>
            {row.lastResetAt ? (
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                <div className="text-base font-bold text-rose-800 font-mono">
                  {timeAgo(row.lastResetAt)}
                </div>
                <div className="text-xs lg:text-sm text-rose-700 mt-0.5">
                  {formatAbsoluteTime(row.lastResetAt)}
                </div>
                <div className="text-[11px] lg:text-xs text-rose-600 mt-1.5">
                  Last time this cache tag was invalidated (admin CRUD or Reset All Caches).
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <div className="text-sm font-semibold text-gray-700">Never</div>
                <div className="text-xs lg:text-sm text-gray-500 mt-0.5">
                  This cache tag has not been invalidated since the server started.
                </div>
              </div>
            )}
          </section>

          <section>
            <div className="text-[11px] lg:text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Why it resets
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-[12px] text-amber-900 leading-relaxed">
              {row.resetReason}
            </div>
          </section>

          <section>
            <div className="text-[11px] lg:text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Traffic (selected range)
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <div className="text-[11px] lg:text-xs text-emerald-700 font-semibold">Cache Hits</div>
                <div className="text-base font-bold text-emerald-800">{row.cacheHits.toLocaleString()}</div>
                <div className="text-[10px] lg:text-xs text-emerald-600">served from memory</div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <div className="text-[11px] lg:text-xs text-rose-700 font-semibold">DB Hits</div>
                <div className="text-base font-bold text-rose-800">{row.cacheMisses.toLocaleString()}</div>
                <div className="text-[10px] lg:text-xs text-rose-600">hit the database</div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                <div className="text-[11px] lg:text-xs text-gray-600 font-semibold">Hit Rate</div>
                <div className="text-base font-bold text-gray-900">{hitRate !== null ? `${hitRate}%` : '—'}</div>
                <div className="text-[10px] lg:text-xs text-gray-500">{row.count.toLocaleString()} requests</div>
              </div>
            </div>
          </section>

          <section>
            <div className="text-[11px] lg:text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
              Response time
            </div>
            <div className="grid grid-cols-3 gap-2 text-[12px] mb-2">
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                <div className="text-[11px] lg:text-xs text-emerald-700 font-semibold">Cache Avg</div>
                <div className={`font-semibold ${speedClass(row.cacheHits > 0 ? row.hitAvgDuration : null)}`}>
                  {row.cacheHits > 0 ? formatMs(row.hitAvgDuration) : '—'}
                </div>
                <div className="text-[10px] lg:text-xs text-emerald-600">
                  max {row.cacheHits > 0 ? formatMs(row.hitMaxDuration) : '—'}
                </div>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-lg p-2.5">
                <div className="text-[11px] lg:text-xs text-rose-700 font-semibold">DB Avg</div>
                <div className={`font-semibold ${speedClass(row.cacheMisses > 0 ? row.missAvgDuration : null)}`}>
                  {row.cacheMisses > 0 ? formatMs(row.missAvgDuration) : '—'}
                </div>
                <div className="text-[10px] lg:text-xs text-rose-600">
                  max {row.cacheMisses > 0 ? formatMs(row.missMaxDuration) : '—'}
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-2.5">
                <div className="text-[11px] lg:text-xs text-gray-600 font-semibold">Overall Avg</div>
                <div className={`font-semibold ${speedClass(row.hasData ? row.avgDuration : null)}`}>
                  {row.hasData ? formatMs(row.avgDuration) : '—'}
                </div>
                <div className="text-[10px] lg:text-xs text-gray-500">
                  max {row.hasData ? formatMs(row.maxDuration) : '—'}
                </div>
              </div>
            </div>
            <p className="text-[11px] lg:text-xs text-gray-400">
              Cache Avg = served from memory. DB Avg = cache miss, went to the database.
            </p>
          </section>
        </div>

        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function CacheTab() {
  const [range, setRange] = useState<Range>('24h');
  const { data, loading, refetch } = useAnalytics(range);
  const [selectedRow, setSelectedRow] = useState<CacheRouteStats | null>(null);
  const [resetMap, setResetMap] = useState<Record<string, string>>({});
  const [resetAllAt, setResetAllAt] = useState<string | null>(null);

  const fetchResets = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/cache/resets`, { headers: getAuthHeader() });
      if (!res.ok) return;
      const json = await res.json();
      setResetMap(json.data?.tags || {});
      setResetAllAt(json.data?.lastInvalidatedAllAt || null);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => { fetchResets(); }, [fetchResets]);
  useEffect(() => {
    const id = setInterval(fetchResets, 15000);
    return () => clearInterval(id);
  }, [fetchResets]);

  const combinedRefetch = useCallback(
    () => Promise.all([refetch(), fetchResets()]),
    [refetch, fetchResets],
  );
  const action = useBusyAction<'refresh'>();

  const cacheStats: CacheRouteStats[] = useMemo(() => {
    return CACHE_ROUTES.map((route) => {
      const sources = [
        ...(data?.topPaths || []),
        ...(data?.slowestPaths || []),
      ];
      const seen = new Set<string>();
      const matches = sources.filter((p) => {
        const key = `${p.method} ${p.path}`;
        if (seen.has(key)) return false;
        if (!matchesCacheRoute(route, p.method, p.path)) return false;
        seen.add(key);
        return true;
      });

      let count = 0;
      let cacheHits = 0;
      let cacheMisses = 0;
      let weightedDuration = 0;
      let maxDuration = 0;
      let uniqueUsers = 0;
      let failCount = 0;
      let lastAt: string | null = null;
      let hitWeightedDuration = 0;
      let hitMaxDuration = 0;
      let missWeightedDuration = 0;
      let missMaxDuration = 0;

      for (const m of matches) {
        count += m.count;
        cacheHits += m.cacheHits || 0;
        cacheMisses += m.cacheMisses || 0;
        weightedDuration += (m.avgDuration || 0) * m.count;
        if ((m.maxDuration || 0) > maxDuration) maxDuration = m.maxDuration || 0;
        if (m.uniqueUsers && m.uniqueUsers > uniqueUsers) uniqueUsers = m.uniqueUsers;
        failCount += m.failCount || 0;
        if (m.lastAt && (!lastAt || new Date(m.lastAt) > new Date(lastAt))) lastAt = m.lastAt;

        if (m.hitAvgDuration != null && m.cacheHits) {
          hitWeightedDuration += m.hitAvgDuration * m.cacheHits;
        }
        if (m.hitMaxDuration != null && m.hitMaxDuration > hitMaxDuration) {
          hitMaxDuration = m.hitMaxDuration;
        }
        if (m.missAvgDuration != null && m.cacheMisses) {
          missWeightedDuration += m.missAvgDuration * m.cacheMisses;
        }
        if (m.missMaxDuration != null && m.missMaxDuration > missMaxDuration) {
          missMaxDuration = m.missMaxDuration;
        }
      }

      const resetAt = lastAt
        ? new Date(new Date(lastAt).getTime() + route.ttlSeconds * 1000).toISOString()
        : null;

      let lastResetAt: string | null = null;
      for (const tag of route.tags) {
        const ts = resetMap[tag];
        if (ts && (!lastResetAt || new Date(ts) > new Date(lastResetAt))) lastResetAt = ts;
      }
      if (resetAllAt && (!lastResetAt || new Date(resetAllAt) > new Date(lastResetAt))) {
        lastResetAt = resetAllAt;
      }

      return {
        method: route.method,
        path: route.path,
        ttlLabel: formatTtl(route.ttlSeconds),
        ttlSeconds: route.ttlSeconds,
        count,
        cacheHits,
        cacheMisses,
        avgDuration: count > 0 ? weightedDuration / count : 0,
        maxDuration,
        hitAvgDuration: cacheHits > 0 ? hitWeightedDuration / cacheHits : 0,
        hitMaxDuration,
        missAvgDuration: cacheMisses > 0 ? missWeightedDuration / cacheMisses : 0,
        missMaxDuration,
        uniqueUsers,
        failCount,
        lastAt,
        hasData: count > 0,
        resetReason: route.resetReason,
        resetAt,
        lastResetAt,
      };
    }).sort((a, b) => b.count - a.count);
  }, [data, resetMap, resetAllAt]);

  const totals = useMemo(() => {
    const t = cacheStats.reduce(
      (acc, r) => {
        acc.count += r.count;
        acc.hits += r.cacheHits;
        acc.misses += r.cacheMisses;
        acc.weightedDur += r.avgDuration * r.count;
        if (r.maxDuration > acc.maxDur) acc.maxDur = r.maxDuration;
        return acc;
      },
      { count: 0, hits: 0, misses: 0, weightedDur: 0, maxDur: 0 },
    );
    const hitRate = t.hits + t.misses > 0 ? Math.round((t.hits / (t.hits + t.misses)) * 100) : null;
    const avgDur = t.count > 0 ? t.weightedDur / t.count : 0;
    return { ...t, hitRate, avgDur };
  }, [cacheStats]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs text-gray-500">
          Cached API endpoints · TTL from <span className="font-mono">cache(ttl, tag)</span> middleware
        </p>
        <div className="flex items-center gap-2">
          <RangeTabs range={range} onChange={setRange} />
          <button
            onClick={() => action.run('refresh', combinedRefetch)}
            disabled={action.busy !== null}
            aria-busy={action.busy === 'refresh'}
            aria-label={action.busy === 'refresh' ? 'Refreshing…' : 'Refresh'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {action.busy === 'refresh' ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            )}
          </button>
        </div>
      </div>

      {/* Overview stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-4">
        <StatCard
          icon={Database}
          label="Cached Routes"
          value={String(CACHE_ROUTES.length)}
          sub={`${cacheStats.filter((r) => r.hasData).length} with traffic`}
          color="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          icon={Zap}
          label="Cache Hits"
          value={totals.hits.toLocaleString()}
          sub="served from memory (no DB)"
          color="text-emerald-600 bg-emerald-50"
        />
        <StatCard
          icon={Database}
          label="DB Hits"
          value={totals.misses.toLocaleString()}
          sub="cache misses — hit the database"
          color="text-rose-600 bg-rose-50"
        />
        <StatCard
          icon={TrendingUp}
          label="Hit Rate"
          value={totals.hitRate !== null ? `${totals.hitRate}%` : '—'}
          sub={`${totals.count.toLocaleString()} total requests`}
          color={
            totals.hitRate !== null && totals.hitRate >= 70
              ? 'text-emerald-600 bg-emerald-50'
              : totals.hitRate !== null && totals.hitRate >= 30
              ? 'text-amber-600 bg-amber-50'
              : 'text-gray-600 bg-gray-100'
          }
        />
        <StatCard
          icon={Clock}
          label="Avg Response"
          value={formatMs(totals.avgDur)}
          sub={`Max ${formatMs(totals.maxDur)}`}
          color="text-purple-600 bg-purple-50"
        />
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20 bg-white border border-gray-200 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left">
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">Endpoint</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs">TTL</th>
                  <th className="px-4 py-2.5 font-medium text-emerald-700 text-xs" title="Requests served from in-memory cache — no DB query">Cache</th>
                  <th className="px-4 py-2.5 font-medium text-rose-700 text-xs" title="Cache misses — count + avg / max response time">DB</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs" title="When this cache tag was last invalidated by an admin action">Last Reset</th>
                  <th className="px-4 py-2.5 font-medium text-gray-600 text-xs text-center">Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {cacheStats.map((r) => {
                  const hitRate =
                    r.cacheHits + r.cacheMisses > 0
                      ? Math.round((r.cacheHits / (r.cacheHits + r.cacheMisses)) * 100)
                      : null;
                  return (
                    <tr
                      key={`${r.method} ${r.path}`}
                      className={`hover:bg-gray-50 ${!r.hasData ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-2.5 align-top">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`flex-shrink-0 px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[r.method] || 'bg-gray-100 text-gray-600'}`}>
                            {r.method}
                          </span>
                          <span className="text-xs lg:text-sm text-gray-800 font-mono truncate block max-w-[260px]" title={r.path}>
                            {r.path}
                          </span>
                        </div>
                        <div className="text-[10px] lg:text-xs text-gray-400 mt-0.5 pl-[34px]">
                          {r.count.toLocaleString()} total · {r.lastAt ? `last ${timeAgo(r.lastAt)}` : 'no traffic'}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <span className="text-[11px] lg:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          {r.ttlLabel}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        <div
                          className="inline-flex flex-col items-start gap-0.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1.5 py-0.5"
                          title="Requests served from in-memory cache"
                        >
                          <span className="inline-flex items-center gap-1 text-xs lg:text-sm font-semibold">
                            <Zap className="w-3 h-3" />
                            {r.cacheHits.toLocaleString()}
                            <span className="text-emerald-500 font-normal">hits</span>
                          </span>
                          <span className="text-xs lg:text-sm font-mono text-emerald-600 leading-tight">
                            {hitRate !== null ? `${hitRate}% hit rate` : 'no traffic'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        {r.cacheMisses > 0 ? (
                          <div
                            className="inline-flex flex-col items-start gap-0.5 text-rose-700 bg-rose-50 border border-rose-200 rounded px-1.5 py-0.5"
                            title="DB hits (cache misses) — count, avg, max"
                          >
                            <span className="inline-flex items-center gap-1 text-xs lg:text-sm font-semibold">
                              <Database className="w-3 h-3" />
                              {r.cacheMisses.toLocaleString()}
                              <span className="text-rose-500 font-normal">hits</span>
                            </span>
                            <span className="text-xs lg:text-sm font-mono text-rose-600 leading-tight">
                              avg <b className={speedClass(r.missAvgDuration)}>{formatMs(r.missAvgDuration)}</b>
                              {' · '}
                              max <b className={speedClass(r.missMaxDuration)}>{formatMs(r.missMaxDuration)}</b>
                            </span>
                          </div>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs lg:text-sm font-semibold text-gray-400 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded"
                            title="No DB hits in this range"
                          >
                            <Database className="w-3 h-3" />
                            0
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top">
                        {r.lastResetAt ? (
                          <span
                            className="text-[11px] lg:text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded"
                            title={`Cache last flushed ${formatAbsoluteTime(r.lastResetAt)}`}
                          >
                            {timeAgo(r.lastResetAt)}
                          </span>
                        ) : (
                          <span
                            className="text-[11px] lg:text-xs text-gray-400"
                            title="Cache has not been invalidated since the server started"
                          >
                            never
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 align-top text-center">
                        <CacheResetInfo row={r} onOpen={setSelectedRow} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile */}
          <div className="md:hidden divide-y divide-gray-100">
            {cacheStats.map((r) => {
              const hitRate =
                r.cacheHits + r.cacheMisses > 0
                  ? Math.round((r.cacheHits / (r.cacheHits + r.cacheMisses)) * 100)
                  : null;
              return (
                <div key={`${r.method} ${r.path}`} className={`p-3 ${!r.hasData ? 'opacity-60' : ''}`}>
                  <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span className={`px-1.5 py-0.5 text-[11px] lg:text-xs font-bold rounded ${METHOD_COLORS[r.method] || 'bg-gray-100 text-gray-600'}`}>
                      {r.method}
                    </span>
                    <span className="text-[11px] lg:text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                      cache {r.ttlLabel}
                    </span>
                    <span className="ml-auto text-sm font-bold text-gray-900">{r.count.toLocaleString()}</span>
                  </div>
                  <p className="text-xs lg:text-sm font-mono text-gray-700 truncate">{r.path}</p>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <span
                      className="inline-flex items-center gap-1 text-[10px] lg:text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded"
                      title={hitRate !== null ? `${hitRate}% cache hit rate` : 'served from memory'}
                    >
                      <Zap className="w-2.5 h-2.5" />
                      {r.cacheHits} cache{hitRate !== null ? ` · ${hitRate}%` : ''}
                    </span>
                    <span
                      className="inline-flex items-center gap-1 text-[10px] lg:text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded"
                      title={r.cacheMisses > 0 ? `DB hits · avg ${formatMs(r.missAvgDuration)} · max ${formatMs(r.missMaxDuration)}` : 'No DB hits in this range'}
                    >
                      <Database className="w-2.5 h-2.5" />
                      {r.cacheMisses} db{r.cacheMisses > 0 ? ` · ${formatMs(r.missAvgDuration)}` : ''}
                    </span>
                    {r.lastResetAt && (
                      <span
                        className="text-[10px] lg:text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1 py-0.5 rounded"
                        title={`Cache last flushed ${formatAbsoluteTime(r.lastResetAt)}`}
                      >
                        reset {timeAgo(r.lastResetAt)}
                      </span>
                    )}
                    <CacheResetInfo row={r} onOpen={setSelectedRow} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-3 flex items-center gap-3 flex-wrap text-[11px] lg:text-xs text-gray-500">
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
            <Zap className="w-2.5 h-2.5" />
            Cache Hits
          </span>
          = served from memory, no DB query
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-700 font-semibold">
            <Database className="w-2.5 h-2.5" />
            DB Hits
          </span>
          = cache miss, request hit the database
        </span>
        <span className="text-gray-400">
          Stats come from request analytics within the selected range.
        </span>
      </div>

      {selectedRow && (
        <CacheResetModal row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="mb-3">
        <h3 className="text-sm lg:text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-[11px] lg:text-sm text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
