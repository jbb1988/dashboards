'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import ContractDetailDrawer, { Contract } from '@/components/contracts/ContractDetailDrawer';
import { DataSourceIndicator } from '@/components/mars-ui';

// Apple Pro Design Tokens
const appleTokens = {
  // L1 Surface
  surfaceL1: 'linear-gradient(180deg, rgba(28,36,52,0.88), rgba(18,24,36,0.96))',
  // L2 Surface
  surfaceL2: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
  // Shadows
  shadowL1: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)',
  shadowHalo: 'drop-shadow(0 0 120px rgba(90,130,255,0.15))',
  // Text
  textPrimary: 'rgba(235,240,255,0.92)',
  textSecondary: 'rgba(200,210,235,0.75)',
  textMuted: 'rgba(200,210,235,0.5)',
  // Accents
  accentBlue: 'rgba(90,130,255,0.95)',
  accentAmber: 'rgba(255,190,90,0.95)',
  accentGreen: 'rgba(80,210,140,0.95)',
  accentRed: 'rgba(255,95,95,0.95)',
};

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

// Apple Pro accent-aligned status colors
const statusColors: Record<string, string> = {
  'Discussions Not Started': 'rgba(200,210,235,0.6)',
  'Initial Agreement Development': 'rgba(90,130,255,0.95)',
  'Review & Redlines': 'rgba(255,190,90,0.95)',
  'Agreement Submission': '#A78BFA',
  'Approval & Signature': '#EC4899',
  'PO Received': 'rgba(80,210,140,0.95)',
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
            <div
              key={i}
              className="h-24 rounded-2xl animate-pulse"
              style={{
                background: appleTokens.surfaceL1,
                boxShadow: appleTokens.shadowL1,
              }}
            />
          ))}
        </div>
        <div
          className="h-96 rounded-2xl animate-pulse"
          style={{
            background: appleTokens.surfaceL1,
            boxShadow: appleTokens.shadowL1,
          }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{
          background: appleTokens.surfaceL1,
          boxShadow: appleTokens.shadowL1,
        }}
      >
        <p style={{ color: appleTokens.accentRed }} className="mb-2">Error loading pipeline</p>
        <p style={{ color: appleTokens.textMuted }} className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Data Source Indicator */}
      <div className="flex justify-end">
        <DataSourceIndicator
          source="salesforce"
          lastUpdated={data?.lastUpdated || null}
          isSyncing={loading}
        />
      </div>

      {/* L1 - KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { title: 'Total Pipeline', value: data?.kpis.totalPipeline || 0, count: data?.kpis.totalCount || 0, color: appleTokens.accentBlue },
          { title: 'Overdue', value: data?.kpis.overdueValue || 0, count: data?.kpis.overdueCount || 0, color: appleTokens.accentRed },
          { title: 'Due in 30 Days', value: data?.kpis.dueNext30Value || 0, count: data?.kpis.dueNext30Count || 0, color: appleTokens.accentAmber },
          { title: 'Average Value', value: data?.kpis.totalCount ? data.kpis.totalPipeline / data.kpis.totalCount : 0, count: null, color: appleTokens.accentGreen },
        ].map((kpi, idx) => (
          <motion.div
            key={idx}
            className="p-5 rounded-2xl relative overflow-hidden"
            style={{
              background: appleTokens.surfaceL1,
              border: `1px solid ${kpi.color}20`,
              boxShadow: `${appleTokens.shadowL1}, 0 0 30px ${kpi.color}12`,
            }}
            whileHover={{ y: -2, boxShadow: `0 40px 100px rgba(0,0,0,0.8), 0 0 60px ${kpi.color}25, inset 0 1px 0 rgba(255,255,255,0.10)` }}
          >
            {/* Left accent bar */}
            <div
              className="absolute left-0 top-0 bottom-0 w-[2px]"
              style={{
                background: `linear-gradient(180deg, ${kpi.color} 0%, ${kpi.color}60 100%)`,
                boxShadow: `0 0 12px ${kpi.color}60`,
              }}
            />
            <p style={{ color: appleTokens.textSecondary }} className="text-xs font-semibold mb-2">{kpi.title}</p>
            <p style={{ color: kpi.color }} className="text-2xl font-bold tabular-nums">{formatCurrency(kpi.value)}</p>
            {kpi.count !== null && (
              <p style={{ color: appleTokens.textMuted }} className="text-xs mt-1">{kpi.count} contracts</p>
            )}
            {kpi.count === null && (
              <p style={{ color: appleTokens.textMuted }} className="text-xs mt-1">per contract</p>
            )}
          </motion.div>
        ))}
      </div>

      {/* L2 - Filters Toolbar */}
      <div
        className="flex gap-2 flex-wrap p-2 rounded-xl"
        style={{
          background: appleTokens.surfaceL2,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
        }}
      >
        {['all', 'overdue', ...Object.keys(data?.statusBreakdown || {})].map((filter) => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className="px-3 py-1.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: activeFilter === filter ? 'rgba(255,255,255,0.08)' : 'transparent',
              borderLeft: activeFilter === filter ? `2px solid ${appleTokens.accentBlue}` : '2px solid transparent',
              color: activeFilter === filter ? appleTokens.textPrimary : appleTokens.textMuted,
            }}
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

      {/* L1 - Contracts Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: appleTokens.surfaceL1,
          boxShadow: appleTokens.shadowL1,
        }}
      >
        <table className="w-full">
          <thead>
            <tr>
              <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wider" style={{ color: appleTokens.textSecondary }}>Contract</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wider" style={{ color: appleTokens.textSecondary }}>Value</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wider" style={{ color: appleTokens.textSecondary }}>Status</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wider" style={{ color: appleTokens.textSecondary }}>Days in Stage</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold tracking-wider" style={{ color: appleTokens.textSecondary }}>Close Date</th>
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
                className="cursor-pointer transition-colors"
                style={{
                  background: 'transparent',
                }}
                whileHover={{
                  backgroundColor: 'rgba(255,255,255,0.06)',
                }}
              >
                <td className="px-4 py-3">
                  <div>
                    <p style={{ color: appleTokens.textPrimary }} className="text-sm font-medium">{contract.name}</p>
                    {contract.salesRep && (
                      <p style={{ color: appleTokens.textMuted }} className="text-xs">{contract.salesRep}</p>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium tabular-nums" style={{ color: appleTokens.textPrimary }}>
                  {formatCurrency(contract.value)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium"
                    style={{
                      backgroundColor: `${statusColors[contract.status] || appleTokens.textMuted}20`,
                      color: statusColors[contract.status] || appleTokens.textMuted,
                    }}
                  >
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: statusColors[contract.status] || appleTokens.textMuted }}
                    />
                    {contract.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="text-sm tabular-nums"
                    style={{ color: contract.daysInStage > 30 ? appleTokens.accentRed : appleTokens.textMuted }}
                  >
                    {contract.daysInStage} days
                  </span>
                </td>
                <td className="px-4 py-3 text-sm" style={{ color: appleTokens.textMuted }}>
                  {contract.closeDate ? new Date(contract.closeDate).toLocaleDateString() : '-'}
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>

        {filteredContracts.length > 20 && (
          <div className="px-4 py-3 text-center text-sm" style={{ color: appleTokens.textMuted }}>
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
