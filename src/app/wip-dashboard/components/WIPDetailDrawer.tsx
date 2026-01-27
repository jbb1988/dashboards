'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Package,
  User,
  Calendar,
  Clock,
  DollarSign,
  TrendingUp,
  CheckCircle,
  Circle,
  AlertCircle,
  FileText,
  Wrench,
} from 'lucide-react';

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

interface WorkOrder {
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
  shop_status?: string | null;
  shop_status_id?: string | null;
  days_in_status?: number;
  expected_completion?: string | null;
  days_until_due?: number | null;
}

interface WIPDetailDrawerProps {
  workOrder: WorkOrder | null;
  onClose: () => void;
}

function formatCurrency(value: number | null): string {
  if (value === null || value === 0) return '-';
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(1)}K`;
  return `${sign}$${absValue.toFixed(2)}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  try {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
}

function getStageColor(stage: string | null | undefined): { bg: string; text: string; border: string } {
  if (!stage) return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };
  const stageLower = stage.toLowerCase();
  if (stageLower.includes('planned')) return { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' };
  if (stageLower.includes('released')) return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' };
  if (stageLower.includes('process')) return { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' };
  if (stageLower.includes('built')) return { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' };
  if (stageLower.includes('closed')) return { bg: 'bg-gray-500/20', text: 'text-gray-400', border: 'border-gray-500/30' };
  return { bg: 'bg-cyan-500/20', text: 'text-cyan-400', border: 'border-cyan-500/30' };
}

function getMarginColor(margin: number | null): string {
  if (margin === null) return 'text-gray-500';
  if (margin >= 30) return 'text-green-400';
  if (margin >= 20) return 'text-cyan-400';
  if (margin >= 10) return 'text-amber-400';
  return 'text-red-400';
}

function getDaysColor(days: number | null | undefined): string {
  if (days === null || days === undefined) return 'text-gray-500';
  if (days > 14) return 'text-red-400';
  if (days > 7) return 'text-amber-400';
  return 'text-green-400';
}

function getOperationStatusIcon(status: string | null) {
  if (!status) return <Circle className="w-4 h-4 text-gray-500" />;
  const statusLower = status.toLowerCase();
  if (statusLower.includes('complete') || statusLower.includes('done')) {
    return <CheckCircle className="w-4 h-4 text-green-400" />;
  }
  if (statusLower.includes('progress') || statusLower.includes('active')) {
    return <Clock className="w-4 h-4 text-amber-400 animate-pulse" />;
  }
  return <Circle className="w-4 h-4 text-gray-500" />;
}

export default function WIPDetailDrawer({ workOrder, onClose }: WIPDetailDrawerProps) {
  if (!workOrder) return null;

  const stageColors = getStageColor(workOrder.shop_status);
  const isStuck = (workOrder.days_in_status ?? 0) > 7;
  const isOverdue = (workOrder.days_until_due ?? 1) < 0;

  return (
    <AnimatePresence>
      {workOrder && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40"
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[560px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className={`flex-shrink-0 border-b border-white/[0.06] ${isStuck ? 'bg-red-500/10' : 'bg-[#151F2E]'}`}>
              <div className="p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    {/* Status Badges */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${stageColors.bg} ${stageColors.text} ${stageColors.border}`}>
                        {workOrder.shop_status || 'Unknown'}
                      </span>
                      {isStuck && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          <AlertCircle className="w-3 h-3" />
                          Stuck
                        </span>
                      )}
                      {isOverdue && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/20 text-red-400 border border-red-500/30">
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Work Order Number */}
                    <h2 className="text-xl font-semibold text-white mb-1">
                      {workOrder.work_order}
                    </h2>

                    {/* Customer & SO */}
                    <div className="flex items-center gap-2 text-sm text-[#8FA3BF]">
                      <User className="w-4 h-4" />
                      <span>{workOrder.customer_name || 'Unknown Customer'}</span>
                      {workOrder.so_number && (
                        <>
                          <span className="text-gray-600">•</span>
                          <FileText className="w-4 h-4" />
                          <span>{workOrder.so_number}</span>
                        </>
                      )}
                    </div>

                    {/* Assembly */}
                    {workOrder.assembly_description && (
                      <p className="text-xs text-gray-500 mt-1 truncate" title={workOrder.assembly_description}>
                        {workOrder.assembly_description}
                      </p>
                    )}
                  </div>

                  {/* Close Button */}
                  <button
                    onClick={onClose}
                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-4 gap-3 mt-4">
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">WO Date</div>
                    <div className="text-sm font-medium text-white flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-gray-500" />
                      {formatDate(workOrder.wo_date)}
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isStuck ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/[0.03]'}`}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Days in Stage</div>
                    <div className={`text-sm font-medium ${getDaysColor(workOrder.days_in_status)}`}>
                      {workOrder.days_in_status ?? '-'} days
                    </div>
                  </div>
                  <div className={`rounded-lg p-3 ${isOverdue ? 'bg-red-500/20 border border-red-500/30' : 'bg-white/[0.03]'}`}>
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Due</div>
                    <div className={`text-sm font-medium ${isOverdue ? 'text-red-400' : 'text-white'}`}>
                      {workOrder.expected_completion ? formatDate(workOrder.expected_completion) : '-'}
                    </div>
                  </div>
                  <div className="bg-white/[0.03] rounded-lg p-3">
                    <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">Progress</div>
                    <div className="text-sm font-medium text-white">
                      {workOrder.percent_complete}%
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${workOrder.percent_complete}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 rounded-full"
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>{workOrder.completed_operations} of {workOrder.total_operations} operations</span>
                    <span>{workOrder.percent_complete}% complete</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Financials */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="w-5 h-5 text-green-400" />
                  <h3 className="text-sm font-semibold text-white">Financials</h3>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-xl font-bold text-green-400">
                      {formatCurrency(workOrder.revenue)}
                    </div>
                    <div className="text-xs text-gray-500">Revenue</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-amber-400">
                      {formatCurrency(workOrder.total_cost)}
                    </div>
                    <div className="text-xs text-gray-500">Cost</div>
                  </div>
                  <div>
                    <div className={`text-xl font-bold ${getMarginColor(workOrder.margin_pct)}`}>
                      {workOrder.margin_pct !== null ? `${workOrder.margin_pct.toFixed(1)}%` : '-'}
                    </div>
                    <div className="text-xs text-gray-500">Margin</div>
                  </div>
                </div>
              </div>

              {/* Current Operation */}
              {workOrder.current_operation && (
                <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="w-5 h-5 text-purple-400" />
                    <h3 className="text-sm font-semibold text-purple-400">Current Operation</h3>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-semibold text-white">
                        {workOrder.current_operation.operation_name}
                      </div>
                      <div className="text-xs text-gray-500">
                        Step {workOrder.current_operation.operation_sequence} • {workOrder.current_operation.work_center || 'No work center'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getDaysColor(workOrder.days_in_current_op)}`}>
                        {workOrder.days_in_current_op ?? 0}d
                      </div>
                      <div className="text-xs text-gray-500">in operation</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Operations List */}
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Package className="w-4 h-4 text-cyan-400" />
                    Operations
                  </h3>
                  <span className="text-xs text-gray-500">
                    {workOrder.completed_operations}/{workOrder.total_operations} complete
                  </span>
                </div>

                {workOrder.operations.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-4">No operations found</p>
                ) : (
                  <div className="space-y-2">
                    {workOrder.operations
                      .sort((a, b) => a.operation_sequence - b.operation_sequence)
                      .map((op, index) => {
                        const isComplete = op.status?.toLowerCase().includes('complete');
                        const isCurrent = workOrder.current_operation?.operation_sequence === op.operation_sequence;

                        return (
                          <div
                            key={index}
                            className={`flex items-center gap-3 p-3 rounded-lg ${
                              isCurrent
                                ? 'bg-purple-500/10 border border-purple-500/20'
                                : isComplete
                                ? 'bg-green-500/5 border border-green-500/10'
                                : 'bg-white/[0.02] border border-white/[0.04]'
                            }`}
                          >
                            <div className="flex-shrink-0">
                              {getOperationStatusIcon(op.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className={`text-sm font-medium ${isComplete ? 'text-gray-400' : 'text-white'}`}>
                                {op.operation_sequence}. {op.operation_name}
                              </div>
                              <div className="text-xs text-gray-500">
                                {op.work_center || 'No work center'}
                              </div>
                            </div>
                            <div className="text-right text-xs">
                              {op.status && (
                                <span className={`${isComplete ? 'text-green-400' : isCurrent ? 'text-purple-400' : 'text-gray-500'}`}>
                                  {op.status}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex-shrink-0 border-t border-white/[0.06] p-4 bg-[#151F2E]">
              <button
                onClick={onClose}
                className="w-full px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg transition-colors text-sm font-medium"
              >
                Close
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
