'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ActionItem, ActionType } from '@/lib/action-classification';
import { getActionTypeLabel } from '@/lib/roi-calculation';

interface RequiredActionsTableProps {
  actions: ActionItem[];
  onRefresh: () => void;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function RequiredActionsTable({ actions, onRefresh }: RequiredActionsTableProps) {
  const [sortBy, setSortBy] = useState<'value' | 'risk' | 'speed'>('value');
  const [filterType, setFilterType] = useState<ActionType | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'in_progress' | 'completed'>('all');
  const [selectedAction, setSelectedAction] = useState<ActionItem | null>(null);

  // Filter and sort actions
  let filteredActions = [...actions];

  // Apply type filter
  if (filterType !== 'all') {
    filteredActions = filteredActions.filter(a => a.action_type === filterType);
  }

  // Apply status filter
  if (filterStatus !== 'all') {
    filteredActions = filteredActions.filter(a => a.status === filterStatus);
  }

  // Sort
  filteredActions.sort((a, b) => {
    if (sortBy === 'value') {
      const aValue = a.expected_recovery || a.cross_sell_potential || 0;
      const bValue = b.expected_recovery || b.cross_sell_potential || 0;
      return bValue - aValue;
    } else if (sortBy === 'risk') {
      const riskOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      return riskOrder[a.risk_level] - riskOrder[b.risk_level];
    } else {
      // speed
      return a.speed_to_impact_days - b.speed_to_impact_days;
    }
  });

  // Get unique action types
  const actionTypes = Array.from(new Set(actions.map(a => a.action_type)));

  // Handle owner assignment
  const handleOwnerChange = async (actionId: string, owner: string) => {
    // TODO: Implement API call to update owner
    console.log('Update owner for action', actionId, 'to', owner);
    onRefresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
          <span className="text-[20px]">📋</span>
          Required Actions ({filteredActions.length})
        </h3>

        <div className="flex items-center gap-2">
          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-3 py-1.5 bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] rounded-lg text-[13px] hover:bg-[#334155] transition-colors"
          >
            <option value="value">Sort by $ Impact</option>
            <option value="risk">Sort by Risk</option>
            <option value="speed">Sort by Speed</option>
          </select>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-1.5 bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] rounded-lg text-[13px] hover:bg-[#334155] transition-colors"
          >
            <option value="all">All Types</option>
            {actionTypes.map(type => (
              <option key={type} value={type}>{getActionTypeLabel(type)}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-1.5 bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] rounded-lg text-[13px] hover:bg-[#334155] transition-colors"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1E293B] border border-white/[0.04] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.04] bg-[#0F172A]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Action
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  $ Impact
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Risk
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Speed
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredActions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[#64748B] text-[14px]">
                    No actions found
                  </td>
                </tr>
              ) : (
                filteredActions.map((action, idx) => {
                  const value = action.expected_recovery || action.cross_sell_potential || 0;
                  const riskColor = getRiskColor(action.risk_level);

                  return (
                    <motion.tr
                      key={action.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      onClick={() => setSelectedAction(action)}
                      className="border-b border-white/[0.04] hover:bg-[#334155]/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="text-[13px] font-medium text-white">{action.action_title}</div>
                        <div className="text-[11px] text-[#94A3B8] mt-0.5 max-w-md truncate">
                          {action.action_description}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[13px] text-white">{action.customer_name}</div>
                        <div className="text-[11px] text-[#94A3B8]">{action.customer_segment}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-1 bg-[#38BDF8]/10 text-[#38BDF8] rounded text-[11px] font-medium">
                          {getActionTypeLabel(action.action_type)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[14px] font-semibold text-white">{formatCurrency(value)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-[11px] font-medium ${riskColor}`}>
                          {action.risk_level}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[13px] text-[#94A3B8]">
                        {action.speed_to_impact_days}d
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={action.owner || ''}
                          onChange={(e) => handleOwnerChange(action.id, e.target.value)}
                          className="px-2 py-1 bg-[#0F172A] border border-white/[0.04] text-[#94A3B8] rounded text-[12px] hover:bg-[#1E293B] transition-colors min-w-[120px]"
                        >
                          <option value="">Unassigned</option>
                          <option value="Sales Rep 1">Sales Rep 1</option>
                          <option value="Sales Rep 2">Sales Rep 2</option>
                          <option value="Sales Manager">Sales Manager</option>
                          <option value="VP Sales">VP Sales</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={action.status} />
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Detail Modal */}
      <AnimatePresence>
        {selectedAction && (
          <ActionDetailModal
            action={selectedAction}
            onClose={() => setSelectedAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for status badge
function StatusBadge({ status }: { status: string }) {
  const colors = {
    pending: 'bg-[#64748B]/10 text-[#64748B]',
    in_progress: 'bg-[#F59E0B]/10 text-[#F59E0B]',
    completed: 'bg-[#22C55E]/10 text-[#22C55E]',
  };

  return (
    <span className={`px-2 py-1 rounded text-[11px] font-medium ${colors[status as keyof typeof colors] || colors.pending}`}>
      {status.replace('_', ' ')}
    </span>
  );
}

// Helper function for risk color
function getRiskColor(risk: string): string {
  switch (risk) {
    case 'critical':
      return 'bg-[#EF4444]/10 text-[#EF4444]';
    case 'high':
      return 'bg-[#F59E0B]/10 text-[#F59E0B]';
    case 'medium':
      return 'bg-[#38BDF8]/10 text-[#38BDF8]';
    case 'low':
      return 'bg-[#64748B]/10 text-[#64748B]';
    default:
      return 'bg-[#64748B]/10 text-[#64748B]';
  }
}

// Action Detail Modal
function ActionDetailModal({ action, onClose }: { action: ActionItem; onClose: () => void }) {
  const value = action.expected_recovery || action.cross_sell_potential || 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#1E293B] border border-white/[0.1] rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-[18px] font-bold text-white">{action.action_title}</h3>
              <p className="text-[13px] text-[#94A3B8] mt-1">{action.action_description}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/[0.04] rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div className="bg-[#0F172A] p-3 rounded-lg">
              <div className="text-[11px] text-[#64748B] uppercase font-semibold mb-1">$ Impact</div>
              <div className="text-[16px] font-bold text-white">{formatCurrency(value)}</div>
            </div>
            <div className="bg-[#0F172A] p-3 rounded-lg">
              <div className="text-[11px] text-[#64748B] uppercase font-semibold mb-1">Risk Level</div>
              <div className="text-[13px] font-medium text-white capitalize">{action.risk_level}</div>
            </div>
            <div className="bg-[#0F172A] p-3 rounded-lg">
              <div className="text-[11px] text-[#64748B] uppercase font-semibold mb-1">Speed</div>
              <div className="text-[16px] font-bold text-white">{action.speed_to_impact_days}d</div>
            </div>
          </div>

          {/* Call Script */}
          {action.call_script && (
            <div className="bg-[#0F172A] p-4 rounded-lg">
              <div className="text-[12px] font-semibold text-[#38BDF8] uppercase mb-2">Call Script</div>
              <div className="text-[14px] text-white leading-relaxed">{action.call_script}</div>
            </div>
          )}

          {/* Customer Details */}
          <div className="bg-[#0F172A] p-4 rounded-lg">
            <div className="text-[12px] font-semibold text-[#38BDF8] uppercase mb-2">Customer Details</div>
            <div className="space-y-2 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Name:</span>
                <span className="text-white font-medium">{action.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">Segment:</span>
                <span className="text-white">{action.customer_segment}</span>
              </div>
              {action.days_stopped && (
                <div className="flex justify-between">
                  <span className="text-[#94A3B8]">Days Inactive:</span>
                  <span className="text-white">{action.days_stopped}d</span>
                </div>
              )}
            </div>
          </div>

          {/* Action */}
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-[#38BDF8] text-white rounded-lg hover:bg-[#38BDF8]/80 transition-colors text-[14px] font-medium"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
