/**
 * StatusBadge Component
 * Visual status indicators for project cards
 */

import { AlertTriangle, TrendingUp, Clock } from 'lucide-react';

interface StatusBadgeProps {
  isAtRisk?: boolean;
  isHighValue?: boolean;
  isRecent?: boolean;
}

export function StatusBadge({ isAtRisk, isHighValue, isRecent }: StatusBadgeProps) {
  if (isAtRisk) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded">
        <AlertTriangle className="w-3 h-3 text-red-400" />
        <span className="text-xs font-medium text-red-400">At Risk</span>
      </div>
    );
  }

  if (isHighValue) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/20 rounded">
        <TrendingUp className="w-3 h-3 text-green-400" />
        <span className="text-xs font-medium text-green-400">High Value</span>
      </div>
    );
  }

  if (isRecent) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/10 border border-blue-500/20 rounded">
        <Clock className="w-3 h-3 text-blue-400" />
        <span className="text-xs font-medium text-blue-400">Recent</span>
      </div>
    );
  }

  return null;
}
