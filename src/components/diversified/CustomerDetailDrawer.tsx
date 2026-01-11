'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface CustomerDetail {
  customer: {
    id: string;
    name: string;
    status: 'active' | 'warning' | 'at_risk' | 'churned';
    days_since_last_order: number;
  };
  summary: {
    total_revenue: number;
    total_units: number;
    first_order: string | null;
    last_order: string | null;
    current_period_revenue: number;
    prior_period_revenue: number;
    revenue_change_pct: number;
  };
  periods: {
    current: { start: string; end: string };
    prior: { start: string; end: string };
  };
  monthly_trend: Array<{
    month: string;
    revenue: number;
    units: number;
    cost: number;
  }>;
  products: Array<{
    item_id: string;
    item_name: string;
    item_description: string;
    class_name: string;
    current_revenue: number;
    current_units: number;
    prior_revenue: number;
    prior_units: number;
    change_pct: number;
    trend: 'growing' | 'stable' | 'declining';
    last_purchase_date: string;
    days_since_purchase: number;
    stopped_buying: 'active' | 'warning' | 'stopped';
  }>;
  stopped_buying_summary: {
    stopped_count: number;
    stopped_prior_revenue: number;
    warning_count: number;
    warning_prior_revenue: number;
  };
  transactions: Array<{
    date: string;
    transaction_number: string;
    items: Array<{ item_name: string; quantity: number; revenue: number }>;
    total_revenue: number;
    total_units: number;
  }>;
}

interface CustomerDetailDrawerProps {
  customerId: string | null;
  customerName?: string;
  onClose: () => void;
}

