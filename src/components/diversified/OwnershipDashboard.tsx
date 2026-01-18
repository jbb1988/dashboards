'use client';

import type { ActionItem } from '@/lib/action-classification';

interface OwnershipDashboardProps {
  actions: ActionItem[];
}

export function OwnershipDashboard({ actions }: OwnershipDashboardProps) {
  // Group by owner
  const byOwner = new Map<string, ActionItem[]>();
  let unassigned = 0;

  for (const action of actions) {
    if (!action.owner) {
      unassigned++;
      continue;
    }

    if (!byOwner.has(action.owner)) {
      byOwner.set(action.owner, []);
    }
    byOwner.get(action.owner)!.push(action);
  }

  // Calculate stats per owner
  const ownerStats = Array.from(byOwner.entries()).map(([owner, ownerActions]) => {
    const totalValue = ownerActions.reduce((sum, a) => {
      return sum + (a.expected_recovery || a.cross_sell_potential || 0);
    }, 0);

    const overdue = ownerActions.filter(a => {
      if (!a.due_date) return false;
      return new Date(a.due_date) < new Date();
    }).length;

    return {
      owner,
      count: ownerActions.length,
      totalValue,
      overdue,
    };
  });

  // Sort by total value descending
  ownerStats.sort((a, b) => b.totalValue - a.totalValue);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[16px] font-semibold text-white flex items-center gap-2">
          <span className="text-[20px]">👥</span>
          Ownership Dashboard
        </h3>
        {unassigned > 0 && (
          <div className="px-3 py-1.5 bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] rounded-lg text-[12px] font-medium">
            ⚠️ {unassigned} unassigned actions
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ownerStats.map((stat) => (
          <div
            key={stat.owner}
            className="bg-[#1E293B] border border-white/[0.04] rounded-xl p-4 hover:border-[#38BDF8]/30 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="text-[14px] font-semibold text-white">{stat.owner}</h4>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">{stat.count} actions assigned</div>
              </div>
              {stat.overdue > 0 && (
                <div className="px-2 py-1 bg-[#EF4444]/10 text-[#EF4444] rounded text-[11px] font-medium">
                  {stat.overdue} overdue
                </div>
              )}
            </div>

            <div className="bg-[#0F172A] p-3 rounded-lg">
              <div className="text-[11px] text-[#64748B] uppercase font-semibold mb-1">Total $ Impact</div>
              <div className="text-[18px] font-bold text-[#22C55E]">
                ${stat.totalValue >= 1000000
                  ? `${(stat.totalValue / 1000000).toFixed(1)}M`
                  : `${(stat.totalValue / 1000).toFixed(0)}K`}
              </div>
            </div>
          </div>
        ))}

        {ownerStats.length === 0 && (
          <div className="col-span-full bg-[#1E293B] border border-white/[0.04] rounded-xl p-8 text-center">
            <div className="text-[14px] text-[#64748B]">No owners assigned yet</div>
          </div>
        )}
      </div>
    </div>
  );
}
