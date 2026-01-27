'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { AccountSettingsPopover } from './AccountSettingsPopover';
import { SidebarCustomizeModal } from './SidebarCustomizeModal';
import { departments, allDashboards as navDashboards, DEFAULT_PINNED_ROUTES } from '@/lib/navigation';
import { getDashboardIcon } from '@/lib/navigation-icons';

// Context for sidebar state - allows dashboards to respond to collapse
export const SidebarContext = createContext<{
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean) => void;
}>({
  isCollapsed: false,
  setIsCollapsed: () => {},
});

export const useSidebar = () => useContext(SidebarContext);

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

interface NavGroup {
  name: string;
  items: NavItem[];
}

// Home item - always pinned first (non-removable)
const homeNavItem: NavItem = {
  name: 'Home',
  href: '/',
  icon: getDashboardIcon('home'),
};

// Build NavItems from shared navigation config (excluding Home)
const allDashboards: NavItem[] = navDashboards.map(d => ({
  name: d.name,
  href: d.href,
  icon: getDashboardIcon(d.icon),
  disabled: d.disabled,
}));

// Build navigation groups from departments (dynamically from shared config)
const navGroups: NavGroup[] = departments.map(dept => ({
  name: dept.name,
  items: dept.dashboards.map(d => ({
    name: d.name,
    href: d.href,
    icon: getDashboardIcon(d.icon),
    disabled: d.disabled,
  })),
}));

// Collect all routes for permission filtering
const allRoutes = [
  homeNavItem.href,
  ...allDashboards.map(item => item.href),
];

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// Apple Pro spec: 272px expanded, 72px collapsed
export const SIDEBAR_WIDTH = 272;
export const SIDEBAR_COLLAPSED_WIDTH = 72;

