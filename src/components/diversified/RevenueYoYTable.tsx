'use client';

import { useState, useMemo } from 'react';

interface ClassYoYData {
  class_name: string;
  parent_class: string | null;
  current_units: number;
  prior_units: number;
  units_change_pct: number;
  current_revenue: number;
  prior_revenue: number;
  revenue_change_pct: number;
  avg_price_per_unit: number;
}

interface RevenueYoYTableProps {
  data: ClassYoYData[];
  title?: string;
  subtitle?: string;
  onRowClick?: (className: string) => void;
}

type SortField = 'class_name' | 'current_revenue' | 'prior_revenue' | 'revenue_change_pct' | 'current_units' | 'prior_units' | 'units_change_pct' | 'avg_price_per_unit';
type SortDirection = 'asc' | 'desc';

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

const formatPercent = (value: number): string => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
};

export function RevenueYoYTable({
  data,
  title = 'Revenue & Units YoY Comparison',
  subtitle = 'Click a row to see item details',
  onRowClick,
}: RevenueYoYTableProps) {
  const [sortField, setSortField] = useState<SortField>('current_revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle string sorting
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc'
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      // Handle number sorting
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return (
        <svg className="w-3 h-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
      );
    }

    return sortDirection === 'asc' ? (
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
    <div className="bg-[#151F2E] rounded-xl border border-[#2A3F5F] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#2A3F5F]">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
          <div>
            <h3 className="text-[16px] font-semibold text-white">{title}</h3>
            <p className="text-[12px] text-[#64748B] mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[#0F1722] border-b border-[#2A3F5F]">
              <th
                className="px-6 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('class_name')}
              >
                <div className="flex items-center gap-1.5">
                  Class <SortIcon field="class_name" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('current_revenue')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Current Revenue <SortIcon field="current_revenue" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('prior_revenue')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Prior Revenue <SortIcon field="prior_revenue" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('revenue_change_pct')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Revenue Δ% <SortIcon field="revenue_change_pct" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('current_units')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Current Units <SortIcon field="current_units" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('prior_units')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Prior Units <SortIcon field="prior_units" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('units_change_pct')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Units Δ% <SortIcon field="units_change_pct" />
                </div>
              </th>
              <th
                className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-wider text-[#94A3B8] cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort('avg_price_per_unit')}
              >
                <div className="flex items-center justify-end gap-1.5">
                  Avg $/Unit <SortIcon field="avg_price_per_unit" />
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#2A3F5F]">
            {sortedData.map((row, idx) => (
              <tr
                key={row.class_name}
                className={`
                  ${idx % 2 === 0 ? 'bg-[#151F2E]' : 'bg-[#0F1722]'}
                  ${onRowClick ? 'cursor-pointer hover:bg-[#1A2942] transition-colors' : ''}
                `}
                onClick={() => onRowClick && onRowClick(row.class_name)}
              >
                <td className="px-6 py-4 text-[13px] font-medium text-white whitespace-nowrap">
                  {row.class_name}
                </td>
                <td className="px-4 py-4 text-[13px] text-right text-cyan-400 whitespace-nowrap">
                  {formatCurrency(row.current_revenue)}
                </td>
                <td className="px-4 py-4 text-[13px] text-right text-[#94A3B8] whitespace-nowrap">
                  {formatCurrency(row.prior_revenue)}
                </td>
                <td className={`px-4 py-4 text-[13px] text-right font-semibold whitespace-nowrap ${
                  row.revenue_change_pct >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatPercent(row.revenue_change_pct)}
                </td>
                <td className="px-4 py-4 text-[13px] text-right text-cyan-400 whitespace-nowrap">
                  {formatNumber(row.current_units)}
                </td>
                <td className="px-4 py-4 text-[13px] text-right text-[#94A3B8] whitespace-nowrap">
                  {formatNumber(row.prior_units)}
                </td>
                <td className={`px-4 py-4 text-[13px] text-right font-semibold whitespace-nowrap ${
                  row.units_change_pct >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {formatPercent(row.units_change_pct)}
                </td>
                <td className="px-4 py-4 text-[13px] text-right text-white whitespace-nowrap">
                  {formatCurrency(row.avg_price_per_unit)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[#0F1722] border-t border-[#2A3F5F] text-center">
        <span className="text-[11px] text-[#64748B]">
          Showing {sortedData.length} classes • Click column headers to sort
        </span>
      </div>
    </div>
  );
}
