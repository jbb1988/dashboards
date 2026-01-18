'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface StoppedBuyingData {
  summary: {
    total_products_with_churn: number;
    total_customers_with_churn: number;
    total_revenue_at_risk: number;
    total_units_lost: number;
  };
  by_product: Array<{
    item_id: string;
    item_name: string;
    item_description: string;
    class_name: string;
    customers_lost: number;
    total_prior_revenue: number;
    total_prior_units: number;
    customer_list: Array<{
      customer_id: string;
      customer_name: string;
      prior_revenue: number;
      prior_units: number;
      last_purchase_date: string;
      days_since_purchase: number;
    }>;
  }>;
  by_customer: Array<{
    customer_id: string;
    customer_name: string;
    products_stopped: number;
    total_prior_revenue: number;
    product_list: Array<{
      item_id: string;
      item_name: string;
      item_description?: string;
      class_name: string;
      prior_revenue: number;
      last_purchase_date: string;
    }>;
  }>;
  by_class: Array<{
    class_name: string;
    revenue: number;
    count: number;
  }>;
  periods: {
    detection_window: { start: string; end: string; description: string };
    comparison_window: { start: string; end: string; description: string };
  };
}

interface StoppedBuyingReportProps {
  onCustomerClick?: (customerId: string, customerName: string) => void;
  selectedYears?: number[];
  selectedMonths?: number[];
}

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

