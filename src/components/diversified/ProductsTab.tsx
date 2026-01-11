'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface ProductData {
  item_id: string;
  item_name: string;
  item_description: string;
  class_name: string;
  class_category: string;
  current_revenue: number;
  current_units: number;
  prior_revenue: number;
  prior_units: number;
  change_pct: number;
  trend: 'growing' | 'stable' | 'declining';
  current_margin_pct: number;
  prior_margin_pct: number;
  current_customer_count: number;
  prior_customer_count: number;
  customers_lost: number;
  customers_gained: number;
  total_customer_count: number;
  last_purchase_date: string;
  top_customers: Array<{ id: string; name: string; revenue: number }>;
}

interface ProductsResponse {
  products: ProductData[];
  summary: {
    total_products: number;
    total_current_revenue: number;
    total_prior_revenue: number;
    overall_change_pct: number;
    growing_products: number;
    declining_products: number;
    products_with_lost_customers: number;
  };
  by_class: Array<{ class_name: string; revenue: number; count: number }>;
  periods: {
    current: { start: string; end: string };
    prior: { start: string; end: string };
  };
}

interface ProductsTabProps {
  onCustomerClick?: (customerId: string, customerName: string) => void;
}

const TREND_CONFIG = {
  growing: { icon: '↑', color: 'text-green-400', bg: 'bg-green-400/10' },
  stable: { icon: '→', color: 'text-gray-400', bg: 'bg-gray-400/10' },
  declining: { icon: '↓', color: 'text-red-400', bg: 'bg-red-400/10' },
};

