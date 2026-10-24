'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import {
  LayoutDashboard,
  Users,
  Package,
  ShoppingCart,
  Settings,
  BookOpen,
  Image,
  FileEdit,
  MessageSquare,
  X,
  Store,
  FolderOpen,
  FileText,
  Undo2,
  Ticket,
  Mail,
  Bell,
  Boxes,
  Truck,
  ClipboardList,
  BarChart3,
  Layers,
  Star,
  Palette,
  Wrench,
  Briefcase,
  CalendarCheck,
  Wallet,
  Building2,
  Receipt,
  Landmark,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Shield,
  TrendingUp,
  LineChart,
  AlertCircle,
  Signal,
  ArrowLeftRight,
  UserCog,
} from 'lucide-react';
import { useAccess } from '@/context/AccessContext';
import { describeAccess } from '@/helper/access';
import { getCurrentUser } from '@/helper/helper';

interface MenuItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
  notificationCount?: number;
  /** Permission key(s) needed to see this item ('view'); any one is enough. */
  perm?: string | string[];
  /** Only the super admin sees it. */
  superOnly?: boolean;
}

interface AdminSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function AdminSidebar({ isOpen, onClose, isCollapsed = false, onToggleCollapse }: AdminSidebarProps) {
  const pathname = usePathname();
  const { access, can, isSuperAdmin, currentBranch } = useAccess();
  const tokenUser = getCurrentUser();
  const footerName =
    `${access?.user?.firstName || tokenUser?.firstName || ''} ${access?.user?.lastName || tokenUser?.lastName || ''}`.trim() || 'Admin';
  const footerRole = describeAccess(access, currentBranch?.name);
  const [siteName, setSiteName] = useState<string>('');
  const [sidebarSearch, setSidebarSearch] = useState('');
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  // Restore collapsed sections from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('adminSidebarCollapsedSections');
      if (stored) setCollapsedSections(JSON.parse(stored));
    } catch {}
  }, []);

  const toggleSection = (label: string) => {
    setCollapsedSections((prev) => {
      const next = { ...prev, [label]: !prev[label] };
      try { localStorage.setItem('adminSidebarCollapsedSections', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const fetchSettings = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/settings`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        const settings = data.data || data;
        if (settings.siteName) {
          setSiteName(settings.siteName);
          localStorage.setItem('siteName', settings.siteName);
        }
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  useEffect(() => {
    // Check localStorage first for instant display
    const cachedSiteName = localStorage.getItem('siteName');
    if (cachedSiteName) {
      setSiteName(cachedSiteName);
    }

    // Then fetch fresh data
    fetchSettings();

    // Listen for storage changes (when settings are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'siteName' && e.newValue) {
        setSiteName(e.newValue);
      }
      if (e.key === 'settingsUpdated') {
        fetchSettings();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Also listen for custom event within same tab
    const handleSettingsUpdate = () => {
      fetchSettings();
    };
    window.addEventListener('settingsUpdated', handleSettingsUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', handleSettingsUpdate);
    };
  }, []);

  // Main Section
  const mainMenuItems: MenuItem[] = [
    { name: 'Dashboard', path: '/admin', icon: <LayoutDashboard className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'dashboard' },
    { name: 'POS', path: '/admin/pos', icon: <Store className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'pos' },
    { name: 'POS Orders', path: '/admin/pos-orders', icon: <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'pos_orders' },
    { name: 'Load', path: '/admin/load', icon: <Signal className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'networks' },
  ];

  // Reports Section — all business analytics reports in one place.
  const reportsMenuItems: MenuItem[] = [
    { name: 'Sales Reports', path: '/admin/reports/sales', icon: <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'report_sales' },
    { name: 'Cost Analysis', path: '/admin/reports/cost-analysis', icon: <LineChart className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'report_cost_analysis' },
    { name: 'Stock', path: '/admin/reports/stock', icon: <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'report_stock' },
    { name: 'Expenses', path: '/admin/reports/expenses', icon: <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'report_expenses' },
    { name: 'Receivables', path: '/admin/reports/receivables', icon: <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'report_receivables' },
    { name: 'Cash in Hand', path: '/admin/reports/cash-in-hand', icon: <Wallet className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'report_cash_in_hand' },
  ];

  // Product Management Section
  const productMenuItems: MenuItem[] = [
    { name: 'Products', path: '/admin/products', icon: <Package className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'products' },
    { name: 'Categories', path: '/admin/products/categories', icon: <Layers className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'product_categories' },
    { name: 'Attributes', path: '/admin/products/attributes', icon: <Palette className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'product_attributes' },
    { name: 'Stock', path: '/admin/products/stock', icon: <Boxes className="w-4 h-4 sm:w-5 sm:h-5" />, perm: ['product_stock', 'stock_receive'] },
  ];

  // Customer Management Section
  const customerMenuItems: MenuItem[] = [
    { name: 'Customers', path: '/admin/users', icon: <Users className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'customers' },
  ];

  // Finance Section
  const financeMenuItems: MenuItem[] = [
    { name: 'Banks', path: '/admin/banks', icon: <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'banks' },
    { name: 'Expenses', path: '/admin/expenses', icon: <Receipt className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'expenses' },
  ];

  // Branches & Staff Section — shops, staff logins, what each role may do, moving stock.
  const branchMenuItems: MenuItem[] = [
    { name: 'Branches', path: '/admin/branches', icon: <Building2 className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'branches' },
    { name: 'Staff Logins', path: '/admin/staff', icon: <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'staff' },
    { name: 'Roles & Permissions', path: '/admin/roles', icon: <Shield className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'roles' },
    { name: 'Stock Transfers', path: '/admin/stock-transfers', icon: <ArrowLeftRight className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'stock_transfers' },
  ];

  // System Settings Section
  const systemMenuItems: MenuItem[] = [
    { name: 'Activity Log', path: '/admin/activity-log', icon: <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'activity_log', superOnly: true },
    { name: 'Settings', path: '/admin/settings', icon: <Settings className="w-4 h-4 sm:w-5 sm:h-5" />, perm: 'settings' },
  ];

  const renderMenuItem = (item: MenuItem) => {
    // Check if this exact path matches, or if it's a parent path (but not when a more specific child path exists)
    let isActive = pathname === item.path;

    // For non-exact matches, check if pathname starts with item.path
    // But exclude cases where another menu item has a more specific match
    if (!isActive && item.path !== '/admin' && pathname?.startsWith(item.path)) {
      // Check if there's a more specific menu item that matches
      const allItems = [...mainMenuItems, ...reportsMenuItems, ...productMenuItems, ...customerMenuItems, ...financeMenuItems, ...branchMenuItems, ...systemMenuItems];
      const hasMoreSpecificMatch = allItems.some(
        other => other.path !== item.path &&
                 other.path.startsWith(item.path) &&
                 pathname?.startsWith(other.path)
      );
      isActive = !hasMoreSpecificMatch;
    }

    const baseClasses = `group flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-md sm:rounded-lg transition-all duration-200`;
    const activeClasses = isActive
      ? 'bg-honey-500 text-white font-semibold'
      : 'text-gray-600 hover:bg-sage-100 hover:text-charcoal';

    return (
      <Link
        key={item.path}
        href={item.path}
        className={`${baseClasses} ${activeClasses} ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}`}
        onClick={onClose}
        title={isCollapsed ? item.name : undefined}
      >
        <span className={`relative ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-honey-600'}`}>
          {item.icon}
          {isCollapsed && item.notificationCount !== undefined && item.notificationCount > 0 && (
            <span className="hidden lg:flex absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-1 items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full">
              {item.notificationCount > 9 ? '9+' : item.notificationCount}
            </span>
          )}
        </span>
        <span className={`flex-1 ${isCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
        {item.notificationCount !== undefined && item.notificationCount > 0 && (
          <span className={`min-w-[18px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 flex items-center justify-center text-[10px] sm:text-xs font-bold bg-red-500 text-white rounded-full ${isCollapsed ? 'lg:hidden' : ''}`}>
            {item.notificationCount > 99 ? '99+' : item.notificationCount}
          </span>
        )}
        {item.badge && (
          <span className={`px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium bg-honey-500 text-white rounded-full ${isCollapsed ? 'lg:hidden' : ''}`}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  };

  return (
    <>
      {/* Mobile sidebar backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-gray-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 overflow-visible transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 lg:static lg:inset-0 ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-64'}`}
      >
        {/* Desktop collapse toggle (floating chevron on the right edge) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex absolute top-5 -right-3 z-40 w-6 h-6 items-center justify-center rounded-full bg-white border border-gray-200 shadow-md text-gray-500 hover:text-charcoal hover:border-honey-500 hover:bg-honey-50 transition-colors"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
        )}

        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo Header */}
          <div className={`flex items-center h-12 sm:h-14 md:h-16 px-3 sm:px-4 border-b border-gray-200 ${isCollapsed ? 'lg:justify-center lg:px-2' : 'justify-between'}`}>
            <div className={`flex items-center gap-2 sm:gap-3 ${isCollapsed ? 'lg:gap-0' : ''}`}>
              <div className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 bg-honey-500 rounded-md sm:rounded-lg shadow-md flex-shrink-0">
                <Store className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
              </div>
              <div className={isCollapsed ? 'lg:hidden' : ''}>
                <h1 className="text-sm sm:text-base font-semibold text-gray-900">{siteName || 'Admin'}</h1>
                <p className="text-[10px] sm:text-xs text-gray-500">Admin Panel</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1 sm:p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md sm:rounded-lg lg:hidden"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 sm:px-3 py-3 sm:py-4 overflow-y-auto admin-scrollbar">
            {/* Search — hidden when collapsed on desktop */}
            <div className={`relative mb-3 ${isCollapsed ? 'lg:hidden' : ''}`}>
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="Search menu..."
                className="w-full pl-8 pr-7 py-2 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-300 focus:bg-white placeholder-gray-400 transition-colors"
              />
              {sidebarSearch && (
                <button onClick={() => setSidebarSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-gray-600">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {(() => {
              const q = sidebarSearch.toLowerCase().trim();
              // Hide what this login may not open (super admin sees everything).
              const allowed = (item: MenuItem) =>
                item.superOnly ? isSuperAdmin || !access : !item.perm || can(item.perm, 'view');
              const filterItems = (items: MenuItem[]) =>
                items.filter(allowed).filter((item) => !q || item.name.toLowerCase().includes(q));

              const sections = [
                { label: 'Main', icon: <LayoutDashboard className="w-3.5 h-3.5" />, items: filterItems(mainMenuItems) },
                { label: 'Reports', icon: <BarChart3 className="w-3.5 h-3.5" />, items: filterItems(reportsMenuItems) },
                { label: 'Product Management', icon: <Package className="w-3.5 h-3.5" />, items: filterItems(productMenuItems) },
                { label: 'Customer Management', icon: <Users className="w-3.5 h-3.5" />, items: filterItems(customerMenuItems) },
                { label: 'Finance', icon: <Wallet className="w-3.5 h-3.5" />, items: filterItems(financeMenuItems) },
                { label: 'Branches & Staff', icon: <Building2 className="w-3.5 h-3.5" />, items: filterItems(branchMenuItems) },
                { label: 'System Settings', icon: <Settings className="w-3.5 h-3.5" />, items: filterItems(systemMenuItems) },
              ];

              const visibleSections = sections.filter((s) => s.items.length > 0);

              if (q && visibleSections.length === 0) {
                return (
                  <div className="text-center py-6">
                    <Search className="w-5 h-5 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No menu items found</p>
                  </div>
                );
              }

              return visibleSections.map((section, idx) => {
                // Auto-expand if search is active; otherwise honor user's collapsed preference
                const isSectionCollapsed = !q && !isCollapsed && !!collapsedSections[section.label];
                const itemCount = section.items.length;
                // Total notification count for this section's items
                const sectionNotifs = section.items.reduce((sum, item) => sum + (item.notificationCount || 0), 0);
                // Is any item in this section currently active?
                const sectionHasActive = section.items.some((it) => pathname === it.path || (it.path !== '/admin' && pathname?.startsWith(it.path)));

                return (
                  <div
                    key={section.label}
                    className={`${idx > 0 ? (isSectionCollapsed ? 'mt-1' : 'mt-3 sm:mt-4') : ''} ${!isSectionCollapsed ? 'space-y-1' : ''}`}
                  >
                    {isCollapsed ? (
                      <>
                        {idx > 0 && <div className="hidden lg:block border-t border-gray-100 mb-2" />}
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleSection(section.label)}
                        className={`relative w-full flex items-center gap-2 sm:gap-2.5 pl-2.5 sm:pl-3 pr-2 sm:pr-2.5 py-2 sm:py-2.5 text-[10px] sm:text-xs font-semibold uppercase tracking-[0.06em] rounded-lg transition-all duration-200 group overflow-hidden ${
                          isSectionCollapsed
                            ? `${sectionHasActive ? 'text-charcoal bg-honey-50/60 border border-honey-200' : 'text-gray-500 bg-gray-50/70 border border-gray-100 hover:bg-white hover:border-honey-200 hover:text-charcoal hover:shadow-sm'}`
                            : 'text-gray-400 hover:text-charcoal mb-1 sm:mb-1.5'
                        }`}
                        aria-expanded={!isSectionCollapsed}
                      >
                        {/* Left accent bar */}
                        {isSectionCollapsed && (
                          <span
                            className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r transition-colors ${
                              sectionHasActive ? 'bg-honey-500' : 'bg-transparent group-hover:bg-honey-600'
                            }`}
                            aria-hidden="true"
                          />
                        )}

                        {/* Icon */}
                        {isSectionCollapsed && (
                          <span className={`flex items-center justify-center w-5 h-5 rounded-md transition-colors ${
                            sectionHasActive ? 'bg-honey-500 text-white' : 'bg-white text-gray-400 group-hover:text-honey-600 border border-gray-200 group-hover:border-honey-300'
                          }`}>
                            {section.icon}
                          </span>
                        )}

                        <span className="truncate flex-1 text-left">{section.label}</span>

                        <span className="flex items-center gap-1.5 flex-shrink-0">
                          {isSectionCollapsed && sectionNotifs > 0 && (
                            <span className="min-w-[16px] h-4 px-1 flex items-center justify-center text-[9px] font-bold bg-red-500 text-white rounded-full normal-case tracking-normal">
                              {sectionNotifs > 9 ? '9+' : sectionNotifs}
                            </span>
                          )}
                          {isSectionCollapsed && itemCount > 0 && (
                            <span className="text-[9px] font-bold text-gray-400 group-hover:text-honey-600 normal-case tracking-normal tabular-nums">
                              {itemCount}
                            </span>
                          )}
                          <ChevronDown
                            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isSectionCollapsed ? 'text-gray-400 group-hover:text-honey-600' : 'text-gray-300 group-hover:text-gray-500'} transition-transform duration-200 ${isSectionCollapsed ? '-rotate-90' : ''}`}
                          />
                        </span>
                      </button>
                    )}
                    {!isSectionCollapsed && section.items.map(renderMenuItem)}
                  </div>
                );
              });
            })()}
          </nav>

          {/* Footer */}
          <div className="p-2 sm:p-3 md:p-4 border-t border-gray-200">
            <div className={`flex items-center gap-2 sm:gap-3 px-2 sm:px-3 py-1.5 sm:py-2 bg-gray-50 rounded-md sm:rounded-lg ${isCollapsed ? 'lg:justify-center lg:px-1' : ''}`} title={isCollapsed ? `${footerName} — ${footerRole}` : undefined}>
              <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-gray-200 rounded-full flex-shrink-0">
                <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 md:w-4 md:h-4 text-gray-600" />
              </div>
              <div className={`flex-1 min-w-0 ${isCollapsed ? 'lg:hidden' : ''}`}>
                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{footerName}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 truncate">{footerRole}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
