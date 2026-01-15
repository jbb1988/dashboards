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
  badge?: string;
  disabled?: boolean;
}

interface NavCategory {
  name: string;
  items: NavItem[];
}

// Static nav structure - will be filtered by permissions
const navCategories: NavCategory[] = [
  {
    name: 'Contracts',
    items: [
      {
        name: 'Contracts Pipeline',
        href: '/contracts-dashboard',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
        badge: 'Salesforce',
      },
      {
        name: 'Contract Review',
        href: '/contracts/review',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        ),
        badge: 'Claude',
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
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        ),
        badge: 'NetSuite',
      },
    ],
  },
  {
    name: 'Project Management',
    items: [
      {
        name: 'Project Tracker',
        href: '/pm-dashboard',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        ),
        badge: 'Asana',
      },
    ],
  },
  {
    name: 'Finance',
    items: [
      {
        name: 'Project Profitability',
        href: '/closeout-dashboard',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
        badge: 'NetSuite',
      },
    ],
  },
  {
    name: 'Operations',
    items: [
      {
        name: 'Coming Soon',
        href: '#',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        ),
        disabled: true,
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
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        ),
        badge: 'Smartsheet',
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
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    name: 'Resources',
    items: [
      {
        name: 'Guides',
        href: '/guides',
        icon: (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        ),
      },
    ],
  },
];

// Badge dot color mapping (matches Data Sources colors exactly)
function getBadgeDotColor(badge: string): string {
  switch (badge) {
    case 'Salesforce':
      return 'bg-[#38BDF8]'; // Blue - matches Salesforce in data sources
    case 'Asana':
      return 'bg-[#E16259]'; // Red - matches Asana in data sources
    case 'DocuSign':
      return 'bg-[#FFD700]'; // Gold - matches DocuSign in data sources
    case 'NetSuite':
      return 'bg-[#F97316]'; // Orange - matches NetSuite in data sources
    case 'Smartsheet':
      return 'bg-[#0073EA]'; // Dark Blue - matches Smartsheet in data sources
    case 'Excel':
      return 'bg-[#22C55E]'; // Green - local files
    case 'Claude':
      return 'bg-[#A855F7]'; // Purple - AI powered (Claude)
    default:
      return 'bg-[#64748B]';
  }
}

