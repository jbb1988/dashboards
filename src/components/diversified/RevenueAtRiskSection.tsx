'use client';

import { KPICard } from '@/components/mars-ui';

interface RevenueAtRiskSectionProps {
  revenueAtRisk: {
    bucket_30d: {
      total_revenue: number;
      customer_count: number;
      customers: Array<{
        customer_name: string;
        revenue_at_risk: number;
        days_inactive: number;
        segment: string;
      }>;
    };
    bucket_60d: {
      total_revenue: number;
      customer_count: number;
      customers: Array<{
        customer_name: string;
        revenue_at_risk: number;
        days_inactive: number;
        segment: string;
      }>;
    };
    bucket_90d: {
      total_revenue: number;
      customer_count: number;
      customers: Array<{
        customer_name: string;
        revenue_at_risk: number;
        days_inactive: number;
        segment: string;
      }>;
    };
  };
  top3Accounts: Array<{
    customer_name: string;
    revenue_at_risk: number;
    days_inactive: number;
    attrition_score: number;
  }>;
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function RevenueAtRiskSection({ revenueAtRisk, top3Accounts }: RevenueAtRiskSectionProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
        <span className="text-[20px]">💰</span>
        Revenue at Risk
      </h3>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* 30-Day Bucket - Critical */}
        <KPICard
          title="30-Day Bucket"
          value={formatCurrency(revenueAtRisk.bucket_30d.total_revenue)}
          subtitle={`${revenueAtRisk.bucket_30d.customer_count} customers - ACT NOW`}
          icon="⚠️"
          color="#EF4444"
        />

        {/* 60-Day Bucket - Plan */}
        <KPICard
          title="60-Day Bucket"
          value={formatCurrency(revenueAtRisk.bucket_60d.total_revenue)}
          subtitle={`${revenueAtRisk.bucket_60d.customer_count} customers - PLAN`}
          icon="📋"
          color="#F59E0B"
        />

        {/* 90-Day Bucket - Monitor */}
        <KPICard
          title="90-Day Bucket"
          value={formatCurrency(revenueAtRisk.bucket_90d.total_revenue)}
          subtitle={`${revenueAtRisk.bucket_90d.customer_count} customers - MONITOR`}
          icon="👀"
          color="#38BDF8"
        />
      </div>

      {/* Top 3 Accounts at Risk */}
      {top3Accounts.length > 0 && (
        <div className="bg-[#1E293B] border border-white/[0.04] rounded-xl p-4">
          <h4 className="text-[14px] font-semibold text-white mb-3">Top 3 Accounts Driving Loss</h4>
          <div className="space-y-2">
            {top3Accounts.map((account, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3 bg-[#0F172A] rounded-lg border border-white/[0.04] hover:border-[#38BDF8]/30 transition-colors"
              >
                <div className="flex-1">
                  <div className="text-[14px] font-medium text-white">{account.customer_name}</div>
                  <div className="text-[12px] text-[#94A3B8] mt-0.5">
                    {account.days_inactive} days inactive • Score: {account.attrition_score}
                  </div>
                </div>
                <div className="text-[16px] font-bold text-[#EF4444]">
                  {formatCurrency(account.revenue_at_risk)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
