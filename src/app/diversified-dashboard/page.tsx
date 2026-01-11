'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, KPICard } from '@/components/mars-ui';
import {
  RevenueAreaChart,
  ClassBarChart,
  BudgetVarianceChart,
  CustomerDonut,
  AttritionBarChart,
  YoYComparisonChart,
  ConcentrationChart,
  CrossSellTable,
} from '@/components/charts';
import { CustomerDetailDrawer } from '@/components/diversified/CustomerDetailDrawer';
import { ProductsTab } from '@/components/diversified/ProductsTab';
import { StoppedBuyingReport } from '@/components/diversified/StoppedBuyingReport';
import { AIInsightsPanelV2 } from '@/components/AIInsightsPanelV2';
import InsightsDrawer from '@/components/diversified/InsightsDrawer';
import { SalesTasksTab } from '@/components/diversified/SalesTasksTab';
import { MetricExplainer, HHIExplainer, YoYChangeExplainer } from '@/components/ui/MetricExplainer';

interface ClassSummary {
  class_name: string;
  class_category: string;
  total_units: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
  transaction_count: number;
}

interface ItemSummary {
  item_name: string;
  quantity: number;
  revenue: number;
}

interface CustomerSummary {
  customer_id: string;
  customer_name: string;
  total_units: number;
  total_revenue: number;
  total_cost: number;
  total_gross_profit: number;
  avg_gross_profit_pct: number;
  transaction_count: number;
  top_items?: ItemSummary[];
  item_count?: number;
}

interface DashboardSummary {
  totalRevenue: number;
  totalUnits: number;
  totalCost: number;
  grossProfit: number;
  grossProfitPct: number;
  transactionCount: number;
  uniqueClasses: number;
  uniqueCustomers: number;
  budgetRevenue: number;
  budgetUnits: number;
  budgetCost: number;
  budgetGrossProfit: number;
  variancePct: number | null;
}

interface FilterOptions {
  years: number[];
  months: number[];
  classes: string[];
  customers: Array<{ id: string; name: string }>;
}

interface MonthlyChartData {
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  grossProfitPct: number;
  units: number;
  transactionCount: number;
}

interface ClassMonthlyData {
  className: string;
  year: number;
  month: number;
  monthName: string;
  revenue: number;
  cost: number;
  grossProfit: number;
  units: number;
}

interface BudgetData {
  year: number;
  month: number;
  class_name: string;
  budget_revenue: number;
}

interface ChartData {
  monthly: MonthlyChartData[];
  classMonthly: ClassMonthlyData[];
}

// Insights data types
interface InsightsSummary {
  at_risk_customers: number;
  at_risk_revenue: number;
  churned_customers: number;
  churned_revenue: number;
  yoy_revenue_change_pct: number;
  yoy_margin_change_pct: number;
  cross_sell_potential: number;
  hhi_index: number;
  hhi_interpretation: 'diversified' | 'moderate' | 'concentrated';
  new_customers_12mo: number;
}

interface AttritionData {
  customer_id: string;
  customer_name: string;
  attrition_score: number;
  status: 'active' | 'declining' | 'at_risk' | 'churned';
  revenue_at_risk: number;
  recency_days: number;
  frequency_change_pct: number;
  monetary_change_pct: number;
  current_12mo_revenue?: number;
  prior_12mo_revenue?: number;
  score_components?: {
    recency: number;
    frequency: number;
    monetary: number;
    productMix: number;
  };
}

interface YoYData {
  entity_type: 'customer' | 'class';
  entity_id: string;
  entity_name: string;
  current_revenue: number;
  prior_revenue: number;
  revenue_change_pct: number;
  current_margin_pct: number;
  prior_margin_pct: number;
  trend: 'growing' | 'stable' | 'declining';
}

interface CrossSellOpportunity {
  customer_id: string;
  customer_name: string;
  current_classes: string[];
  recommended_class: string;
  affinity_score: number;
  similar_customer_count: number;
  similar_customer_coverage_pct: number;
  estimated_revenue: number;
  avg_margin_pct: number;
  reasoning: string;
}

interface ConcentrationData {
  hhi_index: number;
  hhi_interpretation: 'diversified' | 'moderate' | 'concentrated';
  top_customer_pct: number;
  top_customer_name: string;
  top_3_concentration: number;
  top_3_names: string[];
  customers_for_80_pct: number;
  total_customers: number;
  total_revenue: number;
  segments: {
    tier: 'platinum' | 'gold' | 'silver' | 'bronze';
    customer_count: number;
    total_revenue: number;
    pct_of_total: number;
    threshold_description: string;
  }[];
}

interface InsightAlert {
  type: 'danger' | 'warning' | 'info';
  title: string;
  message: string;
  metric?: string;
}

interface InsightsData {
  summary: InsightsSummary;
  alerts: InsightAlert[];
  attrition: AttritionData[];
  yoy: YoYData[];
  crossSell: CrossSellOpportunity[];
  concentration: ConcentrationData;
}

interface DashboardData {
  summary: DashboardSummary;
  byClass: ClassSummary[];
  byCustomer: CustomerSummary[];
  filterOptions: FilterOptions;
  filters: {
    years?: number[];
    months?: number[];
    className?: string;
    customerId?: string;
    view: string;
  };
  chartData?: ChartData;
  lastUpdated: string;
}

// Format currency - rounded to nearest dollar with commas (for table rows)
function formatCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString()}`;
}

// Format currency compact - abbreviated K/M format (for KPI cards)
function formatCurrencyCompact(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

// Format number with commas
function formatNumber(value: number): string {
  return value.toLocaleString();
}

// Format percent
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Month names
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Filter Chip Component
function FilterChip({ label, selected, onClick, count }: {
  label: string;
  selected: boolean;
  onClick: () => void;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-all ${
        selected
          ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30'
          : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
      }`}
    >
      {label}
      {count !== undefined && <span className="ml-1.5 opacity-60">({count})</span>}
    </button>
  );
}

