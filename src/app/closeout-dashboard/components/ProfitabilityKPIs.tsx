'use client';

import { DollarSign, TrendingUp, TrendingDown, Percent, Target } from 'lucide-react';
import KPICard, { AnimatedCounter } from '@/components/mars-ui/KPICard';

interface ProjectKPIs {
  budgetRevenue: number;
  actualRevenue: number;
  budgetCost: number;
  actualCost: number;
  budgetGP: number;
  actualGP: number;
  budgetGPM: number;
  actualGPM: number;
  variance: number;
  variancePct: number;
  cpi: number;
}

interface ProfitabilityKPIsProps {
  kpis: ProjectKPIs;
  projectName: string;
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

export default function ProfitabilityKPIs({ kpis, projectName }: ProfitabilityKPIsProps) {
  const isRevenueGood = kpis.actualRevenue >= kpis.budgetRevenue;
  const isCostGood = kpis.variance > 0; // Positive variance means under budget
  const isGPGood = kpis.actualGP >= kpis.budgetGP;
  const isGPMHealthy = kpis.actualGPM >= 50;
  const isCPIGood = kpis.cpi >= 1;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">
          {projectName} - Project Profitability
        </h2>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>Budget vs Actual Analysis</span>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {/* Revenue KPI */}
        <KPICard
          title="REVENUE"
          value={<AnimatedCounter value={kpis.actualRevenue} prefix="$" decimals={0} />}
          subtitle={`Budget: ${formatCurrency(kpis.budgetRevenue)}`}
          icon={<DollarSign className="w-5 h-5" />}
          color={isRevenueGood ? '#22C55E' : '#EF4444'}
          trend={isRevenueGood ? 'up' : 'down'}
          trendLabel={kpis.budgetRevenue > 0 ?
            `${((kpis.actualRevenue - kpis.budgetRevenue) / kpis.budgetRevenue * 100).toFixed(1)}% vs budget` :
            undefined
          }
        />

        {/* Cost KPI */}
        <KPICard
          title="COST"
          value={<AnimatedCounter value={kpis.actualCost} prefix="$" decimals={0} />}
          subtitle={`Budget: ${formatCurrency(kpis.budgetCost)}`}
          icon={<DollarSign className="w-5 h-5" />}
          color={isCostGood ? '#22C55E' : '#F59E0B'}
          trend={isCostGood ? 'down' : 'up'}
          trendLabel={`${formatCurrency(Math.abs(kpis.variance))} ${isCostGood ? 'under' : 'over'}`}
          invertTrendColor={true}
        />

        {/* Gross Profit KPI */}
        <KPICard
          title="GROSS PROFIT"
          value={<AnimatedCounter value={kpis.actualGP} prefix="$" decimals={0} />}
          subtitle={`Budget: ${formatCurrency(kpis.budgetGP)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={isGPGood ? '#22C55E' : '#EF4444'}
          trend={isGPGood ? 'up' : 'down'}
          trendLabel={kpis.budgetGP !== 0 ?
            `${formatCurrency(kpis.actualGP - kpis.budgetGP)} vs budget` :
            undefined
          }
        />

        {/* GPM% KPI */}
        <KPICard
          title="GPM %"
          value={<AnimatedCounter value={kpis.actualGPM} suffix="%" decimals={1} />}
          subtitle="Target: 50%+"
          icon={<Percent className="w-5 h-5" />}
          color={isGPMHealthy ? '#22C55E' : kpis.actualGPM >= 30 ? '#F59E0B' : '#EF4444'}
          glowIntensity={isGPMHealthy ? 'subtle' : 'none'}
        />

        {/* CPI KPI */}
        <KPICard
          title="CPI"
          value={<AnimatedCounter value={kpis.cpi} decimals={2} />}
          subtitle="Cost Performance Index"
          icon={<Target className="w-5 h-5" />}
          color={isCPIGood ? '#22C55E' : '#EF4444'}
          trend={isCPIGood ? 'up' : 'down'}
          trendLabel={isCPIGood ? 'Under Budget' : 'Over Budget'}
          tooltip="Cost Performance Index (CPI) = Budget Cost ÷ Actual Cost. CPI > 1.0 means project is under budget (good). CPI < 1.0 means over budget (bad)."
        />
      </div>
    </div>
  );
}
