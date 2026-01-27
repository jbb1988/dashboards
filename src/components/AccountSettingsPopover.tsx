'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from './Sidebar';

interface AccountSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userRole: string;
  isCollapsed: boolean;
  onCustomizeSidebar?: () => void;
}

// Data sources with monochrome icons
const dataSources = [
  { name: 'Salesforce', status: 'live' as const, icon: 'cloud' },
  { name: 'Asana', status: 'live' as const, icon: 'check-square' },
  { name: 'DocuSign', status: 'live' as const, icon: 'file-signature' },
  { name: 'NetSuite', status: 'live' as const, icon: 'database' },
  { name: 'Smartsheet', status: 'live' as const, icon: 'table' },
  { name: 'Excel', status: 'manual' as const, icon: 'file-spreadsheet' },
];

// Monochrome icon component
function DataSourceIcon({ type }: { type: string }) {
  const iconClass = "w-[18px] h-[18px] text-white/50";

  switch (type) {
    case 'cloud':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
        </svg>
      );
    case 'check-square':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'file-signature':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      );
    case 'database':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
        </svg>
      );
    case 'table':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h7.5c.621 0 1.125-.504 1.125-1.125m-9.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-7.5A1.125 1.125 0 0112 18.375m9.75-12.75c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125m19.5 0v1.5c0 .621-.504 1.125-1.125 1.125M2.25 5.625v1.5c0 .621.504 1.125 1.125 1.125m0 0h17.25m-17.25 0h7.5c.621 0 1.125.504 1.125 1.125M3.375 8.25c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m17.25-3.75h-7.5c-.621 0-1.125.504-1.125 1.125m8.625-1.125c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h7.5m-7.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M12 10.875v-1.5m0 1.5c0 .621-.504 1.125-1.125 1.125M12 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125M10.875 12c-.621 0-1.125.504-1.125 1.125M12 10.875c0-.621.504-1.125 1.125-1.125m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M12 12h.008v.008H12V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
      );
    case 'file-spreadsheet':
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0118 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5m0 3.75v1.5c0 .621.504 1.125 1.125 1.125h1.5m-3.75-3.75h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5m1.5 0h1.5m1.5 0h1.5m3 0h1.5m-1.5 0c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0-3.75h-1.5m1.5 3.75h-1.5m-3-3.75h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m0-3.75v3.75m3-3.75v3.75" />
        </svg>
      );
    default:
      return (
        <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3m3 3a3 3 0 100 6h13.5a3 3 0 100-6m-16.5-3a3 3 0 013-3h13.5a3 3 0 013 3m-19.5 0a4.5 4.5 0 01.9-2.7L5.737 5.1a3.375 3.375 0 012.7-1.35h7.126c1.062 0 2.062.5 2.7 1.35l2.587 3.45a4.5 4.5 0 01.9 2.7m0 0a3 3 0 01-3 3m0 3h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008zm-3 6h.008v.008h-.008v-.008zm0-6h.008v.008h-.008v-.008z" />
        </svg>
      );
  }
}

export function AccountSettingsPopover({
  isOpen,
  onClose,
  userEmail,
  userRole,
  isCollapsed,
  onCustomizeSidebar,
}: AccountSettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={popoverRef}
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
          className="fixed z-50 overflow-hidden"
          style={{
            bottom: '16px',
            left: isCollapsed ? `${SIDEBAR_COLLAPSED_WIDTH + 16}px` : `${SIDEBAR_WIDTH + 16}px`,
            width: '360px',
            borderRadius: '16px',
            // Apple Pro surface
            background: 'rgba(18,24,34,0.92)',
            border: '1px solid rgba(255,255,255,0.08)',
            // Soft wide shadow + inner top highlight
            boxShadow: `
              0 24px 48px -12px rgba(0, 0, 0, 0.5),
              0 8px 24px -8px rgba(0, 0, 0, 0.4),
              inset 0 1px 0 rgba(255,255,255,0.06)
            `,
          }}
        >
          {/* User Info Section - Compressed header */}
          <div className="px-4 py-4">
            <div className="flex items-center gap-3">
              {/* Avatar - 36px */}
              <div className="w-9 h-9 rounded-full bg-white/[0.08] flex items-center justify-center flex-shrink-0">
                <span className="text-[13px] text-white/70 font-medium">
                  {userEmail?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-white/92 font-semibold truncate">{userEmail}</p>
                <p className="text-[11px] text-white/55 capitalize mt-0.5">{userRole}</p>
              </div>
            </div>
          </div>

          {/* Data Sources Section - Monochrome icons + status pills */}
          <div className="px-2 pb-2">
            <h3 className="px-2 text-[11px] font-semibold text-white/35 mb-1">
              Data Sources
            </h3>
            <div className="space-y-0.5">
              {dataSources.map((source) => (
                <div
                  key={source.name}
                  className="flex items-center justify-between h-10 px-2 rounded-xl hover:bg-white/[0.04] transition-colors duration-[180ms] group"
                >
                  <div className="flex items-center gap-3">
                    <DataSourceIcon type={source.icon} />
                    <span className="text-[13px] text-white/70 group-hover:text-white/90 transition-colors">
                      {source.name}
                    </span>
                  </div>
                  {/* Status pill */}
                  {source.status === 'live' ? (
                    <span
                      className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                      style={{
                        background: 'rgba(60,220,120,0.12)',
                        color: 'rgba(60,220,120,0.95)',
                      }}
                    >
                      Live
                    </span>
                  ) : (
                    <span
                      className="px-2 py-0.5 text-[10px] font-medium rounded-full"
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        color: 'rgba(255,255,255,0.70)',
                      }}
                    >
                      Manual
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/[0.06] mx-4" />

          {/* Actions Section - List-style actions */}
          <div className="px-2 py-2">
            {/* Customize Sidebar */}
            {onCustomizeSidebar && (
              <button
                onClick={onCustomizeSidebar}
                onMouseEnter={() => setHoveredAction('customize')}
                onMouseLeave={() => setHoveredAction(null)}
                className="w-full flex items-center gap-3 h-11 px-2 rounded-xl hover:bg-white/[0.04] transition-all duration-[180ms] group"
              >
                <svg
                  className="w-[18px] h-[18px] text-white/50 group-hover:text-white/70 transition-colors"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12"
                  />
                </svg>
                <span className="text-[13px] text-white/70 group-hover:text-white/90 transition-colors">
                  Customize Sidebar
                </span>
              </button>
            )}

            {/* Sign Out - Muted red only on hover */}
            <button
              onClick={handleSignOut}
              onMouseEnter={() => setHoveredAction('signout')}
              onMouseLeave={() => setHoveredAction(null)}
              className="w-full flex items-center gap-3 h-11 px-2 rounded-xl hover:bg-white/[0.04] transition-all duration-[180ms] group"
            >
              <svg
                className={`w-[18px] h-[18px] transition-colors duration-[180ms] ${
                  hoveredAction === 'signout' ? 'text-red-400/80' : 'text-white/50'
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                />
              </svg>
              <span className={`text-[13px] transition-colors duration-[180ms] ${
                hoveredAction === 'signout' ? 'text-red-400/80' : 'text-white/70'
              }`}>
                Sign out
              </span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
