'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import {
  DashboardBackground,
  backgroundPresets,
  KPICard,
  KPIIcons,
  KPICardSkeleton,
  TableRowSkeleton,
  tokens,
} from '@/components/mars-ui';
import ObligationCalendar from '@/components/obligations/ObligationCalendar';

interface Obligation {
  id: string;
  contract_name: string;
  counterparty_name: string | null;
  title: string;
  description: string | null;
  obligation_type: string;
  due_date: string | null;
  status: 'pending' | 'upcoming' | 'due' | 'overdue' | 'completed' | 'waived' | 'deferred';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assigned_to: string | null;
  ai_extracted: boolean;
  ai_confidence: number | null;
  extraction_review_status: string;
  created_at: string;
}

interface Summary {
  pending: number;
  upcoming: number;
  due: number;
  overdue: number;
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-white/5">
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRowSkeleton key={i} columns={6} />
        ))}
      </div>
    </div>
  );
}

const statusColors = {
  pending: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
  upcoming: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  due: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/20' },
  overdue: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  completed: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  waived: { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
  deferred: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
};

const priorityColors = {
  low: { bg: 'bg-green-500/10', text: 'text-green-400' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-400' },
  critical: { bg: 'bg-red-500/10', text: 'text-red-400' },
};

const typeIcons: Record<string, string> = {
  payment: '$',
  delivery: '📦',
  notice: '📋',
  renewal: '🔄',
  termination: '⚠️',
  reporting: '📊',
  insurance: '🛡️',
  compliance: '✓',
  audit: '🔍',
  milestone: '🎯',
  other: '📝',
};

function ObligationRow({
  obligation,
  index,
  onClick,
  onComplete,
}: {
  obligation: Obligation;
  index: number;
  onClick: () => void;
  onComplete: () => void;
}) {
  const status = statusColors[obligation.status] || statusColors.pending;
  const priority = priorityColors[obligation.priority] || priorityColors.medium;

  const dueDate = obligation.due_date
    ? new Date(obligation.due_date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'No date';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className={`
        grid grid-cols-[2fr,1fr,1fr,1fr,1fr,80px] gap-4 px-5 py-4 items-center
        border-b ${tokens.border.subtle}
        ${index % 2 === 0 ? tokens.bg.section : tokens.bg.card}
        hover:bg-[#1E293B] transition-colors cursor-pointer group
      `}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0 text-lg">
          {typeIcons[obligation.obligation_type] || typeIcons.other}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${tokens.text.primary} group-hover:text-orange-400 transition-colors truncate`}>
              {obligation.title}
            </span>
            {obligation.ai_extracted && obligation.extraction_review_status === 'pending_review' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/20">
                AI
              </span>
            )}
          </div>
          <p className={`text-xs ${tokens.text.muted} truncate`}>
            {obligation.contract_name}
            {obligation.counterparty_name && ` • ${obligation.counterparty_name}`}
          </p>
        </div>
      </div>

      <div>
        <span className="text-xs px-2 py-1 rounded-full bg-[#1E293B] text-[#8FA3BF] capitalize">
          {obligation.obligation_type}
        </span>
      </div>

      <div className="text-sm text-white/90">
        {dueDate}
      </div>

      <div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${status.bg} ${status.text} ${status.border} border capitalize`}>
          {obligation.status}
        </span>
      </div>

      <div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${priority.bg} ${priority.text} capitalize`}>
          {obligation.priority}
        </span>
      </div>

      <div className="flex justify-end gap-2">
        {obligation.status !== 'completed' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            className="p-1.5 hover:bg-green-500/20 rounded transition-colors group/btn"
            title="Mark as completed"
          >
            <svg className="w-4 h-4 text-[#64748B] group-hover/btn:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        )}
        <svg
          className={`w-4 h-4 ${tokens.text.muted} group-hover:text-orange-400 transition-colors`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.div>
  );
}

export default function ObligationsPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [summary, setSummary] = useState<Summary>({ pending: 0, upcoming: 0, due: 0, overdue: 0 });
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchObligations();
  }, [statusFilter, typeFilter]);

  async function fetchObligations() {
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);
      if (typeFilter) params.append('type', typeFilter);

      const response = await fetch(`/api/obligations?${params.toString()}`);
      const data = await response.json();
      setObligations(data.obligations || []);
      setSummary(data.summary || { pending: 0, upcoming: 0, due: 0, overdue: 0 });
    } catch (error) {
      console.error('Failed to fetch obligations:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete(obligation: Obligation) {
    try {
      await fetch('/api/obligations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: obligation.id,
          status: 'completed',
        }),
      });
      fetchObligations();
    } catch (error) {
      console.error('Failed to complete obligation:', error);
    }
  }

  // Filter obligations by search query
  const filteredObligations = obligations.filter(o =>
    o.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.contract_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const obligationTypes = [...new Set(obligations.map(o => o.obligation_type))];

  return (
    <div className="min-h-screen bg-[#0F1722] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.admin} />

      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.div
        className="relative z-10 text-white"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <header className="border-b border-white/[0.06] bg-[#0F1722]/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.3)] sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Obligation Tracking</h1>
                <p className="text-[12px] text-[#8FA3BF] mt-1">
                  Monitor contract deadlines and compliance requirements
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* View Toggle */}
                <div className="flex rounded-lg overflow-hidden border border-white/10">
                  <button
                    onClick={() => setViewMode('list')}
                    className={`px-3 py-2 text-sm transition-colors ${
                      viewMode === 'list' ? 'bg-orange-500 text-white' : 'bg-white/5 text-[#8FA3BF]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setViewMode('calendar')}
                    className={`px-3 py-2 text-sm transition-colors ${
                      viewMode === 'calendar' ? 'bg-orange-500 text-white' : 'bg-white/5 text-[#8FA3BF]'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </button>
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchObligations()}
                  className="px-4 py-2 rounded-lg bg-[#1E293B] text-sm text-[#8FA3BF] hover:text-white transition-colors"
                >
                  Refresh
                </motion.button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {loading ? (
            <LoadingState />
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard
                  title="Overdue"
                  value={summary.overdue}
                  subtitle="Require attention"
                  icon={KPIIcons.alert}
                  color="#EF4444"
                  delay={0.1}
                />
                <KPICard
                  title="Due Today"
                  value={summary.due}
                  subtitle="Action needed"
                  icon={KPIIcons.clock}
                  color="#F59E0B"
                  delay={0.2}
                />
                <KPICard
                  title="Upcoming"
                  value={summary.upcoming}
                  subtitle="Next 7 days"
                  icon={KPIIcons.calendar}
                  color="#3B82F6"
                  delay={0.3}
                />
                <KPICard
                  title="Pending"
                  value={summary.pending}
                  subtitle="Future deadlines"
                  icon={KPIIcons.document}
                  color="#8B5CF6"
                  delay={0.4}
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search obligations..."
                    className="w-full pl-10 pr-4 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-orange-500/50"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
                >
                  <option value="">All Statuses</option>
                  <option value="overdue">Overdue</option>
                  <option value="due">Due Today</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                </select>

                {/* Type Filter */}
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="px-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500/50"
                >
                  <option value="">All Types</option>
                  {obligationTypes.map(type => (
                    <option key={type} value={type} className="capitalize">{type}</option>
                  ))}
                </select>

                {(statusFilter || typeFilter || searchQuery) && (
                  <button
                    onClick={() => {
                      setStatusFilter('');
                      setTypeFilter('');
                      setSearchQuery('');
                    }}
                    className="px-3 py-2 text-sm text-[#8FA3BF] hover:text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Content */}
              {viewMode === 'calendar' ? (
                <ObligationCalendar
                  obligations={filteredObligations}
                  onSelectObligation={(obligation) => setSelectedObligation(obligation)}
                  onSelectDate={(date) => console.log('Selected date:', date)}
                />
              ) : (
                <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                  <div className="grid grid-cols-[2fr,1fr,1fr,1fr,1fr,80px] gap-4 px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-white/5 sticky top-0 z-10 bg-[#151F2E] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                    <div>Obligation</div>
                    <div>Type</div>
                    <div>Due Date</div>
                    <div>Status</div>
                    <div>Priority</div>
                    <div className="text-right">Actions</div>
                  </div>

                  <div className="max-h-[500px] overflow-y-auto">
                    {filteredObligations.length === 0 ? (
                      <div className="px-5 py-8 text-center text-[#64748B] text-sm">
                        {searchQuery || statusFilter || typeFilter
                          ? 'No obligations match your filters'
                          : 'No obligations tracked yet'}
                      </div>
                    ) : (
                      filteredObligations.map((obligation, index) => (
                        <ObligationRow
                          key={obligation.id}
                          obligation={obligation}
                          index={index}
                          onClick={() => setSelectedObligation(obligation)}
                          onComplete={() => handleComplete(obligation)}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </motion.div>

      {/* Obligation Detail Modal */}
      {selectedObligation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151F2E] border border-white/10 rounded-xl w-full max-w-lg"
          >
            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{selectedObligation.title}</h3>
              <button
                onClick={() => setSelectedObligation(null)}
                className="p-1 hover:bg-white/5 rounded transition-colors"
              >
                <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {selectedObligation.description && (
                <div>
                  <label className="text-xs text-[#64748B] uppercase">Description</label>
                  <p className="text-sm text-white mt-1">{selectedObligation.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-[#64748B] uppercase">Contract</label>
                  <p className="text-sm text-white mt-1">{selectedObligation.contract_name}</p>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] uppercase">Due Date</label>
                  <p className="text-sm text-white mt-1">
                    {selectedObligation.due_date
                      ? new Date(selectedObligation.due_date).toLocaleDateString()
                      : 'Not set'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] uppercase">Type</label>
                  <p className="text-sm text-white mt-1 capitalize">{selectedObligation.obligation_type}</p>
                </div>
                <div>
                  <label className="text-xs text-[#64748B] uppercase">Assigned To</label>
                  <p className="text-sm text-white mt-1">{selectedObligation.assigned_to || 'Unassigned'}</p>
                </div>
              </div>
              {selectedObligation.status !== 'completed' && (
                <button
                  onClick={() => {
                    handleComplete(selectedObligation);
                    setSelectedObligation(null);
                  }}
                  className="w-full px-4 py-2 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600 transition-colors"
                >
                  Mark as Completed
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
