'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardOption } from './DashboardCheckboxes';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  dashboards: string[];
  userCount: number;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#EF4444',
  sales: '#3B82F6',
  finance: '#22C55E',
  pm: '#F59E0B',
  legal: '#8B5CF6',
  viewer: '#64748B',
};

interface DashboardAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  dashboard: DashboardOption | null;
  roles: Role[];
}

export default function DashboardAccessModal({
  isOpen,
  onClose,
  onSave,
  dashboard,
  roles,
}: DashboardAccessModalProps) {
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dashboard) {
      // Find which roles currently have access to this dashboard
      const rolesWithAccess = roles
        .filter(r => r.dashboards.includes(dashboard.id))
        .map(r => r.id);
      setSelectedRoles(rolesWithAccess);
    } else {
      setSelectedRoles([]);
    }
    setError(null);
  }, [dashboard, roles, isOpen]);

  const getRoleColor = (roleName: string) => {
    return ROLE_COLORS[roleName] || '#38BDF8';
  };

  const toggleRole = (roleId: string) => {
    if (selectedRoles.includes(roleId)) {
      setSelectedRoles(selectedRoles.filter(id => id !== roleId));
    } else {
      setSelectedRoles([...selectedRoles, roleId]);
    }
  };

  const toggleAll = () => {
    if (selectedRoles.length === roles.length) {
      setSelectedRoles([]);
    } else {
      setSelectedRoles(roles.map(r => r.id));
    }
  };

  const handleSave = async () => {
    if (!dashboard) return;

    setSaving(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/dashboards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dashboardId: dashboard.id,
          roleIds: selectedRoles,
        }),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        onSave();
        onClose();
      }
    } catch (err) {
      setError('Failed to update dashboard access');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && dashboard && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-[#151F2E] rounded-xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="text-lg font-semibold text-white">
                Edit Dashboard Access
              </h3>
              <p className="text-[13px] text-[#64748B] mt-1">
                {dashboard.name}
                {dashboard.category && (
                  <span className="text-[#64748B]"> &middot; {dashboard.category}</span>
                )}
              </p>
            </div>

            {/* Body */}
            <div className="p-6 overflow-y-auto flex-1">
              <div className="bg-[#0F1722] rounded-lg p-4 border border-white/5">
                {/* Select All */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/10">
                  <span className="text-[12px] font-medium text-[#64748B]">
                    {selectedRoles.length} of {roles.length} roles selected
                  </span>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-[12px] text-[#38BDF8] hover:text-[#38BDF8]/80"
                  >
                    {selectedRoles.length === roles.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>

                {/* Role Checkboxes */}
                <div className="space-y-1">
                  {roles.map(role => {
                    const color = getRoleColor(role.name);
                    const isSelected = selectedRoles.includes(role.id);

                    return (
                      <motion.label
                        key={role.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors hover:bg-[#1E293B]/50 ${
                          isSelected ? 'bg-[#38BDF8]/10' : ''
                        }`}
                        whileHover={{ x: 2 }}
                      >
                        <div className="relative">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRole(role.id)}
                            className="sr-only"
                          />
                          <div
                            className={`w-4 h-4 rounded border-2 transition-colors ${
                              isSelected
                                ? 'bg-[#38BDF8] border-[#38BDF8]'
                                : 'border-[#64748B] bg-transparent'
                            }`}
                          >
                            {isSelected && (
                              <svg
                                className="w-3 h-3 text-[#0B1220] absolute top-0.5 left-0.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span
                            className="text-[13px] font-medium capitalize"
                            style={{ color }}
                          >
                            {role.name}
                          </span>
                          {role.is_system && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400">
                              SYSTEM
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-[#64748B] flex-shrink-0">
                          {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                        </span>
                      </motion.label>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-[13px] bg-red-500/10 rounded-lg p-3 mt-4">
                  {error}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 flex-shrink-0">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[#64748B] hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0B1220] font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
