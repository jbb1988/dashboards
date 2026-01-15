'use client';

import ProfitabilityTrendChart from '@/components/ProfitabilityTrendChart';
import ProfitabilityMatrix from '@/components/ProfitabilityMatrix';

interface AnalyticsTabProps {
  projects: any[];
  monthly: any[];
  types: any[];
}

export default function AnalyticsTab({ projects, monthly, types }: AnalyticsTabProps) {
  // Map projects to matrix format
  const matrixData = projects.map(p => ({
    customer_name: p.project,
    project_type: p.type,
    total_revenue: p.actualRevenue,
    total_cogs: p.actualCost,
    gross_profit: p.actualGP,
    gross_profit_pct: p.actualGPM * 100,
    transaction_count: p.itemCount || (p.workOrders?.length || 0),
  }));

  return (
    <div className="space-y-6">
      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Trend Chart */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Profitability Trend</h3>
          <ProfitabilityTrendChart data={monthly} height={300} />
        </div>

        {/* Matrix Chart */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Project Performance Matrix</h3>
          <ProfitabilityMatrix projects={matrixData} height={300} />
        </div>
      </div>

      {/* Type Breakdown */}
      <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-6">
        <h3 className="text-sm font-semibold text-white mb-4">Revenue by Project Type</h3>
        <div className="space-y-4">
          {types.map((type) => {
            const maxRevenue = Math.max(...types.map(t => t.revenue));
            const barWidth = maxRevenue > 0 ? (type.revenue / maxRevenue) * 100 : 0;
            const gpmColor = type.gpm >= 0.6 ? '#22C55E' : type.gpm >= 0.5 ? '#F59E0B' : '#EF4444';

            return (
              <div key={type.type}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white font-medium">{type.type}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-300">
                      {formatCurrency(type.revenue)}
                    </span>
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ backgroundColor: `${gpmColor}20`, color: gpmColor }}
                    >
                      {formatPercent(type.gpm * 100)}
                    </span>
                  </div>
                </div>
                <div className="h-3 bg-white/[0.08] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${barWidth}%`,
                      background: `linear-gradient(90deg, ${gpmColor}80, ${gpmColor})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Format currency
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Format percent
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}
