'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import LocationHealthCard from '@/components/distributors/LocationHealthCard';
import PriorityActionsPanel from '@/components/distributors/PriorityActionsPanel';
import CompetitivePositionCard from '@/components/distributors/CompetitivePositionCard';
import PeerBenchmarkingTable from '@/components/distributors/PeerBenchmarkingTable';
import { CreateTaskModal } from '@/components/diversified/CreateTaskModal';
import type { AIRecommendation } from '@/components/diversified/UnifiedInsightsPanel';

// Icon Components
const ArrowUpIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
);

const ArrowDownIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);

const ChevronRightIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);

const ArrowLeftIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

// KPI Card Component
function KPICard({
  label,
  value,
  change,
  changeLabel,
  index = 0,
  icon
}: {
  label: string;
  value: string;
  change?: number;
  changeLabel?: string;
  index?: number;
  icon?: React.ReactNode;
}) {
  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-6 border border-white/[0.04] hover:border-[#14B8A6]/30 transition-all duration-300"
    >
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-[#64748B]">{label}</span>
        {icon && (
          <div className="w-8 h-8 rounded-lg bg-[#14B8A6]/10 flex items-center justify-center">
            {icon}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-white mb-2">{value}</div>
      {change !== undefined && (
        <div className="flex items-center gap-1.5">
          {isPositive && (
            <ArrowUpIcon className="w-3.5 h-3.5 text-[#10B981]" />
          )}
          {isNegative && (
            <ArrowDownIcon className="w-3.5 h-3.5 text-[#EF4444]" />
          )}
          <span className={`text-xs ${isPositive ? 'text-[#10B981]' : isNegative ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
            {isPositive ? '+' : ''}{change.toFixed(1)}% {changeLabel || 'YoY'}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// Format currency
const formatCurrency = (value: number) => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  } else {
    return `$${value.toFixed(0)}`;
  }
};

// Format percentage
const formatPercent = (value: number) => `${value.toFixed(1)}%`;

// StatRow Component for Quick Stats
function StatRow({
  label,
  value,
  trend,
  sublabel
}: {
  label: string;
  value: string;
  trend?: number;
  sublabel?: string;
}) {
  const isPositive = trend !== undefined && trend >= 0;
  const isNegative = trend !== undefined && trend < 0;

  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#64748B]">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-white">{value}</span>
        {sublabel && (
          <span className="text-xs text-[#64748B]">{sublabel}</span>
        )}
        {trend !== undefined && (
          <span className={`text-xs ${isPositive ? 'text-[#10B981]' : isNegative ? 'text-[#EF4444]' : 'text-[#64748B]'}`}>
            {isPositive ? '▲' : isNegative ? '▼' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

export default function DistributorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read filters directly from URL - no local state needed
  const selectedYears = useMemo(() => {
    const yearsParam = searchParams.get('years');
    return yearsParam ? yearsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
  }, [searchParams]);

  const selectedMonths = useMemo(() => {
    const monthsParam = searchParams.get('months');
    return monthsParam ? monthsParam.split(',').map(Number).filter(n => !isNaN(n)) : [];
  }, [searchParams]);

  const selectedClass = useMemo(() => {
    return searchParams.get('className');
  }, [searchParams]);

  // Task creation modal state
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<AIRecommendation | null>(null);
  const [growthOppTasksCreated, setGrowthOppTasksCreated] = useState<Set<number>>(new Set());

  // Filter panel state
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // Determine if this is a location or distributor view
  const isLocationView = useMemo(() => {
    // Location IDs are numeric (customer_id like "2875")
    // Distributor IDs are text slugs (like "ferguson" or "ferguson-enterprises")
    return id && /^\d+$/.test(id); // Check if ID is purely numeric
  }, [id]);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build URL with filter params
        const params = new URLSearchParams();
        if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
        if (selectedMonths.length > 0) params.set('months', selectedMonths.join(','));
        if (selectedClass) params.set('className', selectedClass);

        const baseEndpoint = isLocationView
          ? `/api/diversified/distributors/location/${id}`
          : `/api/diversified/distributors/${id}`;

        const endpoint = params.toString() ? `${baseEndpoint}?${params.toString()}` : baseEndpoint;

        console.log('[Detail Page] Fetching:', endpoint);
        console.log('[Detail Page] Is Location View:', isLocationView);
        console.log('[Detail Page] Filters:', { selectedYears, selectedMonths, selectedClass });

        const response = await fetch(endpoint, { signal: abortController.signal });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[Detail Page] Fetch aborted');
          return;
        }
        console.error('Error fetching detail data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    // Cleanup: abort fetch if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [id, isLocationView, selectedYears, selectedMonths, selectedClass]);

  // Handle task creation from priority actions
  const handleCreateTaskFromAction = (action: any) => {
    // Transform PriorityAction into AIRecommendation format
    const recommendation: AIRecommendation = {
      category: action.category,
      title: action.title,
      problem: action.description,
      recommendation: action.impact,
      expected_impact: `Opportunity: $${(action.metrics.opportunity / 1000).toFixed(1)}k`,
      priority: action.priority === 'critical' ? 'high' : action.priority,
      action_items: [
        action.impact,
        `Effort: ${action.effort}`,
        `Opportunity: $${(action.metrics.opportunity / 1000).toFixed(1)}k`
      ],
      customer_segment: `${data?.distributor_name} - ${data?.location}`,
    };

    setSelectedRecommendation(recommendation);
    setIsTaskModalOpen(true);
  };

  // Handle task creation from growth opportunities
  const handleCreateTaskFromGrowthOpp = (opportunity: any, index: number) => {
    // Transform Growth Opportunity into AIRecommendation format
    const recommendation: AIRecommendation = {
      category: 'expansion',
      title: `Expand into ${opportunity.category} category`,
      problem: `This location is not purchasing ${opportunity.category} products, but ${opportunity.purchased_by_pct}% of other ${data?.distributor_name} locations do.`,
      recommendation: opportunity.action,
      expected_impact: `Estimated opportunity: ${formatCurrency(opportunity.estimated_opportunity)}`,
      priority: 'medium',
      action_items: [
        opportunity.action,
        `Purchased by ${opportunity.purchased_by_pct}% of peer locations`,
        `Estimated opportunity: ${formatCurrency(opportunity.estimated_opportunity)}`
      ],
      customer_segment: `${data?.distributor_name} - ${data?.location}`,
    };

    setSelectedRecommendation(recommendation);
    setIsTaskModalOpen(true);
    setGrowthOppTasksCreated(prev => new Set(prev).add(index));
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

      setIsTaskModalOpen(false);
      setSelectedRecommendation(null);
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  };

  // Handle filter changes - only update URL, useMemo will handle state
  const handleFilterChange = (type: 'year' | 'month', value: number) => {
    const params = new URLSearchParams(searchParams.toString());

    if (type === 'year') {
      const newYears = selectedYears.includes(value)
        ? selectedYears.filter(y => y !== value)
        : [...selectedYears, value];
      if (newYears.length > 0) {
        params.set('years', newYears.join(','));
      } else {
        params.delete('years');
      }
    } else if (type === 'month') {
      const newMonths = selectedMonths.includes(value)
        ? selectedMonths.filter(m => m !== value)
        : [...selectedMonths, value];
      if (newMonths.length > 0) {
        params.set('months', newMonths.join(','));
      } else {
        params.delete('months');
      }
    }

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    router.replace(newUrl);
  };

  const availableYears = [2022, 2023, 2024, 2025, 2026];
  const availableMonths = [
    { value: 1, label: 'Jan' },
    { value: 2, label: 'Feb' },
    { value: 3, label: 'Mar' },
    { value: 4, label: 'Apr' },
    { value: 5, label: 'May' },
    { value: 6, label: 'Jun' },
    { value: 7, label: 'Jul' },
    { value: 8, label: 'Aug' },
    { value: 9, label: 'Sep' },
    { value: 10, label: 'Oct' },
    { value: 11, label: 'Nov' },
    { value: 12, label: 'Dec' },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#14B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-[#64748B]">Loading details...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0B1220] flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-[#EF4444]/10 flex items-center justify-center mx-auto mb-4">
            <span className="text-[#EF4444] text-2xl">✕</span>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Error Loading Data</h2>
          <p className="text-[#64748B] mb-6">{error || 'Unknown error occurred'}</p>
          <button
            onClick={() => router.push('/distributors-dashboard')}
            className="px-6 py-2.5 bg-[#14B8A6] text-white rounded-lg hover:bg-[#0D9488] transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Chart colors - diverse palette for better differentiation
  const CHART_COLORS = [
    '#14B8A6', // Teal
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#10B981', // Green
    '#3B82F6', // Blue
    '#EF4444', // Red
    '#F97316', // Orange
    '#06B6D4', // Cyan
    '#6366F1', // Indigo
  ];

  return (
    <div className="min-h-screen bg-[#0B1220] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb & Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/distributors-dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] text-[#14B8A6] rounded-lg hover:bg-[#334155] transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              Back to Dashboard
            </button>

            <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => router.push('/distributors-dashboard')}
              className="text-[#64748B] hover:text-[#14B8A6] transition-colors"
            >
              Distributors
            </button>
            {isLocationView ? (
              <>
                <ChevronRightIcon className="w-4 h-4 text-[#475569]" />
                <button
                  onClick={() => router.push(`/distributors/${data.distributor_name.toLowerCase().replace(/\s+/g, '-')}`)}
                  className="text-[#64748B] hover:text-[#14B8A6] transition-colors"
                >
                  {data.distributor_name}
                </button>
                <ChevronRightIcon className="w-4 h-4 text-[#475569]" />
                <span className="text-white font-medium">{data.location}</span>
              </>
            ) : (
              <>
                <ChevronRightIcon className="w-4 h-4 text-[#475569]" />
                <span className="text-white font-medium">{data.distributor_name}</span>
              </>
            )}
          </div>
          </div>

          {/* Filter Button */}
          <div className="relative">
            <button
              onClick={() => setIsFilterPanelOpen(!isFilterPanelOpen)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E293B] text-white rounded-lg hover:bg-[#334155] transition-colors border border-white/[0.08]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              Filters
              {(selectedYears.length > 0 || selectedMonths.length > 0) && (
                <span className="ml-1 px-1.5 py-0.5 bg-[#38BDF8] text-white text-[10px] rounded-full">
                  {selectedYears.length + selectedMonths.length}
                </span>
              )}
            </button>

            {/* Filter Dropdown Panel */}
            {isFilterPanelOpen && (
              <div className="absolute right-0 top-full mt-2 w-96 bg-[#1E293B] border border-white/[0.08] rounded-xl shadow-2xl z-50 p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white">Date Filters</h3>
                  <button
                    onClick={() => setIsFilterPanelOpen(false)}
                    className="text-[#64748B] hover:text-white transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Year Selection */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2 block">
                    Year
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableYears.map(year => (
                      <button
                        key={year}
                        onClick={() => handleFilterChange('year', year)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedYears.includes(year)
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                            : 'bg-[#0F172A] text-[#64748B] border border-white/[0.04] hover:border-white/[0.08]'
                        }`}
                      >
                        {year}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Month Selection */}
                <div className="mb-4">
                  <label className="text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2 block">
                    Months
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {availableMonths.map(month => (
                      <button
                        key={month.value}
                        onClick={() => handleFilterChange('month', month.value)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all ${
                          selectedMonths.includes(month.value)
                            ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
                            : 'bg-[#0F172A] text-[#64748B] border border-white/[0.04] hover:border-white/[0.08]'
                        }`}
                      >
                        {month.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <button
                    onClick={() => {
                      router.replace(window.location.pathname);
                      setIsFilterPanelOpen(false);
                    }}
                    className="text-xs text-[#EF4444] hover:text-[#EF4444]/80 font-medium transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setIsFilterPanelOpen(false)}
                    className="px-4 py-2 bg-[#14B8A6] text-white text-xs font-medium rounded-lg hover:bg-[#0D9488] transition-colors"
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                {isLocationView ? `${data.distributor_name} - ${data.location}` : data.distributor_name}
              </h1>
              {isLocationView && data.state && (
                <p className="text-[#64748B]">{data.state}</p>
              )}
            </div>

            {/* Filter Controls */}
            {(selectedYears.length > 0 || selectedMonths.length > 0 || selectedClass) && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B] mr-1">Filters:</span>
                {selectedYears.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8]">
                    <span className="text-[12px] font-medium">Year: {selectedYears.join(', ')}</span>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete('years');
                        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
                        router.replace(newUrl);
                      }}
                      className="hover:bg-[#38BDF8]/20 rounded p-0.5 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {selectedMonths.length > 0 && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8]">
                    <span className="text-[12px] font-medium">Months: {selectedMonths.join(', ')}</span>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete('months');
                        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
                        router.replace(newUrl);
                      }}
                      className="hover:bg-[#38BDF8]/20 rounded p-0.5 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                {selectedClass && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#38BDF8]/10 border border-[#38BDF8]/30 text-[#38BDF8]">
                    <span className="text-[12px] font-medium">Class: {selectedClass}</span>
                    <button
                      onClick={() => {
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete('className');
                        const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
                        router.replace(newUrl);
                      }}
                      className="hover:bg-[#38BDF8]/20 rounded p-0.5 transition-colors"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
                <button
                  onClick={() => {
                    router.replace(window.location.pathname);
                  }}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </motion.div>

        {/* KPI Cards */}
        {isLocationView ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <KPICard
              label="Revenue"
              value={formatCurrency(data.revenue)}
              change={data.yoy_change_pct}
              index={0}
            />
            <KPICard
              label="Margin %"
              value={formatPercent(data.margin_pct)}
              index={1}
            />
            <KPICard
              label="YoY Change"
              value={formatPercent(data.yoy_change_pct)}
              change={data.yoy_change_pct}
              index={2}
            />
            <KPICard
              label="Categories"
              value={data.category_count.toString()}
              index={3}
            />
            <KPICard
              label="Last Purchase"
              value={data.last_purchase_date ? `${Math.floor((new Date().getTime() - new Date(data.last_purchase_date).getTime()) / (1000 * 60 * 60 * 24))} days ago` : 'N/A'}
              index={4}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <KPICard
              label="Total Revenue"
              value={formatCurrency(data.total_revenue)}
              change={data.yoy_change_pct}
              index={0}
            />
            <KPICard
              label="Margin %"
              value={formatPercent(data.total_margin_pct)}
              index={1}
            />
            <KPICard
              label="Locations"
              value={data.location_count.toString()}
              index={2}
            />
            <KPICard
              label="Avg per Location"
              value={formatCurrency(data.avg_revenue_per_location)}
              index={3}
            />
            <KPICard
              label="Growth Opportunities"
              value={data.growth_opportunities.toString()}
              index={4}
            />
          </div>
        )}

        {/* Strategic Intelligence Dashboard (Location View Only) */}
        {isLocationView && data.health_score && (
          <>
            {/* Health Score Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mb-6"
            >
              <LocationHealthCard healthScore={data.health_score} />
            </motion.div>

            {/* Priority Actions Panel */}
            {data.priority_actions && data.priority_actions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.6 }}
                className="mb-6"
              >
                <PriorityActionsPanel
                  actions={data.priority_actions}
                  onCreateTask={handleCreateTaskFromAction}
                />
              </motion.div>
            )}

            {/* Two-Column Layout: Competitive Position & Quick Stats */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Competitive Position */}
              {data.competitive_position && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.7 }}
                >
                  <CompetitivePositionCard
                    position={data.competitive_position}
                    totalLocations={data.distributor_metrics?.total_locations || data.peer_location_count}
                  />
                </motion.div>
              )}

              {/* Quick Stats */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
                className="p-6 rounded-xl bg-[#151F2E] border border-white/[0.06]"
              >
                <h3 className="text-sm font-semibold text-white mb-4">Quick Stats</h3>
                <div className="space-y-3">
                  <StatRow
                    label="R12 Revenue"
                    value={formatCurrency(data.revenue)}
                    trend={data.yoy_change_pct}
                  />
                  <StatRow
                    label="Avg Order Value"
                    value={formatCurrency(data.revenue / (data.recent_transactions?.length || 12))}
                  />
                  <StatRow
                    label="Categories"
                    value={data.category_count.toString()}
                    sublabel="purchased"
                  />
                  <StatRow
                    label="Avg Margin"
                    value={formatPercent(data.margin_pct)}
                  />
                  <StatRow
                    label="vs Dist. Avg"
                    value={`${data.variance_from_avg >= 0 ? '+' : ''}${formatPercent(data.variance_from_avg)}`}
                    trend={data.variance_from_avg}
                  />
                </div>
              </motion.div>
            </div>

            {/* Peer Benchmarking */}
            {data.similar_locations && data.similar_locations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.8 }}
                className="mb-6"
              >
                <PeerBenchmarkingTable
                  currentLocation={{
                    customer_id: data.customer_id,
                    customer_name: data.customer_name,
                    revenue: data.revenue,
                    category_count: data.category_count,
                    margin_pct: data.margin_pct,
                  }}
                  peers={data.similar_locations}
                  transactionCount={data.recent_transactions?.length || 12}
                />
              </motion.div>
            )}
          </>
        )}

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Revenue Trend */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-6 border border-white/[0.04]"
          >
            <h3 className="text-lg font-semibold text-white mb-4">
              {isLocationView ? 'Revenue vs Distributor Avg' : 'Revenue Trend'}
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={data.revenue_trend}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#14B8A6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#14B8A6" stopOpacity={0} />
                  </linearGradient>
                  {isLocationView && (
                    <linearGradient id="avgGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#64748B" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#64748B" stopOpacity={0} />
                    </linearGradient>
                  )}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                <XAxis dataKey="month" stroke="#64748B" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748B" style={{ fontSize: '12px' }} tickFormatter={(value) => formatCurrency(value)} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: any) => [formatCurrency(value), isLocationView ? 'Revenue' : 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#14B8A6"
                  strokeWidth={2}
                  fill="url(#revenueGradient)"
                  animationDuration={1500}
                />
                {isLocationView && (
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke="#64748B"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    fill="url(#avgGradient)"
                    animationDuration={1500}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
            {isLocationView && (
              <div className="mt-4 flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#14B8A6]"></div>
                  <span className="text-[#64748B]">This Location</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-[#64748B]"></div>
                  <span className="text-[#64748B]">Distributor Avg</span>
                </div>
              </div>
            )}
          </motion.div>

          {/* Category Breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-6 border border-white/[0.04]"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Category Breakdown</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={data.category_breakdown}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  label={(entry: any) => `${entry.percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                  animationDuration={1500}
                >
                  {data.category_breakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#ffffff'
                  }}
                  itemStyle={{
                    color: '#ffffff'
                  }}
                  labelStyle={{
                    color: '#ffffff'
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {data.category_breakdown.map((cat: any, index: number) => (
                <div key={cat.category} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[index] }}
                  ></div>
                  <span className="text-[#64748B] truncate">{cat.category}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Location View: Growth Opportunities & Transactions */}
        {isLocationView && data.growth_opportunities && data.growth_opportunities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-6 border border-white/[0.04] mb-8"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Growth Opportunities</h3>
            <div className="space-y-4">
              {data.growth_opportunities.map((opp: any, index: number) => (
                <div
                  key={index}
                  className="bg-[#0F172A]/50 rounded-lg p-4 border border-[#14B8A6]/20"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-white font-medium mb-1">Missing Category: {opp.category}</h4>
                      <p className="text-sm text-[#64748B]">
                        Purchased by {opp.purchased_by_pct}% of {data.distributor_name} locations
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-[#14B8A6] font-semibold">
                        {formatCurrency(opp.estimated_opportunity)}
                      </div>
                      <div className="text-xs text-[#64748B]">Est. Opportunity</div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleCreateTaskFromGrowthOpp(opp, index)}
                    disabled={growthOppTasksCreated.has(index)}
                    className={`mt-2 px-4 py-2 rounded-lg text-sm transition-colors ${
                      growthOppTasksCreated.has(index)
                        ? 'bg-green-500/20 text-green-300 border border-green-500/30 cursor-not-allowed'
                        : 'bg-[#14B8A6]/10 text-[#14B8A6] hover:bg-[#14B8A6]/20'
                    }`}
                  >
                    {growthOppTasksCreated.has(index) ? (
                      <span className="flex items-center gap-2">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Task Created
                      </span>
                    ) : (
                      opp.action
                    )}
                  </button>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Distributor View: Top Locations */}
        {!isLocationView && data.locations && data.locations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-6 border border-white/[0.04] mb-8"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Top Performing Locations</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#64748B]">Location</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">Revenue</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">YoY %</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">Margin %</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#64748B]">Categories</th>
                  </tr>
                </thead>
                <tbody>
                  {data.locations.map((loc: any) => (
                    <tr
                      key={loc.customer_id}
                      onClick={() => router.push(`/distributors/${loc.customer_id}`)}
                      className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <div className="text-white font-medium">{loc.location}</div>
                        {loc.state && (
                          <div className="text-xs text-[#64748B]">{loc.state}</div>
                        )}
                      </td>
                      <td className="text-right py-3 px-4 text-white font-medium">
                        {formatCurrency(loc.revenue)}
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className={`${loc.yoy_change_pct >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'}`}>
                          {loc.yoy_change_pct >= 0 ? '+' : ''}{formatPercent(loc.yoy_change_pct)}
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 text-white">
                        {formatPercent(loc.margin_pct)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {loc.categories && loc.categories.slice(0, 5).map((cat: string, idx: number) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-[#14B8A6]/10 text-[#14B8A6] border border-[#14B8A6]/20"
                            >
                              {cat}
                            </span>
                          ))}
                          {loc.categories && loc.categories.length > 5 && (
                            <span className="px-2 py-0.5 text-[10px] text-[#64748B]">
                              +{loc.categories.length - 5} more
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Location View: Recent Transactions */}
        {isLocationView && data.recent_transactions && data.recent_transactions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
            className="bg-gradient-to-br from-[#1E293B] to-[#0F172A] rounded-xl p-6 border border-white/[0.04]"
          >
            <h3 className="text-lg font-semibold text-white mb-4">Recent Transactions (Last 30 Days)</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/[0.04]">
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#64748B]">Date</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#64748B]">Item</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-[#64748B]">Category</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">Quantity</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">Revenue</th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_transactions.slice(0, 20).map((txn: any, index: number) => (
                    <tr key={index} className="border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 px-4 text-[#64748B] text-sm">
                        {new Date(txn.date).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm">
                        <div className="text-white font-medium">{txn.item_name}</div>
                        {txn.item_description && (
                          <div className="text-xs text-[#64748B] mt-0.5">{txn.item_description}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#64748B] text-sm">{txn.category}</td>
                      <td className="text-right py-3 px-4 text-white text-sm">{txn.quantity}</td>
                      <td className="text-right py-3 px-4 text-white font-medium">
                        {formatCurrency(txn.revenue)}
                      </td>
                      <td className="text-right py-3 px-4 text-white">
                        {formatPercent(txn.margin_pct)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      {/* Task Creation Modal */}
      {selectedRecommendation && (
        <CreateTaskModal
          isOpen={isTaskModalOpen}
          onClose={() => {
            setIsTaskModalOpen(false);
            setSelectedRecommendation(null);
          }}
          insight={selectedRecommendation}
          onSave={handleTaskSave}
        />
      )}
    </div>
  );
}
