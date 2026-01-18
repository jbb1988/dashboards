'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import DiversifiedFilterDrawer, { DiversifiedFilterState } from '@/components/diversified/DiversifiedFilterDrawer';
import DistributorTable from '@/components/distributors/DistributorTable';
import LocationTable from '@/components/distributors/LocationTable';
import { DistributorInsightsPanel } from '@/components/distributors/DistributorInsightsPanel';
import { SalesTasksTab } from '@/components/diversified/SalesTasksTab';
import { DistributorRevenueChart } from '@/components/charts/DistributorRevenueChart';
import { LocationConcentrationChart } from '@/components/charts/LocationConcentrationChart';
import { CategoryHeatmap } from '@/components/charts/CategoryHeatmap';
import { LocationPerformanceChart } from '@/components/charts/LocationPerformanceChart';
import { CreateTaskModal } from '@/components/diversified/CreateTaskModal';
import type { AIRecommendation } from '@/components/diversified/UnifiedInsightsPanel';

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

interface GrowthScore {
  overall: number;
  components: {
    revenueGap: number;
    trendScore: number;
    categoryGap: number;
    marginHealth: number;
  };
  tier: 'high' | 'medium' | 'low';
}

interface DistributorLocation {
  customer_id: string;
  customer_name: string;
  location: string;
  state: string;
  location_confidence: number;
  revenue: number;
  prior_revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
  yoy_change_pct: number;
  units: number;
  categories: string[];
  category_count: number;
  last_purchase_date: string | null;
  growth_score?: GrowthScore;
  is_opportunity: boolean;
}

interface DistributorData {
  distributor_name: string;
  total_revenue: number;
  prior_revenue: number;
  yoy_change_pct: number;
  location_count: number;
  avg_revenue_per_location: number;
  total_margin_pct: number;
  category_penetration: number;
  growth_opportunities: number;
  locations: DistributorLocation[];
}

interface LocationWithDistributor extends DistributorLocation {
  distributor_name: string;
}

interface DistributorsResponse {
  distributors?: DistributorData[]; // Present when view=distributor
  locations?: LocationWithDistributor[]; // Present when view=location
  summary: {
    total_distributors: number;
    total_locations: number;
    total_revenue: number;
    total_diversified_revenue: number;
    avg_revenue_per_location: number;
    total_growth_opportunities: number;
    opportunities_by_tier: {
      high: number;
      medium: number;
      low: number;
    };
  };
  periods: {
    current: { start: string; end: string };
    prior: { start: string; end: string };
  };
  categories: string[];
}

// =============================================================================
// CONSTANTS
// =============================================================================

