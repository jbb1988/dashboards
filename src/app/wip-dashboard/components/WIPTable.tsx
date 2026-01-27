'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ChevronRight } from 'lucide-react';
import WIPDetailDrawer from './WIPDetailDrawer';

interface WorkOrderWithOperations {
  work_order_id: string;
  work_order: string;
  wo_date: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  so_number: string | null;
  assembly_description: string | null;
  operations: any[];
  current_operation: any | null;
  total_operations: number;
  completed_operations: number;
  percent_complete: number;
  days_in_current_op: number | null;
  revenue: number | null;
  total_cost: number | null;
  margin_pct: number | null;
  shop_status?: string | null;
  shop_status_id?: string | null;
  days_in_status?: number;
  expected_completion?: string | null;
  days_until_due?: number | null;
}

interface WIPTableProps {
  data: WorkOrderWithOperations[];
}

function formatCurrency(value: number | null): string {
  if (value === null || value === 0) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

function getStageColor(stage: string | null | undefined): string {
  if (!stage) return 'bg-gray-500/20 text-gray-400';
  const stageLower = stage.toLowerCase();
  if (stageLower.includes('planned')) return 'bg-blue-500/20 text-blue-400';
  if (stageLower.includes('released')) return 'bg-cyan-500/20 text-cyan-400';
  if (stageLower.includes('process')) return 'bg-purple-500/20 text-purple-400';
  if (stageLower.includes('built')) return 'bg-green-500/20 text-green-400';
  if (stageLower.includes('closed')) return 'bg-gray-500/20 text-gray-400';
  return 'bg-cyan-500/20 text-cyan-400';
}

function getDaysColor(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'text-gray-500';
  if (days > 14) return 'text-red-400 font-semibold';
  if (days > 7) return 'text-red-400';
  if (days > 3) return 'text-amber-400';
  return 'text-green-400';
}

function getMarginColor(margin: number | null): string {
  if (margin === null) return 'text-gray-500';
  if (margin >= 30) return 'text-green-400';
  if (margin >= 20) return 'text-cyan-400';
  if (margin >= 10) return 'text-amber-400';
  return 'text-red-400';
}

function getDueColor(daysUntilDue: number | null | undefined): string {
  if (daysUntilDue === null || daysUntilDue === undefined) return 'text-gray-500';
  if (daysUntilDue < 0) return 'text-red-400 font-semibold'; // Overdue
  if (daysUntilDue <= 2) return 'text-amber-400'; // Due soon
  if (daysUntilDue <= 7) return 'text-cyan-400';
  return 'text-green-400';
}

function formatDueDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    // NetSuite format: "M/D/YYYY"
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

// Grid columns: Alert | WO# | Customer | Stage | Days | Due | Revenue | Margin | Chevron
const GRID_COLS = '24px 1fr 1.5fr 110px 60px 80px 90px 60px 24px';

export default function WIPTable({ data }: WIPTableProps) {
  const [sortBy, setSortBy] = useState<'days' | 'revenue' | 'margin' | 'stage'>('days');
  const [sortDesc, setSortDesc] = useState(false);
  const [selectedWO, setSelectedWO] = useState<WorkOrderWithOperations | null>(null);

  const handleSort = (col: typeof sortBy) => {
    if (sortBy === col) {
      setSortDesc(!sortDesc);
    } else {
      setSortBy(col);
      setSortDesc(col === 'revenue' || col === 'margin'); // Default desc for financial
    }
  };

  const sortedData = [...data].sort((a, b) => {
    let cmp = 0;
    switch (sortBy) {
      case 'days':
        cmp = (a.days_in_status ?? 0) - (b.days_in_status ?? 0);
        break;
      case 'revenue':
        cmp = (a.revenue ?? 0) - (b.revenue ?? 0);
        break;
      case 'margin':
        cmp = (a.margin_pct ?? 0) - (b.margin_pct ?? 0);
        break;
      case 'stage':
        cmp = (a.shop_status ?? '').localeCompare(b.shop_status ?? '');
        break;
    }
    return sortDesc ? -cmp : cmp;
  });

  const SortArrow = ({ col }: { col: typeof sortBy }) => (
    sortBy === col ? <span className="ml-1">{sortDesc ? '↓' : '↑'}</span> : null
  );

  return (
    <div className="overflow-x-auto">
      {/* Header */}
      <div
        className="grid gap-4 px-4 py-3 border-b border-white/[0.06] text-xs font-semibold text-gray-500 uppercase tracking-wider"
        style={{ gridTemplateColumns: GRID_COLS }}
      >
        <div></div>
        <div>WO #</div>
        <div>Customer</div>
        <div className="cursor-pointer hover:text-gray-300" onClick={() => handleSort('stage')}>
          Stage<SortArrow col="stage" />
        </div>
        <div className="text-center cursor-pointer hover:text-gray-300" onClick={() => handleSort('days')}>
          Age<SortArrow col="days" />
        </div>
        <div className="text-center">Due</div>
        <div className="text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('revenue')}>
          Revenue<SortArrow col="revenue" />
        </div>
        <div className="text-right cursor-pointer hover:text-gray-300" onClick={() => handleSort('margin')}>
          Margin<SortArrow col="margin" />
        </div>
        <div></div>
      </div>

      {/* Rows */}
      {sortedData.map((wo, index) => {
        const days = wo.days_in_status ?? wo.days_in_current_op;
        const daysColor = getDaysColor(days);
        const isStuck = days !== null && days !== undefined && days > 7;
        const shopStatus = wo.shop_status || 'Unknown';
        const isEven = index % 2 === 0;
        const hasValidCost = wo.total_cost !== null && wo.total_cost > 0;

        return (
          <motion.div
            key={wo.work_order_id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.015, 0.3) }}
            onClick={() => setSelectedWO(wo)}
            className={`grid gap-4 px-4 py-3 items-center border-b border-white/[0.04] transition-colors hover:bg-white/[0.05] cursor-pointer ${
              isStuck ? 'bg-red-500/[0.03]' : isEven ? 'bg-[#151F2E]' : 'bg-[#131B28]'
            }`}
            style={{ gridTemplateColumns: GRID_COLS }}
          >
            {/* Alert Icon */}
            <div className="flex justify-center">
              {isStuck && <AlertCircle className="w-4 h-4 text-red-400" />}
            </div>

            {/* WO # */}
            <div className="min-w-0">
              <div className="font-medium text-white truncate">{wo.work_order}</div>
              {wo.so_number && (
                <div className="text-[11px] text-gray-500 truncate">SO: {wo.so_number}</div>
              )}
            </div>

            {/* Customer */}
            <div className="min-w-0">
              <div className="text-gray-300 truncate" title={wo.customer_name || ''}>
                {wo.customer_name || '-'}
              </div>
              {wo.assembly_description && (
                <div className="text-[11px] text-gray-500 truncate" title={wo.assembly_description}>
                  {wo.assembly_description}
                </div>
              )}
            </div>

            {/* Stage */}
            <div>
              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${getStageColor(shopStatus)}`}>
                {shopStatus}
              </span>
            </div>

            {/* Days (Age) */}
            <div className="text-center">
              {days !== null && days !== undefined ? (
                <span className={daysColor}>{days}d</span>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </div>

            {/* Due Date */}
            <div className="text-center">
              {wo.expected_completion ? (
                <div>
                  <span className={getDueColor(wo.days_until_due)}>
                    {formatDueDate(wo.expected_completion)}
                  </span>
                </div>
              ) : (
                <span className="text-gray-500">-</span>
              )}
            </div>

            {/* Revenue */}
            <div className="text-right">
              <span className={wo.revenue ? 'text-gray-300' : 'text-gray-500'}>
                {formatCurrency(wo.revenue)}
              </span>
            </div>

            {/* Margin */}
            <div className="text-right">
              <span className={getMarginColor(hasValidCost ? wo.margin_pct : null)}>
                {hasValidCost && wo.margin_pct !== null ? `${wo.margin_pct.toFixed(0)}%` : '-'}
              </span>
            </div>

            {/* Chevron */}
            <div className="flex justify-center">
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </div>
          </motion.div>
        );
      })}

      {/* Empty State */}
      {data.length === 0 && (
        <div className="py-12 text-center text-gray-400">
          No work orders found
        </div>
      )}

      {/* WIP Detail Drawer */}
      <WIPDetailDrawer
        workOrder={selectedWO}
        onClose={() => setSelectedWO(null)}
      />
    </div>
  );
}
