'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { AccountSettingsPopover } from './AccountSettingsPopover';
import { SidebarCustomizeModal } from './SidebarCustomizeModal';

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
  icon: (
    <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
};

// All available dashboards that can be pinned (excluding Home)
const allDashboards: NavItem[] = [
  {
    name: 'Contract Review',
    href: '/contracts/review',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    name: 'Contracts Pipeline',
    href: '/contracts-dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    name: 'Project Tracker',
    href: '/pm-dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    name: 'Command Center',
    href: '/operations',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    name: 'Playbooks',
    href: '/playbooks',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    name: 'Clause Library',
    href: '/clauses',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    name: 'Diversified Products',
    href: '/diversified-dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
  },
  {
    name: 'Distributors',
    href: '/distributors-dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    name: 'Project Profitability',
    href: '/closeout-dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    name: 'Strategic Initiatives',
    href: '/management-dashboard',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    name: 'User Management',
    href: '/admin',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    name: 'Guides',
    href: '/guides',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
];

// Default pinned routes (excluding Home which is always first)
const DEFAULT_PINNED_ROUTES = [
  '/contracts/review',
  '/contracts-dashboard',
  '/pm-dashboard',
  '/operations',
];

// Collapsible Groups (Accordion) - Only one can be expanded at a time
const navGroups: NavGroup[] = [
  {
    name: 'Contracts',
    items: [
      {
        name: 'Playbooks',
        href: '/playbooks',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      },
      {
        name: 'Clause Library',
        href: '/clauses',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Sales',
    items: [
      {
        name: 'Diversified Products',
        href: '/diversified-dashboard',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
      },
      {
        name: 'Distributors',
        href: '/distributors-dashboard',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Operations',
    items: [
      {
        name: 'Project Profitability',
        href: '/closeout-dashboard',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Management',
    items: [
      {
        name: 'Strategic Initiatives',
        href: '/management-dashboard',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Administration',
    items: [
      {
        name: 'User Management',
        href: '/admin',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
      {
        name: 'Guides',
        href: '/guides',
        icon: (
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      },
    ],
  },
];

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
