'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  overrides: UserOverride[];
  overrideCount: number;
}

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  user?: User | null;
  roles: Role[];
  dashboards: DashboardOption[];
  roleDashboardAccess: Record<string, string[]>;
}

type InviteMethod = 'password' | 'magic_link';

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  user,
  roles,
  dashboards,
  roleDashboardAccess,
}: UserModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [inviteMethod, setInviteMethod] = useState<InviteMethod>('password');
  const [overrides, setOverrides] = useState<UserOverride[]>([]);
  const [saving, setSaving] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isEditing = !!user;

  // Get the default viewer role ID
  const viewerRole = roles.find(r => r.name === 'viewer');
  const defaultRoleId = viewerRole?.id || roles[0]?.id || '';

  useEffect(() => {
    if (user) {
      setEmail(user.email);
      setSelectedRoleId(user.roleId || defaultRoleId);
      setOverrides(user.overrides || []);
    } else {
      setEmail('');
      setPassword('');
      setSelectedRoleId(defaultRoleId);
      setInviteMethod('password');
      setOverrides([]);
    }
    setError(null);
    setSuccess(null);
  }, [user, isOpen, defaultRoleId]);

  // Get role's default dashboards
  const roleDashboards = roleDashboardAccess[selectedRoleId] || [];

  // Calculate effective access for each dashboard
  const getEffectiveAccess = (dashboardId: string): { hasAccess: boolean; source: 'role' | 'grant' | 'revoke' | 'none' } => {
    const override = overrides.find(o => o.dashboardId === dashboardId);
    const hasRoleAccess = roleDashboards.includes(dashboardId);

    if (override?.accessType === 'revoke') {
      return { hasAccess: false, source: 'revoke' };
    } else if (override?.accessType === 'grant') {
      return { hasAccess: true, source: 'grant' };
    } else if (hasRoleAccess) {
      return { hasAccess: true, source: 'role' };
    }
    return { hasAccess: false, source: 'none' };
  };

  // Toggle dashboard override
  const toggleDashboardOverride = (dashboardId: string) => {
    const hasRoleAccess = roleDashboards.includes(dashboardId);
    const currentOverride = overrides.find(o => o.dashboardId === dashboardId);

    let newOverrides = overrides.filter(o => o.dashboardId !== dashboardId);

    if (!currentOverride) {
      // No override: add grant (if no role access) or revoke (if has role access)
      newOverrides.push({
        dashboardId,
        accessType: hasRoleAccess ? 'revoke' : 'grant',
      });
    } else if (currentOverride.accessType === 'grant') {
      // Grant -> remove override (go back to role default)
      // No action needed, already filtered out
    } else if (currentOverride.accessType === 'revoke') {
      // Revoke -> remove override (go back to role default)
      // No action needed, already filtered out
    }

    setOverrides(newOverrides);
  };

  const handleSave = async () => {
    if (!isEditing && !email.trim()) {
      setError('Email is required');
      return;
    }

    if (!isEditing && inviteMethod === 'password' && !password.trim()) {
      setError('Password is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const endpoint = '/api/admin/users';
      const method = isEditing ? 'PATCH' : 'POST';

      const body = isEditing
        ? {
            userId: user.id,
            roleId: selectedRoleId,
            overrides: overrides,
          }
        : {
            email,
            password: inviteMethod === 'password' ? password : undefined,
            roleId: selectedRoleId,
            inviteMethod,
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
        if (!isEditing && inviteMethod === 'magic_link') {
          setSuccess(`Magic link invitation sent to ${email}`);
          setTimeout(() => {
            onSave();
            onClose();
          }, 2000);
        } else {
          onSave();
          onClose();
        }
      }
    } catch (err) {
      setError('Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const selectedRole = roles.find(r => r.id === selectedRoleId);

  const handleResendInvite = async () => {
    if (!user) return;

    setResending(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, email: user.email }),
      });

      const data = await response.json();
      if (data.error) {
        setError(data.error);
      } else {
        setSuccess(`Magic link sent to ${user.email}`);
      }
    } catch (err) {
      setError('Failed to resend invite');
    } finally {
      setResending(false);
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
              <h3 className="text-lg font-semibold text-white">
                {isEditing ? 'Edit User' : 'Add New User'}
              </h3>
              {isEditing && (
                <p className="text-[13px] text-[#64748B] mt-1">{user.email}</p>
              )}
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Email (only for new users) */}
              {!isEditing && (
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50"
                    placeholder="user@example.com"
                  />
                </div>
              )}

              {/* Invite Method (only for new users) */}
              {!isEditing && (
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-2">
                    Account Setup Method
                  </label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setInviteMethod('password')}
                      className={`flex-1 p-3 rounded-lg border transition-colors ${
                        inviteMethod === 'password'
                          ? 'border-[#38BDF8] bg-[#38BDF8]/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            inviteMethod === 'password'
                              ? 'border-[#38BDF8] bg-[#38BDF8]'
                              : 'border-[#64748B]'
                          }`}
                        >
                          {inviteMethod === 'password' && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0B1220]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[13px] font-medium text-white">Temporary Password</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1 text-left">
                        User will change on first login
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setInviteMethod('magic_link')}
                      className={`flex-1 p-3 rounded-lg border transition-colors ${
                        inviteMethod === 'magic_link'
                          ? 'border-[#38BDF8] bg-[#38BDF8]/10'
                          : 'border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            inviteMethod === 'magic_link'
                              ? 'border-[#38BDF8] bg-[#38BDF8]'
                              : 'border-[#64748B]'
                          }`}
                        >
                          {inviteMethod === 'magic_link' && (
                            <div className="w-full h-full flex items-center justify-center">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#0B1220]" />
                            </div>
                          )}
                        </div>
                        <span className="text-[13px] font-medium text-white">Magic Link</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1 text-left">
                        Send email invitation
                      </p>
                    </button>
                  </div>
                </div>
              )}

              {/* Password (only for password method) */}
              {!isEditing && inviteMethod === 'password' && (
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-1.5">
                    Temporary Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50"
                    placeholder="Minimum 6 characters"
                  />
                  <p className="text-[11px] text-amber-400/80 mt-1.5">
                    Share this password with the user. They can change it using "Forgot Password" on the login page.
                  </p>
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-1.5">
                  Role
                </label>
                <select
                  value={selectedRoleId}
                  onChange={e => {
                    setSelectedRoleId(e.target.value);
                    // Clear overrides when role changes
                    if (!isEditing) setOverrides([]);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-[#0F1722] border border-white/10 text-white focus:outline-none focus:border-[#38BDF8]/50"
                >
                  {roles.map(role => (
                    <option key={role.id} value={role.id} className="bg-[#0F1722]">
                      {role.name.charAt(0).toUpperCase() + role.name.slice(1)}
                      {role.is_system ? ' (System)' : ''}
                    </option>
                  ))}
                </select>
                {selectedRole?.description && (
                  <p className="text-[11px] text-[#64748B] mt-1">
                    {selectedRole.description}
                  </p>
                )}
              </div>

              {/* Dashboard Overrides (only for editing) */}
              {isEditing && (
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-2">
                    Dashboard Access
                  </label>
                  <p className="text-[11px] text-[#64748B] mb-3">
                    Click to override role defaults. Overrides are shown with colored indicators.
                  </p>
                  <div className="bg-[#0F1722] rounded-lg p-3 border border-white/5 max-h-48 overflow-y-auto space-y-1">
                    {dashboards.map(dashboard => {
                      const { hasAccess, source } = getEffectiveAccess(dashboard.id);
                      return (
                        <button
                          key={dashboard.id}
                          type="button"
                          onClick={() => toggleDashboardOverride(dashboard.id)}
                          className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-[#1E293B]/50 ${
                            hasAccess ? 'bg-[#22C55E]/5' : ''
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded flex items-center justify-center transition-colors ${
                              hasAccess
                                ? source === 'grant'
                                  ? 'bg-emerald-500'
                                  : 'bg-[#38BDF8]'
                                : source === 'revoke'
                                ? 'bg-red-500'
                                : 'bg-[#64748B]/30'
                            }`}
                          >
                            {hasAccess && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {source === 'revoke' && (
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                          <span className={`text-[13px] flex-1 text-left ${hasAccess ? 'text-white' : 'text-[#64748B]'}`}>
                            {dashboard.name}
                          </span>
                          {source !== 'none' && source !== 'role' && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded ${
                                source === 'grant'
                                  ? 'bg-emerald-500/20 text-emerald-400'
                                  : 'bg-red-500/20 text-red-400'
                              }`}
                            >
                              {source === 'grant' ? '+Added' : '-Removed'}
                            </span>
                          )}
                          {source === 'role' && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#38BDF8]/20 text-[#38BDF8]">
                              From Role
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Messages */}
              {error && (
                <div className="text-red-400 text-[13px] bg-red-500/10 rounded-lg p-3">
                  {error}
                </div>
              )}
              {success && (
                <div className="text-emerald-400 text-[13px] bg-emerald-500/10 rounded-lg p-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {success}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-white/10 flex justify-between items-center flex-shrink-0">
              {/* Resend Invite Button - only for editing */}
              {isEditing ? (
                <button
                  onClick={handleResendInvite}
                  disabled={resending || saving}
                  className="px-4 py-2 text-amber-400 hover:bg-amber-400/10 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {resending ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Send Magic Link
                    </>
                  )}
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-[#64748B] hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !!success}
                  className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0B1220] font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving
                    ? 'Saving...'
                    : isEditing
                    ? 'Save Changes'
                    : inviteMethod === 'magic_link'
                    ? 'Send Invitation'
                    : 'Create User'}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
