'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatChartCurrency, CHART_COLORS } from './ChartContainer';

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

interface CrossSellTableProps {
  data: CrossSellOpportunity[];
  onCustomerClick?: (customerId: string) => void;
}

type SortField = 'customer' | 'product' | 'affinity' | 'revenue' | 'margin';
type SortDir = 'asc' | 'desc';

function getAffinityColor(score: number): string {
  if (score >= 70) return 'text-green-400 bg-green-400/10';
  if (score >= 50) return 'text-amber-400 bg-amber-400/10';
  return 'text-orange-400 bg-orange-400/10';
}

function truncateName(name: string, maxLength: number = 25): string {
  if (name.length <= maxLength) return name;
  return name.substring(0, maxLength - 3) + '...';
}

export function CrossSellTable({ data, onCustomerClick }: CrossSellTableProps) {
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterProduct, setFilterProduct] = useState<string>('');

  const uniqueProducts = useMemo(() => {
    return [...new Set(data.map(d => d.recommended_class))].sort();
  }, [data]);

  const sortedData = useMemo(() => {
    let filtered = [...data];

    // Apply product filter
    if (filterProduct) {
      filtered = filtered.filter(d => d.recommended_class === filterProduct);
    }

    // Apply sort
    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'customer':
          comparison = a.customer_name.localeCompare(b.customer_name);
          break;
        case 'product':
          comparison = a.recommended_class.localeCompare(b.recommended_class);
          break;
        case 'affinity':
          comparison = a.affinity_score - b.affinity_score;
          break;
        case 'revenue':
          comparison = a.estimated_revenue - b.estimated_revenue;
          break;
        case 'margin':
          comparison = a.avg_margin_pct - b.avg_margin_pct;
          break;
      }
      return sortDir === 'desc' ? -comparison : comparison;
    });

    return filtered.slice(0, 25); // Limit to 25 rows
  }, [data, sortField, sortDir, filterProduct]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }
    return (
      <svg className="w-3 h-3 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        {sortDir === 'desc' ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        )}
      </svg>
    );
  };

  const totalPotential = useMemo(() => {
    return data.reduce((sum, d) => sum + d.estimated_revenue, 0);
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="bg-[#0F1123]/80 rounded-2xl p-6 border border-white/[0.08] shadow-lg shadow-cyan-500/5 backdrop-blur-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="text-cyan-400">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            Cross-Sell Opportunities
          </h3>
          <p className="text-[#64748B] text-[12px] mt-0.5">
            {data.length} opportunities • {formatChartCurrency(totalPotential)} potential
          </p>
        </div>

        {/* Filter */}
        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="text-[12px] bg-white/[0.05] border border-white/10 rounded-lg px-3 py-1.5 text-white focus:outline-none focus:border-cyan-400/50"
        >
          <option value="">All Products</option>
          {uniqueProducts.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/10">
              <th
                className="text-left py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('customer')}
              >
                <div className="flex items-center gap-1.5">
                  Customer
                  <SortIcon field="customer" />
                </div>
              </th>
              <th
                className="text-left py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('product')}
              >
                <div className="flex items-center gap-1.5">
                  Recommended Product
                  <SortIcon field="product" />
                </div>
              </th>
              <th
                className="text-center py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('affinity')}
              >
                <div className="flex items-center justify-center gap-1.5">
                  Affinity
                  <SortIcon field="affinity" />
                </div>
              </th>
              <th
                className="text-right py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('revenue')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Est. Revenue
                  <SortIcon field="revenue" />
                </div>
              </th>
              <th
                className="text-right py-2 px-3 text-[11px] font-medium text-[#64748B] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('margin')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Margin
                  <SortIcon field="margin" />
                </div>
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row, idx) => (
              <>
                <tr
                  key={row.customer_id + row.recommended_class}
                  className={`border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors ${
                    expandedRow === row.customer_id + row.recommended_class ? 'bg-white/[0.03]' : ''
                  }`}
                >
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => onCustomerClick?.(row.customer_id)}
                      className="text-[13px] text-white hover:text-cyan-400 transition-colors text-left"
                      title={row.customer_name}
                    >
                      {truncateName(row.customer_name)}
                    </button>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[13px] text-[#94A3B8]">{row.recommended_class}</span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${getAffinityColor(row.affinity_score)}`}>
                      {row.affinity_score}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className="text-[13px] text-white font-medium">
                      {formatChartCurrency(row.estimated_revenue)}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <span className={`text-[13px] ${row.avg_margin_pct >= 40 ? 'text-green-400' : row.avg_margin_pct >= 25 ? 'text-amber-400' : 'text-red-400'}`}>
                      {row.avg_margin_pct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => setExpandedRow(
                        expandedRow === row.customer_id + row.recommended_class
                          ? null
                          : row.customer_id + row.recommended_class
                      )}
                      className="text-[#64748B] hover:text-white transition-colors"
                    >
                      <svg
                        className={`w-4 h-4 transform transition-transform ${
                          expandedRow === row.customer_id + row.recommended_class ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </td>
                </tr>
                <AnimatePresence>
                  {expandedRow === row.customer_id + row.recommended_class && (
                    <motion.tr
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <td colSpan={6} className="px-3 pb-3">
                        <div className="bg-white/[0.03] rounded-lg p-4 text-[12px]">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <span className="text-[#64748B]">Currently Buys:</span>
                              <div className="text-white mt-1 flex flex-wrap gap-1">
                                {row.current_classes.slice(0, 5).map(c => (
                                  <span key={c} className="bg-white/[0.05] px-2 py-0.5 rounded text-[11px]">
                                    {c}
                                  </span>
                                ))}
                                {row.current_classes.length > 5 && (
                                  <span className="text-[#64748B]">+{row.current_classes.length - 5} more</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span className="text-[#64748B]">Why This Recommendation:</span>
                              <p className="text-[#94A3B8] mt-1">{row.reasoning}</p>
                            </div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/[0.05] flex items-center gap-4">
                            <span className="text-[#64748B]">
                              Based on {row.similar_customer_count} similar customers ({row.similar_customer_coverage_pct}% coverage)
                            </span>
                          </div>
                        </div>
                      </td>
                    </motion.tr>
                  )}
                </AnimatePresence>
              </>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div className="text-center py-8 text-[#64748B]">
          No cross-sell opportunities match the current filter.
        </div>
      )}
    </motion.div>
  );
}
