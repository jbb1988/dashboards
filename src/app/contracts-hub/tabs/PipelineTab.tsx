'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { KPICard, AnimatedCounter, tokens } from '@/components/mars-ui';
import ContractDetailDrawer, { Contract } from '@/components/contracts/ContractDetailDrawer';

interface KPIs {
  totalPipeline: number;
  totalCount: number;
  overdueValue: number;
  overdueCount: number;
  dueNext30Value: number;
  dueNext30Count: number;
}

interface ContractData {
  contracts: Contract[];
  kpis: KPIs;
  statusBreakdown: Record<string, { count: number; value: number }>;
  lastUpdated: string;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

const statusColors: Record<string, string> = {
  'Discussions Not Started': '#64748B',
  'Initial Agreement Development': '#38BDF8',
  'Review & Redlines': '#F59E0B',
  'Agreement Submission': '#A78BFA',
  'Approval & Signature': '#EC4899',
  'PO Received': '#22C55E',
};

export default function PipelineTab() {
  const [data, setData] = useState<ContractData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/salesforce');
        if (!response.ok) throw new Error('Failed to fetch contracts');
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load contracts');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredContracts = useMemo(() => {
    if (!data?.contracts) return [];
    if (activeFilter === 'all') return data.contracts;
    if (activeFilter === 'overdue') return data.contracts.filter(c => c.isOverdue);
    return data.contracts.filter(c => c.status === activeFilter);
  }, [data?.contracts, activeFilter]);

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

  if (error) {
    return (
      <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} p-8 text-center`}>
        <p className="text-red-400 mb-2">Error loading pipeline</p>
        <p className="text-[#64748B] text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Total Pipeline"
          value={<AnimatedCounter value={data?.kpis.totalPipeline || 0} prefix="$" />}
          subtitle={`${data?.kpis.totalCount || 0} contracts`}
          color="#38BDF8"
        />
        <KPICard
          title="Overdue"
          value={<AnimatedCounter value={data?.kpis.overdueValue || 0} prefix="$" />}
          subtitle={`${data?.kpis.overdueCount || 0} contracts`}
          color="#EF4444"
        />
        <KPICard
          title="Due in 30 Days"
          value={<AnimatedCounter value={data?.kpis.dueNext30Value || 0} prefix="$" />}
          subtitle={`${data?.kpis.dueNext30Count || 0} contracts`}
          color="#F59E0B"
        />
        <KPICard
          title="Average Value"
          value={<AnimatedCounter value={data?.kpis.totalCount ? data.kpis.totalPipeline / data.kpis.totalCount : 0} prefix="$" />}
          subtitle="per contract"
          color="#22C55E"
        />
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'overdue', ...Object.keys(data?.statusBreakdown || {})].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
              activeFilter === filter
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#1E293B] text-[#64748B] hover:text-white'
            }`}
          >
            {filter === 'all' ? 'All Contracts' : filter === 'overdue' ? 'Overdue' : filter}
            {filter !== 'all' && filter !== 'overdue' && data?.statusBreakdown[filter] && (
              <span className="ml-1.5 text-xs opacity-60">
                ({data.statusBreakdown[filter].count})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Contracts Table */}
      <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Contract</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Value</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Days in Stage</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Close Date</th>
            </tr>
          </thead>
          <tbody>
            {filteredContracts.slice(0, 20).map((contract, idx) => (
              <motion.tr
                key={contract.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                onClick={() => setSelectedContract(contract)}
                className="border-b border-white/5 hover:bg-white/[0.02] cursor-pointer transition-colors"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-[#EAF2FF] text-sm font-medium">{contract.name}</p>
                    {contract.salesRep && (
                      <p className="text-[#64748B] text-xs">{contract.salesRep}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#EAF2FF] text-sm font-medium tabular-nums">
                  {formatCurrency(contract.value)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium"
                    style={{
                      backgroundColor: `${statusColors[contract.status] || '#64748B'}20`,
                      color: statusColors[contract.status] || '#64748B',
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: statusColors[contract.status] || '#64748B' }}
                    />
                    {contract.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-sm tabular-nums ${contract.daysInStage > 30 ? 'text-red-400' : 'text-[#64748B]'}`}>
                    {contract.daysInStage} days
                  </span>
                </td>
                <td className="px-4 py-3 text-[#64748B] text-sm">
                  {contract.closeDate ? new Date(contract.closeDate).toLocaleDateString() : '-'}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {filteredContracts.length > 20 && (
          <div className="px-4 py-3 text-center text-[#64748B] text-sm border-t border-white/5">
            Showing 20 of {filteredContracts.length} contracts
          </div>
        )}
      </div>

      {/* Contract Detail Drawer */}
      {selectedContract && (
        <ContractDetailDrawer
          contract={selectedContract}
          onClose={() => setSelectedContract(null)}
        />
      )}
    </div>
  );
}
