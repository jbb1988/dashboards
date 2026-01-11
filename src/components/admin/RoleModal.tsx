'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import DashboardCheckboxes, { DashboardOption } from './DashboardCheckboxes';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  dashboards: string[];
  userCount: number;
}

interface RoleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  role?: Role | null;
  dashboards: DashboardOption[];
}

export default function RoleModal({
  isOpen,
  onClose,
  onSave,
  role,
  dashboards,
}: RoleModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedDashboards, setSelectedDashboards] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!role;
  const isSystemRole = role?.is_system || false;

  useEffect(() => {
    if (role) {
      setName(role.name);
      setDescription(role.description || '');
      setSelectedDashboards(role.dashboards || []);
    } else {
      setName('');
      setDescription('');
      setSelectedDashboards([]);
    }
    setError(null);
  }, [role, isOpen]);

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Role name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const endpoint = '/api/admin/roles';
      const method = isEditing ? 'PATCH' : 'POST';
      const body = isEditing
        ? {
            roleId: role.id,
            name: isSystemRole ? undefined : name,
            description,
            dashboards: selectedDashboards,
          }
        : {
            name,
            description,
            dashboards: selectedDashboards,
          };

      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        onSave();
        onClose();
      }
    } catch (err) {
      setError('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
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
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">
                  {isEditing ? 'Edit Role' : 'Create Role'}
                </h3>
                {isSystemRole && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-400">
                    System Role
                  </span>
                )}
              </div>
              {isEditing && (
                <p className="text-[13px] text-[#64748B] mt-1">
                  {role.userCount} user{role.userCount !== 1 ? 's' : ''} assigned
                </p>
              )}
            </div>

            {/* Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Name */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-1.5">
                  Role Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={isSystemRole}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50 disabled:opacity-50 disabled:cursor-not-allowed"
                  placeholder="e.g., Management"
                />
                {isSystemRole && (
                  <p className="text-[11px] text-[#64748B] mt-1">
                    System role names cannot be changed
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50 resize-none"
                  placeholder="Describe what this role is for..."
                />
              </div>

              {/* Dashboard Access */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3">
                  Dashboard Access
                </label>
                <div className="bg-[#0F1722] rounded-lg p-4 border border-white/5 max-h-64 overflow-y-auto">
                  <DashboardCheckboxes
                    dashboards={dashboards}
                    selected={selectedDashboards}
                    onChange={setSelectedDashboards}
                  />
                </div>
              </div>

              {error && (
                <div className="text-red-400 text-[13px] bg-red-500/10 rounded-lg p-3">
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
                {saving ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Role'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
