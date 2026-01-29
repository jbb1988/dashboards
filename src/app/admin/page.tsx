'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';
import { UsersTab, RolesTab, DashboardsTab, DashboardOption } from '@/components/admin';

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

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  dashboards: string[];
  userCount: number;
}

type Tab = 'users' | 'roles' | 'dashboards';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [dashboards, setDashboards] = useState<DashboardOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Build role -> dashboards mapping
  const roleDashboardAccess: Record<string, string[]> = {};
  roles.forEach(role => {
    roleDashboardAccess[role.id] = role.dashboards || [];
  });

  // Fetch all data
  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [usersRes, rolesRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/roles'),
      ]);

      const usersData = await usersRes.json();
      const rolesData = await rolesRes.json();

      if (usersData.error) {
        setError(usersData.error);
        return;
      }

      if (rolesData.error) {
        setError(rolesData.error);
        return;
      }

      setUsers(usersData.users || []);
      setRoles(rolesData.roles || []);
      setDashboards(rolesData.dashboards || []);
    } catch (err) {
      setError('Failed to fetch data');
      console.error('Error fetching admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const marginLeft = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'users', label: 'Users', count: users.length },
    { id: 'roles', label: 'Roles', count: roles.length },
    { id: 'dashboards', label: 'Dashboards', count: dashboards.length },
  ];

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.admin} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main
        className="relative z-10 transition-all duration-200 ease-out min-h-screen"
        style={{ marginLeft }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">User Management</h1>
            <p className="text-[#64748B] mt-1">Manage users, roles, and dashboard permissions</p>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-white/[0.06]">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative px-4 py-3 text-[13px] font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'text-white'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                <span className="flex items-center gap-2">
                  {tab.label}
                  {tab.count !== undefined && (
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        activeTab === tab.id
                          ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                          : 'bg-white/5 text-[#64748B]'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </span>
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38BDF8]"
                    transition={{ duration: 0.2 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
                <span className="text-[13px] text-[#64748B]">Loading...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 flex items-center gap-3">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-medium">Error loading data</div>
                <div className="text-[13px] opacity-80">{error}</div>
              </div>
              <button
                onClick={fetchData}
                className="ml-auto px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-[13px] font-medium transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* Tab Content */}
          {!loading && !error && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'users' && (
                <UsersTab
                  users={users}
                  roles={roles}
                  dashboards={dashboards}
                  roleDashboardAccess={roleDashboardAccess}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'roles' && (
                <RolesTab
                  roles={roles}
                  dashboards={dashboards}
                  onRefresh={fetchData}
                />
              )}
              {activeTab === 'dashboards' && (
                <DashboardsTab
                  roles={roles}
                  dashboards={dashboards}
                  onRefresh={fetchData}
                />
              )}
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
}
