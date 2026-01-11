'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RoleModal from './RoleModal';
import { DashboardOption } from './DashboardCheckboxes';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  dashboards: string[];
  userCount: number;
}

interface RolesTabProps {
  roles: Role[];
  dashboards: DashboardOption[];
  onRefresh: () => void;
}

const ROLE_COLORS: Record<string, string> = {
  admin: '#EF4444',
  sales: '#3B82F6',
  finance: '#22C55E',
  pm: '#F59E0B',
  legal: '#8B5CF6',
  viewer: '#64748B',
};

export default function RolesTab({
  roles,
  dashboards,
  onRefresh,
}: RolesTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleEdit = (role: Role) => {
    setEditingRole(role);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingRole(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingRole) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/admin/roles?roleId=${deletingRole.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (data.error) {
        setDeleteError(data.error);
      } else {
        setDeletingRole(null);
        onRefresh();
      }
    } catch (err) {
      setDeleteError('Failed to delete role');
    } finally {
      setDeleting(false);
    }
  };

  const getRoleColor = (roleName: string) => {
    return ROLE_COLORS[roleName] || '#38BDF8';
  };

  const getDashboardNames = (dashboardIds: string[]) => {
    return dashboardIds
      .map(id => dashboards.find(d => d.id === id)?.name || id)
      .slice(0, 3);
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Roles</h2>
          <p className="text-[13px] text-[#64748B] mt-1">
            Manage role permissions and dashboard access
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0B1220] font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Role
        </button>
      </div>

      {/* Roles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {roles.map((role, index) => (
          <motion.div
            key={role.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-5 hover:border-white/10 transition-colors"
          >
            {/* Role Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold"
                  style={{
                    background: `${getRoleColor(role.name)}20`,
                    color: getRoleColor(role.name),
                  }}
                >
                  {role.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-white font-semibold capitalize">{role.name}</h3>
                    {role.is_system && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-amber-500/20 text-amber-400">
                        SYSTEM
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#64748B]">
                    {role.userCount} user{role.userCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <motion.button
                  onClick={() => handleEdit(role)}
                  className="p-2 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded-lg transition-colors"
                  title="Edit role"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </motion.button>
                {!role.is_system && (
                  <motion.button
                    onClick={() => setDeletingRole(role)}
                    className="p-2 text-[#64748B] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Delete role"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </motion.button>
                )}
              </div>
            </div>

            {/* Description */}
            {role.description && (
              <p className="text-[13px] text-[#94A3B8] mb-3">
                {role.description}
              </p>
            )}

            {/* Dashboard Access */}
            <div className="mt-3 pt-3 border-t border-white/5">
              <div className="text-[11px] text-[#64748B] mb-2">
                Dashboard Access ({role.dashboards.length})
              </div>
              <div className="flex flex-wrap gap-1">
                {getDashboardNames(role.dashboards).map(name => (
                  <span
                    key={name}
                    className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#94A3B8]"
                  >
                    {name}
                  </span>
                ))}
                {role.dashboards.length > 3 && (
                  <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#64748B]">
                    +{role.dashboards.length - 3} more
                  </span>
                )}
                {role.dashboards.length === 0 && (
                  <span className="text-[10px] text-[#64748B]">No dashboard access</span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Role Modal */}
      <RoleModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingRole(null);
        }}
        onSave={onRefresh}
        role={editingRole}
        dashboards={dashboards}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingRole && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => {
              setDeletingRole(null);
              setDeleteError(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151F2E] rounded-xl border border-white/10 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Delete Role</h3>
              </div>

              <div className="p-6">
                <p className="text-[#94A3B8]">
                  Are you sure you want to delete the <strong className="text-white capitalize">{deletingRole.name}</strong> role?
                </p>
                {deletingRole.userCount > 0 && (
                  <p className="text-[13px] text-amber-400 mt-2 bg-amber-500/10 rounded-lg p-3">
                    This role has {deletingRole.userCount} user{deletingRole.userCount !== 1 ? 's' : ''} assigned.
                    You must reassign them to another role before deleting.
                  </p>
                )}
                {deleteError && (
                  <p className="text-[13px] text-red-400 mt-2 bg-red-500/10 rounded-lg p-3">
                    {deleteError}
                  </p>
                )}
              </div>

              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setDeletingRole(null);
                    setDeleteError(null);
                  }}
                  className="px-4 py-2 text-[#64748B] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting || deletingRole.userCount > 0}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deleting ? 'Deleting...' : 'Delete Role'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