const STATUS_CONFIG = {
  active: { label: 'Active', color: 'text-green-400', bg: 'bg-green-400/10', border: 'border-green-400/30' },
  warning: { label: 'Warning', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  at_risk: { label: 'At Risk', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/30' },
  churned: { label: 'Churned', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/30' },
};

const TREND_CONFIG = {
  growing: { icon: '↑', color: 'text-green-400' },
  stable: { icon: '→', color: 'text-gray-400' },
  declining: { icon: '↓', color: 'text-red-400' },
};

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

export function CustomerDetailDrawer({ customerId, customerName, onClose }: CustomerDetailDrawerProps) {
  const [data, setData] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'transactions'>('products');
  const [expandedTransaction, setExpandedTransaction] = useState<string | null>(null);

  useEffect(() => {
    if (!customerId) return;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/diversified/customer/${encodeURIComponent(customerId)}`);
        if (!response.ok) {
          throw new Error('Failed to fetch customer data');
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
  }, [customerId]);

  if (!customerId) return null;

  const statusConfig = data ? STATUS_CONFIG[data.customer.status] : STATUS_CONFIG.active;

  return (
    <AnimatePresence>
      {customerId && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-[700px] bg-[#0F1722] border-l border-white/10 shadow-2xl z-50 overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/[0.06] bg-gradient-to-r from-[#38BDF8]/5 to-transparent">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-xl font-semibold text-white">
                      {data?.customer.name || customerName || 'Loading...'}
                    </h2>
                    {data && (
                      <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border} border`}>
                        {statusConfig.label}
                      </span>
                    )}
                  </div>
                  {data && (
                    <div className="flex items-center gap-4 text-[12px] text-[#64748B]">
                      <span>Last order: {formatDate(data.summary.last_order)}</span>
                      <span>•</span>
                      <span>{data.customer.days_since_last_order} days ago</span>
                    </div>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-[#64748B] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="flex items-center justify-center h-64">
                  <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {error && (
                <div className="m-6 p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                  {error}
                </div>
              )}

              {data && !loading && (
                <div className="p-6 space-y-6">
                  {/* Summary KPIs */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-[#151F2E] border border-white/[0.04]">
                      <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Total Revenue</div>
                      <div className="text-lg font-bold text-white">{formatCurrency(data.summary.total_revenue)}</div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#151F2E] border border-white/[0.04]">
                      <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">R12 Change</div>
                      <div className={`text-lg font-bold ${data.summary.revenue_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {data.summary.revenue_change_pct >= 0 ? '+' : ''}{data.summary.revenue_change_pct.toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#151F2E] border border-white/[0.04]">
                      <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Products Lost</div>
                      <div className={`text-lg font-bold ${data.stopped_buying_summary.stopped_count > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {data.stopped_buying_summary.stopped_count}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-[#151F2E] border border-white/[0.04]">
                      <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Revenue at Risk</div>
                      <div className={`text-lg font-bold ${data.stopped_buying_summary.stopped_prior_revenue > 0 ? 'text-amber-400' : 'text-green-400'}`}>
                        {formatCurrency(data.stopped_buying_summary.stopped_prior_revenue)}
                      </div>
                    </div>
                  </div>

                  {/* Stopped Buying Alert */}
                  {data.stopped_buying_summary.stopped_count > 0 && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-red-500/20">
                          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-red-400 mb-1">Products Stopped Buying</h4>
                          <p className="text-[12px] text-[#94A3B8]">
                            This customer stopped buying {data.stopped_buying_summary.stopped_count} product(s) they previously purchased.
                            Prior annual revenue from these products: {formatCurrency(data.stopped_buying_summary.stopped_prior_revenue)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Monthly Trend Chart */}
                  <div className="p-4 rounded-lg bg-[#151F2E] border border-white/[0.04]">
                    <h3 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">Monthly Revenue Trend</h3>
                    <div className="h-[160px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.monthly_trend} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                          <XAxis
                            dataKey="month"
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            axisLine={{ stroke: '#334155' }}
                            tickLine={false}
                            tickFormatter={(val) => {
                              const [year, month] = val.split('-');
                              return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][parseInt(month) - 1]} ${year.slice(2)}`;
                            }}
                          />
                          <YAxis
                            tick={{ fill: '#64748B', fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            tickFormatter={(val) => `$${(val / 1000).toFixed(0)}K`}
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: '#1B1F39',
                              border: '1px solid rgba(255,255,255,0.1)',
                              borderRadius: '8px',
                              padding: '8px 12px',
                            }}
                            labelStyle={{ color: '#94A3B8', fontSize: '11px', marginBottom: '4px' }}
                            formatter={(value) => [formatCurrency(value as number), 'Revenue']}
                            labelFormatter={(label) => {
                              const [year, month] = label.split('-');
                              return `${['January','February','March','April','May','June','July','August','September','October','November','December'][parseInt(month) - 1]} ${year}`;
                            }}
                          />
                          <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                            {data.monthly_trend.map((entry, index) => {
                              const isCurrentPeriod = entry.month >= data.periods.current.start.slice(0, 7);
                              return (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={isCurrentPeriod ? '#38BDF8' : '#475569'}
                                  fillOpacity={0.8}
                                />
                              );
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex items-center justify-center gap-4 mt-2 text-[10px]">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-[#38BDF8]" />
                        <span className="text-[#94A3B8]">Current 12 months</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-[#475569]" />
                        <span className="text-[#94A3B8]">Prior 12 months</span>
                      </div>
                    </div>
                  </div>

                  {/* Sub-tabs for Products/Transactions */}
                  <div className="flex items-center gap-1 border-b border-white/[0.06]">
                    <button
                      onClick={() => setActiveSubTab('products')}
                      className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all ${
                        activeSubTab === 'products'
                          ? 'text-[#38BDF8] border-[#38BDF8]'
                          : 'text-[#64748B] border-transparent hover:text-white'
                      }`}
                    >
                      Products ({data.products.length})
                    </button>
                    <button
                      onClick={() => setActiveSubTab('transactions')}
                      className={`px-4 py-2.5 text-[12px] font-medium border-b-2 transition-all ${
                        activeSubTab === 'transactions'
                          ? 'text-[#38BDF8] border-[#38BDF8]'
                          : 'text-[#64748B] border-transparent hover:text-white'
                      }`}
                    >
                      Transactions ({data.transactions.length})
                    </button>
                  </div>

                  {/* Products Tab */}
                  {activeSubTab === 'products' && (
                    <div className="space-y-2">
                      {/* Stopped products first */}
                      {data.products.filter(p => p.stopped_buying === 'stopped').length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-[11px] font-semibold text-red-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Stopped Buying (6+ months)
                          </h4>
                          {data.products.filter(p => p.stopped_buying === 'stopped').map((product) => (
                            <ProductRow key={product.item_id} product={product} />
                          ))}
                        </div>
                      )}

                      {/* Warning products */}
                      {data.products.filter(p => p.stopped_buying === 'warning').length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide mb-2 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Declining (3-6 months since purchase)
                          </h4>
                          {data.products.filter(p => p.stopped_buying === 'warning').map((product) => (
                            <ProductRow key={product.item_id} product={product} />
                          ))}
                        </div>
                      )}

                      {/* Active products */}
                      <div>
                        <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-2">
                          Active Products
                        </h4>
                        {data.products.filter(p => p.stopped_buying === 'active').map((product) => (
                          <ProductRow key={product.item_id} product={product} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Transactions Tab */}
                  {activeSubTab === 'transactions' && (
                    <div className="space-y-2">
                      {data.transactions.map((tx) => (
                        <div
                          key={tx.transaction_number}
                          className="rounded-lg bg-[#151F2E] border border-white/[0.04] overflow-hidden"
                        >
                          <button
                            onClick={() => setExpandedTransaction(
                              expandedTransaction === tx.transaction_number ? null : tx.transaction_number
                            )}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-[12px] text-[#64748B]">{formatDate(tx.date)}</span>
                              <span className="text-[13px] text-white font-medium">{tx.transaction_number}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <span className="text-[12px] text-[#94A3B8]">{tx.items.length} items</span>
                              <span className="text-[14px] font-semibold text-white">{formatCurrency(tx.total_revenue)}</span>
                              <svg
                                className={`w-4 h-4 text-[#64748B] transition-transform ${expandedTransaction === tx.transaction_number ? 'rotate-180' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </div>
                          </button>

                          <AnimatePresence>
                            {expandedTransaction === tx.transaction_number && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-white/[0.04]"
                              >
                                <div className="p-4 space-y-2">
                                  {tx.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between text-[12px]">
                                      <span className="text-[#94A3B8]">{item.item_name}</span>
                                      <div className="flex items-center gap-4">
                                        <span className="text-[#64748B]">{item.quantity} qty</span>
                                        <span className="text-white font-medium">{formatCurrency(item.revenue)}</span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ProductRow({ product }: { product: CustomerDetail['products'][0] }) {
  const trendConfig = TREND_CONFIG[product.trend];
  const stoppedConfig = {
    stopped: { bg: 'bg-red-500/10', border: 'border-red-500/30' },
    warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
    active: { bg: 'bg-[#151F2E]', border: 'border-white/[0.04]' },
  };
  const config = stoppedConfig[product.stopped_buying];

  return (
    <div className={`p-3 rounded-lg ${config.bg} border ${config.border} mb-2`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] text-white font-medium">{product.item_name}</span>
            {product.stopped_buying === 'stopped' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-red-500/20 text-red-400">STOPPED</span>
            )}
            {product.stopped_buying === 'warning' && (
              <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-amber-500/20 text-amber-400">DECLINING</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-[#64748B]">
            <span>{product.class_name}</span>
            <span>•</span>
            <span>Last: {formatDate(product.last_purchase_date)}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2">
            <span className={`text-[11px] ${trendConfig.color}`}>{trendConfig.icon}</span>
            <span className="text-[14px] font-semibold text-white">{formatCurrency(product.current_revenue)}</span>
          </div>
          <div className="text-[10px] text-[#64748B]">
            vs {formatCurrency(product.prior_revenue)} prior
            <span className={`ml-1 ${product.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ({product.change_pct >= 0 ? '+' : ''}{product.change_pct.toFixed(0)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
