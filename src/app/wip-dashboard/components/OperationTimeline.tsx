'use client';

import { motion } from 'framer-motion';
import { Check, Clock, CircleDot, AlertCircle } from 'lucide-react';

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

interface OperationTimelineProps {
  operations: WorkOrderOperation[];
}

type OperationStatus = 'complete' | 'in_progress' | 'pending' | 'blocked';

function getOperationStatus(status: string): OperationStatus {
  const statusLower = status.toLowerCase();
  if (statusLower.includes('complete') || statusLower === 'complete') {
    return 'complete';
  }
  if (statusLower.includes('progress') || statusLower === 'in_progress' || statusLower === 'inprogress') {
    return 'in_progress';
  }
  if (statusLower.includes('block') || statusLower.includes('hold')) {
    return 'blocked';
  }
  return 'pending';
}

function getStatusIcon(status: OperationStatus) {
  switch (status) {
    case 'complete':
      return <Check className="w-4 h-4" />;
    case 'in_progress':
      return <Clock className="w-4 h-4" />;
    case 'blocked':
      return <AlertCircle className="w-4 h-4" />;
    default:
      return <CircleDot className="w-3 h-3" />;
  }
}

function getStatusStyles(status: OperationStatus): { bg: string; border: string; text: string; icon: string } {
  switch (status) {
    case 'complete':
      return {
        bg: 'bg-green-500/20',
        border: 'border-green-500/50',
        text: 'text-green-400',
        icon: 'text-green-400',
      };
    case 'in_progress':
      return {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/50',
        text: 'text-blue-400',
        icon: 'text-blue-400',
      };
    case 'blocked':
      return {
        bg: 'bg-red-500/20',
        border: 'border-red-500/50',
        text: 'text-red-400',
        icon: 'text-red-400',
      };
    default:
      return {
        bg: 'bg-gray-500/10',
        border: 'border-gray-500/30',
        text: 'text-gray-500',
        icon: 'text-gray-500',
      };
  }
}

function calculateDaysInOperation(startDate: string | null, endDate: string | null, status: OperationStatus): number | null {
  if (!startDate) return null;

  const start = new Date(startDate);
  const end = endDate && status === 'complete' ? new Date(endDate) : new Date();

  return Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export default function OperationTimeline({ operations }: OperationTimelineProps) {
  // Sort operations by sequence
  const sortedOps = [...operations].sort((a, b) => a.operation_sequence - b.operation_sequence);

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Operation Details
      </div>

      {/* Timeline */}
      <div className="relative">
        {sortedOps.map((op, index) => {
          const status = getOperationStatus(op.status);
          const styles = getStatusStyles(status);
          const days = calculateDaysInOperation(op.start_date, op.end_date, status);
          const isLast = index === sortedOps.length - 1;

          return (
            <motion.div
              key={`${op.operation_sequence}-${index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-4 relative"
            >
              {/* Vertical Line (connector) */}
              {!isLast && (
                <div
                  className={`absolute left-[15px] top-[28px] w-[2px] h-[calc(100%-12px)] ${
                    status === 'complete' ? 'bg-green-500/40' : 'bg-gray-700'
                  }`}
                />
              )}

              {/* Status Indicator */}
              <div
                className={`
                  relative z-10 flex items-center justify-center w-8 h-8 rounded-full
                  ${styles.bg} ${styles.border} border
                `}
              >
                <span className={styles.icon}>
                  {getStatusIcon(status)}
                </span>
              </div>

              {/* Operation Details */}
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-3">
                  {/* Operation Name */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-500">
                      Op {op.operation_sequence}:
                    </span>
                    <span className={`text-sm font-medium ${styles.text}`}>
                      {op.operation_name}
                    </span>
                  </div>

                  {/* Status Badge */}
                  <span className={`px-2 py-0.5 rounded text-xs ${styles.bg} ${styles.text}`}>
                    {op.status}
                  </span>

                  {/* Days */}
                  {days !== null && status !== 'pending' && (
                    <span className={`text-xs ${
                      status === 'in_progress' && days > 7 ? 'text-amber-400' :
                      status === 'in_progress' && days > 3 ? 'text-yellow-500' :
                      'text-gray-500'
                    }`}>
                      {days}d
                    </span>
                  )}
                </div>

                {/* Additional Info Row */}
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                  {/* Work Center */}
                  {op.work_center && (
                    <span>Work Center: {op.work_center}</span>
                  )}

                  {/* Dates */}
                  {op.start_date && (
                    <span>
                      Started: {op.start_date}
                      {op.end_date && status === 'complete' && ` - Completed: ${op.end_date}`}
                    </span>
                  )}

                  {/* Quantity */}
                  {op.input_quantity !== null && (
                    <span>
                      Qty: {op.completed_quantity || 0} / {op.input_quantity}
                    </span>
                  )}

                  {/* Time */}
                  {op.estimated_time !== null && (
                    <span>
                      Est: {op.estimated_time}h
                      {op.actual_time !== null && ` / Actual: ${op.actual_time}h`}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      {sortedOps.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/[0.06] flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500/20 border border-green-500/50" />
            <span className="text-xs text-gray-500">
              {sortedOps.filter(op => getOperationStatus(op.status) === 'complete').length} Complete
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500/50" />
            <span className="text-xs text-gray-500">
              {sortedOps.filter(op => getOperationStatus(op.status) === 'in_progress').length} In Progress
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500/10 border border-gray-500/30" />
            <span className="text-xs text-gray-500">
              {sortedOps.filter(op => getOperationStatus(op.status) === 'pending').length} Pending
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
