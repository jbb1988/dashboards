'use client';

interface CompetitivePositionCardProps {
  position: {
    revenue_percentile: number;
    frequency_percentile: number;
    margin_percentile: number;
    category_percentile: number;
  };
  totalLocations: number;
}

export default function CompetitivePositionCard({
  position,
  totalLocations,
}: CompetitivePositionCardProps) {
  return (
    <div className="p-6 rounded-xl bg-[#151F2E] border border-white/[0.06]">
      <h3 className="text-sm font-semibold text-white mb-4">Competitive Position</h3>
      <p className="text-xs text-[#64748B] mb-6">
        Percentile rank vs {totalLocations} locations in this distributor
      </p>

      <div className="space-y-4">
        <PercentileBar
          label="Revenue"
          percentile={position.revenue_percentile}
          icon="💰"
        />
        <PercentileBar
          label="Order Frequency"
          percentile={position.frequency_percentile}
          icon="📊"
        />
        <PercentileBar
          label="Margin"
          percentile={position.margin_percentile}
          icon="📈"
        />
        <PercentileBar
          label="Category Diversity"
          percentile={position.category_percentile}
          icon="🏷️"
        />
      </div>
    </div>
  );
}

function PercentileBar({ label, percentile, icon }: { label: string; percentile: number; icon: string }) {
  let colorClass = 'bg-green-500';
  if (percentile < 75) colorClass = 'bg-blue-500';
  if (percentile < 50) colorClass = 'bg-amber-500';
  if (percentile < 25) colorClass = 'bg-red-500';

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>{icon}</span>
          <span className="text-xs text-[#94A3B8]">{label}</span>
        </div>
        <span className="text-sm font-semibold text-white">{percentile}th</span>
      </div>
      <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${percentile}%` }}
        />
      </div>
    </div>
  );
}