// Item Tooltip Component - styled to match Contracts Pipeline KEY DATES tooltip
function ItemTooltip({
  customer,
  position
}: {
  customer: CustomerSummary;
  position: { x: number; y: number };
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Adjust position to prevent tooltip from going off-screen
  const adjustedX = Math.min(position.x, typeof window !== 'undefined' ? window.innerWidth - 340 : position.x);
  const adjustedY = Math.min(position.y, typeof window !== 'undefined' ? window.innerHeight - 300 : position.y);

  if (!mounted) return null;

  // Colors for item dots (cycle through)
  const dotColors = ['#38BDF8', '#22C55E', '#F59E0B', '#A855F7', '#EC4899'];

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed z-[9999]"
      style={{ left: adjustedX, top: adjustedY }}
    >
      <div className="bg-[#0F1722] border border-white/10 rounded-xl shadow-2xl shadow-black/50 backdrop-blur-xl overflow-hidden min-w-[280px] max-w-[380px]">
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-white/[0.06] bg-gradient-to-r from-[#38BDF8]/10 to-transparent">
          <span className="text-[10px] font-semibold text-[#38BDF8] uppercase tracking-wider">Items Purchased</span>
        </div>

        {/* Items List */}
        <div className="p-3 space-y-0">
          {customer.top_items && customer.top_items.length > 0 ? (
            <>
              {customer.top_items.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 py-2 px-1 rounded hover:bg-white/[0.02] transition-colors"
                >
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: dotColors[idx % dotColors.length],
                      boxShadow: `0 0 6px ${dotColors[idx % dotColors.length]}50`
                    }}
                  />
                  <span className="text-[12px] text-[#94A3B8] flex-1 truncate max-w-[180px]" title={item.item_name}>
                    {item.item_name}
                  </span>
                  <span className="text-[11px] text-[#64748B] tabular-nums">
                    {item.quantity.toLocaleString()} qty
                  </span>
                  <span className="text-[13px] font-medium text-[#E2E8F0] tabular-nums min-w-[70px] text-right">
                    {formatCurrency(item.revenue)}
                  </span>
                </div>
              ))}

              {/* More items indicator */}
              {customer.item_count && customer.item_count > 5 && (
                <div className="flex items-center gap-3 py-2 px-1 mt-1 border-t border-white/[0.04]">
                  <div className="w-2 h-2 rounded-full bg-[#475569]" />
                  <span className="text-[11px] text-[#64748B] italic">
                    + {customer.item_count - 5} more items
                  </span>
                </div>
              )}
            </>
          ) : (
            <div className="py-2 px-1 text-[12px] text-[#64748B] italic">No item data available</div>
          )}
        </div>
      </div>
    </motion.div>,
    document.body
  );
}