export default function Sidebar({ isCollapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [accessibleRoutes, setAccessibleRoutes] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false);
  const [isCustomizeModalOpen, setIsCustomizeModalOpen] = useState(false);
  // Accordion state - null means all collapsed (default per spec)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  // Pinned dashboards state (excluding Home)
  const [pinnedRoutes, setPinnedRoutes] = useState<string[]>(DEFAULT_PINNED_ROUTES);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  // Hover state for section headers (show chevron only on hover)
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // Use controlled or internal state
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  // Load sidebar preferences
  const loadSidebarPreferences = useCallback(async () => {
    try {
      const response = await fetch('/api/user/sidebar-preferences');
      const data = await response.json();
      if (!data.error && data.pinnedDashboards) {
        setPinnedRoutes(data.pinnedDashboards);
      }
    } catch (err) {
      console.error('Error fetching sidebar preferences:', err);
    }
    setPreferencesLoaded(true);
  }, []);

  // Load user and permissions on mount
  useEffect(() => {
    const loadUserAndPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        try {
          const response = await fetch('/api/user/permissions');
          const data = await response.json();

          if (!data.error) {
            setUserRole(data.role || 'viewer');
            setAccessibleRoutes(data.accessibleRoutes || []);
          }
        } catch (err) {
          console.error('Error fetching user permissions:', err);
          setUserRole('viewer');
          setAccessibleRoutes([]);
        }
        // Load sidebar preferences after user is authenticated
        loadSidebarPreferences();
      }
      setPermissionsLoaded(true);
    };

    loadUserAndPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setUserRole('viewer');
        setAccessibleRoutes([]);
        setPinnedRoutes(DEFAULT_PINNED_ROUTES);
        setPermissionsLoaded(true);
        setPreferencesLoaded(true);
      } else {
        loadUserAndPermissions();
      }
    });

    return () => subscription.unsubscribe();
  }, [loadSidebarPreferences]);

  // Load collapsed state from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    if (saved !== null) {
      const value = saved === 'true';
      setInternalCollapsed(value);
      onCollapsedChange?.(value);
    }
  }, []);

  // Filter items based on permissions
  const hasAccess = (href: string) => {
    if (href === '/') return true; // Home is always accessible
    if (userRole === 'admin') return true;
    return accessibleRoutes.some(route => href === route || href.startsWith(route + '/'));
  };

  // Build primary nav: Home + pinned dashboards (filtered by access)
  const filteredPinnedRoutes = pinnedRoutes.filter(route => hasAccess(route));
  const primaryNavItems: NavItem[] = [
    homeNavItem,
    ...filteredPinnedRoutes.map(route => allDashboards.find(d => d.href === route)!).filter(Boolean),
  ];

  // Build accordion groups with unpinned dashboards
  const unpinnedDashboards = allDashboards.filter(d =>
    !pinnedRoutes.includes(d.href) && hasAccess(d.href)
  );

  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item =>
      hasAccess(item.href) && !pinnedRoutes.includes(item.href)
    ),
  })).filter(group => group.items.length > 0);

  // Available dashboards for customization modal (only those user has access to)
  const availableDashboardsForCustomization = allDashboards.filter(d => hasAccess(d.href));

  // Save sidebar preferences handler
  const handleSavePreferences = async (newPinnedRoutes: string[]) => {
    const response = await fetch('/api/user/sidebar-preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinnedDashboards: newPinnedRoutes }),
    });

    if (!response.ok) {
      throw new Error('Failed to save preferences');
    }

    const data = await response.json();
    setPinnedRoutes(data.pinnedDashboards);
  };

  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setInternalCollapsed(newValue);
    onCollapsedChange?.(newValue);
    localStorage.setItem('sidebar-collapsed', String(newValue));
  };

  const toggleGroup = (groupName: string) => {
    // Accordion: clicking same group closes it, clicking different group opens it and closes others
    setExpandedGroup(prev => prev === groupName ? null : groupName);
  };

  const isItemActive = (href: string) => pathname === href || pathname?.startsWith(href + '/');

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        width: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
      }}
      transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
      className="fixed left-0 top-0 h-full z-50 flex flex-col"
      style={{
        // Apple Pro gradient background
        background: 'linear-gradient(to bottom, rgba(8,12,18,0.92), rgba(6,10,16,0.98))',
        // Right edge inner highlight only
        boxShadow: 'inset -1px 0 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Logo Header with Collapse Control */}
      <div className={`flex-shrink-0 relative ${isCollapsed ? 'px-3 pt-4 pb-3' : 'pl-4 pr-3 pt-4 pb-3.5'}`}>
        <div className="flex items-start justify-between">
          <Link href="/" className="block">
            {isCollapsed ? (
              <div className="w-10 h-10 flex items-center justify-center">
                <img
                  src="/mars-icon-collapsed.png"
                  alt="MARS"
                  className="w-8 h-8 object-contain"
                />
              </div>
            ) : (
              <div>
                <img
                  src="/mars-logo-horizontal.png"
                  alt="MARS"
                  className="h-7 object-contain"
                  style={{ maxHeight: '28px' }}
                />
                <p className="text-[9px] text-white/45 mt-1 tracking-[0.06em]">
                  Executive Dashboards
                </p>
              </div>
            )}
          </Link>

          {/* Collapse Control - Icon only, top-right */}
          <button
            onClick={toggleCollapsed}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-white/70 hover:bg-white/[0.04] transition-all duration-[180ms]"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <motion.svg
              animate={{ rotate: isCollapsed ? 180 : 0 }}
              transition={{ duration: 0.18 }}
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </motion.svg>
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-3' : 'px-4'}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`nav::-webkit-scrollbar { display: none; }`}</style>

        {/* Primary Navigation - Always Visible */}
        <div className="space-y-0.5">
          {!permissionsLoaded && user ? (
            // Loading skeleton
            <div className="space-y-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-10 bg-white/[0.02] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            primaryNavItems.map((item) => {
              const isActive = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  className={`
                    flex items-center h-10 rounded-xl transition-all duration-[180ms] group relative
                    ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'}
                    ${isActive
                      ? 'bg-[rgba(88,160,255,0.10)]'
                      : 'hover:bg-white/[0.04]'
                    }
                  `}
                  onClick={(e) => item.disabled && e.preventDefault()}
                  title={isCollapsed ? item.name : undefined}
                >
                  {/* Active indicator - 2px left accent line */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[rgba(88,160,255,0.95)] rounded-sm" />
                  )}
                  <span className={`flex-shrink-0 w-6 flex items-center justify-center ${
                    isActive
                      ? 'text-[rgba(88,160,255,0.95)] opacity-100'
                      : 'text-white/60 group-hover:opacity-85'
                  }`}>
                    {item.icon}
                  </span>
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className={`text-[13px] whitespace-nowrap overflow-hidden ${
                          isActive
                            ? 'text-white font-semibold'
                            : 'text-white/70 group-hover:text-white/90'
                        }`}
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[rgba(18,24,34,0.95)] text-white/90 text-[12px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-white/[0.08]">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>

        {/* Collapsible Groups - 20px section spacing */}
        {permissionsLoaded && filteredGroups.length > 0 && (
          <div className="mt-5 space-y-5">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroup === group.name;
              const hasActiveItem = group.items.some(item => isItemActive(item.href));
              const isHovered = hoveredGroup === group.name;

              return (
                <div key={group.name}>
                  {/* Group Header - Title Case, 11px, 35% opacity */}
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleGroup(group.name)}
                      onMouseEnter={() => setHoveredGroup(group.name)}
                      onMouseLeave={() => setHoveredGroup(null)}
                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg transition-all duration-[180ms] group"
                    >
                      <span className="text-[11px] font-semibold text-white/35">
                        {group.name}
                      </span>
                      <motion.svg
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.15 }}
                        className={`w-3 h-3 transition-opacity duration-[180ms] ${
                          isHovered || isExpanded ? 'opacity-50' : 'opacity-0'
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>
                  ) : (
                    // Collapsed state - subtle divider
                    <div className="h-px bg-white/[0.06] my-2 mx-2" />
                  )}

                  {/* Group Items - 12px indent when expanded */}
                  <AnimatePresence>
                    {(isExpanded || isCollapsed) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className={`space-y-0.5 ${!isCollapsed ? 'mt-1 ml-3' : ''}`}>
                          {group.items.map((item) => {
                            const isActive = isItemActive(item.href);
                            return (
                              <Link
                                key={item.href}
                                href={item.disabled ? '#' : item.href}
                                className={`
                                  flex items-center h-10 rounded-xl transition-all duration-[180ms] group relative
                                  ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'}
                                  ${isActive
                                    ? 'bg-[rgba(88,160,255,0.10)]'
                                    : 'hover:bg-white/[0.04]'
                                  }
                                `}
                                onClick={(e) => item.disabled && e.preventDefault()}
                                title={isCollapsed ? item.name : undefined}
                              >
                                {/* Active indicator - 2px left accent line */}
                                {isActive && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-[rgba(88,160,255,0.95)] rounded-sm" />
                                )}
                                <span className={`flex-shrink-0 w-6 flex items-center justify-center ${
                                  isActive
                                    ? 'text-[rgba(88,160,255,0.95)] opacity-100'
                                    : 'text-white/60 group-hover:opacity-85'
                                }`}>
                                  {item.icon}
                                </span>
                                <AnimatePresence>
                                  {!isCollapsed && (
                                    <motion.span
                                      initial={{ opacity: 0, width: 0 }}
                                      animate={{ opacity: 1, width: 'auto' }}
                                      exit={{ opacity: 0, width: 0 }}
                                      className={`text-[13px] whitespace-nowrap overflow-hidden ${
                                        isActive
                                          ? 'text-white font-semibold'
                                          : 'text-white/65 group-hover:text-white/90'
                                      }`}
                                    >
                                      {item.name}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                                {/* Tooltip for collapsed state */}
                                {isCollapsed && (
                                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[rgba(18,24,34,0.95)] text-white/90 text-[12px] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity border border-white/[0.08]">
                                    {item.name}
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* Footer Section - Single row button, 44px height */}
      {user && (
        <div className={`flex-shrink-0 ${isCollapsed ? 'px-3 py-3' : 'px-4 py-3'}`}>
          <button
            onClick={() => setIsAccountPopoverOpen(!isAccountPopoverOpen)}
            className={`
              flex items-center h-11 w-full rounded-xl transition-all duration-[180ms] group
              hover:bg-white/[0.04]
              ${isCollapsed ? 'justify-center px-0' : 'px-3 gap-3'}
            `}
            title={isCollapsed ? 'Account Settings' : undefined}
          >
            {/* Avatar - 28px */}
            <div className="w-7 h-7 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
              <span className="text-[11px] text-white/70 font-medium">
                {user.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] text-white/70 truncate group-hover:text-white/90 transition-colors">Account</p>
                  <p className="text-[10px] text-white/35 capitalize">{userRole}</p>
                </div>
                {/* Gear icon - 18px */}
                <svg
                  className="w-[18px] h-[18px] text-white/35 group-hover:text-white/60 transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </>
            )}
          </button>

          {/* Account Settings Popover */}
          <AccountSettingsPopover
            isOpen={isAccountPopoverOpen}
            onClose={() => setIsAccountPopoverOpen(false)}
            userEmail={user.email || ''}
            userRole={userRole}
            isCollapsed={isCollapsed}
            onCustomizeSidebar={() => {
              setIsAccountPopoverOpen(false);
              setIsCustomizeModalOpen(true);
            }}
          />
        </div>
      )}

      {/* Sidebar Customize Modal */}
      <SidebarCustomizeModal
        isOpen={isCustomizeModalOpen}
        onClose={() => setIsCustomizeModalOpen(false)}
        availableDashboards={availableDashboardsForCustomization}
        currentPinned={pinnedRoutes}
        onSave={handleSavePreferences}
      />
    </motion.div>
  );
}
