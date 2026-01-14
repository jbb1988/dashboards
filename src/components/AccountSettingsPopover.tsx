'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DataSourceStatus } from './DataSourceStatus';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface AccountSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userRole: string;
  isCollapsed: boolean;
}

// Color mapping for data sources (from Sidebar.tsx)
const badgeColors: Record<string, string> = {
  Salesforce: '#38BDF8',
  Asana: '#E16259',
  DocuSign: '#FFD700',
  NetSuite: '#F97316',
  Smartsheet: '#0073EA',
  Excel: '#22C55E',
};

const dataSources = [
  { name: 'Salesforce', status: 'live' as const, color: badgeColors.Salesforce },
  { name: 'Asana', status: 'live' as const, color: badgeColors.Asana },
  { name: 'DocuSign', status: 'live' as const, color: badgeColors.DocuSign },
  { name: 'NetSuite', status: 'live' as const, color: badgeColors.NetSuite },
  { name: 'Smartsheet', status: 'live' as const, color: badgeColors.Smartsheet },
  { name: 'Excel', status: 'manual' as const, color: badgeColors.Excel },
];

export function AccountSettingsPopover({
  isOpen,
  onClose,
  userEmail,
  userRole,
  isCollapsed,
}: AccountSettingsPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

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
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.15, ease: 'easeOut' }}
          className="fixed bg-[#1A2332] border border-[#2A3544] rounded-lg shadow-2xl overflow-hidden z-50"
          style={{
            bottom: '16px',
            left: isCollapsed ? '88px' : '272px',
            width: '280px',
          }}
        >
          {/* User Info Section */}
          <div className="px-4 py-3 border-b border-[#2A3544]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#1E293B] flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-[#8FA3BF] font-medium">
                  {userEmail?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-[#8FA3BF] truncate">{userEmail}</p>
                <p className="text-[9px] text-[#475569] capitalize mt-0.5">{userRole}</p>
              </div>
            </div>
          </div>

          {/* Data Sources Section */}
          <div className="px-4 py-3 border-b border-[#2A3544]">
            <h3 className="text-[9px] text-[#64748B] uppercase tracking-wider mb-2 font-medium">
              Data Sources
            </h3>
            <div className="space-y-0.5">
              {dataSources.map((source) => (
                <DataSourceStatus
                  key={source.name}
                  name={source.name}
                  status={source.status}
                  color={source.color}
                  variant="popover"
                />
              ))}
            </div>
          </div>

          {/* Sign Out Button */}
          <div className="px-4 py-3">
            <button
              onClick={handleSignOut}
              className="w-full px-3 py-2 text-[11px] text-[#8FA3BF] bg-[#1E293B] hover:bg-[#2A3544] rounded-md transition-colors duration-150 flex items-center justify-center gap-2"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              Sign out
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
