'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import UserModal from './UserModal';
import { DashboardOption } from './DashboardCheckboxes';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
}

interface UserOverride {
  dashboardId: string;
  accessType: 'grant' | 'revoke';
}

interface User {
  id: string;
  email: string;
  role: string;
  roleId: string | null;
  createdAt: string;
  lastSignIn: string | null;
  overrides: UserOverride[];
  overrideCount: number;
}

interface UsersTabProps {
  users: User[];
  roles: Role[];
  dashboards: DashboardOption[];
  roleDashboardAccess: Record<string, string[]>;
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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function UsersTab({
  users,
  roles,
  dashboards,
  roleDashboardAccess,
  onRefresh,
}: UsersTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingUser(null);
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/users?userId=${deletingUser.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();
      if (!data.error) {
        setDeletingUser(null);
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to delete user:', err);
    } finally {
      setDeleting(false);
    }
  };

  const getRoleColor = (roleName: string) => {
    return ROLE_COLORS[roleName] || '#64748B';
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Users</h2>
          <p className="text-[13px] text-[#64748B] mt-1">
            {users.length} user{users.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0B1220] font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
        <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 bg-[#0F1722] border-b border-white/[0.04] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          <div>User</div>
          <div>Role</div>
          <div>Created</div>
          <div>Last Sign In</div>
          <div>Actions</div>
        </div>

        {users.length === 0 ? (
          <div className="px-6 py-12 text-center text-[#64748B]">
            No users found. Click "Add User" to create one.
          </div>
        ) : (
          users.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.03 }}
              className={`grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 px-6 py-4 items-center border-b border-white/[0.04] hover:bg-[#1E293B]/50 transition-colors ${
                index % 2 === 0 ? 'bg-[#151F2E]' : 'bg-[#131B28]'
              }`}
            >
              {/* Email */}
              <div>
                <div className="text-white font-medium">{user.email}</div>
                <div className="text-[11px] text-[#64748B] mt-0.5 flex items-center gap-2">
                  <span>ID: {user.id.slice(0, 8)}...</span>
                  {user.overrideCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px]">
                      {user.overrideCount} override{user.overrideCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>

              {/* Role */}
              <div>
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                  style={{
                    background: `${getRoleColor(user.role)}20`,
                    color: getRoleColor(user.role),
                  }}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: getRoleColor(user.role) }}
                  />
                  {user.role}
                </span>
              </div>

              {/* Created */}
              <div className="text-[13px] text-[#94A3B8]">
                {formatDate(user.createdAt)}
              </div>

              {/* Last Sign In */}
              <div className="text-[13px] text-[#94A3B8]">
                {formatDate(user.lastSignIn)}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <motion.button
                  onClick={() => handleEdit(user)}
                  className="p-2 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded-lg transition-colors"
                  title="Edit user"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </motion.button>
                <motion.button
                  onClick={() => setDeletingUser(user)}
                  className="p-2 text-[#64748B] hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                  title="Delete user"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </motion.button>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* User Modal */}
      <UserModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingUser(null);
        }}
        onSave={onRefresh}
        user={editingUser}
        roles={roles}
        dashboards={dashboards}
        roleDashboardAccess={roleDashboardAccess}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setDeletingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#151F2E] rounded-xl border border-white/10 shadow-2xl w-full max-w-md"
              onClick={e => e.stopPropagation()}
            >
              <div className="px-6 py-4 border-b border-white/10">
                <h3 className="text-lg font-semibold text-white">Delete User</h3>
              </div>

              <div className="p-6">
                <p className="text-[#94A3B8]">
                  Are you sure you want to delete <strong className="text-white">{deletingUser.email}</strong>?
                </p>
                <p className="text-[13px] text-[#64748B] mt-2">
                  This action cannot be undone. The user will lose access to all dashboards.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setDeletingUser(null)}
                  className="px-4 py-2 text-[#64748B] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting...' : 'Delete User'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
