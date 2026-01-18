'use client';

import type { ROIQuadrant } from '@/lib/roi-calculation';

interface ROIPriorityChartProps {
  quadrants: ROIQuadrant[];
}

export function ROIPriorityChart({ quadrants }: ROIPriorityChartProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
        <span className="text-[20px]">📊</span>
        ROI Priority Matrix
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {quadrants.map((quadrant) => {
          const color = getQuadrantColor(quadrant.name);

          return (
            <div
              key={quadrant.name}
              className={`bg-[#1E293B] border ${color.border} rounded-xl p-4`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h4 className={`text-[14px] font-semibold ${color.text}`}>{quadrant.name}</h4>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">{quadrant.description}</p>
                </div>
                <div className={`px-2 py-1 ${color.bg} ${color.text} rounded text-[12px] font-bold`}>
                  {quadrant.actions.length}
                </div>
              </div>

              {/* Top 3 actions in quadrant */}
              <div className="space-y-2">
                {quadrant.actions.slice(0, 3).map((action, idx) => {
                  const value = action.expected_recovery || action.cross_sell_potential || 0;
                  return (
                    <div
                      key={action.id}
                      className="bg-[#0F172A] p-2.5 rounded-lg border border-white/[0.04] hover:border-white/[0.1] transition-colors"
                    >
                      <div className="text-[12px] font-medium text-white truncate">{action.customer_name}</div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-[#94A3B8]">{action.speed_to_impact_days}d</span>
                        <span className="text-[12px] font-semibold text-[#22C55E]">
                          ${value >= 1000 ? `${(value / 1000).toFixed(0)}K` : value.toFixed(0)}
                        </span>
                      </div>
                    </div>
                  );
                })}
                {quadrant.actions.length === 0 && (
                  <div className="text-[12px] text-[#64748B] text-center py-4">No actions in this quadrant</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getQuadrantColor(name: string) {
  switch (name) {
    case 'Do First':
      return {
        border: 'border-[#EF4444]/30',
        bg: 'bg-[#EF4444]/10',
        text: 'text-[#EF4444]',
      };
    case 'Quick Wins':
      return {
        border: 'border-[#22C55E]/30',
        bg: 'bg-[#22C55E]/10',
        text: 'text-[#22C55E]',
      };
    case 'Big Bets':
      return {
        border: 'border-[#F59E0B]/30',
        bg: 'bg-[#F59E0B]/10',
        text: 'text-[#F59E0B]',
      };
    case 'Defer':
      return {
        border: 'border-[#64748B]/30',
        bg: 'bg-[#64748B]/10',
        text: 'text-[#64748B]',
      };
    default:
      return {
        border: 'border-white/[0.04]',
        bg: 'bg-white/[0.02]',
        text: 'text-white',
      };
  }
}
