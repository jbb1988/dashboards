'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard, KPIIcons } from '@/components/mars-ui';
import { FilterBar, PillarCard, InitiativeRow, InitiativeDetailDrawer, ChartsTab, BoardView } from '@/components/management';

interface Initiative {
  id: number;
  rowNumber: number;
  title: string;
  pillar: string | null;
  siLevel: string;
  owner: string | null;
  status: string | null;
  statusLabel: string;
  statusColor: string;
  timeframe: string | null;
  timeframeLabel: string;
  percentComplete: number;
  dueDate: string | null;
  description: string | null;
  comments: string | null;
  measurement: string | null;
  target: string | null;
  lastUpdated: string | null;
  updatedBy: string | null;
  dependency: string | null;
  priority: string | null;
  isPillarRow: boolean;
  parentPillar: string | null;
}

interface PillarStats {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  complete: number;
  avgProgress: number;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byTimeframe: Record<string, number>;
  byPillar: Record<string, PillarStats>;
}

interface MetaOption {
  key: string;
  label: string;
  color?: string;
  description?: string;
}

interface Meta {
  pillars: { name: string; color: string; icon: string }[];
  statuses: MetaOption[];
  timeframes: MetaOption[];
  siLevels: MetaOption[];
}

interface InitiativesResponse {
  initiatives: Initiative[];
  summary: Summary;
  owners: string[];
  lastSynced: string;
  meta: Meta;
}

type TabType = 'overview' | 'by-pillar' | 'by-owner' | 'at-risk' | 'charts' | 'board';

const PILLAR_COLORS: Record<string, string> = {
  'REVENUE GROWTH': '#38BDF8',
  'OPERATING RESULTS': '#22C55E',
  'CUSTOMER SATISFACTION': '#F59E0B',
  'TEAM MEMBER SATISFACTION': '#8B5CF6',
};

