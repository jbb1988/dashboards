'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';

interface Dashboard {
  name: string;
  href: string;
  icon: React.ReactNode;
}

interface SidebarCustomizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableDashboards: Dashboard[];
  currentPinned: string[];
  onSave: (pinnedDashboards: string[]) => Promise<void>;
}

export function SidebarCustomizeModal({
  isOpen,
  onClose,
  availableDashboards,
  currentPinned,
  onSave,
}: SidebarCustomizeModalProps) {
  const [pinnedRoutes, setPinnedRoutes] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Maximum 4 pinned items (excluding Home)
  const MAX_PINNED = 4;

  // Initialize pinned routes when modal opens
  useEffect(() => {
    if (isOpen) {
      setPinnedRoutes([...currentPinned]);
      setError(null);
    }
  }, [isOpen, currentPinned]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const togglePinned = (href: string) => {
    setError(null);
    if (pinnedRoutes.includes(href)) {
      // Remove from pinned
      setPinnedRoutes(prev => prev.filter(r => r !== href));
    } else {
      // Add to pinned (if under limit)
      if (pinnedRoutes.length >= MAX_PINNED) {
        setError(`Maximum ${MAX_PINNED} pinned dashboards allowed`);
        return;
      }
      setPinnedRoutes(prev => [...prev, href]);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    try {
      await onSave(pinnedRoutes);
      onClose();
    } catch (err) {
      setError('Failed to save preferences');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    // Reset to defaults (same as API defaults)
    setPinnedRoutes([
      '/contracts/review',
      '/contracts-dashboard',
      '/pm-dashboard',
      '/operations',
    ]);
    setError(null);
  };

  // Get dashboard by href
  const getDashboard = (href: string) => availableDashboards.find(d => d.href === href);

  // Separate pinned and unpinned dashboards
  const unpinnedDashboards = availableDashboards.filter(d => !pinnedRoutes.includes(d.href));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-[100]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#1A2332] border border-[#2A3544] rounded-xl shadow-2xl z-[101] overflow-hidden"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-[#2A3544]">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-white">Customize Sidebar</h2>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    Select up to {MAX_PINNED} dashboards to pin (Home is always first)
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="p-1.5 text-[#64748B] hover:text-white hover:bg-[#2A3544] rounded-lg transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4 max-h-[60vh] overflow-y-auto">
              {/* Error message */}
              {error && (
                <div className="mb-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-[11px] text-red-400">{error}</p>
                </div>
              )}

              {/* Home (always pinned - non-removable) */}
              <div className="mb-4">
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider mb-2 font-medium">
                  Always Pinned
                </p>
                <div className="flex items-center gap-3 px-3 py-2.5 bg-[#0F172A] rounded-lg border border-[#2A3544]">
                  <span className="text-[#38BDF8]">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </span>
                  <span className="text-[12px] text-white font-medium flex-1">Home</span>
                  <svg className="w-4 h-4 text-[#38BDF8]" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
              </div>

              {/* Pinned dashboards (reorderable) */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[9px] text-[#64748B] uppercase tracking-wider font-medium">
                    Pinned ({pinnedRoutes.length}/{MAX_PINNED})
                  </p>
                </div>
                {pinnedRoutes.length === 0 ? (
                  <div className="px-3 py-4 bg-[#0F172A]/50 rounded-lg border border-dashed border-[#2A3544] text-center">
                    <p className="text-[11px] text-[#64748B]">No pinned dashboards. Select from below.</p>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={pinnedRoutes}
                    onReorder={setPinnedRoutes}
                    className="space-y-1.5"
                  >
                    {pinnedRoutes.map((href) => {
                      const dashboard = getDashboard(href);
                      if (!dashboard) return null;
                      return (
                        <Reorder.Item
                          key={href}
                          value={href}
                          className="flex items-center gap-3 px-3 py-2.5 bg-[#1E293B] rounded-lg border border-[#2A3544] cursor-grab active:cursor-grabbing"
                        >
                          <svg className="w-3.5 h-3.5 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                          </svg>
                          <span className="text-[#8FA3BF]">{dashboard.icon}</span>
                          <span className="text-[12px] text-white font-medium flex-1">{dashboard.name}</span>
                          <button
                            onClick={() => togglePinned(href)}
                            className="p-1 text-[#64748B] hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </Reorder.Item>
                      );
                    })}
                  </Reorder.Group>
                )}
              </div>

              {/* Available dashboards */}
              <div>
                <p className="text-[9px] text-[#64748B] uppercase tracking-wider mb-2 font-medium">
                  Available Dashboards
                </p>
                <div className="space-y-1">
                  {unpinnedDashboards.map((dashboard) => (
                    <button
                      key={dashboard.href}
                      onClick={() => togglePinned(dashboard.href)}
                      disabled={pinnedRoutes.length >= MAX_PINNED}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left ${
                        pinnedRoutes.length >= MAX_PINNED
                          ? 'bg-[#0F172A]/30 border-[#1E293B] opacity-50 cursor-not-allowed'
                          : 'bg-[#0F172A] border-[#1E293B] hover:border-[#38BDF8]/30 hover:bg-[#0F172A]/80'
                      }`}
                    >
                      <span className="text-[#64748B]">{dashboard.icon}</span>
                      <span className="text-[12px] text-[#8FA3BF] font-medium flex-1">{dashboard.name}</span>
                      <svg className="w-3.5 h-3.5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#2A3544] flex items-center justify-between gap-3">
              <button
                onClick={handleReset}
                className="px-3 py-2 text-[11px] text-[#64748B] hover:text-white hover:bg-[#2A3544] rounded-lg transition-colors"
              >
                Reset to Defaults
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-[11px] text-[#8FA3BF] bg-[#1E293B] hover:bg-[#2A3544] rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 text-[11px] text-white bg-[#38BDF8] hover:bg-[#0EA5E9] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSaving && (
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
