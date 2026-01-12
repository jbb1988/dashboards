'use client';

import { useMemo } from 'react';
import { ChartContainer, formatChartCurrency } from './ChartContainer';

interface ConcentrationMetrics {
  hhi_index: number;
  hhi_interpretation: 'diversified' | 'moderate' | 'concentrated';
  top_customer_pct: number;
  top_customer_name: string;
  top_3_concentration: number;
  top_3_names: string[];
  customers_for_80_pct: number;
  total_customers: number;
  total_revenue: number;
  single_customer_risk?: boolean;
  segments: {
    tier: 'platinum' | 'gold' | 'silver' | 'bronze';
    customer_count: number;
    total_revenue: number;
    pct_of_total: number;
    threshold_description: string;
    customers?: Array<{ name: string; revenue: number; pct: number; top_classes?: string[] }>;
  }[];
}

interface ConcentrationChartProps {
  data: ConcentrationMetrics;
  index?: number;
  onCustomerClick?: (customerId: string, customerName: string) => void;
}

export function ConcentrationChart({ data, index = 0, onCustomerClick }: ConcentrationChartProps) {
  // Calculate key dollar figures
  const topCustomerRevenue = Math.round(data.total_revenue * data.top_customer_pct / 100);
  const isHighRisk = data.top_customer_pct > 25 || data.single_customer_risk;
  const isModerateRisk = data.top_customer_pct > 15;

  // Get top customer's product classes (what's at risk)
  const topCustomerClasses = useMemo(() => {
    const platinumSegment = data.segments.find(s => s.tier === 'platinum');
    const topCustomer = platinumSegment?.customers?.find(c => c.name === data.top_customer_name);
    return topCustomer?.top_classes || [];
  }, [data.segments, data.top_customer_name]);

  // Find growth targets (Gold + Silver tier customers)
  const growthTargets = useMemo(() => {
    const goldSegment = data.segments.find(s => s.tier === 'gold');
    const silverSegment = data.segments.find(s => s.tier === 'silver');
    const targets: Array<{ name: string; revenue: number; growthTarget: number; newPct: number; topClasses: string[] }> = [];

    // Silver customers - highest growth potential
    if (silverSegment?.customers) {
      silverSegment.customers.slice(0, 3).forEach(c => {
        const growthTarget = Math.round(c.revenue * 0.5); // 50% growth = realistic
        const newRevenue = c.revenue + growthTarget;
        const newPct = (newRevenue / (data.total_revenue + growthTarget)) * 100;
        targets.push({ name: c.name, revenue: c.revenue, growthTarget, newPct, topClasses: c.top_classes || [] });
      });
    }

    // Gold customers - moderate growth
    if (goldSegment?.customers) {
      goldSegment.customers.slice(0, 2).forEach(c => {
        const growthTarget = Math.round(c.revenue * 0.25); // 25% growth
        const newRevenue = c.revenue + growthTarget;
        const newPct = (newRevenue / (data.total_revenue + growthTarget)) * 100;
        targets.push({ name: c.name, revenue: c.revenue, growthTarget, newPct, topClasses: c.top_classes || [] });
      });
    }

    return targets.sort((a, b) => b.growthTarget - a.growthTarget).slice(0, 4);
  }, [data.segments, data.total_revenue]);

  const totalGrowthTarget = growthTargets.reduce((sum, t) => sum + t.growthTarget, 0);

  // Calculate new concentration if targets achieved
  const newTotalRevenue = data.total_revenue + totalGrowthTarget;
  const newTopPct = (topCustomerRevenue / newTotalRevenue) * 100;
  const concentrationReduction = data.top_customer_pct - newTopPct;

  return (
    <ChartContainer
      title="Revenue Risk & Opportunity"
      subtitle={`${data.total_customers} customers • ${formatChartCurrency(data.total_revenue)} total`}
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
      index={index}
      height={380}
    >
      <div className="space-y-4">
        {/* THE RISK - What you could lose */}
        <div className={`rounded-xl p-4 ${
          isHighRisk ? 'bg-gradient-to-r from-red-500/20 to-red-500/5 border border-red-500/30' :
          isModerateRisk ? 'bg-gradient-to-r from-amber-500/15 to-amber-500/5 border border-amber-500/25' :
          'bg-gradient-to-r from-green-500/15 to-green-500/5 border border-green-500/25'
        }`}>
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${
                isHighRisk ? 'text-red-400' : isModerateRisk ? 'text-amber-400' : 'text-green-400'
              }`}>
                {isHighRisk ? '⚠️ HIGH RISK' : isModerateRisk ? '⚡ WATCH' : '✓ HEALTHY'}
              </span>
            </div>
            <div className={`text-3xl font-bold ${
              isHighRisk ? 'text-red-400' : isModerateRisk ? 'text-amber-400' : 'text-green-400'
            }`}>
              {data.top_customer_pct.toFixed(0)}%
            </div>
          </div>

          <div className="mb-3">
            <div
              className="text-white font-semibold text-[14px] hover:text-cyan-400 cursor-pointer transition-colors truncate"
              title={data.top_customer_name}
              onClick={() => onCustomerClick?.(data.top_customer_name, data.top_customer_name)}
            >
              {data.top_customer_name}
            </div>
            <div className="text-[#94A3B8] text-[12px]">
              = <span className="text-white font-bold">{formatChartCurrency(topCustomerRevenue)}</span> of your revenue
            </div>
            {/* What they buy - revenue at risk by product */}
            {topCustomerClasses.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="text-[9px] text-[#64748B] mr-1">Buys:</span>
                {topCustomerClasses.slice(0, 3).map((cls, i) => (
                  <span
                    key={i}
                    className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.08] text-white/80"
                    title={cls}
                  >
                    {cls.length > 18 ? cls.slice(0, 16) + '...' : cls}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className={`text-[12px] p-2 rounded-lg ${
            isHighRisk ? 'bg-red-500/10' : 'bg-white/5'
          }`}>
            {isHighRisk ? (
              <span className="text-red-300">
                <strong>Board concern:</strong> Losing this customer wipes out {data.top_customer_pct.toFixed(0)}% of revenue overnight.
              </span>
            ) : isModerateRisk ? (
              <span className="text-amber-300">
                <strong>Watch:</strong> Getting close to single-customer dependency. Target: &lt;15%
              </span>
            ) : (
              <span className="text-green-300">
                <strong>Good:</strong> No single customer dominates. Revenue is diversified.
              </span>
            )}
          </div>
        </div>

        {/* THE SOLUTION - What to do about it */}
        <div className="rounded-xl p-4 bg-gradient-to-r from-cyan-500/10 to-transparent border border-cyan-500/20">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
              📈 GROWTH ACTION PLAN
            </div>
            {totalGrowthTarget > 0 && (
              <div className="text-right">
                <div className="text-green-400 font-bold text-lg">+{formatChartCurrency(totalGrowthTarget)}</div>
                <div className="text-[10px] text-[#64748B]">potential revenue</div>
              </div>
            )}
          </div>

          {growthTargets.length > 0 ? (
            <>
              <div className="space-y-2 mb-3">
                {growthTargets.map((target, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer transition-all group"
                    onClick={() => onCustomerClick?.(target.name, target.name)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-white text-[12px] font-medium truncate group-hover:text-cyan-400" title={target.name}>
                            {target.name}
                          </div>
                          <div className="text-[10px] text-[#64748B]">
                            {formatChartCurrency(target.revenue)} → <span className="text-green-400">{formatChartCurrency(target.revenue + target.growthTarget)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-green-400 text-[11px] font-semibold shrink-0">
                        +{formatChartCurrency(target.growthTarget)}
                      </div>
                    </div>
                    {/* What they buy - actionable context */}
                    {target.topClasses.length > 0 && (
                      <div className="mt-1.5 ml-7 flex flex-wrap gap-1">
                        {target.topClasses.slice(0, 3).map((cls, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.06] text-[#94A3B8]"
                            title={cls}
                          >
                            {cls.length > 20 ? cls.slice(0, 18) + '...' : cls}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Impact projection */}
              {isHighRisk && concentrationReduction > 0 && (
                <div className="p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div className="text-[11px] text-green-300">
                    <strong>Impact:</strong> Growing these accounts reduces top customer dependency
                    from <span className="text-red-400">{data.top_customer_pct.toFixed(0)}%</span> →
                    <span className="text-green-400"> {newTopPct.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-4 text-[#64748B]">
              <p className="text-[12px]">Customer tier data needed for growth targets</p>
            </div>
          )}
        </div>

        {/* Quick Stats Footer */}
        <div className="flex justify-between text-[10px] px-1">
          <div className="text-[#64748B]">
            Top 3: <span className={`font-bold ${data.top_3_concentration > 50 ? 'text-red-400' : 'text-white'}`}>
              {data.top_3_concentration.toFixed(0)}%
            </span>
          </div>
          <div className="text-[#64748B]">
            80% from: <span className="font-bold text-cyan-400">{data.customers_for_80_pct}</span> customers
          </div>
        </div>
      </div>
    </ChartContainer>
  );
}