export default function ManagementDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [data, setData] = useState<InitiativesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingRows, setUpdatingRows] = useState<Set<number>>(new Set());
  const [selectedInitiative, setSelectedInitiative] = useState<Initiative | null>(null);

  // Filters
  const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<string | null>(null);
  const [selectedOwner, setSelectedOwner] = useState<string | null>(null);
  const [selectedSiLevel, setSelectedSiLevel] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const marginLeft = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedPillar) params.append('pillar', selectedPillar);
      if (selectedStatus) params.append('status', selectedStatus);
      if (selectedTimeframe) params.append('timeframe', selectedTimeframe);
      if (selectedOwner) params.append('owner', selectedOwner);
      if (selectedSiLevel) params.append('siLevel', selectedSiLevel);
      if (searchQuery) params.append('search', searchQuery);

      const url = `/api/smartsheet/initiatives${params.toString() ? `?${params}` : ''}`;
      const res = await fetch(url);
      const result = await res.json();

      if (result.error) {
        setError(result.message || result.error);
      } else {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [selectedPillar, selectedStatus, selectedTimeframe, selectedOwner, selectedSiLevel, searchQuery]);

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [fetchData]);

  // Update handler
  const handleUpdate = async (rowId: number, updates: Record<string, string>) => {
    setUpdatingRows(prev => new Set(prev).add(rowId));
    try {
      const res = await fetch('/api/smartsheet/initiatives', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowId, updates }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.message);
      // Refresh data after update
      await fetchData();
    } finally {
      setUpdatingRows(prev => {
        const next = new Set(prev);
        next.delete(rowId);
        return next;
      });
    }
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSelectedPillar(null);
    setSelectedStatus(null);
    setSelectedTimeframe(null);
    setSelectedOwner(null);
    setSelectedSiLevel(null);
    setSearchQuery('');
  };

  // Filter options from meta
  const pillarOptions = useMemo(() =>
    data?.meta.pillars.map(p => ({ key: p.name, label: p.name, color: p.color })) || [],
    [data?.meta.pillars]
  );

  const statusOptions = useMemo(() =>
    data?.meta.statuses || [],
    [data?.meta.statuses]
  );

  const timeframeOptions = useMemo(() =>
    data?.meta.timeframes || [],
    [data?.meta.timeframes]
  );

  const siLevelOptions = useMemo(() =>
    data?.meta.siLevels || [],
    [data?.meta.siLevels]
  );

  // Filtered initiatives by tab
  const displayedInitiatives = useMemo(() => {
    if (!data) return [];

    let filtered = data.initiatives;

    // Tab-specific filtering
    if (activeTab === 'at-risk') {
      filtered = filtered.filter(i => !i.isPillarRow && (i.status === 'Yellow' || i.status === 'Red'));
    }

    return filtered;
  }, [data, activeTab]);

  // Group by owner for By Owner tab
  const initiativesByOwner = useMemo(() => {
    if (!data) return {};
    const grouped: Record<string, Initiative[]> = {};
    for (const init of data.initiatives) {
      if (init.isPillarRow) continue;
      const owner = init.owner || 'Unassigned';
      if (!grouped[owner]) grouped[owner] = [];
      grouped[owner].push(init);
    }
    return grouped;
  }, [data]);

  // Summary stats
  const summaryStats = useMemo(() => {
    if (!data) return { total: 0, onTrack: 0, atRisk: 0, critical: 0 };
    const initiatives = data.initiatives.filter(i => !i.isPillarRow);
    return {
      total: initiatives.length,
      onTrack: data.summary.byStatus['Green'] || 0,
      atRisk: data.summary.byStatus['Yellow'] || 0,
      critical: data.summary.byStatus['Red'] || 0,
    };
  }, [data]);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'by-pillar' as const, label: 'By Pillar' },
    { id: 'by-owner' as const, label: 'By Owner' },
    { id: 'at-risk' as const, label: 'At Risk', badge: summaryStats.atRisk + summaryStats.critical },
    { id: 'charts' as const, label: 'Charts' },
    { id: 'board' as const, label: 'Board View' },
  ];

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.pm} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main
        className="relative z-10 transition-all duration-200 ease-out min-h-screen"
        style={{ marginLeft }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-amber-500/20">
                  <svg className="w-7 h-7 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">Strategic Initiatives</h1>
                  <p className="text-[#64748B] text-[13px]">2026 Company Pillars & Objectives</p>
                </div>
              </div>

              {/* Sync Status */}
              {data && (
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-[#64748B]">
                    Last synced: {new Date(data.lastSynced).toLocaleTimeString()}
                  </span>
                  <button
                    onClick={() => { setLoading(true); fetchData(); }}
                    className="p-2 rounded-lg bg-[#1E293B] hover:bg-[#1E293B]/80 text-[#94A3B8] transition-colors"
                    title="Refresh"
                  >
                    <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats - Using KPICard from master template */}
          {!loading && data && (
            <div className="grid grid-cols-4 gap-4 mb-6">
              <KPICard
                title="Total Initiatives"
                value={summaryStats.total}
                subtitle={`${data.owners.length} owners`}
                icon={KPIIcons.clipboard}
                color="#A855F7"
                delay={0}
              />
              <KPICard
                title="On Track"
                value={summaryStats.onTrack}
                subtitle="Green status"
                icon={KPIIcons.checkCircle}
                color="#22C55E"
                delay={0.1}
                onClick={() => setSelectedStatus(selectedStatus === 'Green' ? null : 'Green')}
                isActive={selectedStatus === 'Green'}
              />
              <KPICard
                title="At Risk"
                value={summaryStats.atRisk}
                subtitle="Yellow status"
                icon={KPIIcons.warning}
                color="#F59E0B"
                delay={0.2}
                badge={summaryStats.atRisk > 0 ? summaryStats.atRisk : undefined}
                onClick={() => setSelectedStatus(selectedStatus === 'Yellow' ? null : 'Yellow')}
                isActive={selectedStatus === 'Yellow'}
              />
              <KPICard
                title="Critical"
                value={summaryStats.critical}
                subtitle="Red status"
                icon={KPIIcons.alert}
                color="#EF4444"
                delay={0.3}
                badge={summaryStats.critical > 0 ? summaryStats.critical : undefined}
                onClick={() => setSelectedStatus(selectedStatus === 'Red' ? null : 'Red')}
                isActive={selectedStatus === 'Red'}
              />
            </div>
          )}

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 bg-[#151F2E] rounded-xl p-1 w-fit">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-orange-500 text-white'
                    : 'text-[#94A3B8] hover:text-white hover:bg-white/[0.05]'
                }`}
              >
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    activeTab === tab.id ? 'bg-white/20' : 'bg-red-500/20 text-red-400'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Filter Bar */}
          {data && (
            <div className="mb-6">
              <FilterBar
                pillars={pillarOptions}
                statuses={statusOptions}
                timeframes={timeframeOptions}
                owners={data.owners}
                siLevels={siLevelOptions}
                selectedPillar={selectedPillar}
                selectedStatus={selectedStatus}
                selectedTimeframe={selectedTimeframe}
                selectedOwner={selectedOwner}
                selectedSiLevel={selectedSiLevel}
                searchQuery={searchQuery}
                onPillarChange={setSelectedPillar}
                onStatusChange={setSelectedStatus}
                onTimeframeChange={setSelectedTimeframe}
                onOwnerChange={setSelectedOwner}
                onSiLevelChange={setSelectedSiLevel}
                onSearchChange={setSearchQuery}
                onClearAll={clearAllFilters}
              />
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-[13px] text-[#64748B]">Loading strategic initiatives...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-6 text-center">
              <svg className="w-12 h-12 mx-auto text-red-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 font-medium">{error}</p>
              <button
                onClick={() => { setLoading(true); fetchData(); }}
                className="mt-4 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-[13px] font-medium transition-colors"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Main Content */}
          {!loading && !error && data && (
            <AnimatePresence mode="wait">
              {/* Overview Tab - Pillar Cards */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="grid grid-cols-2 gap-6 mb-8">
                    {Object.entries(PILLAR_COLORS).map(([name, color], index) => (
                      <PillarCard
                        key={name}
                        name={name}
                        color={color}
                        stats={data.summary.byPillar[name] || { total: 0, onTrack: 0, atRisk: 0, critical: 0, complete: 0, avgProgress: 0 }}
                        isSelected={selectedPillar === name}
                        onClick={() => setSelectedPillar(selectedPillar === name ? null : name)}
                        index={index}
                      />
                    ))}
                  </div>

                  {/* All Initiatives List */}
                  <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06]">
                      <h2 className="text-white font-semibold">All Initiatives</h2>
                      <p className="text-[12px] text-[#64748B] mt-1">
                        {displayedInitiatives.filter(i => !i.isPillarRow).length} initiatives
                      </p>
                    </div>
                    <div className="max-h-[600px] overflow-y-auto">
                      {displayedInitiatives.map(init => (
                        <InitiativeRow
                          key={init.id}
                          initiative={init}
                          pillarColor={PILLAR_COLORS[init.parentPillar || ''] || '#64748B'}
                          onClick={() => !init.isPillarRow && setSelectedInitiative(init)}
                          isUpdating={updatingRows.has(init.id)}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* By Pillar Tab */}
              {activeTab === 'by-pillar' && (
                <motion.div
                  key="by-pillar"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {Object.entries(PILLAR_COLORS).map(([pillarName, color]) => {
                    const pillarInits = displayedInitiatives.filter(
                      i => i.parentPillar === pillarName || (i.isPillarRow && i.title === pillarName)
                    );
                    if (pillarInits.length === 0) return null;

                    return (
                      <div key={pillarName} className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
                        <div
                          className="px-5 py-4 border-b border-white/[0.06] flex items-center gap-3"
                          style={{ backgroundColor: `${color}10` }}
                        >
                          <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: color }} />
                          <div className="flex-1">
                            <h2 className="text-white font-semibold">{pillarName}</h2>
                            <p className="text-[12px] text-[#64748B]">
                              {pillarInits.filter(i => !i.isPillarRow).length} initiatives
                            </p>
                          </div>
                          <div className="flex items-center gap-4 text-[12px]">
                            <span className="text-green-400">{data.summary.byPillar[pillarName]?.onTrack || 0} on track</span>
                            <span className="text-amber-400">{data.summary.byPillar[pillarName]?.atRisk || 0} at risk</span>
                          </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto">
                          {pillarInits.filter(i => !i.isPillarRow).map(init => (
                            <InitiativeRow
                              key={init.id}
                              initiative={init}
                              pillarColor={color}
                              onClick={() => setSelectedInitiative(init)}
                              isUpdating={updatingRows.has(init.id)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}

              {/* By Owner Tab */}
              {activeTab === 'by-owner' && (
                <motion.div
                  key="by-owner"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  {Object.entries(initiativesByOwner)
                    .sort((a, b) => b[1].length - a[1].length)
                    .map(([owner, inits]) => (
                      <div key={owner} className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                          <div>
                            <h2 className="text-white font-semibold">{owner}</h2>
                            <p className="text-[12px] text-[#64748B]">{inits.length} initiatives</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {['Green', 'Yellow', 'Red'].map(status => {
                              const count = inits.filter(i => i.status === status).length;
                              if (count === 0) return null;
                              const colors = { Green: 'bg-green-400', Yellow: 'bg-amber-400', Red: 'bg-red-400' };
                              return (
                                <span key={status} className="flex items-center gap-1 text-[12px] text-[#94A3B8]">
                                  <span className={`w-2 h-2 rounded-full ${colors[status as keyof typeof colors]}`} />
                                  {count}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {inits.map(init => (
                            <InitiativeRow
                              key={init.id}
                              initiative={init}
                              pillarColor={PILLAR_COLORS[init.parentPillar || ''] || '#64748B'}
                              onClick={() => setSelectedInitiative(init)}
                              isUpdating={updatingRows.has(init.id)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                </motion.div>
              )}

              {/* At Risk Tab */}
              {activeTab === 'at-risk' && (
                <motion.div
                  key="at-risk"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/[0.06] bg-red-500/5">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <h2 className="text-white font-semibold">Initiatives Requiring Attention</h2>
                      </div>
                      <p className="text-[12px] text-[#64748B] mt-1">
                        {displayedInitiatives.length} initiatives at risk or critical
                      </p>
                    </div>

                    {displayedInitiatives.length === 0 ? (
                      <div className="p-12 text-center">
                        <svg className="w-16 h-16 mx-auto text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-green-400 font-medium text-lg">All initiatives on track!</p>
                        <p className="text-[#64748B] text-[13px] mt-1">No initiatives currently at risk or critical</p>
                      </div>
                    ) : (
                      <div className="max-h-[600px] overflow-y-auto">
                        {displayedInitiatives.map(init => (
                          <InitiativeRow
                            key={init.id}
                            initiative={init}
                            pillarColor={PILLAR_COLORS[init.parentPillar || ''] || '#64748B'}
                            onClick={() => setSelectedInitiative(init)}
                            isUpdating={updatingRows.has(init.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Charts Tab */}
              {activeTab === 'charts' && (
                <motion.div
                  key="charts"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <ChartsTab
                    summary={data.summary}
                    initiatives={data.initiatives}
                    pillarColors={PILLAR_COLORS}
                    onOwnerClick={(owner) => {
                      setSelectedOwner(owner);
                      setActiveTab('by-owner');
                    }}
                  />
                </motion.div>
              )}

              {/* Board View Tab */}
              {activeTab === 'board' && (
                <motion.div
                  key="board"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <BoardView
                    summary={data.summary}
                    initiatives={data.initiatives}
                    pillarColors={PILLAR_COLORS}
                    lastSynced={data.lastSynced}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </main>

      {/* Initiative Detail Drawer */}
      <AnimatePresence>
        {selectedInitiative && (
          <InitiativeDetailDrawer
            initiative={selectedInitiative}
            onClose={() => setSelectedInitiative(null)}
            onUpdate={async (rowId, updates) => {
              await handleUpdate(rowId, updates);
              // Update the selected initiative in local state after successful save
              if (data) {
                const updatedInit = data.initiatives.find(i => i.id === rowId);
                if (updatedInit) {
                  setSelectedInitiative(updatedInit);
                }
              }
            }}
            isUpdating={updatingRows.has(selectedInitiative.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