const CHART_COLORS = ['#38BDF8', '#22C55E', '#F59E0B', '#A855F7', '#EC4899', '#14B8A6', '#F97316', '#6366F1'];

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function ProductsTab({ onCustomerClick }: ProductsTabProps) {
  const [data, setData] = useState<ProductsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'revenue' | 'change' | 'customers'>('revenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterTrend, setFilterTrend] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/diversified/products');
        if (!response.ok) {
          throw new Error('Failed to fetch products data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredAndSortedProducts = useMemo(() => {
    if (!data) return [];

    let filtered = data.products;

    // Apply filters
    if (filterClass !== 'all') {
      filtered = filtered.filter(p => p.class_name === filterClass);
    }
    if (filterTrend !== 'all') {
      filtered = filtered.filter(p => p.trend === filterTrend);
    }
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p =>
        p.item_name.toLowerCase().includes(search) ||
        p.item_description?.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortBy) {
        case 'revenue':
          aVal = a.current_revenue;
          bVal = b.current_revenue;
          break;
        case 'change':
          aVal = a.change_pct;
          bVal = b.change_pct;
          break;
        case 'customers':
          aVal = a.current_customer_count;
          bVal = b.current_customer_count;
          break;
        default:
          aVal = a.current_revenue;
          bVal = b.current_revenue;
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }, [data, filterClass, filterTrend, searchTerm, sortBy, sortDir]);

  const handleSort = (column: 'revenue' | 'change' | 'customers') => {
    if (sortBy === column) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const top10Products = data.products.slice(0, 10);
  const classBreakdown = data.by_class.slice(0, 8);

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Total Products</div>
          <div className="text-2xl font-bold text-white">{data.summary.total_products}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">R12 Revenue</div>
          <div className="text-2xl font-bold text-white">{formatCurrency(data.summary.total_current_revenue)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">R12 Change</div>
          <div className={`text-2xl font-bold ${data.summary.overall_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {data.summary.overall_change_pct >= 0 ? '+' : ''}{data.summary.overall_change_pct.toFixed(1)}%
          </div>
        </div>
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Growing</div>
          <div className="text-2xl font-bold text-green-400">{data.summary.growing_products}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Declining</div>
          <div className="text-2xl font-bold text-red-400">{data.summary.declining_products}</div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top 10 Products Bar Chart */}
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-4">Top 10 Products by Revenue</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={top10Products}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
              >
                <XAxis
                  type="number"
                  tick={{ fill: '#64748B', fontSize: 10 }}
                  axisLine={{ stroke: '#334155' }}
                  tickLine={false}
                  tickFormatter={(val) => `$${(val / 1000).toFixed(0)}K`}
                />
                <YAxis
                  type="category"
                  dataKey="item_description"
                  tick={{ fill: '#94A3B8', fontSize: 10 }}
                  axisLine={false}
                  tickLine={false}
                  width={140}
                  tickFormatter={(val) => val && val.length > 22 ? `${val.slice(0, 22)}...` : (val || 'Unknown')}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1B1F39',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: '#fff', fontSize: '12px', marginBottom: '4px' }}
                  formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                />
                <Bar dataKey="current_revenue" fill="#38BDF8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Class Breakdown Pie Chart */}
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-4">Revenue by Product Class</h3>
          <div className="h-[280px] flex items-center">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={classBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="revenue"
                    nameKey="class_name"
                  >
                    {classBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1B1F39',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      padding: '8px 12px',
                      color: '#fff',
                    }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#94A3B8' }}
                    formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-2">
              {classBreakdown.map((cls, idx) => (
                <div key={cls.class_name} className="flex items-center gap-2 text-[11px]">
                  <div
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                  />
                  <span className="text-[#94A3B8] truncate flex-1" title={cls.class_name}>
                    {cls.class_name.length > 20 ? `${cls.class_name.slice(0, 20)}...` : cls.class_name}
                  </span>
                  <span className="text-white font-medium">{formatCurrency(cls.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex items-center gap-4 p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 rounded-lg bg-[#0F1722] border border-white/[0.04] text-[13px] text-white placeholder-[#64748B] focus:outline-none focus:border-[#38BDF8]/50"
          />
        </div>

        {/* Class Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#64748B] uppercase">Class:</span>
          <select
            value={filterClass}
            onChange={(e) => setFilterClass(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0F1722] border border-white/[0.04] text-[12px] text-white focus:outline-none focus:border-[#38BDF8]/50"
          >
            <option value="all">All Classes</option>
            {data.by_class.map(cls => (
              <option key={cls.class_name} value={cls.class_name}>{cls.class_name}</option>
            ))}
          </select>
        </div>

        {/* Trend Filter */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#64748B] uppercase">Trend:</span>
          <select
            value={filterTrend}
            onChange={(e) => setFilterTrend(e.target.value)}
            className="px-3 py-2 rounded-lg bg-[#0F1722] border border-white/[0.04] text-[12px] text-white focus:outline-none focus:border-[#38BDF8]/50"
          >
            <option value="all">All Trends</option>
            <option value="growing">Growing</option>
            <option value="stable">Stable</option>
            <option value="declining">Declining</option>
          </select>
        </div>

        <div className="text-[12px] text-[#64748B]">
          Showing {filteredAndSortedProducts.length} of {data.products.length} products
        </div>
      </div>

      {/* Products Table */}
      <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
        {/* Table Header */}
        <div className="grid grid-cols-[1fr,100px,100px,80px,100px,60px] gap-4 px-4 py-3 bg-[#0F1722] border-b border-white/[0.04] text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
          <div>Product</div>
          <button
            onClick={() => handleSort('revenue')}
            className={`text-right flex items-center justify-end gap-1 hover:text-white ${sortBy === 'revenue' ? 'text-[#38BDF8]' : ''}`}
          >
            Revenue
            {sortBy === 'revenue' && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
          </button>
          <button
            onClick={() => handleSort('change')}
            className={`text-right flex items-center justify-end gap-1 hover:text-white ${sortBy === 'change' ? 'text-[#38BDF8]' : ''}`}
          >
            R12 Change
            {sortBy === 'change' && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
          </button>
          <div className="text-center">Trend</div>
          <button
            onClick={() => handleSort('customers')}
            className={`text-right flex items-center justify-end gap-1 hover:text-white ${sortBy === 'customers' ? 'text-[#38BDF8]' : ''}`}
          >
            Customers
            {sortBy === 'customers' && <span>{sortDir === 'desc' ? '↓' : '↑'}</span>}
          </button>
          <div></div>
        </div>

        {/* Table Body */}
        <div className="max-h-[500px] overflow-y-auto">
          {filteredAndSortedProducts.map((product) => {
            const trendConfig = TREND_CONFIG[product.trend];
            const isExpanded = expandedProduct === product.item_id;

            return (
              <div key={product.item_id} className="border-b border-white/[0.02]">
                <div
                  className="grid grid-cols-[1fr,100px,100px,80px,100px,60px] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                  onClick={() => setExpandedProduct(isExpanded ? null : product.item_id)}
                >
                  <div>
                    <div className="text-[13px] text-white font-medium">{product.item_description || product.item_name}</div>
                    <div className="text-[11px] text-[#64748B]">{product.class_name}</div>
                  </div>
                  <div className="text-right text-[13px] text-white font-medium">
                    {formatCurrency(product.current_revenue)}
                  </div>
                  <div className={`text-right text-[13px] font-medium ${product.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {product.change_pct >= 0 ? '+' : ''}{product.change_pct.toFixed(1)}%
                  </div>
                  <div className="flex items-center justify-center">
                    <span className={`px-2 py-1 rounded text-[10px] font-medium ${trendConfig.bg} ${trendConfig.color}`}>
                      {trendConfig.icon} {product.trend}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] text-white">{product.current_customer_count}</div>
                    {product.customers_lost > 0 && (
                      <div className="text-[10px] text-red-400">-{product.customers_lost} lost</div>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    <svg
                      className={`w-4 h-4 text-[#64748B] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 py-4 bg-[#0F1722] border-t border-white/[0.04]">
                        <div className="grid grid-cols-3 gap-6">
                          {/* Period Comparison */}
                          <div>
                            <h4 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">Period Comparison</h4>
                            <div className="space-y-2 text-[12px]">
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Current 12 Mo Revenue:</span>
                                <span className="text-white font-medium">{formatCurrency(product.current_revenue)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Prior 12 Mo Revenue:</span>
                                <span className="text-white">{formatCurrency(product.prior_revenue)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Current Margin:</span>
                                <span className="text-white">{product.current_margin_pct.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Units Sold (R12):</span>
                                <span className="text-white">{product.current_units.toLocaleString()}</span>
                              </div>
                            </div>
                          </div>

                          {/* Customer Changes */}
                          <div>
                            <h4 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">Customer Changes</h4>
                            <div className="space-y-2 text-[12px]">
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Current Customers:</span>
                                <span className="text-white font-medium">{product.current_customer_count}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Prior Customers:</span>
                                <span className="text-white">{product.prior_customer_count}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Customers Lost:</span>
                                <span className={product.customers_lost > 0 ? 'text-red-400' : 'text-white'}>{product.customers_lost}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[#64748B]">Customers Gained:</span>
                                <span className={product.customers_gained > 0 ? 'text-green-400' : 'text-white'}>{product.customers_gained}</span>
                              </div>
                            </div>
                          </div>

                          {/* Top Customers */}
                          <div>
                            <h4 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">Top Customers</h4>
                            <div className="space-y-2">
                              {product.top_customers.slice(0, 5).map((customer, idx) => (
                                <div
                                  key={customer.id || idx}
                                  className="flex items-center justify-between text-[12px] hover:bg-white/[0.02] p-1 rounded cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onCustomerClick?.(customer.id || customer.name, customer.name);
                                  }}
                                >
                                  <span className="text-[#38BDF8] hover:underline truncate max-w-[140px]" title={customer.name}>
                                    {customer.name}
                                  </span>
                                  <span className="text-white">{formatCurrency(customer.revenue)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