// Expandable Row Component
function ExpandableRow({
  data,
  type,
  index,
  maxRevenue,
  onExpand,
  isExpanded,
  childData,
}: {
  data: ClassSummary | CustomerSummary;
  type: 'class' | 'customer';
  index: number;
  maxRevenue: number;
  onExpand: () => void;
  isExpanded: boolean;
  childData?: Array<ClassSummary | CustomerSummary>;
}) {
  const isEvenRow = index % 2 === 0;
  const gpColor = data.avg_gross_profit_pct >= 50 ? '#22C55E' : data.avg_gross_profit_pct >= 40 ? '#F59E0B' : '#EF4444';
  const name = type === 'class' ? (data as ClassSummary).class_name : (data as CustomerSummary).customer_name;
  const category = type === 'class' ? (data as ClassSummary).class_category : '';

  // Hover state for item tooltip (only for class view showing customers)
  const [hoveredCustomer, setHoveredCustomer] = useState<CustomerSummary | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (customer: CustomerSummary, e: React.MouseEvent) => {
    // Clear any existing timeout
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    // Set tooltip after 200ms delay
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredCustomer(customer);
      setTooltipPosition({
        x: e.clientX + 15,
        y: e.clientY + 10
      });
    }, 200);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredCustomer(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredCustomer) {
      setTooltipPosition({
        x: e.clientX + 15,
        y: e.clientY + 10
      });
    }
  };

  return (
    <div className={isEvenRow ? 'bg-[#131B28]' : 'bg-[#111827]'}>
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.02, duration: 0.15 }}
        onClick={onExpand}
        className={`grid gap-4 px-6 py-3.5 cursor-pointer transition-all hover:bg-[#1a2740] ${
          isExpanded ? 'bg-[#38BDF8]/5 ring-1 ring-inset ring-[#38BDF8]/20' : ''
        }`}
        style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
      >
        {/* Name */}
        <div className="flex items-center gap-3">
          <motion.span
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.15 }}
            className="text-[#64748B] text-[10px]"
          >
            ▶
          </motion.span>
          <div>
            <div className="font-medium text-[#EAF2FF] text-[14px]">{name}</div>
            {category && <div className="text-[11px] text-[#64748B]">{category}</div>}
          </div>
        </div>

        {/* Units */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatNumber(data.total_units)}</div>
          <div className="text-[11px] text-[#64748B]">units</div>
        </div>

        {/* Revenue */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatCurrency(data.total_revenue)}</div>
          <div className="w-16 h-[3px] rounded-full bg-white/10 overflow-hidden mt-1 ml-auto">
            <div
              className="h-full rounded-full bg-[#38BDF8]"
              style={{ width: `${(data.total_revenue / maxRevenue) * 100}%` }}
            />
          </div>
        </div>

        {/* Cost */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatCurrency(data.total_cost)}</div>
          <div className="text-[11px] text-[#64748B]">COGS</div>
        </div>

        {/* Gross Profit */}
        <div className="text-right">
          <div className="text-[#CBD5E1] font-semibold text-[14px]">{formatCurrency(data.total_gross_profit)}</div>
          <div className="text-[11px] text-[#64748B]">GP</div>
        </div>

        {/* GP% */}
        <div className="text-center">
          <span
            className="inline-flex items-center gap-1.5 justify-center px-2.5 py-1 rounded-full text-[12px] font-semibold"
            style={{ backgroundColor: `${gpColor}20`, color: gpColor }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: gpColor }} />
            {formatPercent(data.avg_gross_profit_pct)}
          </span>
        </div>
      </motion.div>

      {/* Expanded Child Data */}
      <AnimatePresence>
        {isExpanded && childData && childData.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mx-4 mb-4 rounded-lg bg-[#0B1220] border border-white/[0.04] shadow-[inset_0_2px_8px_rgba(0,0,0,0.3)] overflow-hidden">
              {/* Child Header */}
              <div
                className="grid gap-4 px-4 py-2 bg-[#0F172A] border-b border-white/[0.04] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider"
                style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
              >
                <div>{type === 'class' ? 'Customer' : 'Class'}</div>
                <div className="text-right">Units</div>
                <div className="text-right">Revenue</div>
                <div className="text-right">Cost</div>
                <div className="text-right">GP</div>
                <div className="text-center">GP%</div>
              </div>

              {/* Child Rows */}
              {childData.map((child, idx) => {
                const childName = type === 'class'
                  ? (child as CustomerSummary).customer_name
                  : (child as ClassSummary).class_name;
                const childGpColor = child.avg_gross_profit_pct >= 50 ? '#22C55E' : child.avg_gross_profit_pct >= 40 ? '#F59E0B' : '#EF4444';
                const isCustomerRow = type === 'class';
                const customerData = isCustomerRow ? (child as CustomerSummary) : null;
                const hasItemData = customerData?.top_items && customerData.top_items.length > 0;

                return (
                  <div
                    key={idx}
                    className={`grid gap-4 px-4 py-2.5 ${idx % 2 === 0 ? 'bg-[#0B1220]' : 'bg-[#0F1729]'} hover:bg-[#1a2740] transition-colors ${isCustomerRow && hasItemData ? 'cursor-pointer' : ''}`}
                    style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
                    onMouseEnter={isCustomerRow && customerData ? (e) => handleMouseEnter(customerData, e) : undefined}
                    onMouseLeave={isCustomerRow ? handleMouseLeave : undefined}
                    onMouseMove={isCustomerRow ? handleMouseMove : undefined}
                  >
                    <div className="text-[13px] text-[#CBD5E1] flex items-center gap-2">
                      {childName}
                      {isCustomerRow && hasItemData && (
                        <span className="text-[10px] text-[#64748B] bg-white/[0.04] px-1.5 py-0.5 rounded">
                          {customerData.item_count} items
                        </span>
                      )}
                    </div>
                    <div className="text-right text-[13px] text-[#94A3B8]">{formatNumber(child.total_units)}</div>
                    <div className="text-right text-[13px] text-[#94A3B8]">{formatCurrency(child.total_revenue)}</div>
                    <div className="text-right text-[13px] text-[#94A3B8]">{formatCurrency(child.total_cost)}</div>
                    <div className="text-right text-[13px] text-[#94A3B8]">{formatCurrency(child.total_gross_profit)}</div>
                    <div className="text-center">
                      <span
                        className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-medium"
                        style={{ backgroundColor: `${childGpColor}15`, color: childGpColor }}
                      >
                        {formatPercent(child.avg_gross_profit_pct)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Item Tooltip */}
            <AnimatePresence>
              {hoveredCustomer && type === 'class' && (
                <ItemTooltip
                  customer={hoveredCustomer}
                  position={tooltipPosition}
                />
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Loading Skeleton
function LoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Skeletons */}
      <div className="grid grid-cols-6 gap-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-[#151F2E] border border-white/[0.04]" />
        ))}
      </div>

      {/* Filter Skeleton */}
      <div className="h-16 rounded-xl bg-[#151F2E] border border-white/[0.04]" />

      {/* Table Skeleton */}
      <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
        <div className="h-12 bg-[#0F172A] border-b border-white/[0.04]" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-14 border-b border-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

export default function DiversifiedDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // Light loading state for filter changes
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<'table' | 'charts' | 'products' | 'insights' | 'tasks'>('table');
  const [budgetData, setBudgetData] = useState<BudgetData[]>([]);

  // Customer detail drawer state
  const [selectedCustomerForDetail, setSelectedCustomerForDetail] = useState<{ id: string; name: string } | null>(null);

  // Insights state
  const [insightsData, setInsightsData] = useState<InsightsData | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsSubTab, setInsightsSubTab] = useState<'overview' | 'attrition' | 'growth' | 'opportunities' | 'churn'>('overview');
  // Comparison mode: 'rolling12' (default) or 'yoy' for calendar year comparison
  const [insightsMode, setInsightsMode] = useState<'rolling12' | 'yoy'>('rolling12');
  // For YoY mode: which years to compare
  const [yoyCurrentYear, setYoyCurrentYear] = useState(new Date().getFullYear() - 1); // Default to 2025 for comparing full years
  const [yoyPriorYear, setYoyPriorYear] = useState(new Date().getFullYear() - 2); // Default to 2024

  // AI Insights drawer state
  const [insightsDrawerOpen, setInsightsDrawerOpen] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<Array<{
    priority: 'high' | 'medium' | 'low';
    title: string;
    problem: string;
    recommendation: string;
    expected_impact: string;
    action_items: string[];
    category: 'attrition' | 'growth' | 'crosssell' | 'concentration' | 'general';
  }>>([]);
  const [aiExecutiveSummary, setAiExecutiveSummary] = useState('');
  const [insightsGeneratedAt, setInsightsGeneratedAt] = useState<string | null>(null);
  const [loadingSavedInsights, setLoadingSavedInsights] = useState(false);

  // Filter state
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedMonths, setSelectedMonths] = useState<number[]>([]);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'class' | 'customer'>('class');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Child data for expanded rows
  const [childData, setChildData] = useState<Array<ClassSummary | CustomerSummary>>([]);
  const [loadingChild, setLoadingChild] = useState(false);

  // Debounce ref for filter changes
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch dashboard data
  const fetchData = async (isInitialLoad = false) => {
    try {
      // Use full loading skeleton only on initial load, lighter refresh indicator otherwise
      if (isInitialLoad || !data) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const params = new URLSearchParams();

      if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
      if (selectedMonths.length > 0) params.set('months', selectedMonths.join(','));
      if (selectedClass) params.set('className', selectedClass);
      if (selectedCustomer) params.set('customerId', selectedCustomer);
      params.set('view', viewMode);

      // Request chart data when on charts tab
      if (activeTab === 'charts') {
        params.set('charts', 'true');
      }

      const response = await fetch(`/api/diversified?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch data');

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Fetch budget data for charts
  const fetchBudgetData = async () => {
    try {
      const response = await fetch('/api/diversified/budgets');
      if (response.ok) {
        const result = await response.json();
        setBudgetData(result.budgets || []);
      }
    } catch (err) {
      console.error('Error fetching budget data:', err);
    }
  };

  // Fetch insights data
  const fetchInsightsData = async (bustCache = false, mode?: 'rolling12' | 'yoy') => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const params = new URLSearchParams();
      params.set('years', '3'); // Last 3 years
      if (bustCache) params.set('bust', 'true');

      // Set comparison mode
      const compareMode = mode || insightsMode;
      params.set('mode', compareMode);

      // For YoY mode, set the years to compare
      if (compareMode === 'yoy') {
        params.set('currentYear', yoyCurrentYear.toString());
        params.set('priorYear', yoyPriorYear.toString());
      }

      const response = await fetch(`/api/diversified/insights?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch insights data');

      const result = await response.json();
      setInsightsData(result);
    } catch (err) {
      setInsightsError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setInsightsLoading(false);
    }
  };

  // Fetch child data when expanding a row
  const fetchChildData = async (rowId: string, type: 'class' | 'customer') => {
    setLoadingChild(true);
    try {
      const params = new URLSearchParams();
      if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
      if (selectedMonths.length > 0) params.set('months', selectedMonths.join(','));

      if (type === 'class') {
        params.set('className', rowId);
        params.set('view', 'customer');
      } else {
        params.set('customerId', rowId);
        params.set('view', 'class');
      }

      const response = await fetch(`/api/diversified?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch child data');

      const result = await response.json();
      setChildData(type === 'class' ? result.byCustomer : result.byClass);
    } catch (err) {
      console.error('Error fetching child data:', err);
      setChildData([]);
    } finally {
      setLoadingChild(false);
    }
  };

  // Sync from NetSuite
  const handleSync = async () => {
    setSyncing(true);
    try {
      const response = await fetch('/api/diversified/sync', { method: 'POST' });
      const result = await response.json();

      if (result.success) {
        await fetchData();
        alert(`Sync complete: ${result.stats.totalUpserted} records synced`);
      } else {
        alert(`Sync failed: ${result.message}`);
      }
    } catch (err) {
      alert('Sync failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setSyncing(false);
    }
  };

  // Load saved AI insights from Supabase
  const loadSavedInsights = async () => {
    setLoadingSavedInsights(true);
    try {
      const response = await fetch('/api/diversified/insights/saved');
      if (response.ok) {
        const result = await response.json();
        if (result.insights) {
          setAiRecommendations(result.insights.recommendations || []);
          setAiExecutiveSummary(result.insights.executive_summary || '');
          setInsightsGeneratedAt(result.insights.generated_at || result.insights.created_at || null);
        }
      }
    } catch (err) {
      console.error('Error loading saved insights:', err);
    } finally {
      setLoadingSavedInsights(false);
    }
  };

  // Save AI insights to Supabase
  const saveInsights = async (recommendations: typeof aiRecommendations, executiveSummary: string, generatedAt: string) => {
    try {
      await fetch('/api/diversified/insights/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendations,
          executive_summary: executiveSummary,
          generated_at: generatedAt,
        }),
      });
    } catch (err) {
      console.error('Error saving insights:', err);
    }
  };

  // Initial load
  useEffect(() => {
    fetchData(true);
    loadSavedInsights(); // Load any previously saved AI insights
  }, []);

  // Debounced refresh on filter/tab change
  useEffect(() => {
    // Clear any pending fetch
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Skip initial render (handled by initial load useEffect)
    if (loading) return;

    // Debounce filter changes by 300ms to avoid rapid API calls
    fetchTimeoutRef.current = setTimeout(() => {
      fetchData(false);
    }, 300);

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [selectedYears, selectedMonths, selectedClass, selectedCustomer, viewMode, activeTab]);

  // Fetch budget data on mount and when year filter changes
  useEffect(() => {
    fetchBudgetData();
  }, [selectedYears]);

  // Fetch insights when switching to insights tab or when filters change
  useEffect(() => {
    if (activeTab === 'insights') {
      fetchInsightsData();
    }
  }, [activeTab, selectedYears, selectedMonths]);

  // Handle row expansion
  const handleRowExpand = (rowId: string, type: 'class' | 'customer') => {
    if (expandedRow === rowId) {
      setExpandedRow(null);
      setChildData([]);
    } else {
      setExpandedRow(rowId);
      fetchChildData(rowId, type);
    }
  };

  // Reset filters
  const resetFilters = () => {
    setSelectedYears([]);
    setSelectedMonths([]);
    setSelectedClass(null);
    setSelectedCustomer(null);
    setExpandedRow(null);
    setChildData([]);
  };

  // Max revenue for progress bars
  const maxRevenue = useMemo(() => {
    if (!data) return 1;
    const list = viewMode === 'class' ? data.byClass : data.byCustomer;
    return Math.max(...list.map(d => d.total_revenue), 1);
  }, [data, viewMode]);

  return (
    <div className="min-h-screen bg-[#0a0f1a]">
      <Sidebar />
      <DashboardBackground {...backgroundPresets.finance} />

      <main
        className="transition-all duration-300 relative z-10"
        style={{ marginLeft: SIDEBAR_WIDTH }}
      >
        <div className="p-8 max-w-[1800px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between mb-8"
          >
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-[#EAF2FF] tracking-tight">Diversified Products</h1>
                {refreshing && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-[#38BDF8]/10 border border-[#38BDF8]/20">
                    <svg className="w-3.5 h-3.5 animate-spin text-[#38BDF8]" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="text-[11px] font-medium text-[#38BDF8]">Updating...</span>
                  </div>
                )}
              </div>
              <p className="text-[#64748B] mt-1">
                Sales performance by class and customer
                {data?.lastUpdated && (
                  <span className="text-[#475569]"> · Last updated {new Date(data.lastUpdated).toLocaleString()}</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleSync}
                disabled={syncing}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                  syncing
                    ? 'bg-[#1E293B] text-[#64748B] cursor-not-allowed'
                    : 'bg-[#22C55E]/20 text-[#22C55E] hover:bg-[#22C55E]/30 border border-[#22C55E]/30'
                }`}
              >
                {syncing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Syncing...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Sync NetSuite
                  </>
                )}
              </button>
            </div>
          </motion.div>

          {loading ? (
            <LoadingSkeleton />
          ) : error ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-8 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-center"
            >
              <p className="font-medium mb-2">Error loading dashboard</p>
              <p className="text-[13px] opacity-80">{error}</p>
              <button
                onClick={() => fetchData(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 transition-colors"
              >
                Retry
              </button>
            </motion.div>
          ) : data ? (
            <>
              {/* KPI Cards */}
              <div className="grid grid-cols-6 gap-4 mb-6">
                <KPICard
                  title="Total Revenue"
                  value={formatCurrencyCompact(data.summary.totalRevenue)}
                  subtitle={`${data.summary.transactionCount} transactions`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  color="#38BDF8"
                  delay={0}
                />
                <KPICard
                  title="Units Sold"
                  value={formatNumber(data.summary.totalUnits)}
                  subtitle={`${data.summary.uniqueClasses} classes`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                  color="#22D3EE"
                  delay={0.05}
                />
                <KPICard
                  title="Total COGS"
                  value={formatCurrencyCompact(data.summary.totalCost)}
                  subtitle="Cost of goods sold"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                  color="#F59E0B"
                  delay={0.1}
                />
                <KPICard
                  title="Gross Profit"
                  value={formatCurrencyCompact(data.summary.grossProfit)}
                  subtitle={`${data.summary.uniqueCustomers} customers`}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                  color="#22C55E"
                  delay={0.15}
                />
                <KPICard
                  title="Gross Margin"
                  value={formatPercent(data.summary.grossProfitPct)}
                  subtitle="Overall margin"
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" /></svg>}
                  color="#A855F7"
                  delay={0.2}
                />
                <KPICard
                  title="vs Budget"
                  value={data.summary.variancePct !== null ? `${data.summary.variancePct >= 0 ? '+' : ''}${formatPercent(data.summary.variancePct)}` : 'N/A'}
                  subtitle={data.summary.budgetRevenue > 0 ? `Budget: ${formatCurrencyCompact(data.summary.budgetRevenue)}` : 'No budget data'}
                  icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>}
                  color={data.summary.variancePct !== null && data.summary.variancePct >= 0 ? '#22C55E' : '#EF4444'}
                  trend={data.summary.variancePct !== null ? (data.summary.variancePct >= 0 ? 'up' : 'down') : undefined}
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
                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Data Table
                </button>
                <button
                  onClick={() => setActiveTab('charts')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'charts'
                      ? 'bg-[#38BDF8]/20 text-[#38BDF8] border border-[#38BDF8]/30 shadow-[0_0_20px_rgba(56,189,248,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                  </svg>
                  Charts
                </button>
                <button
                  onClick={() => setActiveTab('products')}
                  className={`px-4 py-2.5 rounded-lg text-[13px] font-medium transition-all flex items-center gap-2 ${
                    activeTab === 'products'
                      ? 'bg-[#22C55E]/20 text-[#22C55E] border border-[#22C55E]/30 shadow-[0_0_20px_rgba(34,197,94,0.15)]'
                      : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                  Products
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

              {/* Filters */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04] mb-6"
              >
                <div className="flex items-center gap-6">
                  {/* View Toggle - Only on table view */}
                  {activeTab === 'table' && (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">View:</span>
                        <div className="flex rounded-lg overflow-hidden border border-white/[0.04]">
                          <button
                            onClick={() => { setViewMode('class'); setExpandedRow(null); setChildData([]); }}
                            className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                              viewMode === 'class'
                                ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            By Class
                          </button>
                          <button
                            onClick={() => { setViewMode('customer'); setExpandedRow(null); setChildData([]); }}
                            className={`px-3 py-1.5 text-[12px] font-medium transition-all ${
                              viewMode === 'customer'
                                ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                : 'bg-[#1E293B] text-[#94A3B8] hover:text-white'
                            }`}
                          >
                            By Customer
                          </button>
                        </div>
                      </div>
                      <div className="h-6 w-px bg-white/[0.08]" />
                    </>
                  )}

                  {/* Year Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Year:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.filterOptions.years.map(year => (
                        <FilterChip
                          key={year}
                          label={year.toString()}
                          selected={selectedYears.includes(year)}
                          onClick={() => {
                            setSelectedYears(prev =>
                              prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="h-6 w-px bg-white/[0.08]" />

                  {/* Month Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Month:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {data.filterOptions.months.map(month => (
                        <FilterChip
                          key={month}
                          label={MONTH_NAMES[month - 1]}
                          selected={selectedMonths.includes(month)}
                          onClick={() => {
                            setSelectedMonths(prev =>
                              prev.includes(month) ? prev.filter(m => m !== month) : [...prev, month]
                            );
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="flex-1" />

                  {/* Reset */}
                  {(selectedYears.length > 0 || selectedMonths.length > 0 || selectedClass || selectedCustomer) && (
                    <button
                      onClick={resetFilters}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#EF4444] bg-[#EF4444]/10 hover:bg-[#EF4444]/20 transition-colors"
                    >
                      Reset Filters
                    </button>
                  )}
                </div>
              </motion.div>

              {/* Main Table - Only show on table view */}
              {activeTab === 'table' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className={`rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.25)] relative transition-opacity duration-200 ${refreshing ? 'opacity-70' : ''}`}
              >
                {/* Table Header */}
                <div
                  className="grid gap-4 px-6 py-3 bg-[#0F172A] border-b border-white/[0.04] text-[11px] font-semibold text-[#64748B] uppercase tracking-wider"
                  style={{ gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 80px' }}
                >
                  <div>{viewMode === 'class' ? 'Class' : 'Customer'}</div>
                  <div className="text-right">Units</div>
                  <div className="text-right">Revenue</div>
                  <div className="text-right">Cost</div>
                  <div className="text-right">Gross Profit</div>
                  <div className="text-center">GP%</div>
                </div>

                {/* Table Body */}
                <div className="max-h-[600px] overflow-y-auto">
                  {(viewMode === 'class' ? data.byClass : data.byCustomer).map((row, idx) => {
                    const rowId = viewMode === 'class'
                      ? (row as ClassSummary).class_name
                      : (row as CustomerSummary).customer_id || (row as CustomerSummary).customer_name;

                    return (
                      <ExpandableRow
                        key={rowId}
                        data={row}
                        type={viewMode}
                        index={idx}
                        maxRevenue={maxRevenue}
                        isExpanded={expandedRow === rowId}
                        onExpand={() => handleRowExpand(rowId, viewMode)}
                        childData={expandedRow === rowId ? childData : undefined}
                      />
                    );
                  })}

                  {(viewMode === 'class' ? data.byClass : data.byCustomer).length === 0 && (
                    <div className="p-12 text-center">
                      <div className="text-[#64748B] text-[14px]">No data available</div>
                      <p className="text-[#475569] text-[12px] mt-1">
                        Try syncing from NetSuite or adjusting your filters
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
              )}

              {/* Charts View */}
              {activeTab === 'charts' && data.chartData && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {/* Row 1: Revenue Trend + Budget Variance */}
                  <div className="grid grid-cols-2 gap-6">
                    <RevenueAreaChart data={data.chartData.monthly} index={0} />
                    <BudgetVarianceChart
                      actualData={data.chartData.monthly}
                      budgetData={budgetData}
                      selectedYear={selectedYears.length === 1 ? selectedYears[0] : undefined}
                      selectedMonths={selectedMonths}
                      index={1}
                    />
                  </div>

                  {/* Row 2: Class Bar + Customer Donut */}
                  <div className="grid grid-cols-2 gap-6">
                    <ClassBarChart
                      data={data.byClass}
                      classMonthlyData={data.chartData?.classMonthly}
                      selectedYear={selectedYears.length === 1 ? selectedYears[0] : undefined}
                      index={2}
                    />
                    <CustomerDonut data={data.byCustomer} index={3} />
                  </div>
                </motion.div>
              )}

              {/* Charts Loading State */}
              {activeTab === 'charts' && !data.chartData && (
                <div className="p-12 text-center">
                  <div className="text-[#64748B] text-[14px]">Loading chart data...</div>
                  <p className="text-[#475569] text-[12px] mt-1">
                    Please wait while we fetch the visualization data
                  </p>
                </div>
              )}

              {/* Products Tab */}
              {activeTab === 'products' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <ProductsTab
                    onCustomerClick={(customerId, customerName) => {
                      setSelectedCustomerForDetail({ id: customerId, name: customerName });
                    }}
                    selectedYears={selectedYears}
                    selectedMonths={selectedMonths}
                  />
                </motion.div>
              )}

              {/* Insights Tab */}
              {activeTab === 'insights' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-6"
                >
                  {insightsLoading ? (
                    <div className="p-12 text-center">
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <svg className="w-6 h-6 animate-spin text-[#A855F7]" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span className="text-[#A855F7] font-medium">Analyzing sales intelligence...</span>
                      </div>
                      <p className="text-[#475569] text-[12px]">
                        Computing attrition scores, cross-sell opportunities, and concentration metrics
                      </p>
                    </div>
                  ) : insightsError ? (
                    <div className="p-8 rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/30 text-[#EF4444] text-center">
                      <p className="font-medium mb-2">Error loading insights</p>
                      <p className="text-[13px] opacity-80">{insightsError}</p>
                      <button
                        onClick={() => fetchInsightsData(true)}
                        className="mt-4 px-4 py-2 rounded-lg bg-[#EF4444]/20 hover:bg-[#EF4444]/30 transition-colors"
                      >
                        Retry
                      </button>
                    </div>
                  ) : insightsData ? (
                    <>
                      {/* Insights Sub-Navigation */}
                      <div className="flex items-center gap-2 -mt-2 mb-4">
                        {(['overview', 'attrition', 'growth', 'churn', 'opportunities'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setInsightsSubTab(tab)}
                            className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
                              insightsSubTab === tab
                                ? tab === 'churn'
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                  : 'bg-[#A855F7]/20 text-[#A855F7] border border-[#A855F7]/30'
                                : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
                            }`}
                          >
                            {tab === 'overview' && 'Overview'}
                            {tab === 'attrition' && 'Attrition'}
                            {tab === 'growth' && (insightsMode === 'rolling12' ? 'R12 Comparison' : 'YoY Comparison')}
                            {tab === 'churn' && 'Stopped Buying'}
                            {tab === 'opportunities' && 'Opportunities'}
                          </button>
                        ))}

                        <div className="flex-1" />

                        {/* R12 / YoY Mode Toggle */}
                        <div className="flex items-center gap-1 bg-[#0F172A] rounded-lg p-0.5 border border-white/[0.04]">
                          <button
                            onClick={() => {
                              setInsightsMode('rolling12');
                              fetchInsightsData(true, 'rolling12');
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              insightsMode === 'rolling12'
                                ? 'bg-[#38BDF8]/20 text-[#38BDF8]'
                                : 'text-[#64748B] hover:text-white'
                            }`}
                            title="Rolling 12-month comparison (current 12 mo vs prior 12 mo)"
                          >
                            R12
                          </button>
                          <button
                            onClick={() => {
                              setInsightsMode('yoy');
                              fetchInsightsData(true, 'yoy');
                            }}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                              insightsMode === 'yoy'
                                ? 'bg-[#A855F7]/20 text-[#A855F7]'
                                : 'text-[#64748B] hover:text-white'
                            }`}
                            title="Calendar year comparison (full year vs full year)"
                          >
                            YoY
                          </button>
                        </div>

                        {/* Year selectors for YoY mode */}
                        {insightsMode === 'yoy' && (
                          <div className="flex items-center gap-1 text-[11px]">
                            <select
                              value={yoyCurrentYear}
                              onChange={(e) => {
                                const newYear = parseInt(e.target.value);
                                setYoyCurrentYear(newYear);
                                setYoyPriorYear(newYear - 1);
                              }}
                              className="px-2 py-1 rounded-md bg-[#1E293B] border border-white/[0.04] text-white text-[11px] cursor-pointer"
                            >
                              {[2025, 2024, 2023, 2022].map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <span className="text-[#64748B]">vs</span>
                            <select
                              value={yoyPriorYear}
                              onChange={(e) => setYoyPriorYear(parseInt(e.target.value))}
                              className="px-2 py-1 rounded-md bg-[#1E293B] border border-white/[0.04] text-white text-[11px] cursor-pointer"
                            >
                              {[2024, 2023, 2022, 2021].map(year => (
                                <option key={year} value={year}>{year}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => fetchInsightsData(true, 'yoy')}
                              className="ml-1 px-2 py-1 rounded-md bg-[#A855F7]/20 text-[#A855F7] hover:bg-[#A855F7]/30 transition-all"
                            >
                              Apply
                            </button>
                          </div>
                        )}

                        <button
                          onClick={() => fetchInsightsData(true)}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-[#64748B] bg-[#1E293B] border border-white/[0.04] hover:bg-[#334155] hover:text-white transition-all flex items-center gap-1.5"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                      </div>

                      {/* Alerts Banner */}
                      {insightsData.alerts.length > 0 && insightsSubTab === 'overview' && (
                        <div className="space-y-2">
                          {insightsData.alerts.slice(0, 3).map((alert, idx) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${
                                alert.type === 'danger'
                                  ? 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
                                  : alert.type === 'warning'
                                  ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                                  : 'bg-[#38BDF8]/10 border-[#38BDF8]/30 text-[#38BDF8]'
                              }`}
                            >
                              <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <div className="flex-1">
                                <span className="font-medium">{alert.title}:</span>
                                <span className="ml-1 opacity-90">{alert.message}</span>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {/* Insights KPI Cards */}
                      {insightsSubTab === 'overview' && (
                        <div className="grid grid-cols-6 gap-4">
                          <KPICard
                            title="At-Risk Customers"
                            value={insightsData.summary.at_risk_customers.toString()}
                            subtitle={`${formatCurrencyCompact(insightsData.summary.at_risk_revenue)} at risk`}
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>}
                            color="#EF4444"
                            delay={0}
                          />
                          <KPICard
                            title={insightsMode === 'rolling12' ? 'R12 Revenue' : `${yoyCurrentYear} vs ${yoyPriorYear}`}
                            value={`${insightsData.summary.yoy_revenue_change_pct >= 0 ? '+' : ''}${insightsData.summary.yoy_revenue_change_pct.toFixed(1)}%`}
                            subtitle={insightsMode === 'rolling12' ? 'vs prior 12 months' : 'full year comparison'}
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
                            color={insightsData.summary.yoy_revenue_change_pct >= 0 ? '#22C55E' : '#EF4444'}
                            trend={insightsData.summary.yoy_revenue_change_pct >= 0 ? 'up' : 'down'}
                            delay={0.05}
                          />
                          <KPICard
                            title="Cross-Sell Potential"
                            value={formatCurrencyCompact(insightsData.summary.cross_sell_potential)}
                            subtitle={`${insightsData.crossSell.length} opportunities`}
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                            color="#A855F7"
                            delay={0.1}
                          />
                          <KPICard
                            title="Concentration"
                            value={insightsData.summary.hhi_interpretation.charAt(0).toUpperCase() + insightsData.summary.hhi_interpretation.slice(1)}
                            subtitle={`HHI: ${insightsData.summary.hhi_index.toLocaleString()}`}
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /></svg>}
                            color={insightsData.summary.hhi_interpretation === 'diversified' ? '#22C55E' : insightsData.summary.hhi_interpretation === 'moderate' ? '#F59E0B' : '#EF4444'}
                            delay={0.15}
                          />
                          <KPICard
                            title="New Customers"
                            value={insightsData.summary.new_customers_12mo.toString()}
                            subtitle="last 12 months"
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>}
                            color="#22C55E"
                            delay={0.2}
                          />
                          <KPICard
                            title="Churned Revenue"
                            value={formatCurrencyCompact(insightsData.summary.churned_revenue)}
                            subtitle={`${insightsData.summary.churned_customers} customers`}
                            icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>}
                            color="#EF4444"
                            delay={0.25}
                          />
                        </div>
                      )}

                      {/* Overview Sub-Tab Content */}
                      {insightsSubTab === 'overview' && (
                        <div className="space-y-6">
                          {/* Row 1: Attrition + Concentration */}
                          <div className="grid grid-cols-2 gap-6">
                            <AttritionBarChart
                              data={insightsData.attrition.slice(0, 10)}
                              index={0}
                            />
                            <ConcentrationChart
                              data={insightsData.concentration}
                              index={1}
                            />
                          </div>

                          {/* AI Insights Panel */}
                          <div className="space-y-4">
                            <AIInsightsPanelV2
                              onGenerate={async () => {
                                const response = await fetch('/api/diversified/insights/ai', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify(insightsData),
                                });
                                if (!response.ok) throw new Error('Failed to generate AI insights');
                                const result = await response.json();
                                // Store the recommendations for the drawer
                                setAiRecommendations(result.recommendations || []);
                                setAiExecutiveSummary(result.executive_summary || '');
                                setInsightsGeneratedAt(result.generated_at || new Date().toISOString());
                                // Auto-save to Supabase so insights persist
                                await saveInsights(
                                  result.recommendations || [],
                                  result.executive_summary || '',
                                  result.generated_at || new Date().toISOString()
                                );
                                return result;
                              }}
                            />

                            {/* Open Insights Drawer Button - only show if we have recommendations */}
                            {aiRecommendations.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-2"
                              >
                                <button
                                  onClick={() => setInsightsDrawerOpen(true)}
                                  className="w-full py-3 px-4 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-xl text-purple-400 font-medium text-[13px] transition-all flex items-center justify-center gap-2"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                  </svg>
                                  View Full Analysis & Action Plan
                                  <span className="text-[11px] text-purple-400/70">
                                    ({aiRecommendations.length} recommendations)
                                  </span>
                                </button>
                                {insightsGeneratedAt && (
                                  <div className="flex items-center justify-center gap-2 text-[11px] text-[#64748B]">
                                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>
                                      Saved {new Date(insightsGeneratedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: 'numeric',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                )}
                              </motion.div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Attrition Sub-Tab Content */}
                      {insightsSubTab === 'attrition' && (
                        <div className="space-y-6">
                          <AttritionBarChart
                            data={insightsData.attrition}
                            index={0}
                          />

                          {/* Detailed Attrition Table */}
                          <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                            className="bg-[#0F1123]/80 rounded-2xl p-6 border border-white/[0.08]"
                          >
                            <div className="flex items-center gap-2 mb-4">
                              <h3 className="text-white font-semibold">Customer Attrition Details</h3>
                              <MetricExplainer
                                title="Attrition Score"
                                description="How likely this customer is to stop buying. Based on: how recently they ordered (35%), if order frequency is dropping (30%), if spend is declining (25%), and if they're buying fewer product types (10%). Score 0-100 where higher = more risk."
                                calculation="(Recency × 35%) + (Frequency Change × 30%) + (Spend Change × 25%) + (Product Mix × 10%)"
                                thresholds={[
                                  { label: 'Active', range: '0-40', description: 'Healthy, no immediate risk' },
                                  { label: 'Declining', range: '40-70', description: 'Negative trends, needs attention' },
                                  { label: 'At-Risk', range: '70+', description: 'High churn probability' },
                                  { label: 'Churned', range: 'N/A', description: 'No purchase in 12+ months' },
                                ]}
                              />
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full">
                                <thead>
                                  <tr className="border-b border-white/10">
                                    <th className="text-left py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase">Customer</th>
                                    <th className="text-center py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase">Status</th>
                                    <th className="text-center py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase">Score</th>
                                    <th className="text-right py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase">Last Purchase</th>
                                    <th className="text-right py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase">Revenue at Risk</th>
                                    <th className="text-right py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase">Change</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {insightsData.attrition.slice(0, 20).map((customer, idx) => (
                                    <tr key={customer.customer_id} className="border-b border-white/[0.05] hover:bg-white/[0.02]">
                                      <td className="py-2.5 px-3 text-[13px] text-white">{customer.customer_name}</td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                          customer.status === 'churned' ? 'bg-[#64748B]/20 text-[#64748B]' :
                                          customer.status === 'at_risk' ? 'bg-[#EF4444]/20 text-[#EF4444]' :
                                          customer.status === 'declining' ? 'bg-[#F59E0B]/20 text-[#F59E0B]' :
                                          'bg-[#22C55E]/20 text-[#22C55E]'
                                        }`}>
                                          {customer.status.replace('_', ' ').toUpperCase()}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-center">
                                        <span className={`text-[13px] font-medium ${
                                          customer.attrition_score >= 70 ? 'text-[#EF4444]' :
                                          customer.attrition_score >= 50 ? 'text-[#F59E0B]' :
                                          customer.attrition_score >= 30 ? 'text-[#FBBF24]' :
                                          'text-[#22C55E]'
                                        }`}>
                                          {customer.attrition_score}
                                        </span>
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[13px] text-[#94A3B8]">
                                        {customer.recency_days} days ago
                                      </td>
                                      <td className="py-2.5 px-3 text-right text-[13px] text-white font-medium">
                                        {formatCurrencyCompact(customer.revenue_at_risk)}
                                      </td>
                                      <td className="py-2.5 px-3 text-right">
                                        <span className={`text-[13px] font-medium ${
                                          customer.monetary_change_pct >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                                        }`}>
                                          {customer.monetary_change_pct >= 0 ? '+' : ''}{customer.monetary_change_pct.toFixed(1)}%
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        </div>
                      )}

                      {/* Growth Sub-Tab Content - R12 or YoY comparison */}
                      {insightsSubTab === 'growth' && (
                        <div className="space-y-6">
                          {/* Period indicator */}
                          <div className="text-[12px] text-[#64748B] bg-[#0F172A] rounded-lg px-3 py-2 inline-block">
                            {insightsMode === 'rolling12' ? (
                              <>Comparing <span className="text-white">last 12 months</span> vs <span className="text-white">prior 12 months</span></>
                            ) : (
                              <>Comparing <span className="text-white">{yoyCurrentYear}</span> vs <span className="text-white">{yoyPriorYear}</span> (full calendar years)</>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-6">
                            <YoYComparisonChart
                              data={insightsData.yoy}
                              currentYear={insightsMode === 'yoy' ? yoyCurrentYear : new Date().getFullYear()}
                              priorYear={insightsMode === 'yoy' ? yoyPriorYear : new Date().getFullYear() - 1}
                              viewMode="customer"
                              index={0}
                              isRolling12={insightsMode === 'rolling12'}
                            />
                            <YoYComparisonChart
                              data={insightsData.yoy}
                              currentYear={insightsMode === 'yoy' ? yoyCurrentYear : new Date().getFullYear()}
                              priorYear={insightsMode === 'yoy' ? yoyPriorYear : new Date().getFullYear() - 1}
                              viewMode="class"
                              index={1}
                              isRolling12={insightsMode === 'rolling12'}
                            />
                          </div>
                        </div>
                      )}

                      {/* Stopped Buying Sub-Tab Content */}
                      {insightsSubTab === 'churn' && (
                        <StoppedBuyingReport
                          onCustomerClick={(customerId, customerName) => {
                            setSelectedCustomerForDetail({ id: customerId, name: customerName });
                          }}
                          selectedYears={selectedYears}
                          selectedMonths={selectedMonths}
                        />
                      )}

                      {insightsSubTab === 'opportunities' && (
                        <div className="space-y-6">
                          <CrossSellTable data={insightsData.crossSell} />
                        </div>
                      )}
                    </>
                  ) : null}
                </motion.div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <SalesTasksTab
                    onCustomerClick={(customerId, customerName) => {
                      setSelectedCustomerForDetail({ id: customerId, name: customerName });
                    }}
                  />
                </motion.div>
              )}
            </>
          ) : null}
        </div>
      </main>

      {/* Customer Detail Drawer */}
      <CustomerDetailDrawer
        customerId={selectedCustomerForDetail?.id || null}
        customerName={selectedCustomerForDetail?.name}
        onClose={() => setSelectedCustomerForDetail(null)}
      />

      {/* AI Insights Drawer */}
      <InsightsDrawer
        isOpen={insightsDrawerOpen}
        onClose={() => setInsightsDrawerOpen(false)}
        recommendations={aiRecommendations}
        executiveSummary={aiExecutiveSummary}
        onAddToTasks={async (actionItem, recommendation) => {
          try {
            const response = await fetch('/api/diversified/tasks', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title: actionItem,
                description: `From AI insight: ${recommendation.title}\n\nProblem: ${recommendation.problem}`,
                priority: recommendation.priority === 'high' ? 'high' : recommendation.priority === 'medium' ? 'medium' : 'low',
                source: 'ai_insight',
                insight_id: recommendation.title,
              }),
            });
            if (response.ok) {
              // Show brief confirmation
              const toast = document.createElement('div');
              toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg z-[100] animate-pulse';
              toast.textContent = 'Task added!';
              document.body.appendChild(toast);
              setTimeout(() => toast.remove(), 2000);
            }
          } catch (err) {
            console.error('Error adding task:', err);
          }
        }}
      />
    </div>
  );
}
