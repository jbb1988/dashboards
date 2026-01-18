'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface PriorityAction {
  id: string;
  rank: number;
  action: string;
  entityName: string;
  entityId: string;
  impact: number; // Revenue impact in dollars
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'inactive' | 'margin' | 'category' | 'frequency' | 'expansion' | 'new';
  owner?: string;
  dueDate?: string;
  status: 'open' | 'in_progress' | 'completed';
  effort: 'low' | 'medium' | 'high';
  playbook?: {
    context: string;
    talkingPoints: string[];
    successMetrics: string[];
    similarWins?: string[];
  };
}

interface PriorityActionQueueProps {
  actions: PriorityAction[];
  onActionClick?: (action: PriorityAction) => void;
  onStatusChange?: (actionId: string, status: PriorityAction['status']) => void;
  showPlaybook?: boolean;
}

type SortField = 'rank' | 'impact' | 'riskLevel' | 'dueDate';

export default function PriorityActionQueue({
  actions,
  onActionClick,
  onStatusChange,
  showPlaybook = true,
}: PriorityActionQueueProps) {
  const [sortField, setSortField] = useState<SortField>('rank');
  const [selectedAction, setSelectedAction] = useState<PriorityAction | null>(null);

  const riskLevelOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

  const sortedActions = [...actions].sort((a, b) => {
    switch (sortField) {
      case 'rank':
        return a.rank - b.rank;
      case 'impact':
        return b.impact - a.impact;
      case 'riskLevel':
        return riskLevelOrder[a.riskLevel] - riskLevelOrder[b.riskLevel];
      case 'dueDate':
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      default:
        return 0;
    }
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleActionClick = (action: PriorityAction) => {
    if (showPlaybook && action.playbook) {
      setSelectedAction(action);
    }
    onActionClick?.(action);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Priority Action Queue</h3>
          <p className="text-sm text-[#64748B] mt-1">
            Top {actions.length} actions ranked by ROI
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-[#64748B]">Sort by:</span>
          <select
            value={sortField}
            onChange={(e) => setSortField(e.target.value as SortField)}
            className="px-3 py-1.5 rounded-lg bg-[#151F2E] border border-white/[0.04] text-sm text-white focus:outline-none focus:border-cyan-500/50"
          >
            <option value="rank">Rank (ROI)</option>
            <option value="impact">Impact ($)</option>
            <option value="riskLevel">Risk Level</option>
            <option value="dueDate">Due Date</option>
          </select>
        </div>
      </div>

      {/* Action Table */}
      <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[60px_2fr_1fr_1fr_1.2fr_120px_100px] gap-4 px-6 py-4 bg-[#0F1824] border-b border-white/[0.04]">
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-center">
            Rank
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Action
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-right">
            Impact
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-center">
            Risk Level
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
            Owner
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-center">
            Due Date
          </div>
          <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider text-center">
            Status
          </div>
        </div>

        {/* Table Body */}
        <div className="max-h-[600px] overflow-y-auto">
          {sortedActions.map((action, idx) => (
            <ActionRow
              key={action.id}
              action={action}
              index={idx}
              onActionClick={handleActionClick}
              onStatusChange={onStatusChange}
              formatCurrency={formatCurrency}
              formatDate={formatDate}
            />
          ))}

          {sortedActions.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-[#64748B] text-sm">No actions in queue</div>
              <p className="text-[#475569] text-xs mt-1">
                All accounts are healthy - great work!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Playbook Modal */}
      <AnimatePresence>
        {selectedAction && showPlaybook && selectedAction.playbook && (
          <PlaybookModal
            action={selectedAction}
            onClose={() => setSelectedAction(null)}
            formatCurrency={formatCurrency}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

interface ActionRowProps {
  action: PriorityAction;
  index: number;
  onActionClick: (action: PriorityAction) => void;
  onStatusChange?: (actionId: string, status: PriorityAction['status']) => void;
  formatCurrency: (value: number) => string;
  formatDate: (dateStr: string) => string;
}

function ActionRow({
  action,
  index,
  onActionClick,
  onStatusChange,
  formatCurrency,
  formatDate,
}: ActionRowProps) {
  const riskConfig = {
    CRITICAL: { bg: 'bg-red-500/20', text: 'text-red-300', border: 'border-red-500/30' },
    HIGH: { bg: 'bg-amber-500/20', text: 'text-amber-300', border: 'border-amber-500/30' },
    MEDIUM: { bg: 'bg-blue-500/20', text: 'text-blue-300', border: 'border-blue-500/30' },
    LOW: { bg: 'bg-green-500/20', text: 'text-green-300', border: 'border-green-500/30' },
  };

  const statusConfig = {
    open: { icon: '🔴', label: 'Open', color: 'text-red-400' },
    in_progress: { icon: '🟡', label: 'In Progress', color: 'text-amber-400' },
    completed: { icon: '🟢', label: 'Done', color: 'text-green-400' },
  };

  const config = riskConfig[action.riskLevel];
  const statusCfg = statusConfig[action.status];

  const isOverdue = action.dueDate && new Date(action.dueDate) < new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={() => onActionClick(action)}
      className="grid grid-cols-[60px_2fr_1fr_1fr_1.2fr_120px_100px] gap-4 px-6 py-4 border-b border-white/[0.02] hover:bg-[#1E293B] cursor-pointer transition-colors group"
    >
      {/* Rank */}
      <div className="flex items-center justify-center">
        <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center">
          <span className="text-sm font-bold text-cyan-300">{action.rank}</span>
        </div>
      </div>

      {/* Action */}
      <div>
        <div className="text-sm font-medium text-white mb-1 group-hover:text-cyan-300 transition-colors">
          {action.action}
        </div>
        <div className="text-xs text-[#64748B]">{action.entityName}</div>
      </div>

      {/* Impact */}
      <div className="text-right">
        <div className="text-sm font-semibold text-white">
          {formatCurrency(action.impact)}
        </div>
        <div className="text-[10px] text-[#64748B] mt-0.5">
          {action.effort} effort
        </div>
      </div>

      {/* Risk Level */}
      <div className="flex items-center justify-center">
        <span
          className={`px-2.5 py-1 rounded text-[11px] font-semibold ${config.bg} ${config.text} border ${config.border}`}
        >
          {action.riskLevel}
        </span>
      </div>

      {/* Owner */}
      <div>
        <div className="text-sm text-[#94A3B8]">
          {action.owner || 'Unassigned'}
        </div>
      </div>

      {/* Due Date */}
      <div className="text-center">
        {action.dueDate ? (
          <div className={`text-sm ${isOverdue ? 'text-red-400 font-semibold' : 'text-[#94A3B8]'}`}>
            {formatDate(action.dueDate)}
          </div>
        ) : (
          <div className="text-sm text-[#64748B]">—</div>
        )}
      </div>

      {/* Status */}
      <div className="flex items-center justify-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            const nextStatus: Record<PriorityAction['status'], PriorityAction['status']> = {
              open: 'in_progress',
              in_progress: 'completed',
              completed: 'open',
            };
            onStatusChange?.(action.id, nextStatus[action.status]);
          }}
          className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 transition-colors"
        >
          <span className="text-sm">{statusCfg.icon}</span>
          <span className={`text-[10px] font-medium ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
        </button>
      </div>
    </motion.div>
  );
}

interface PlaybookModalProps {
  action: PriorityAction;
  onClose: () => void;
  formatCurrency: (value: number) => string;
}

function PlaybookModal({ action, onClose, formatCurrency }: PlaybookModalProps) {
  if (!action.playbook) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#151F2E] rounded-2xl border border-white/[0.08] max-w-2xl w-full max-h-[80vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#151F2E] border-b border-white/[0.08] p-6 z-10">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-semibold text-white mb-2">{action.action}</h3>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-[#64748B]">{action.entityName}</span>
                <span className="text-cyan-400 font-semibold">
                  {formatCurrency(action.impact)} impact
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Context */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Context
            </h4>
            <p className="text-sm text-[#94A3B8] leading-relaxed">
              {action.playbook.context}
            </p>
          </div>

          {/* Talking Points */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Talking Points
            </h4>
            <ul className="space-y-2">
              {action.playbook.talkingPoints.map((point, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span className="text-sm text-[#94A3B8] flex-1">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Success Metrics */}
          <div>
            <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
              Success Metrics
            </h4>
            <ul className="space-y-2">
              {action.playbook.successMetrics.map((metric, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="text-green-400 mt-1">✓</span>
                  <span className="text-sm text-[#94A3B8] flex-1">{metric}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Similar Wins */}
          {action.playbook.similarWins && action.playbook.similarWins.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">
                Similar Successful Interventions
              </h4>
              <div className="space-y-2">
                {action.playbook.similarWins.map((win, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <p className="text-xs text-green-300">{win}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-[#151F2E] border-t border-white/[0.08] p-6">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-medium transition-colors"
          >
            Got it - Take Action
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
