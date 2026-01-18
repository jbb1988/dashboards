'use client';

import type { StrategicBucketSummary } from '@/lib/strategic-buckets';
import { getBucketColor, getBucketIcon } from '@/lib/strategic-buckets';

interface StrategicBucketsGridProps {
  buckets: StrategicBucketSummary[];
}

export function StrategicBucketsGrid({ buckets }: StrategicBucketsGridProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
        <span className="text-[20px]">🎯</span>
        Strategic Buckets
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {buckets.map((bucket) => {
          const color = getBucketColorClass(bucket.bucket);
          const icon = getBucketIcon(bucket.bucket);

          return (
            <div
              key={bucket.bucket}
              className={`bg-[#1E293B] border ${color.border} rounded-xl p-4`}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[24px]">{icon}</span>
                <div className="flex-1">
                  <h4 className={`text-[14px] font-semibold ${color.text}`}>{bucket.label}</h4>
                  <p className="text-[11px] text-[#94A3B8]">{bucket.description}</p>
                </div>
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#94A3B8]">Customers:</span>
                  <span className="font-semibold text-white">{bucket.customer_count}</span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#94A3B8]">Revenue:</span>
                  <span className="font-semibold text-white">
                    ${bucket.total_revenue >= 1000000
                      ? `${(bucket.total_revenue / 1000000).toFixed(1)}M`
                      : `${(bucket.total_revenue / 1000).toFixed(0)}K`}
                  </span>
                </div>
                <div className="flex justify-between text-[12px]">
                  <span className="text-[#94A3B8]">At Risk:</span>
                  <span className="font-semibold text-[#EF4444]">
                    ${bucket.total_at_risk >= 1000000
                      ? `${(bucket.total_at_risk / 1000000).toFixed(1)}M`
                      : `${(bucket.total_at_risk / 1000).toFixed(0)}K`}
                  </span>
                </div>
              </div>

              {/* Top 3 actions */}
              <div className="space-y-1.5">
                {bucket.actions.slice(0, 3).map((action, idx) => (
                  <div
                    key={action.id}
                    className="bg-[#0F172A] p-2 rounded text-[11px] border border-white/[0.04]"
                  >
                    <div className="font-medium text-white truncate">{action.customer_name}</div>
                    <div className="text-[#94A3B8] truncate mt-0.5">
                      {action.action_title.substring(0, 40)}...
                    </div>
                  </div>
                ))}
                {bucket.actions.length === 0 && (
                  <div className="text-[11px] text-[#64748B] text-center py-2">No actions</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getBucketColorClass(bucket: string) {
  switch (bucket) {
    case 'urgent_intervention':
      return {
        border: 'border-[#EF4444]/30',
        text: 'text-[#EF4444]',
      };
    case 'defend_and_grow':
      return {
        border: 'border-[#22C55E]/30',
        text: 'text-[#22C55E]',
      };
    case 'nurture_up':
      return {
        border: 'border-[#38BDF8]/30',
        text: 'text-[#38BDF8]',
      };
    case 'optimize_exit':
      return {
        border: 'border-[#64748B]/30',
        text: 'text-[#64748B]',
      };
    default:
      return {
        border: 'border-white/[0.04]',
        text: 'text-white',
      };
  }
}
