'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight } from 'lucide-react';
import OperationTimeline from './OperationTimeline';

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

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  // NetSuite returns MM/DD/YYYY format
  return dateStr;
}

function getStatusColor(status: string | null): string {
  if (!status) return 'bg-gray-500/20 text-gray-400';

  const statusLower = status.toLowerCase();
  if (statusLower.includes('released') || statusLower.includes('open')) {
    return 'bg-blue-500/20 text-blue-400';
  }
  if (statusLower.includes('progress') || statusLower.includes('built')) {
    return 'bg-amber-500/20 text-amber-400';
  }
  if (statusLower.includes('closed') || statusLower.includes('complete')) {
    return 'bg-green-500/20 text-green-400';
  }
  return 'bg-gray-500/20 text-gray-400';
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-white/[0.06]">
            <th className="w-10 px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"></th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">WO #</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Current Operation</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Cost</th>
            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Margin</th>
            <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Days</th>
          </tr>
        </thead>
        <tbody>
          {data.map((wo, index) => {
            const isExpanded = expandedRows.has(wo.work_order_id);
            const hasOperations = wo.operations && wo.operations.length > 0;

            return (
              <motion.tr
                key={wo.work_order_id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.02 }}
                className="group"
              >
                <td colSpan={9} className="p-0">
                  {/* Main Row */}
                  <div
                    onClick={() => hasOperations && toggleRow(wo.work_order_id)}
                    className={`
                      flex items-center w-full border-b border-white/[0.04] transition-colors
                      ${hasOperations ? 'cursor-pointer hover:bg-white/[0.02]' : ''}
                      ${isExpanded ? 'bg-white/[0.03]' : ''}
                    `}
                  >
                    {/* Expand Icon */}
                    <div className="w-10 px-4 py-4 flex items-center justify-center">
                      {hasOperations && (
                        <motion.div
                          animate={{ rotate: isExpanded ? 90 : 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        </motion.div>
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

                    {/* Current Operation */}
                    <div className="flex-1 min-w-[180px] px-4 py-4">
                      {wo.current_operation ? (
                        <div>
                          <span className="text-gray-300">
                            Op {wo.current_operation.operation_sequence}: {wo.current_operation.operation_name}
                          </span>
                          <div className={`inline-block ml-2 px-2 py-0.5 rounded text-xs ${getStatusColor(wo.current_operation.status)}`}>
                            {wo.current_operation.status}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-500">
                          {hasOperations ? 'All Complete' : 'No Operations'}
                        </span>
                      )}
                    </div>

                    {/* Progress */}
                    <div className="w-[120px] px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${wo.percent_complete}%` }}
                            transition={{ duration: 0.5, delay: index * 0.02 }}
                            className={`h-full rounded-full ${
                              wo.percent_complete >= 100
                                ? 'bg-green-500'
                                : wo.percent_complete >= 50
                                  ? 'bg-blue-500'
                                  : 'bg-amber-500'
                            }`}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-[36px] text-right">
                          {wo.percent_complete}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {wo.completed_operations} / {wo.total_operations} ops
                      </div>
                    </div>

                    {/* Revenue */}
                    <div className="w-[100px] px-4 py-4 text-right">
                      <span className="text-gray-300">{formatCurrency(wo.revenue)}</span>
                    </div>

                    {/* Cost */}
                    <div className="w-[100px] px-4 py-4 text-right">
                      <span className="text-gray-400">{formatCurrency(wo.total_cost)}</span>
                    </div>

                    {/* Margin */}
                    <div className="w-[80px] px-4 py-4 text-right">
                      <span className={getMarginColor(wo.margin_pct)}>
                        {wo.margin_pct !== null ? `${wo.margin_pct.toFixed(1)}%` : '-'}
                      </span>
                    </div>

                    {/* Days in Current Op */}
                    <div className="w-[70px] px-4 py-4 text-center">
                      {wo.days_in_current_op !== null ? (
                        <span className={`
                          ${wo.days_in_current_op > 7 ? 'text-red-400' :
                            wo.days_in_current_op > 3 ? 'text-amber-400' : 'text-gray-400'}
                        `}>
                          {wo.days_in_current_op}d
                        </span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && hasOperations && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden bg-white/[0.01] border-b border-white/[0.04]"
                      >
                        <div className="px-14 py-4">
                          <OperationTimeline operations={wo.operations} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
