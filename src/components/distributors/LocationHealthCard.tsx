'use client';

interface LocationHealthCardProps {
  healthScore: {
    overall: number;
    tier: 'excellent' | 'good' | 'fair' | 'poor';
    components: {
      revenue_health: number;
      engagement_health: number;
      margin_health: number;
      category_health: number;
    };
    risk_flags: string[];
  };
}

export default function LocationHealthCard({ healthScore }: LocationHealthCardProps) {
  const tierConfig = {
    excellent: { color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
    good: { color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
    fair: { color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
    poor: { color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  };

  const config = tierConfig[healthScore.tier];

  return (
    <div className={`p-6 rounded-xl ${config.bg} border ${config.border}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Location Health Score</h2>
          <p className="text-sm text-[#94A3B8] mt-1">
            Overall performance assessment across key metrics
          </p>
        </div>
        <div className="text-center">
          <div className={`text-5xl font-bold ${config.color}`}>
            {healthScore.overall}
          </div>
          <div className={`text-sm font-medium ${config.color} uppercase tracking-wider mt-1`}>
            {healthScore.tier}
          </div>
        </div>
      </div>

      {/* Component Breakdown */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <HealthComponent
          label="Revenue"
          score={healthScore.components.revenue_health}
          icon="💰"
        />
        <HealthComponent
          label="Engagement"
          score={healthScore.components.engagement_health}
          icon="📊"
        />
        <HealthComponent
          label="Margin"
          score={healthScore.components.margin_health}
          icon="📈"
        />
        <HealthComponent
          label="Categories"
          score={healthScore.components.category_health}
          icon="🏷️"
        />
      </div>

      {/* Risk Flags */}
      {healthScore.risk_flags.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <div className="text-xs font-semibold text-red-400 uppercase tracking-wider mb-2">
            ⚠️ Risk Flags
          </div>
          <div className="flex flex-wrap gap-2">
            {healthScore.risk_flags.map((flag, idx) => (
              <span
                key={idx}
                className="px-2 py-1 rounded-md text-xs bg-red-500/20 text-red-300 border border-red-500/30"
              >
                {flag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function HealthComponent({ label, score, icon }: { label: string; score: number; icon: string }) {
  let colorClass = 'text-green-400';
  if (score < 80) colorClass = 'text-blue-400';
  if (score < 60) colorClass = 'text-amber-400';
  if (score < 40) colorClass = 'text-red-400';

  return (
    <div className="text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-2xl font-bold ${colorClass}`}>{score}</div>
      <div className="text-xs text-[#64748B] uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}
