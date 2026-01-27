'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, createContext, useContext } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import { AccountSettingsPopover } from './AccountSettingsPopover';

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

// Primary Navigation - Always visible (5 items)
const primaryNavItems: NavItem[] = [
  {
    name: 'Home',
    href: '/',
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
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
  ...primaryNavItems.map(item => item.href),
  ...navGroups.flatMap(group => group.items.map(item => item.href)),
];

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

// Reduced width by 15%: 256 * 0.85 ≈ 218
export const SIDEBAR_WIDTH = 218;
export const SIDEBAR_COLLAPSED_WIDTH = 64;

export default function Sidebar({ isCollapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [accessibleRoutes, setAccessibleRoutes] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false);
  // Accordion state - null means all collapsed (default)
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Use controlled or internal state
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

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
      }
      setPermissionsLoaded(true);
    };

    loadUserAndPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setUserRole('viewer');
        setAccessibleRoutes([]);
        setPermissionsLoaded(true);
      } else {
        loadUserAndPermissions();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
    if (userRole === 'admin') return true;
    return accessibleRoutes.some(route => href === route || href.startsWith(route + '/'));
  };

  const filteredPrimaryNav = primaryNavItems.filter(item => hasAccess(item.href));
  const filteredGroups = navGroups.map(group => ({
    ...group,
    items: group.items.filter(item => hasAccess(item.href)),
  })).filter(group => group.items.length > 0);

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
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed left-0 top-0 h-full bg-[#0B1220] z-50 flex flex-col"
    >
      {/* Logo */}
      <div className={`flex-shrink-0 p-5 ${isCollapsed ? 'px-2 pt-3' : ''}`}>
        <Link href="/" className="block">
          {isCollapsed ? (
            <div className="w-10 h-10 flex items-center justify-center">
              <img
                src="/mars-icon-collapsed.png"
                alt="MARS"
                className="w-9 h-9 object-contain"
              />
            </div>
          ) : (
            <img
              src="/mars-logo-horizontal.png"
              alt="MARS"
              className="h-9 object-contain"
            />
          )}
        </Link>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[9px] text-[#475569] mt-1.5 tracking-[0.08em] uppercase opacity-60"
            >
              Executive Dashboards
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Collapse Toggle Button */}
      <div className={`px-2 mb-2 ${isCollapsed ? 'px-1.5' : ''}`}>
        <button
          onClick={toggleCollapsed}
          className={`w-full p-1.5 rounded-lg bg-[#1E293B] hover:bg-[#2D3B4F] text-[#64748B] hover:text-white transition-all flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-2.5'}`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {!isCollapsed && <span className="text-[11px]">Collapse</span>}
          <motion.svg
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-3.5 h-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </motion.svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 px-2 overflow-y-auto overflow-x-hidden ${isCollapsed ? 'px-1.5' : ''}`} style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style jsx>{`nav::-webkit-scrollbar { display: none; }`}</style>

        {/* Primary Navigation - Always Visible */}
        <div className="space-y-0.5">
          {!permissionsLoaded && user ? (
            // Loading skeleton
            <div className="space-y-1.5 px-1">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-9 bg-[#1E293B]/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            filteredPrimaryNav.map((item) => {
              const isActive = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.disabled ? '#' : item.href}
                  className={`
                    flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 group relative
                    ${isCollapsed ? 'justify-center px-0' : ''}
                    ${isActive
                      ? 'text-white'
                      : 'text-[#8FA3BF]/70 hover:bg-[#151F2E] hover:text-[#CBD5E1]'
                    }
                  `}
                  onClick={(e) => item.disabled && e.preventDefault()}
                  title={isCollapsed ? item.name : undefined}
                >
                  {/* Active indicator bar */}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-[#38BDF8] rounded-r" />
                  )}
                  <span className={`flex-shrink-0 ${isActive ? 'text-[#38BDF8] opacity-100' : 'opacity-60 group-hover:opacity-80'}`}>
                    {item.icon}
                  </span>
                  <AnimatePresence>
                    {!isCollapsed && (
                      <motion.span
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: isActive ? 1 : 0.7, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        className="font-medium text-[12px] whitespace-nowrap overflow-hidden"
                      >
                        {item.name}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-[#1E293B] text-white text-[11px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                      {item.name}
                    </div>
                  )}
                </Link>
              );
            })
          )}
        </div>

        {/* Collapsible Groups */}
        {permissionsLoaded && filteredGroups.length > 0 && (
          <div className="mt-4 space-y-1">
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroup === group.name;
              const hasActiveItem = group.items.some(item => isItemActive(item.href));

              return (
                <div key={group.name}>
                  {/* Group Header */}
                  {!isCollapsed ? (
                    <button
                      onClick={() => toggleGroup(group.name)}
                      className={`
                        w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all
                        ${hasActiveItem ? 'text-[#8FA3BF]' : 'text-[#475569]'}
                        hover:bg-[#151F2E] hover:text-[#8FA3BF]
                      `}
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-60">
                        {group.name}
                      </span>
                      <motion.svg
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.15 }}
                        className="w-3 h-3 opacity-60"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </motion.svg>
                    </button>
                  ) : (
                    // Collapsed state - show divider line instead of header
                    <div className="h-px bg-[#1E293B] my-2 mx-1" />
                  )}

                  {/* Group Items */}
                  <AnimatePresence>
                    {(isExpanded || isCollapsed) && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                      >
                        <div className={`space-y-0.5 ${!isCollapsed ? 'mt-0.5 ml-2' : ''}`}>
                          {group.items.map((item) => {
                            const isActive = isItemActive(item.href);
                            return (
                              <Link
                                key={item.href}
                                href={item.disabled ? '#' : item.href}
                                className={`
                                  flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-200 group relative
                                  ${isCollapsed ? 'justify-center px-0' : ''}
                                  ${isActive
                                    ? 'text-white'
                                    : 'text-[#8FA3BF]/70 hover:bg-[#151F2E] hover:text-[#CBD5E1]'
                                  }
                                `}
                                onClick={(e) => item.disabled && e.preventDefault()}
                                title={isCollapsed ? item.name : undefined}
                              >
                                {/* Active indicator bar */}
                                {isActive && (
                                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2.5px] h-5 bg-[#38BDF8] rounded-r" />
                                )}
                                <span className={`flex-shrink-0 ${isActive ? 'text-[#38BDF8] opacity-100' : 'opacity-60 group-hover:opacity-80'}`}>
                                  {item.icon}
                                </span>
                                <AnimatePresence>
                                  {!isCollapsed && (
                                    <motion.span
                                      initial={{ opacity: 0, width: 0 }}
                                      animate={{ opacity: isActive ? 1 : 0.7, width: 'auto' }}
                                      exit={{ opacity: 0, width: 0 }}
                                      className="font-medium text-[12px] whitespace-nowrap overflow-hidden"
                                    >
                                      {item.name}
                                    </motion.span>
                                  )}
                                </AnimatePresence>
                                {/* Tooltip for collapsed state */}
                                {isCollapsed && (
                                  <div className="absolute left-full ml-2 px-2 py-1 bg-[#1E293B] text-white text-[11px] rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
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

      {/* Footer Section - Separated by divider */}
      <div className="flex-shrink-0 border-t border-[#1E293B]/60">
        {user && (
          <div className={`p-2 ${isCollapsed ? 'px-1.5' : ''}`}>
            <button
              onClick={() => setIsAccountPopoverOpen(!isAccountPopoverOpen)}
              className={`
                flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg
                bg-[#1E293B]/50 hover:bg-[#2A3544] transition-all group cursor-pointer
                ${isCollapsed ? 'justify-center px-0' : ''}
              `}
              title={isCollapsed ? 'Account Settings' : undefined}
            >
              <div className="w-7 h-7 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0 border border-[#2A3544]">
                <span className="text-[11px] text-[#8FA3BF] font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] text-[#8FA3BF] truncate">Account</p>
                  <p className="text-[9px] text-[#475569] capitalize">{userRole}</p>
                </div>
              )}
              {!isCollapsed && (
                <svg
                  className="w-3.5 h-3.5 text-[#64748B] group-hover:text-[#8FA3BF] transition-colors opacity-60"
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
              )}
            </button>

            {/* Account Settings Popover */}
            <AccountSettingsPopover
              isOpen={isAccountPopoverOpen}
              onClose={() => setIsAccountPopoverOpen(false)}
              userEmail={user.email || ''}
              userRole={userRole}
              isCollapsed={isCollapsed}
            />
          </div>
        )}
      </div>
    </motion.div>
  );
}