interface SidebarProps {
  isCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export default function Sidebar({ isCollapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string>('viewer');
  const [accessibleRoutes, setAccessibleRoutes] = useState<string[]>([]);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);
  const [isAccountPopoverOpen, setIsAccountPopoverOpen] = useState(false);

  // Use controlled or internal state
  const isCollapsed = controlledCollapsed ?? internalCollapsed;

  // Load user and permissions on mount
  useEffect(() => {
    const loadUserAndPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch permissions from API
        try {
          const response = await fetch('/api/user/permissions');
          const data = await response.json();

          if (!data.error) {
            setUserRole(data.role || 'viewer');
            setAccessibleRoutes(data.accessibleRoutes || []);
          }
        } catch (err) {
          console.error('Error fetching user permissions:', err);
          // Fallback: user has no access
          setUserRole('viewer');
          setAccessibleRoutes([]);
        }
      }
      setPermissionsLoaded(true);
    };

    loadUserAndPermissions();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        setUserRole('viewer');
        setAccessibleRoutes([]);
        setPermissionsLoaded(true);
      } else {
        // Reload permissions on auth change
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

  // Filter nav items based on accessible routes from database
  const filteredNavCategories = navCategories.map(category => ({
    ...category,
    items: category.items.filter(item => {
      // Always show disabled items
      if (item.disabled) return true;
      // Admin sees everything
      if (userRole === 'admin') return true;
      // Check if route is in accessible routes
      return accessibleRoutes.some(route =>
        item.href === route || item.href.startsWith(route + '/')
      );
    }),
  })).filter(category => category.items.length > 0);

  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setInternalCollapsed(newValue);
    onCollapsedChange?.(newValue);
    localStorage.setItem('sidebar-collapsed', String(newValue));
  };

  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        width: isCollapsed ? 72 : 256,
      }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="fixed left-0 top-0 h-full bg-[#0B1220] z-50 overflow-hidden flex flex-col"
    >
      {/* Logo */}
      <div className={`flex-shrink-0 p-6 ${isCollapsed ? 'px-3 pt-4' : ''}`}>
        <Link href="/" className="block">
          {isCollapsed ? (
            <div className="w-11 h-11 flex items-center justify-center">
              <img
                src="/mars-icon-collapsed.png"
                alt="MARS"
                className="w-10 h-10 object-contain"
              />
            </div>
          ) : (
            <img
              src="/mars-logo-horizontal.png"
              alt="MARS"
              className="h-10 object-contain"
            />
          )}
        </Link>
        <AnimatePresence>
          {!isCollapsed && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[10px] text-[#64748B] mt-2 tracking-[0.08em] uppercase"
            >
              Executive Dashboards
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Collapse Toggle Button - Below logo */}
      <div className={`px-3 mb-2 ${isCollapsed ? 'px-2' : ''}`}>
        <button
          onClick={toggleCollapsed}
          className={`w-full p-2 rounded-lg bg-[#1E293B] hover:bg-[#2D3B4F] text-[#64748B] hover:text-white transition-all flex items-center ${isCollapsed ? 'justify-center' : 'justify-between px-3'}`}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {!isCollapsed && <span className="text-xs">Collapse</span>}
          <motion.svg
            animate={{ rotate: isCollapsed ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </motion.svg>
        </button>
      </div>

      {/* Navigation by Category */}
      <nav className={`flex-1 px-3 space-y-4 overflow-y-auto ${isCollapsed ? 'px-2' : ''}`}>
        {/* Home Link */}
        <div>
          <Link
            href="/"
            className={`
              flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
              ${isCollapsed ? 'justify-center px-0' : ''}
              ${pathname === '/'
                ? 'bg-[#15233A] text-[#EAF2FF]'
                : 'text-[#8FA3BF] hover:bg-[#151F2E] hover:text-[#CBD5E1]'
              }
            `}
            title={isCollapsed ? 'Home' : undefined}
          >
            {pathname === '/' && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#38BDF8] rounded-r" />
            )}
            <span className={`flex-shrink-0 ${pathname === '/' ? 'text-[#38BDF8]' : 'text-[#64748B] group-hover:text-[#8FA3BF]'}`}>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </span>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.span
                  initial={{ opacity: 0, width: 0 }}
                  animate={{ opacity: 1, width: 'auto' }}
                  exit={{ opacity: 0, width: 0 }}
                  className="font-medium text-[13px] whitespace-nowrap overflow-hidden"
                >
                  Home
                </motion.span>
              )}
            </AnimatePresence>
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-[#1E293B] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                Home
              </div>
            )}
          </Link>
        </div>

        {/* Show loading skeleton while permissions load */}
        {!permissionsLoaded && user && (
          <div className="space-y-2 px-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 bg-[#1E293B]/50 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {permissionsLoaded && filteredNavCategories.map((category) => (
          <div key={category.name}>
            <AnimatePresence>
              {!isCollapsed && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-[10px] font-semibold text-[#475569] uppercase tracking-[0.08em] px-3 mb-2"
                >
                  {category.name}
                </motion.p>
              )}
            </AnimatePresence>
            <div className="space-y-0.5">
              {category.items.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.disabled ? '#' : item.href}
                    className={`
                      flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative
                      ${isCollapsed ? 'justify-center px-0' : ''}
                      ${isActive
                        ? 'bg-[#15233A] text-[#EAF2FF]'
                        : item.disabled
                          ? 'text-[#475569] cursor-not-allowed'
                          : 'text-[#8FA3BF] hover:bg-[#151F2E] hover:text-[#CBD5E1]'
                      }
                    `}
                    onClick={(e) => item.disabled && e.preventDefault()}
                    title={isCollapsed ? item.name : undefined}
                  >
                    {/* Active indicator bar */}
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#38BDF8] rounded-r" />
                    )}
                    <span className={`flex-shrink-0 ${isActive ? 'text-[#38BDF8]' : 'text-[#64748B] group-hover:text-[#8FA3BF]'}`}>
                      {item.icon}
                    </span>
                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: 'auto' }}
                          exit={{ opacity: 0, width: 0 }}
                          className="font-medium text-[13px] whitespace-nowrap overflow-hidden"
                        >
                          {item.name}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {item.badge && !isCollapsed && (
                      <span className={`ml-auto w-2 h-2 rounded-full ${getBadgeDotColor(item.badge)}`} title={item.badge} />
                    )}

                    {/* Tooltip for collapsed state */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-2 px-2 py-1 bg-[#1E293B] text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
                        {item.name}
                        {item.badge && (
                          <span className={`ml-2 w-1.5 h-1.5 rounded-full ${getBadgeDotColor(item.badge)} inline-block`} />
                        )}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom Section - User Avatar + Account Settings Popover */}
      <div className="flex-shrink-0 border-t border-[#1E293B] relative">
        {/* User Avatar - Clickable to open Account Settings */}
        {user && (
          <div className={`p-3 ${isCollapsed ? 'px-2' : ''}`}>
            <button
              onClick={() => setIsAccountPopoverOpen(!isAccountPopoverOpen)}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
                bg-[#1E293B] hover:bg-[#2A3544] transition-all group cursor-pointer
                ${isCollapsed ? 'justify-center px-0' : ''}
              `}
              title={isCollapsed ? 'Account Settings' : undefined}
            >
              <div className="w-8 h-8 rounded-full bg-[#0F172A] flex items-center justify-center flex-shrink-0 border border-[#2A3544]">
                <span className="text-sm text-[#8FA3BF] font-medium">
                  {user.email?.charAt(0).toUpperCase()}
                </span>
              </div>
              {!isCollapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[11px] text-[#8FA3BF] truncate">Account</p>
                  <p className="text-[9px] text-[#475569] capitalize">{userRole}</p>
                </div>
              )}
              {!isCollapsed && (
                <svg
                  className="w-4 h-4 text-[#64748B] group-hover:text-[#8FA3BF] transition-colors"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
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

// Export width constants for use in dashboards
export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 72;