export function StoppedBuyingReport({ onCustomerClick, selectedYears, selectedMonths }: StoppedBuyingReportProps) {
  const [data, setData] = useState<StoppedBuyingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'by_product' | 'by_customer'>('by_product');
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  // Sorting state for "By Product" view
  const [productSortColumn, setProductSortColumn] = useState<'product' | 'revenue' | 'customers'>('revenue');
  const [productSortDirection, setProductSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sorting state for "By Customer" view
  const [customerSortColumn, setCustomerSortColumn] = useState<'customer' | 'revenue' | 'products'>('revenue');
  const [customerSortDirection, setCustomerSortDirection] = useState<'asc' | 'desc'>('desc');

  // Sorting handlers
  const handleProductSort = (column: 'product' | 'revenue' | 'customers') => {
    if (productSortColumn === column) {
      setProductSortDirection(productSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setProductSortColumn(column);
      setProductSortDirection('desc');
    }
  };

  const handleCustomerSort = (column: 'customer' | 'revenue' | 'products') => {
    if (customerSortColumn === column) {
      setCustomerSortDirection(customerSortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setCustomerSortColumn(column);
      setCustomerSortDirection('desc');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (selectedYears && selectedYears.length > 0) {
          params.set('years', selectedYears.join(','));
        }
        if (selectedMonths && selectedMonths.length > 0) {
          params.set('months', selectedMonths.join(','));
        }
        const url = `/api/diversified/insights/stopped-buying${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch stopped buying data');
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
  }, [selectedYears, selectedMonths]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
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

  // Sort product data
  const sortedProducts = [...data.by_product].sort((a, b) => {
    let compareValue = 0;

    switch (productSortColumn) {
      case 'product':
        compareValue = (a.item_description || a.item_name).localeCompare(b.item_description || b.item_name);
        break;
      case 'revenue':
        compareValue = a.total_prior_revenue - b.total_prior_revenue;
        break;
      case 'customers':
        compareValue = a.customers_lost - b.customers_lost;
        break;
    }

    return productSortDirection === 'asc' ? compareValue : -compareValue;
  });

  // Sort customer data
  const sortedCustomers = [...data.by_customer].sort((a, b) => {
    let compareValue = 0;

    switch (customerSortColumn) {
      case 'customer':
        compareValue = a.customer_name.localeCompare(b.customer_name);
        break;
      case 'revenue':
        compareValue = a.total_prior_revenue - b.total_prior_revenue;
        break;
      case 'products':
        compareValue = a.products_stopped - b.products_stopped;
        break;
    }

    return customerSortDirection === 'asc' ? compareValue : -compareValue;
  });

  // Sort indicator component
  const SortIndicator = ({ column, activeColumn, direction }: { column: string; activeColumn: string; direction: 'asc' | 'desc' }) => {
    if (column !== activeColumn) {
      return (
        <svg className="w-3 h-3 text-[#64748B]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return direction === 'asc' ? (
      <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
      </svg>
    ) : (
      <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Stopped Buying Analysis
          </h3>
          <div className="mt-1 space-y-1">
            <p className="text-[12px] text-[#64748B]">
              Products that customers purchased {data.periods.comparison_window.description} but have NOT purchased {data.periods.detection_window.description}
            </p>
            <div className="flex items-center gap-2 text-[11px] text-amber-400/80">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              This analysis always uses the last 18 months of data, independent of any dashboard filters
            </div>
          </div>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="text-[10px] text-red-400 uppercase tracking-wide mb-1">Products Dropped</div>
          <div className="text-2xl font-bold text-red-400">{data.summary.total_products_with_churn}</div>
        </div>
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <div className="text-[10px] text-red-400 uppercase tracking-wide mb-1">Customers Affected</div>
          <div className="text-2xl font-bold text-red-400">{data.summary.total_customers_with_churn}</div>
        </div>
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
          <div className="text-[10px] text-amber-400 uppercase tracking-wide mb-1">Revenue at Risk</div>
          <div className="text-2xl font-bold text-amber-400">{formatCurrency(data.summary.total_revenue_at_risk)}</div>
        </div>
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Units Lost</div>
          <div className="text-2xl font-bold text-white">{data.summary.total_units_lost.toLocaleString()}</div>
        </div>
      </div>

      {/* Class Breakdown */}
      {data.by_class.length > 0 && (
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <h4 className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">By Product Class</h4>
          <div className="flex flex-wrap gap-3">
            {data.by_class.slice(0, 6).map((cls) => (
              <div key={cls.class_name} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#0F1722] border border-white/[0.04]">
                <span className="text-[12px] text-[#94A3B8]">{cls.class_name}</span>
                <span className="text-[12px] text-red-400 font-medium">{formatCurrency(cls.revenue)}</span>
                <span className="text-[10px] text-[#64748B]">({cls.count} lost)</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setViewMode('by_product'); setExpandedItem(null); }}
          className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
            viewMode === 'by_product'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
          }`}
        >
          By Product ({data.by_product.length})
        </button>
        <button
          onClick={() => { setViewMode('by_customer'); setExpandedItem(null); }}
          className={`px-4 py-2 rounded-lg text-[12px] font-medium transition-all ${
            viewMode === 'by_customer'
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-[#1E293B] text-[#94A3B8] border border-white/[0.04] hover:bg-[#334155] hover:text-white'
          }`}
        >
          By Customer ({data.by_customer.length})
        </button>
      </div>

      {/* By Product View */}
      {viewMode === 'by_product' && (
        <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
          <div className="grid grid-cols-[1fr,120px,100px,80px] gap-4 px-4 py-3 bg-[#0F1722] border-b border-white/[0.04] text-[10px] font-semibold uppercase tracking-wider">
            <button
              onClick={() => handleProductSort('product')}
              className="flex items-center gap-1.5 text-left hover:text-cyan-400 transition-colors text-[#64748B]"
            >
              Product
              <SortIndicator column="product" activeColumn={productSortColumn} direction={productSortDirection} />
            </button>
            <button
              onClick={() => handleProductSort('revenue')}
              className="flex items-center justify-end gap-1.5 text-right hover:text-cyan-400 transition-colors text-[#64748B]"
            >
              Lost Revenue
              <SortIndicator column="revenue" activeColumn={productSortColumn} direction={productSortDirection} />
            </button>
            <button
              onClick={() => handleProductSort('customers')}
              className="flex items-center justify-end gap-1.5 text-right hover:text-cyan-400 transition-colors text-[#64748B]"
            >
              Customers Lost
              <SortIndicator column="customers" activeColumn={productSortColumn} direction={productSortDirection} />
            </button>
            <div></div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {sortedProducts.map((product) => {
              const isExpanded = expandedItem === product.item_id;

              return (
                <div key={product.item_id} className="border-b border-white/[0.02]">
                  <div
                    className="grid grid-cols-[1fr,120px,100px,80px] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedItem(isExpanded ? null : product.item_id)}
                  >
                    <div>
                      <div className="text-[13px] text-white font-medium">{product.item_description || product.item_name}</div>
                      <div className="text-[11px] text-[#64748B]">{product.class_name}</div>
                    </div>
                    <div className="text-right text-[13px] text-red-400 font-medium">
                      {formatCurrency(product.total_prior_revenue)}
                    </div>
                    <div className="text-right text-[13px] text-white">
                      {product.customers_lost}
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

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-4 bg-[#0F1722] border-t border-white/[0.04]">
                          <h5 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                            Customers Who Stopped Buying This Product
                          </h5>
                          <div className="space-y-2">
                            {product.customer_list.slice(0, 10).map((customer) => (
                              <div
                                key={customer.customer_id || customer.customer_name}
                                className="flex items-center justify-between p-2 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onCustomerClick?.(customer.customer_id || customer.customer_name, customer.customer_name);
                                }}
                              >
                                <div>
                                  <span className="text-[12px] text-[#38BDF8] hover:underline">{customer.customer_name}</span>
                                  <span className="text-[10px] text-[#64748B] ml-2">
                                    Last purchase: {formatDate(customer.last_purchase_date)} ({customer.days_since_purchase} days ago)
                                  </span>
                                </div>
                                <span className="text-[12px] text-white font-medium">{formatCurrency(customer.prior_revenue)}</span>
                              </div>
                            ))}
                            {product.customer_list.length > 10 && (
                              <div className="text-[11px] text-[#64748B] italic pt-2 border-t border-white/[0.04]">
                                + {product.customer_list.length - 10} more customers
                              </div>
                            )}
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
      )}

      {/* By Customer View */}
      {viewMode === 'by_customer' && (
        <div className="rounded-xl bg-[#151F2E] border border-white/[0.04] overflow-hidden">
          <div className="grid grid-cols-[1fr,120px,100px,80px] gap-4 px-4 py-3 bg-[#0F1722] border-b border-white/[0.04] text-[10px] font-semibold uppercase tracking-wider">
            <button
              onClick={() => handleCustomerSort('customer')}
              className="flex items-center gap-1.5 text-left hover:text-cyan-400 transition-colors text-[#64748B]"
            >
              Customer
              <SortIndicator column="customer" activeColumn={customerSortColumn} direction={customerSortDirection} />
            </button>
            <button
              onClick={() => handleCustomerSort('revenue')}
              className="flex items-center justify-end gap-1.5 text-right hover:text-cyan-400 transition-colors text-[#64748B]"
            >
              Revenue at Risk
              <SortIndicator column="revenue" activeColumn={customerSortColumn} direction={customerSortDirection} />
            </button>
            <button
              onClick={() => handleCustomerSort('products')}
              className="flex items-center justify-end gap-1.5 text-right hover:text-cyan-400 transition-colors text-[#64748B]"
            >
              Products Dropped
              <SortIndicator column="products" activeColumn={customerSortColumn} direction={customerSortDirection} />
            </button>
            <div></div>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {sortedCustomers.map((customer) => {
              const isExpanded = expandedItem === (customer.customer_id || customer.customer_name);

              return (
                <div key={customer.customer_id || customer.customer_name} className="border-b border-white/[0.02]">
                  <div
                    className="grid grid-cols-[1fr,120px,100px,80px] gap-4 px-4 py-3 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => setExpandedItem(isExpanded ? null : (customer.customer_id || customer.customer_name))}
                  >
                    <div
                      className="text-[13px] text-[#38BDF8] font-medium hover:underline cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCustomerClick?.(customer.customer_id || customer.customer_name, customer.customer_name);
                      }}
                    >
                      {customer.customer_name}
                    </div>
                    <div className="text-right text-[13px] text-red-400 font-medium">
                      {formatCurrency(customer.total_prior_revenue)}
                    </div>
                    <div className="text-right text-[13px] text-white">
                      {customer.products_stopped}
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

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 py-4 bg-[#0F1722] border-t border-white/[0.04]">
                          <h5 className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                            Products This Customer Stopped Buying
                          </h5>
                          <div className="space-y-2">
                            {customer.product_list.map((product) => (
                              <div
                                key={product.item_id || product.item_name}
                                className="flex items-center justify-between p-2 rounded-lg bg-white/[0.01]"
                              >
                                <div>
                                  <span className="text-[12px] text-white">{product.item_description || product.item_name}</span>
                                  <span className="text-[10px] text-[#64748B] ml-2">{product.class_name}</span>
                                </div>
                                <div className="text-right">
                                  <span className="text-[12px] text-white font-medium">{formatCurrency(product.prior_revenue)}</span>
                                  <div className="text-[9px] text-[#64748B]">Last: {formatDate(product.last_purchase_date)}</div>
                                </div>
                              </div>
                            ))}
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
      )}
    </div>
  );
}
