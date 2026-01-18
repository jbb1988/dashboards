'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { RevenueAtRiskSection } from './RevenueAtRiskSection';
import { RequiredActionsTable } from './RequiredActionsTable';
import { StrategicBucketsGrid } from './StrategicBucketsGrid';
import type { ActionItem } from '@/lib/action-classification';
import type { StrategicBucketSummary } from '@/lib/strategic-buckets';

// ============================================
// TYPES
// ============================================

interface ActionCommandData {
  summary: {
    total_revenue_at_risk: number;
    total_cross_sell_potential: number;
    total_actions: number;
    actions_by_time_bucket: {
      bucket_30d: number;
      bucket_60d: number;
      bucket_90d: number;
    };
    top_3_accounts_at_risk: Array<{
      customer_name: string;
      revenue_at_risk: number;
      days_inactive: number;
      attrition_score: number;
    }>;
  };

  revenue_at_risk: {
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

  required_actions: ActionItem[];
  strategic_buckets: StrategicBucketSummary[];

  generated_at: string;
}

interface ActionCommandCenterProps {
  filters?: {
    years: number[];
    months: number[];
  };
}

// ============================================
// MAIN COMPONENT
// ============================================

export function ActionCommandCenter({ filters }: ActionCommandCenterProps) {
  const [data, setData] = useState<ActionCommandData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch action command data
  useEffect(() => {
    fetchData();
  }, [filters]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Build query params from filters
      const params = new URLSearchParams();
      if (filters?.years && filters.years.length > 0) {
        params.set('years', filters.years.join(','));
      }
      if (filters?.months && filters.months.length > 0) {
        params.set('months', filters.months.join(','));
      }

      const url = `/api/diversified/action-command${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch action command data');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-300px)]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#38BDF8]/20 border-t-[#38BDF8] rounded-full animate-spin" />
          <div className="text-[14px] text-[#94A3B8]">Loading 30-Day Action Command Center...</div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-300px)]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="text-[48px]">⚠️</div>
          <div className="text-[16px] text-white font-medium">Failed to load action command data</div>
          <div className="text-[14px] text-[#94A3B8]">{error || 'Unknown error'}</div>
          <button
            onClick={fetchData}
            className="px-4 py-2 bg-[#38BDF8] text-white rounded-lg hover:bg-[#38BDF8]/80 transition-colors text-[14px] font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 pb-8"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[20px] font-bold text-white mb-1">30-Day Action Command Center</h2>
          <p className="text-[13px] text-[#94A3B8]">
            Instant answers: How much $ is at risk? What are we doing this week? Who owns it? When does it close?
          </p>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-[#1E293B] border border-white/[0.04] text-[#94A3B8] hover:text-white hover:bg-[#334155] rounded-lg text-[13px] font-medium transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* 1. Revenue at Risk Section (30/60/90 day buckets) */}
      <RevenueAtRiskSection
        revenueAtRisk={data.revenue_at_risk}
      />

      {/* 2. Required Actions Table */}
      <RequiredActionsTable
        actions={data.required_actions}
        onRefresh={fetchData}
      />

      {/* 3. Strategic Buckets Grid */}
      <StrategicBucketsGrid
        buckets={data.strategic_buckets}
      />

      {/* Footer */}
      <div className="text-center text-[12px] text-[#64748B] pt-4">
        Last updated: {new Date(data.generated_at).toLocaleString()}
      </div>
    </motion.div>
  );
}
