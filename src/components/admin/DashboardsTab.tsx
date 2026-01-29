'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import DashboardAccessModal from './DashboardAccessModal';
import { DashboardOption } from './DashboardCheckboxes';
import { getDashboardIcon } from '@/lib/navigation-icons';

interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  dashboards: string[];
  userCount: number;
}

interface DashboardsTabProps {
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

export default function DashboardsTab({
  roles,
  dashboards,
  onRefresh,
}: DashboardsTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<DashboardOption | null>(null);

  const handleEdit = (dashboard: DashboardOption) => {
    setEditingDashboard(dashboard);
    setShowModal(true);
  };

  const getRoleColor = (roleName: string) => {
    return ROLE_COLORS[roleName] || '#38BDF8';
  };

  // Group dashboards by category
  const grouped = dashboards.reduce((acc, dash) => {
    const category = dash.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(dash);
    return acc;
  }, {} as Record<string, DashboardOption[]>);

  const categories = Object.keys(grouped).sort();

  // Get roles that have access to a given dashboard
  const getRolesForDashboard = (dashboardId: string) => {
    return roles.filter(r => r.dashboards.includes(dashboardId));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Dashboards</h2>
          <p className="text-[13px] text-[#64748B] mt-1">
            Manage which roles can access each dashboard
          </p>
        </div>
      </div>

      {/* Dashboards by Category */}
      {categories.map(category => (
        <div key={category} className="mb-8">
          <h3 className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wider mb-3">
            {category}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {grouped[category].map((dashboard, index) => {
              const dashboardRoles = getRolesForDashboard(dashboard.id);

              return (
                <motion.div
                  key={dashboard.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-5 hover:border-white/10 transition-colors"
                >
                  {/* Dashboard Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-[#38BDF8]/10 text-[#38BDF8]">
                        {getDashboardIcon(dashboard.icon || dashboard.name.charAt(0).toLowerCase())}
                      </div>
                      <div>
                        <h3 className="text-white font-semibold">{dashboard.name}</h3>
                        <p className="text-[12px] text-[#64748B]">
                          {dashboardRoles.length} role{dashboardRoles.length !== 1 ? 's' : ''} with access
                        </p>
                      </div>
                    </div>

                    {/* Edit Button */}
                    <motion.button
                      onClick={() => handleEdit(dashboard)}
                      className="p-2 text-[#64748B] hover:text-[#38BDF8] hover:bg-[#38BDF8]/10 rounded-lg transition-colors"
                      title="Edit role access"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </motion.button>
                  </div>

                  {/* Role Badges */}
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <div className="text-[11px] text-[#64748B] mb-2">
                      Role Access ({dashboardRoles.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {dashboardRoles.slice(0, 5).map(role => (
                        <span
                          key={role.id}
                          className="text-[10px] px-2 py-0.5 rounded font-medium capitalize"
                          style={{
                            background: `${getRoleColor(role.name)}20`,
                            color: getRoleColor(role.name),
                          }}
                        >
                          {role.name}
                        </span>
                      ))}
                      {dashboardRoles.length > 5 && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-[#64748B]">
                          +{dashboardRoles.length - 5} more
                        </span>
                      )}
                      {dashboardRoles.length === 0 && (
                        <span className="text-[10px] text-[#64748B]">No roles assigned</span>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Dashboard Access Modal */}
      <DashboardAccessModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingDashboard(null);
        }}
        onSave={onRefresh}
        dashboard={editingDashboard}
        roles={roles}
      />
    </div>
  );
}
