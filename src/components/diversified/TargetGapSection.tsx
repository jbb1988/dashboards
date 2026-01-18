'use client';

interface TargetGapSectionProps {
  gapAnalysis: {
    current_run_rate: number;
    target_annual_revenue: number;
    net_gap: number;
    gap_coverage: {
      from_saves: number;
      from_quick_wins: number;
      from_growth: number;
      total_potential: number;
      coverage_pct: number;
    };
  };
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function TargetGapSection({ gapAnalysis }: TargetGapSectionProps) {
  const {
    current_run_rate,
    target_annual_revenue,
    net_gap,
    gap_coverage,
  } = gapAnalysis;

  // Calculate percentages for visualization
  const totalHeight = 300; // pixels
  const currentPct = (current_run_rate / target_annual_revenue) * 100;
  const gapPct = (net_gap / target_annual_revenue) * 100;

  const savesPct = (gap_coverage.from_saves / net_gap) * 100;
  const quickWinsPct = (gap_coverage.from_quick_wins / net_gap) * 100;
  const growthPct = (gap_coverage.from_growth / net_gap) * 100;

  return (
    <div className="space-y-4">
      <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
        <span className="text-[20px]">🎯</span>
        Target Gap Analysis
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Waterfall Chart */}
        <div className="bg-[#1E293B] border border-white/[0.04] rounded-xl p-6">
          <h4 className="text-[14px] font-semibold text-white mb-4">Revenue Waterfall</h4>

          <div className="flex items-end justify-between h-[300px] gap-4">
            {/* Current Run Rate */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-[#38BDF8]/20 border-2 border-[#38BDF8] rounded-t-lg flex items-end justify-center pb-2"
                style={{ height: `${currentPct}%` }}
              >
                <span className="text-[11px] font-semibold text-[#38BDF8]">
                  {formatCurrency(current_run_rate)}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8] text-center mt-2">Current</div>
            </div>

            {/* Saves */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-[#22C55E]/20 border-2 border-[#22C55E] rounded-t-lg flex items-end justify-center pb-2"
                style={{ height: `${savesPct}%` }}
              >
                <span className="text-[11px] font-semibold text-[#22C55E]">
                  +{formatCurrency(gap_coverage.from_saves)}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8] text-center mt-2">Saves</div>
            </div>

            {/* Quick Wins */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-[#F59E0B]/20 border-2 border-[#F59E0B] rounded-t-lg flex items-end justify-center pb-2"
                style={{ height: `${quickWinsPct}%` }}
              >
                <span className="text-[11px] font-semibold text-[#F59E0B]">
                  +{formatCurrency(gap_coverage.from_quick_wins)}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8] text-center mt-2">Quick Wins</div>
            </div>

            {/* Growth */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-[#A855F7]/20 border-2 border-[#A855F7] rounded-t-lg flex items-end justify-center pb-2"
                style={{ height: `${growthPct}%` }}
              >
                <span className="text-[11px] font-semibold text-[#A855F7]">
                  +{formatCurrency(gap_coverage.from_growth)}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8] text-center mt-2">Growth</div>
            </div>

            {/* Target */}
            <div className="flex-1 flex flex-col items-center justify-end">
              <div
                className="w-full bg-white/[0.04] border-2 border-dashed border-white/20 rounded-t-lg flex items-end justify-center pb-2"
                style={{ height: '100%' }}
              >
                <span className="text-[11px] font-semibold text-white">
                  {formatCurrency(target_annual_revenue)}
                </span>
              </div>
              <div className="text-[11px] text-[#94A3B8] text-center mt-2">Target</div>
            </div>
          </div>
        </div>

        {/* Gap Coverage Stats */}
        <div className="space-y-4">
          <div className="bg-[#1E293B] border border-white/[0.04] rounded-xl p-6">
            <h4 className="text-[14px] font-semibold text-white mb-4">Gap Coverage</h4>

            <div className="space-y-4">
              {/* Net Gap */}
              <div className="flex justify-between items-center pb-3 border-b border-white/[0.04]">
                <span className="text-[13px] text-[#94A3B8]">Net Gap to Target</span>
                <span className="text-[18px] font-bold text-white">{formatCurrency(net_gap)}</span>
              </div>

              {/* Coverage Breakdown */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#94A3B8]">From Saves</span>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-[#22C55E]">
                      {formatCurrency(gap_coverage.from_saves)}
                    </div>
                    <div className="text-[11px] text-[#64748B]">{savesPct.toFixed(0)}% of gap</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#94A3B8]">From Quick Wins</span>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-[#F59E0B]">
                      {formatCurrency(gap_coverage.from_quick_wins)}
                    </div>
                    <div className="text-[11px] text-[#64748B]">{quickWinsPct.toFixed(0)}% of gap</div>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-[13px] text-[#94A3B8]">From Growth</span>
                  <div className="text-right">
                    <div className="text-[14px] font-semibold text-[#A855F7]">
                      {formatCurrency(gap_coverage.from_growth)}
                    </div>
                    <div className="text-[11px] text-[#64748B]">{growthPct.toFixed(0)}% of gap</div>
                  </div>
                </div>
              </div>

              {/* Total Coverage */}
              <div className="pt-3 border-t border-white/[0.04]">
                <div className="flex justify-between items-center">
                  <span className="text-[14px] font-semibold text-white">Total Coverage</span>
                  <div className="text-right">
                    <div className={`text-[18px] font-bold ${gap_coverage.coverage_pct >= 100 ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
                      {gap_coverage.coverage_pct.toFixed(0)}%
                    </div>
                    <div className="text-[11px] text-[#64748B]">
                      {formatCurrency(gap_coverage.total_potential)} potential
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-[#0F172A] rounded-full overflow-hidden">
                  <div
                    className={`h-full ${gap_coverage.coverage_pct >= 100 ? 'bg-[#22C55E]' : 'bg-[#F59E0B]'} transition-all`}
                    style={{ width: `${Math.min(100, gap_coverage.coverage_pct)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Gap Status Message */}
          <div
            className={`p-4 rounded-xl border ${
              gap_coverage.coverage_pct >= 100
                ? 'bg-[#22C55E]/10 border-[#22C55E]/30 text-[#22C55E]'
                : gap_coverage.coverage_pct >= 75
                ? 'bg-[#F59E0B]/10 border-[#F59E0B]/30 text-[#F59E0B]'
                : 'bg-[#EF4444]/10 border-[#EF4444]/30 text-[#EF4444]'
            }`}
          >
            <div className="text-[13px] font-medium">
              {gap_coverage.coverage_pct >= 100
                ? '✅ On track to exceed target'
                : gap_coverage.coverage_pct >= 75
                ? '⚠️ On track but close - execute flawlessly'
                : '🚨 Gap too large - need additional initiatives'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