const TIER_CONFIG = {
  high: { label: 'High', color: '#EF4444', bg: 'bg-red-500/10', text: 'text-red-400' },
  medium: { label: 'Medium', color: '#F59E0B', bg: 'bg-amber-500/10', text: 'text-amber-400' },
  low: { label: 'Low', color: '#3B82F6', bg: 'bg-blue-500/10', text: 'text-blue-400' },
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value)}`;
}

function formatPercentage(value: number, decimals: number = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

function formatNumber(value: number): string {
  return value.toLocaleString();
}

function getYoYColor(value: number): string {
  if (value > 0) return 'text-green-400';
  if (value < 0) return 'text-red-400';
  return 'text-gray-400';
}

// Filter Badge Component
function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#14B8A6]/10 border border-[#14B8A6]/20 text-[#14B8A6] text-[12px] font-medium"
    >
      <span>{label}</span>
      <button
        onClick={onRemove}
        className="hover:bg-[#14B8A6]/20 rounded p-0.5 transition-colors"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function DistributorsDashboard() {
  const router = useRouter();

  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'insights' | 'tasks'>('table');

  // View mode (distributor-level or location-level)
  const [viewMode, setViewMode] = useState<'distributor' | 'location'>('distributor');

  // Data state
  const [data, setData] = useState<DistributorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);

  // UI state
  const [expandedDistributor, setExpandedDistributor] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'revenue' | 'growth_opps' | 'yoy'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Modal state for task creation
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<AIRecommendation | null>(null);
  const [selectedActionItem, setSelectedActionItem] = useState<string | undefined>(undefined);

  // Handle task creation from insights
  const handleCreateTask = (recommendation: AIRecommendation, actionItem?: string) => {
    setSelectedRecommendation(recommendation);
    setSelectedActionItem(actionItem);
    setIsTaskModalOpen(true);
  };

  // Handle task save
  const handleTaskSave = async (taskData: any) => {
    try {
      const response = await fetch('/api/diversified/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) throw new Error('Failed to create task');

      // Close modal on success
      setIsTaskModalOpen(false);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  // Compute filter options
  const filterOptions = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 7 }, (_, i) => currentYear - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const classes = data?.categories || [];

    return { years, months, classes };
  }, [data?.categories]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedYears.length > 0) count++;
    if (selectedMonths.length > 0) count++;
    if (selectedClass) count++;
    return count;
  }, [selectedYears, selectedMonths, selectedClass]);

  // Reset filters
  const resetFilters = () => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedClass(null);
  };

  // Data fetching
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (selectedYears.length > 0) params.append('years', selectedYears.join(','));
        if (selectedMonths.length > 0) params.append('months', selectedMonths.join(','));
        if (selectedClass) params.append('className', selectedClass);
        params.append('view', viewMode);

        const response = await fetch(`/api/diversified/distributors?${params}`);
        if (!response.ok) throw new Error('Failed to fetch distributor data');

        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
        console.error('Error fetching distributor data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedYears, selectedMonths, selectedClass, viewMode]);

  // Calculate max revenue for table visualizations
  const maxRevenue = useMemo(() => {
    if (!data) return 0;

    if (viewMode === 'distributor') {
      if (!data.distributors || data.distributors.length === 0) return 0;
      return Math.max(...data.distributors.map(d => d.total_revenue), 0);
    } else {
      // For location view, use the flat locations array from API
      if (!data.locations || data.locations.length === 0) return 0;
      return Math.max(...data.locations.map(loc => loc.revenue), 0);
    }
  }, [data, viewMode]);

  // Sort distributors
  const sortedDistributors = useMemo(() => {
    if (!data || !data.distributors) return [];

    const sorted = [...data.distributors];

    sorted.sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortBy) {
        case 'revenue':
          aVal = a.total_revenue;
          bVal = b.total_revenue;
          break;
        case 'growth_opps':
          aVal = a.growth_opportunities;
          bVal = b.growth_opportunities;
          break;
        case 'yoy':
          aVal = a.yoy_change_pct;
          bVal = b.yoy_change_pct;
          break;
        default:
          aVal = a.total_revenue;
          bVal = b.total_revenue;
      }

      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }, [data, sortBy, sortDir]);

  // Toggle sort
  const handleSort = (column: 'revenue' | 'growth_opps' | 'yoy') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  // ===== CHART DATA PROCESSING =====

  // Chart 1: Revenue trend data (mock for now - would need monthly data from API)
  const revenueTrendData = useMemo(() => {
    if (!data || !data.distributors) return { data: [], distributors: [] };

    // For now, create placeholder monthly data
    // In production, this would come from the API with actual monthly breakdowns
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    const topDistributors = data.distributors.slice(0, 5);

    const chartData = months.map((month, idx) => {
      const monthData: any = { month };
      topDistributors.forEach(dist => {
        // Simulate monthly variance
        const baseRevenue = dist.total_revenue / 12;
        const variance = 0.85 + (Math.random() * 0.3); // 85-115% of average
        monthData[dist.distributor_name] = baseRevenue * variance;
      });
      return monthData;
    });

    return {
      data: chartData,
      distributors: topDistributors.map(d => d.distributor_name)
    };
  }, [data]);

  // Chart 2: Location concentration data
  const concentrationData = useMemo(() => {
    if (!data || !data.distributors) return { data: [], totalRevenue: 0, hhi: 0 };

    // Get all locations across distributors
    const allLocations = data.distributors.flatMap(d =>
      d.locations.map(loc => ({
        name: `${loc.location} (${d.distributor_name})`,
        value: loc.revenue,
      }))
    );

    // Sort by revenue and take top 5
    const sorted = allLocations.sort((a, b) => b.value - a.value);
    const top5 = sorted.slice(0, 5);
    const othersTotal = sorted.slice(5).reduce((sum, loc) => sum + loc.value, 0);

    const chartData = [
      ...top5.map(loc => ({
        name: loc.name,
        value: loc.value,
        percentage: (loc.value / data.summary.total_revenue) * 100
      })),
      ...(othersTotal > 0 ? [{
        name: 'Other',
        value: othersTotal,
        percentage: (othersTotal / data.summary.total_revenue) * 100
      }] : [])
    ];

    // Calculate HHI (Herfindahl-Hirschman Index)
    const hhi = allLocations.reduce((sum, loc) => {
      const marketShare = (loc.value / data.summary.total_revenue) * 100;
      return sum + (marketShare * marketShare);
    }, 0);

    return {
      data: chartData,
      totalRevenue: data.summary.total_revenue,
      hhi
    };
  }, [data]);

  // Chart 3: Category heatmap data
  const categoryHeatmapData = useMemo(() => {
    if (!data || !data.distributors) return { data: [], distributors: [], categories: [] };

    const categories = data.categories || [];
    const heatmapCells: any[] = [];

    data.distributors.forEach(dist => {
      categories.forEach(category => {
        // Calculate revenue for this distributor-category combination
        const categoryRevenue = dist.locations.reduce((sum, loc) => {
          const hasCategory = loc.categories.includes(category);
          return sum + (hasCategory ? loc.revenue / loc.categories.length : 0);
        }, 0);

        heatmapCells.push({
          distributor: dist.distributor_name,
          category,
          revenue: categoryRevenue,
          percentage: dist.total_revenue > 0 ? (categoryRevenue / dist.total_revenue) * 100 : 0
        });
      });
    });

    return {
      data: heatmapCells,
      distributors: data.distributors.map(d => d.distributor_name),
      categories
    };
  }, [data]);

  // Chart 4: At-risk scatter data
  const scatterData = useMemo(() => {
    if (!data || !data.distributors) return [];

    const points = data.distributors.flatMap(dist =>
      dist.locations
        .filter(loc => loc.is_opportunity)
        .map(loc => ({
          name: loc.location,
          distributor: dist.distributor_name,
          x: loc.yoy_change_pct,
          y: loc.revenue,
          z: loc.growth_score?.overall || 50,
          tier: loc.growth_score?.tier || 'low'
        }))
    );

    return points;
  }, [data]);

  // Chart 5: Location performance data
  const performanceData = useMemo(() => {
    if (!data || !data.distributors) return [];

    const allLocations = data.distributors.flatMap(dist => {
      const avgRevenue = dist.avg_revenue_per_location;

      return dist.locations.map(loc => {
        const variance = avgRevenue > 0 ? ((loc.revenue - avgRevenue) / avgRevenue) * 100 : 0;
        const varianceAmount = loc.revenue - avgRevenue;

        return {
          location: loc.location,
          distributor: dist.distributor_name,
          revenue: loc.revenue,
          distributorAvg: avgRevenue,
          variance,
          varianceAmount
        };
      });
    });

    return allLocations;
  }, [data]);

  return (
    <div className="min-h-screen bg-[#0B1220]">
      {/* Background */}
      <DashboardBackground {...backgroundPresets.finance} />

      {/* Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      {/* Main content */}
      <motion.main
        className="relative z-10 transition-all duration-300"
        style={{
          marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
        }}
      >
        <div className="px-8 py-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <h1 className="text-3xl font-bold text-white mb-2">
              Distributor Analysis
            </h1>
            <p className="text-[#94A3B8] text-sm">
              Track growth opportunities across Ferguson, Core & Main, Fortiline, and distributor locations
            </p>
          </motion.div>

          {/* Loading State */}
          {loading && !data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-20"
            >
              <div className="text-[#94A3B8]">Loading distributor data...</div>
            </motion.div>
          )}

          {/* Error State */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 mb-6"
            >
              <p className="text-red-400 text-sm">{error}</p>
            </motion.div>
          )}

          {/* Data Content */}
          {data && (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-6 gap-4 mb-6">
                <KPICard
                  title="Total Distributors"
                  value={data.summary.total_distributors.toString()}
                  subtitle={`${data.summary.total_locations} locations`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>}
                  color="#14B8A6"
                  delay={0}
                />
                <KPICard
                  title="Total Locations"
                  value={data.summary.total_locations.toString()}
                  subtitle={`Avg: ${formatCurrencyCompact(data.summary.avg_revenue_per_location)}/loc`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
                  color="#06B6D4"
                  delay={0.05}
                />
                <KPICard
                  title="Total Revenue"
                  value={formatCurrencyCompact(data.summary.total_revenue)}
                  subtitle="All distributors"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  color="#22C55E"
                  delay={0.1}
                />
                <KPICard
                  title="Avg Revenue/Loc"
                  value={formatCurrencyCompact(data.summary.avg_revenue_per_location)}
                  subtitle="Per location"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  color="#F59E0B"
                  delay={0.15}
                />
                <KPICard
                  title="Growth Opportunities"
                  value={data.summary.total_growth_opportunities.toString()}
                  subtitle={`${data.summary.opportunities_by_tier.high} high priority`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>}
                  color="#EF4444"
                  trend={data.summary.total_growth_opportunities > 0 ? 'up' : undefined}
                  delay={0.2}
                />
                <KPICard
                  title="High Priority"
                  value={data.summary.opportunities_by_tier.high.toString()}
                  subtitle={`${data.summary.opportunities_by_tier.medium} medium, ${data.summary.opportunities_by_tier.low} low`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                  color="#A855F7"
                  delay={0.25}
                />
              </div>

              {/* Tab Navigation */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.28 }}
                className="flex items-center gap-1 mb-6"
              >
                <button
                  onClick={() => setActiveTab('table')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'table'
                      ? 'bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/30 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Table
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'charts'
                      ? 'bg-[#14B8A6]/20 text-[#14B8A6] border border-[#14B8A6]/30 shadow-[0_0_20px_rgba(20,184,166,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Charts
                </button>
                <button
                  onClick={() => setActiveTab('insights')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'insights'
                      ? 'bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30 shadow-[0_0_20px_rgba(168,85,247,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Insights
                </button>
                <button
                  onClick={() => setActiveTab('tasks')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'tasks'
                      ? 'bg-[#F59E0B]/20 text-[#F59E0B] border border-[#F59E0B]/30 shadow-[0_0_20px_rgba(245,158,11,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Tasks
                </button>
              </motion.div>

              {/* Filter Button + Active Filter Badges */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-4 mb-6"
              >
                {/* View Toggle - Only on table view */}
                {activeTab === 'table' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">View:</span>
                    <div className="flex rounded-lg overflow-hidden border border-white/[0.04]">
                      <button
                        onClick={() => setViewMode('distributor')}
                        className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                          viewMode === 'distributor'
                            ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                            : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        By Distributor
                      </button>
                      <button
                        onClick={() => setViewMode('location')}
                        className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                          viewMode === 'location'
                            ? 'bg-[#14B8A6]/20 text-[#14B8A6]'
                            : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                        }`}
                      >
                        By Location
                      </button>
                    </div>
                  </div>
                )}

                {/* Filter Button */}
                <button
                  onClick={() => setFilterDrawerOpen(true)}
                  className="px-4 py-2.5 rounded-xl bg-[#151F2E] border border-white/[0.04] hover:border-[#14B8A6]/30 transition-all flex items-center gap-2 text-white hover:bg-[#1A2942]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                  </svg>
                  <span className="text-[13px] font-medium">Filters</span>
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-[#14B8A6]/20 text-[#14B8A6] text-[10px] font-semibold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>

                {/* Active Filter Badges */}
                <div className="flex items-center gap-2 flex-wrap flex-1">
                  <AnimatePresence>
                    {selectedYears.length > 0 && (
                      <FilterBadge
                        label={`Year: ${selectedYears.join(', ')}`}
                        onRemove={() => setSelectedYears([])}
                      />
                    )}
                    {selectedMonths.length > 0 && (
                      <FilterBadge
                        label={`Month: ${selectedMonths.map(m => MONTH_NAMES[m-1]).join(', ')}`}
                        onRemove={() => setSelectedMonths([])}
                      />
                    )}
                    {selectedClass && (
                      <FilterBadge
                        label={`Class: ${selectedClass}`}
                        onRemove={() => setSelectedClass(null)}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Reset Filters */}
                {activeFilterCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
                  >
                    Reset All
                  </button>
                )}
              </motion.div>

              {/* Tab Content */}
              {activeTab === 'table' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  {viewMode === 'distributor' ? (
                    <DistributorTable
                      data={data.distributors || []}
                      maxRevenue={maxRevenue}
                      totalDiversifiedRevenue={data.summary.total_diversified_revenue}
                      selectedYears={selectedYears}
                      selectedMonths={selectedMonths}
                      selectedClass={selectedClass}
                    />
                  ) : (
                    <LocationTable
                      data={data.locations ? [{ distributor_name: '', locations: data.locations }] : []}
                      maxRevenue={maxRevenue}
                      selectedYears={selectedYears}
                      selectedMonths={selectedMonths}
                      selectedClass={selectedClass}
                    />
                  )}
                </motion.div>
              )}

              {activeTab === 'charts' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                  className="space-y-6"
                >
                  {/* Row 1: Revenue Trend + Location Concentration */}
                  <div className="grid grid-cols-2 gap-6">
                    <DistributorRevenueChart
                      data={revenueTrendData.data}
                      distributorNames={revenueTrendData.distributors}
                      index={0}
                    />
                    <LocationConcentrationChart
                      data={concentrationData.data}
                      totalRevenue={concentrationData.totalRevenue}
                      hhi={concentrationData.hhi}
                      index={1}
                    />
                  </div>

                  {/* Row 2: Category Heatmap (full width) */}
                  <CategoryHeatmap
                    data={categoryHeatmapData.data}
                    distributors={categoryHeatmapData.distributors}
                    categories={categoryHeatmapData.categories}
                    index={2}
                  />

                </motion.div>
              )}

              {activeTab === 'insights' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <DistributorInsightsPanel
                    onGenerate={async () => {
                      const params = new URLSearchParams();
                      if (selectedYears.length > 0) params.append('years', selectedYears.join(','));
                      if (selectedMonths.length > 0) params.append('months', selectedMonths.join(','));
                      if (selectedClass) params.append('className', selectedClass);

                      const response = await fetch(`/api/diversified/distributors/insights?${params}`);
                      if (!response.ok) throw new Error('Failed to generate insights');

                      const result = await response.json();
                      return {
                        recommendations: result.recommendations,
                        executive_summary: result.executive_summary,
                      };
                    }}
                    onCreateTask={handleCreateTask}
                    selectedYears={selectedYears}
                    selectedMonths={selectedMonths}
                    selectedClass={selectedClass}
                  />
                </motion.div>
              )}

              {activeTab === 'tasks' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.35 }}
                >
                  <SalesTasksTab />
                </motion.div>
              )}
            </>
          )}
        </div>
      </motion.main>

      {/* Filter Drawer */}
      <DiversifiedFilterDrawer
        isOpen={filterDrawerOpen}
        onClose={() => setFilterDrawerOpen(false)}
        filters={{
          selectedYears,
          selectedMonths,
          selectedClass,
          viewMode: 'class',
        }}
        onFilterChange={(updates) => {
          if (updates.selectedYears !== undefined) setSelectedYears(updates.selectedYears);
          if (updates.selectedMonths !== undefined) setSelectedMonths(updates.selectedMonths);
          if (updates.selectedClass !== undefined) setSelectedClass(updates.selectedClass);
        }}
        filterOptions={filterOptions}
        activeTab="distributors"
      />

      {/* Task Creation Modal */}
      {selectedRecommendation && (
        <CreateTaskModal
          isOpen={isTaskModalOpen}
          onClose={() => setIsTaskModalOpen(false)}
          insight={selectedRecommendation}
          actionItem={selectedActionItem}
          onSave={handleTaskSave}
        />
      )}
    </div>
  );
}
