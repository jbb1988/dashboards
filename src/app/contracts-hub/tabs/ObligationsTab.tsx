'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import { KPICard, KPIIcons, tokens } from '@/components/mars-ui';
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
  created_at: string;
}

interface Summary {
  pending: number;
  upcoming: number;
  due: number;
  overdue: number;
}

const priorityColors = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#38BDF8',
  low: '#22C55E',
};

const statusColors = {
  pending: '#64748B',
  upcoming: '#38BDF8',
  due: '#F59E0B',
  overdue: '#EF4444',
  completed: '#22C55E',
  waived: '#A78BFA',
  deferred: '#64748B',
};

export default function ObligationsTab() {
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [summary, setSummary] = useState<Summary>({ pending: 0, upcoming: 0, due: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadObligations();
  }, []);

  const loadObligations = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_obligations')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;

      const obls = data || [];
      setObligations(obls);

      // Calculate summary
      const now = new Date();
      const in7Days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      setSummary({
        pending: obls.filter(o => o.status === 'pending').length,
        upcoming: obls.filter(o => {
          if (!o.due_date) return false;
          const due = new Date(o.due_date);
          return due > now && due <= in7Days;
        }).length,
        due: obls.filter(o => o.status === 'due').length,
        overdue: obls.filter(o => o.status === 'overdue').length,
      });
    } catch (err) {
      console.error('Failed to load obligations:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredObligations = obligations.filter(o => {
    if (filterStatus === 'all') return true;
    return o.status === filterStatus;
  });

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('contract_obligations')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      loadObligations();
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-24 rounded-xl ${tokens.bg.card} animate-pulse`} />
          ))}
        </div>
        <div className={`h-96 rounded-xl ${tokens.bg.card} animate-pulse`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Overdue"
          value={summary.overdue}
          icon={<KPIIcons.warning />}
          accentColor="#EF4444"
        />
        <KPICard
          label="Due Soon"
          value={summary.due}
          icon={<KPIIcons.clock />}
          accentColor="#F59E0B"
        />
        <KPICard
          label="Upcoming (7d)"
          value={summary.upcoming}
          icon={<KPIIcons.calendar />}
          accentColor="#38BDF8"
        />
        <KPICard
          label="Pending"
          value={summary.pending}
          icon={<KPIIcons.tasks />}
          accentColor="#64748B"
        />
      </div>

      {/* View Toggle & Filters */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'overdue', 'due', 'upcoming', 'pending', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                filterStatus === status
                  ? 'bg-[#1E3A5F] text-white'
                  : 'bg-[#1E293B] text-[#64748B] hover:text-white'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        <div className="flex gap-1 bg-[#1E293B] rounded-lg p-1">
          <button
            onClick={() => setView('list')}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              view === 'list' ? 'bg-[#1E3A5F] text-white' : 'text-[#64748B]'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setView('calendar')}
            className={`px-3 py-1.5 rounded text-sm transition-all ${
              view === 'calendar' ? 'bg-[#1E3A5F] text-white' : 'text-[#64748B]'
            }`}
          >
            Calendar
          </button>
        </div>
      </div>

      {/* List View */}
      {view === 'list' && (
        <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Obligation</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Contract</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Due Date</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Priority</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Status</th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredObligations.map((obl, idx) => (
                <motion.tr
                  key={obl.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.02 }}
                  className="border-b border-white/5 hover:bg-white/[0.02]"
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-[#EAF2FF] text-sm font-medium">{obl.title}</p>
                      {obl.description && (
                        <p className="text-[#64748B] text-xs line-clamp-1">{obl.description}</p>
                      )}
                      {obl.ai_extracted && (
                        <span className="inline-flex items-center gap-1 mt-1 text-[10px] text-[#A855F7]">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                          </svg>
                          AI Extracted
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[#64748B] text-sm">{obl.contract_name}</td>
                  <td className="px-4 py-3 text-[#64748B] text-sm">
                    {obl.due_date ? new Date(obl.due_date).toLocaleDateString() : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${priorityColors[obl.priority]}20`,
                        color: priorityColors[obl.priority],
                      }}
                    >
                      {obl.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                      style={{
                        backgroundColor: `${statusColors[obl.status]}20`,
                        color: statusColors[obl.status],
                      }}
                    >
                      {obl.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={obl.status}
                      onChange={(e) => updateStatus(obl.id, e.target.value)}
                      className="bg-[#1E293B] border border-[#2A3544] rounded px-2 py-1 text-xs text-[#64748B] focus:outline-none focus:border-[#38BDF8]"
                    >
                      <option value="pending">Pending</option>
                      <option value="upcoming">Upcoming</option>
                      <option value="due">Due</option>
                      <option value="overdue">Overdue</option>
                      <option value="completed">Completed</option>
                      <option value="waived">Waived</option>
                      <option value="deferred">Deferred</option>
                    </select>
                  </td>
                </motion.tr>
              ))}
              {filteredObligations.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-[#64748B] text-sm">
                    No obligations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Calendar View */}
      {view === 'calendar' && (
        <ObligationCalendar obligations={obligations} onStatusChange={updateStatus} />
      )}
    </div>
  );
}
