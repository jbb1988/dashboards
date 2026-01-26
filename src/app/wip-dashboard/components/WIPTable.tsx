'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react';

interface WorkOrderOperation {
  operation_sequence: number;
  operation_name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  completed_quantity: number | null;
  input_quantity: number | null;
  work_center: string | null;
  estimated_time: number | null;
  actual_time: number | null;
}

interface WorkOrderWithOperations {
  work_order_id: string;
  work_order: string;
  wo_date: string | null;
  status: string | null;
  customer_id: string | null;
  customer_name: string | null;
  so_number: string | null;
  assembly_description: string | null;
  operations: WorkOrderOperation[];
  current_operation: WorkOrderOperation | null;
  total_operations: number;
  completed_operations: number;
  percent_complete: number;
  days_in_current_op: number | null;
  revenue: number | null;
  total_cost: number | null;
  margin_pct: number | null;
  // New shop status fields
  shop_status?: string | null;
  shop_status_id?: string | null;
  days_in_status?: number;
}

interface WIPTableProps {
  data: WorkOrderWithOperations[];
}

function formatCurrency(value: number | null): string {
  if (value === null) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

function getStageColor(stage: string | null | undefined): string {
  if (!stage) return 'bg-gray-500/20 text-gray-400';

  const stageLower = stage.toLowerCase();
  if (stageLower.includes('fab')) {
    return 'bg-blue-500/20 text-blue-400';
  }
  if (stageLower.includes('assembly') || stageLower.includes('assy')) {
    return 'bg-purple-500/20 text-purple-400';
  }
  if (stageLower.includes('test')) {
    return 'bg-amber-500/20 text-amber-400';
  }
  if (stageLower.includes('ship') || stageLower.includes('crat')) {
    return 'bg-green-500/20 text-green-400';
  }
  if (stageLower.includes('hold') || stageLower.includes('wait')) {
    return 'bg-red-500/20 text-red-400';
  }
  return 'bg-cyan-500/20 text-cyan-400';
}

function getDaysColor(days: number | null | undefined): { color: string; indicator: string } {
  if (days === null || days === undefined) {
    return { color: 'text-gray-500', indicator: '' };
  }
  if (days > 14) {
    return { color: 'text-red-400 font-semibold', indicator: '!!' };
  }
  if (days > 7) {
    return { color: 'text-red-400', indicator: '!' };
  }
  if (days > 3) {
    return { color: 'text-amber-400', indicator: '' };
  }
  return { color: 'text-green-400', indicator: '' };
}

function getMarginColor(margin: number | null): string {
  if (margin === null) return 'text-gray-400';
  if (margin >= 30) return 'text-green-400';
  if (margin >= 20) return 'text-cyan-400';
  if (margin >= 10) return 'text-amber-400';
  return 'text-red-400';
}

export default function WIPTable({ data }: WIPTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'days' | 'revenue' | 'margin' | 'stage'>('days');
  const [sortDesc, setSortDesc] = useState(true);

  const toggleRow = (woId: string) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(woId)) {
        newSet.delete(woId);
      } else {
        newSet.add(woId);
      }
      return newSet;
    });
  };

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    let comparison = 0;
    switch (sortBy) {
      case 'days':
        comparison = (a.days_in_status ?? a.days_in_current_op ?? 0) - (b.days_in_status ?? b.days_in_current_op ?? 0);
        break;
      case 'revenue':
        comparison = (a.revenue ?? 0) - (b.revenue ?? 0);
        break;
      case 'margin':
        comparison = (a.margin_pct ?? 0) - (b.margin_pct ?? 0);
        break;
      case 'stage':
        comparison = (a.shop_status ?? '').localeCompare(b.shop_status ?? '');
        break;
    }
    return sortDesc ? -comparison : comparison;
  });

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">WO #</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
            <th
              className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300"
              onClick={() => { setSortBy('stage'); setSortDesc(sortBy === 'stage' ? !sortDesc : true); }}
            >
              Current Stage {sortBy === 'stage' && (sortDesc ? '↓' : '↑')}
            </th>
            <th
              className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300"
              onClick={() => { setSortBy('days'); setSortDesc(sortBy === 'days' ? !sortDesc : true); }}
            >
              Days {sortBy === 'days' && (sortDesc ? '↓' : '↑')}
            </th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300"
              onClick={() => { setSortBy('revenue'); setSortDesc(sortBy === 'revenue' ? !sortDesc : true); }}
            >
              Revenue {sortBy === 'revenue' && (sortDesc ? '↓' : '↑')}
            </th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
            <th
              className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-300"
              onClick={() => { setSortBy('margin'); setSortDesc(sortBy === 'margin' ? !sortDesc : true); }}
            >
              Margin {sortBy === 'margin' && (sortDesc ? '↓' : '↑')}
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedData.map((wo, index) => {
            const isExpanded = expandedRows.has(wo.work_order_id);
            const days = wo.days_in_status ?? wo.days_in_current_op;
            const { color: daysColor, indicator: daysIndicator } = getDaysColor(days);
            const isStuck = days !== null && days !== undefined && days > 7;
            const shopStatus = wo.shop_status || wo.current_operation?.operation_name;

            return (
              <motion.tr
                key={wo.work_order_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.01 }}
                className="group"
              >
                <td colSpan={8} className="p-0">
                  {/* Main Row */}
                  <div
                    className={`
                      flex items-center w-full border-b border-white/[0.04] transition-colors
                      ${isStuck ? 'bg-red-500/[0.03]' : ''}
                      hover:bg-white/[0.02]
                    `}
                  >
                    {/* Alert Icon for Stuck WOs */}
                    <div className="w-10 px-4 py-4 flex items-center justify-center">
                      {isStuck && (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                    </div>

                    {/* WO # */}
                    <div className="flex-1 min-w-[120px] px-4 py-4">
                      <div className="font-medium text-white">{wo.work_order}</div>
                      {wo.so_number && (
                        <div className="text-xs text-gray-500 mt-0.5">SO: {wo.so_number}</div>
                      )}
                    </div>

                    {/* Customer */}
                    <div className="flex-1 min-w-[180px] px-4 py-4">
                      <div className="text-gray-300 truncate max-w-[200px]" title={wo.customer_name || ''}>
                        {wo.customer_name || '-'}
                      </div>
                      {wo.assembly_description && (
                        <div className="text-xs text-gray-500 mt-0.5 truncate max-w-[200px]" title={wo.assembly_description}>
                          {wo.assembly_description}
                        </div>
                      )}
                    </div>

                    {/* Current Stage */}
                    <div className="flex-1 min-w-[150px] px-4 py-4">
                      {shopStatus ? (
                        <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getStageColor(shopStatus)}`}>
                          {shopStatus}
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>

                    {/* Days in Status */}
                    <div className="w-[80px] px-4 py-4 text-center">
                      {days !== null && days !== undefined ? (
                        <span className={daysColor}>
                          {daysIndicator}{days}d
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>

                    {/* Revenue */}
                    <div className="w-[100px] px-4 py-4 text-right">
                      <span className={wo.revenue ? 'text-gray-300' : 'text-gray-500'}>
                        {formatCurrency(wo.revenue)}
                      </span>
                    </div>

                    {/* Cost */}
                    <div className="w-[100px] px-4 py-4 text-right">
                      <span className={wo.total_cost ? 'text-gray-400' : 'text-gray-500'}>
                        {formatCurrency(wo.total_cost)}
                      </span>
                    </div>

                    {/* Margin */}
                    <div className="w-[80px] px-4 py-4 text-right">
                      <span className={getMarginColor(wo.margin_pct)}>
                        {wo.margin_pct !== null ? `${wo.margin_pct.toFixed(1)}%` : '-'}
                      </span>
                    </div>
                  </div>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>

      {/* Empty state if no data */}
      {data.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-gray-400">No work orders found</p>
        </div>
      )}
    </div>
  );
}
