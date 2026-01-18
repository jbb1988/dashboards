'use client';

import { CheckCircle2, Circle, AlertCircle } from 'lucide-react';

interface WOLineItem {
  lineNumber: number;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  quantityCompleted: number;
  unitCost: number;
  lineCost: number;
  costEstimate: number;
  actualCost: number | null;
  isClosed: boolean;
  completionPct: number;
}

interface WorkOrderCostBreakdownProps {
  lineItems: WOLineItem[];
  totals: {
    lineItemCount: number;
    totalEstimatedCost: number;
    totalActualCost: number | null;
    totalCost: number;
  };
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

export default function WorkOrderCostBreakdown({
  lineItems,
  totals,
}: WorkOrderCostBreakdownProps) {
  const hasActualCosts = totals.totalActualCost !== null && totals.totalActualCost > 0;

  return (
    <div className="mt-3 ml-7">
      <div className="bg-[#0A0F1E] rounded-lg border border-white/[0.06] overflow-hidden">
        {/* Header - Cost Type Indicator */}
        <div className="bg-white/[0.02] border-b border-white/[0.06] px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Cost Breakdown</span>
            {hasActualCosts ? (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                Actual Costs Available
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                Estimated Costs
              </span>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {totals.lineItemCount} {totals.lineItemCount === 1 ? 'component' : 'components'}
          </div>
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead className="bg-white/[0.02] border-b border-white/[0.06]">
            <tr>
              <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">#</th>
              <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Status</th>
              <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Component</th>
              <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Description</th>
              <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Qty</th>
              <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Completed</th>
              <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Unit Cost</th>
              <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Est. Cost</th>
              {hasActualCosts && (
                <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Actual Cost</th>
              )}
              <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Line Cost</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((line) => {
              const isComplete = line.isClosed || line.completionPct >= 100;
              const isPartial = !isComplete && line.completionPct > 0;
              const isNotStarted = line.completionPct === 0;

              return (
                <tr
                  key={line.lineNumber}
                  className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors"
                >
                  <td className="py-2 px-3 text-gray-400 text-xs">{line.lineNumber}</td>

                  {/* Status Indicator */}
                  <td className="py-2 px-3">
                    <div className="flex items-center gap-1.5">
                      {isComplete ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-xs text-green-400">Done</span>
                        </>
                      ) : isPartial ? (
                        <>
                          <AlertCircle className="w-4 h-4 text-yellow-400" />
                          <span className="text-xs text-yellow-400">{formatPercent(line.completionPct)}</span>
                        </>
                      ) : (
                        <>
                          <Circle className="w-4 h-4 text-gray-500" />
                          <span className="text-xs text-gray-500">Pending</span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Component */}
                  <td className="py-2 px-3">
                    <div className="text-gray-300 font-mono text-xs">{line.itemName || line.itemId}</div>
                    {line.itemType && (
                      <div className="text-[10px] text-gray-500 mt-0.5">{line.itemType}</div>
                    )}
                  </td>

                  {/* Description */}
                  <td className="py-2 px-3 text-gray-400 text-xs max-w-xs truncate">
                    {line.itemDescription || '-'}
                  </td>

                  {/* Quantity */}
                  <td className="py-2 px-3 text-right text-gray-300 text-xs">
                    {line.quantity.toFixed(0)}
                  </td>

                  {/* Completed Quantity */}
                  <td className="py-2 px-3 text-right text-xs">
                    <span className={isComplete ? 'text-green-400' : isPartial ? 'text-yellow-400' : 'text-gray-500'}>
                      {line.quantityCompleted.toFixed(0)}
                    </span>
                    <span className="text-gray-500 ml-1">/ {line.quantity.toFixed(0)}</span>
                  </td>

                  {/* Unit Cost */}
                  <td className="py-2 px-3 text-right text-gray-400 text-xs">
                    {formatCurrency(line.unitCost)}
                  </td>

                  {/* Estimated Cost */}
                  <td className="py-2 px-3 text-right text-gray-300 text-xs">
                    {formatCurrency(line.costEstimate)}
                  </td>

                  {/* Actual Cost (if available) */}
                  {hasActualCosts && (
                    <td className="py-2 px-3 text-right text-xs">
                      {line.actualCost !== null && line.actualCost > 0 ? (
                        <span className="text-white font-medium">{formatCurrency(line.actualCost)}</span>
                      ) : (
                        <span className="text-gray-500">-</span>
                      )}
                    </td>
                  )}

                  {/* Line Cost (Total) */}
                  <td className="py-2 px-3 text-right text-white text-xs font-medium">
                    {formatCurrency(line.lineCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Totals Footer */}
          <tfoot className="bg-white/[0.04] border-t-2 border-white/[0.10]">
            <tr className="font-semibold">
              <td colSpan={hasActualCosts ? 7 : 6} className="py-2 px-3 text-xs text-gray-400">
                Work Order Total ({totals.lineItemCount} components)
              </td>
              <td className="py-2 px-3 text-right text-sm">
                <div className="text-gray-400 text-[10px] mb-0.5">Estimated</div>
                <div className="text-gray-300">{formatCurrency(totals.totalEstimatedCost)}</div>
              </td>
              {hasActualCosts && (
                <td className="py-2 px-3 text-right text-sm">
                  <div className="text-gray-400 text-[10px] mb-0.5">Actual</div>
                  <div className="text-white">{formatCurrency(totals.totalActualCost || 0)}</div>
                </td>
              )}
              <td className="py-2 px-3 text-right text-sm">
                <div className="text-gray-400 text-[10px] mb-0.5">Total Cost</div>
                <div className="text-white font-bold">{formatCurrency(totals.totalCost)}</div>
              </td>
            </tr>

            {/* Variance row if actual costs available */}
            {hasActualCosts && totals.totalActualCost !== null && (
              <tr className="border-t border-white/[0.06]">
                <td colSpan={hasActualCosts ? 8 : 7} className="py-2 px-3 text-right text-xs">
                  <span className="text-gray-400 mr-2">Variance (Actual vs Estimated):</span>
                  <span className={
                    totals.totalActualCost <= totals.totalEstimatedCost
                      ? 'text-green-400'
                      : 'text-red-400'
                  }>
                    {formatCurrency(totals.totalActualCost - totals.totalEstimatedCost)}
                    {' '}
                    ({totals.totalEstimatedCost > 0
                      ? formatPercent(((totals.totalActualCost - totals.totalEstimatedCost) / totals.totalEstimatedCost) * 100)
                      : '0%'
                    })
                  </span>
                </td>
                <td></td>
              </tr>
            )}
          </tfoot>
        </table>
      </div>
    </div>
  );
}
