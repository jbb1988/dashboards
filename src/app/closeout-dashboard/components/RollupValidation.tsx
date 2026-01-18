'use client';

import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from 'lucide-react';

interface RollupValidationProps {
  productTypeBreakdown: Array<{ type: string; total: number }>;
  lineItemsTotal: number;
  expectedTotal: number;
  variance: number;
  variancePct: number;
  valid: boolean;
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

export default function RollupValidation({
  productTypeBreakdown,
  lineItemsTotal,
  expectedTotal,
  variance,
  variancePct,
  valid,
}: RollupValidationProps) {
  // Determine validation status
  const isExactMatch = Math.abs(variance) < 0.01;
  const isGoodMatch = variancePct < 1; // <1% variance
  const isWarning = variancePct >= 1 && variancePct < 5; // 1-5% variance
  const isError = variancePct >= 5; // >5% variance

  // Visual indicators
  const getStatusIcon = () => {
    if (isExactMatch || isGoodMatch) {
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    } else if (isWarning) {
      return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    } else {
      return <XCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = () => {
    if (isExactMatch || isGoodMatch) return 'text-green-400';
    if (isWarning) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusMessage = () => {
    if (isExactMatch) return 'Exact match - rollup verified';
    if (isGoodMatch) return 'Valid rollup (< 1% variance)';
    if (isWarning) return 'Minor variance detected';
    return 'Significant variance - review data';
  };

  return (
    <div className="mt-4 ml-7 p-4 bg-white/[0.02] rounded-lg border border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 uppercase tracking-wider">Rollup Validation</span>
          {getStatusIcon()}
          <span className={`text-xs font-medium ${getStatusColor()}`}>
            {getStatusMessage()}
          </span>
        </div>
        {!isExactMatch && (
          <div className="text-xs">
            <span className="text-gray-400">Variance: </span>
            <span className={getStatusColor()}>
              {formatCurrency(Math.abs(variance))} ({variancePct.toFixed(2)}%)
            </span>
          </div>
        )}
      </div>

      {/* Rollup Flow Visualization */}
      <div className="flex items-center gap-3 text-xs">
        {/* Product Type Subtotals */}
        <div className="flex-1">
          <div className="text-gray-500 mb-1.5 text-[10px] uppercase tracking-wide">
            Product Type Subtotals
          </div>
          <div className="bg-[#0A0F1E] rounded border border-white/[0.06] p-2 space-y-1">
            {productTypeBreakdown.map((pt, idx) => (
              <div key={idx} className="flex items-center justify-between">
                <span className="text-gray-400">{pt.type}:</span>
                <span className="text-gray-300 font-mono">{formatCurrency(pt.total)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center gap-1 px-2">
          <ArrowRight className="w-4 h-4 text-gray-600" />
          <span className="text-[10px] text-gray-600">sums to</span>
        </div>

        {/* Line Items Total */}
        <div className="flex-shrink-0">
          <div className="text-gray-500 mb-1.5 text-[10px] uppercase tracking-wide">
            Line Items Total
          </div>
          <div className={`
            bg-[#0A0F1E] rounded border p-2 text-center min-w-[120px]
            ${isGoodMatch ? 'border-green-500/30' : isWarning ? 'border-yellow-500/30' : 'border-red-500/30'}
          `}>
            <div className="text-white font-semibold font-mono">
              {formatCurrency(lineItemsTotal)}
            </div>
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center gap-1 px-2">
          <ArrowRight className="w-4 h-4 text-gray-600" />
          <span className="text-[10px] text-gray-600">matches</span>
        </div>

        {/* SO Total */}
        <div className="flex-shrink-0">
          <div className="text-gray-500 mb-1.5 text-[10px] uppercase tracking-wide">
            SO Total
          </div>
          <div className={`
            bg-[#0A0F1E] rounded border p-2 text-center min-w-[120px]
            ${isGoodMatch ? 'border-green-500/30' : isWarning ? 'border-yellow-500/30' : 'border-red-500/30'}
          `}>
            <div className="text-white font-semibold font-mono">
              {formatCurrency(expectedTotal)}
            </div>
          </div>
        </div>

        {/* Validation Result */}
        <div className="flex-shrink-0 pl-2">
          <div className="text-gray-500 mb-1.5 text-[10px] uppercase tracking-wide">
            Status
          </div>
          <div className={`
            rounded-full p-2 flex items-center justify-center
            ${isGoodMatch ? 'bg-green-500/10' : isWarning ? 'bg-yellow-500/10' : 'bg-red-500/10'}
          `}>
            {getStatusIcon()}
          </div>
        </div>
      </div>

      {/* Warning/Error Messages */}
      {isWarning && (
        <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded text-xs text-yellow-400">
          <strong>Note:</strong> Minor rounding differences detected. Verify pricing or quantity precision if concerned.
        </div>
      )}
      {isError && (
        <div className="mt-3 p-2 bg-red-500/10 border border-red-500/20 rounded text-xs text-red-400">
          <strong>Warning:</strong> Significant variance detected. This may indicate data quality issues or missing line items.
          Please review the NetSuite sales order data.
        </div>
      )}
    </div>
  );
}
