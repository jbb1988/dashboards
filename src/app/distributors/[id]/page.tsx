'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
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

export default function DistributorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Determine if this is a location or distributor view
  const isLocationView = useMemo(() => {
    // Location IDs contain the customer_id format
    // Distributor IDs are simple slugs like "ferguson"
    return id && id.length > 20; // Customer IDs are longer
  }, [id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const endpoint = isLocationView
          ? `/api/diversified/distributors/location/${id}`
          : `/api/diversified/distributors/${id}`;

        const response = await fetch(endpoint);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch data');
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Error fetching detail data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, isLocationView]);

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

  // Chart colors
  const TEAL_COLORS = ['#14B8A6', '#0D9488', '#0F766E', '#115E59', '#134E4A'];

  return (
    <div className="min-h-screen bg-[#0B1220] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb & Back Button */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex items-center gap-4"
        >
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
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-white mb-2">
            {isLocationView ? `${data.distributor_name} - ${data.location}` : data.distributor_name}
          </h1>
          {isLocationView && data.state && (
            <p className="text-[#64748B]">{data.state}</p>
          )}
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
                  labelLine={false}
                  label={(entry: any) => `${entry.percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="revenue"
                  animationDuration={1500}
                >
                  {data.category_breakdown.map((_: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={TEAL_COLORS[index % TEAL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    color: '#fff'
                  }}
                  formatter={(value: any) => [formatCurrency(value), 'Revenue']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {data.category_breakdown.slice(0, 6).map((cat: any, index: number) => (
                <div key={cat.category} className="flex items-center gap-2 text-sm">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: TEAL_COLORS[index % TEAL_COLORS.length] }}
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
                  <button className="mt-2 px-4 py-2 bg-[#14B8A6]/10 text-[#14B8A6] rounded-lg text-sm hover:bg-[#14B8A6]/20 transition-colors">
                    {opp.action}
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
                    <th className="text-right py-3 px-4 text-sm font-medium text-[#64748B]">Categories</th>
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
                      <td className="text-right py-3 px-4 text-[#64748B]">
                        {loc.category_count}
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
                      <td className="py-3 px-4 text-white text-sm">{txn.item_name}</td>
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
    </div>
  );
}
