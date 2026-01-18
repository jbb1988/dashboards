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
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export function RevenueAtRiskSection({ revenueAtRisk }: RevenueAtRiskSectionProps) {
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
    </div>
  );
}
