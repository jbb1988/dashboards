'use client';

import { TrendingUp, TrendingDown, DollarSign, Percent, Target, AlertTriangle } from 'lucide-react';

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

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export default function ProfitabilityKPIs({ kpis, projectName }: ProfitabilityKPIsProps) {
  const isUnderBudget = kpis.variance > 0;
  const isCPIGood = kpis.cpi >= 1;
  const isGPMHealthy = kpis.actualGPM >= 50;

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
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Revenue</span>
            <DollarSign className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(kpis.actualRevenue)}
          </div>
          <div className="text-xs text-gray-400">
            Budget: {formatCurrency(kpis.budgetRevenue)}
          </div>
          {kpis.budgetRevenue > 0 && (
            <div className="mt-2 flex items-center gap-1">
              {kpis.actualRevenue >= kpis.budgetRevenue ? (
                <TrendingUp className="w-3 h-3 text-[#22C55E]" />
              ) : (
                <TrendingDown className="w-3 h-3 text-[#EF4444]" />
              )}
              <span className={`text-xs ${kpis.actualRevenue >= kpis.budgetRevenue ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {formatPercent(((kpis.actualRevenue - kpis.budgetRevenue) / kpis.budgetRevenue) * 100)} vs budget
              </span>
            </div>
          )}
        </div>

        {/* Cost KPI */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Cost</span>
            <DollarSign className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {formatCurrency(kpis.actualCost)}
          </div>
          <div className="text-xs text-gray-400">
            Budget: {formatCurrency(kpis.budgetCost)}
          </div>
          {kpis.budgetCost !== 0 && (
            <div className="mt-2 flex items-center gap-1">
              {isUnderBudget ? (
                <TrendingDown className="w-3 h-3 text-[#22C55E]" />
              ) : (
                <TrendingUp className="w-3 h-3 text-[#EF4444]" />
              )}
              <span className={`text-xs ${isUnderBudget ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {formatCurrency(Math.abs(kpis.variance))} {isUnderBudget ? 'under' : 'over'}
              </span>
            </div>
          )}
        </div>

        {/* Gross Profit KPI */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Gross Profit</span>
            <TrendingUp className="w-4 h-4 text-[#22C55E]" />
          </div>
          <div className={`text-2xl font-bold mb-1 ${kpis.actualGP >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {formatCurrency(kpis.actualGP)}
          </div>
          <div className="text-xs text-gray-400">
            Budget: {formatCurrency(kpis.budgetGP)}
          </div>
          {kpis.budgetGP !== 0 && (
            <div className="mt-2 flex items-center gap-1">
              {kpis.actualGP >= kpis.budgetGP ? (
                <TrendingUp className="w-3 h-3 text-[#22C55E]" />
              ) : (
                <TrendingDown className="w-3 h-3 text-[#EF4444]" />
              )}
              <span className={`text-xs ${kpis.actualGP >= kpis.budgetGP ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                {formatCurrency(kpis.actualGP - kpis.budgetGP)} vs budget
              </span>
            </div>
          )}
        </div>

        {/* GPM% KPI */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">GPM %</span>
            <Percent className="w-4 h-4 text-[#3B82F6]" />
          </div>
          <div className={`text-2xl font-bold mb-1 ${isGPMHealthy ? 'text-[#22C55E]' : 'text-[#F59E0B]'}`}>
            {formatPercent(kpis.actualGPM)}
          </div>
          <div className="text-xs text-gray-400">
            Target: 50%+
          </div>
          <div className="mt-2">
            <div className="h-2 bg-white/[0.08] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  kpis.actualGPM >= 50 ? 'bg-[#22C55E]' : kpis.actualGPM >= 30 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                }`}
                style={{ width: `${Math.min(Math.max(kpis.actualGPM, 0), 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* CPI KPI */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">CPI</span>
            {isCPIGood ? (
              <Target className="w-4 h-4 text-[#22C55E]" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
            )}
          </div>
          <div className={`text-2xl font-bold mb-1 ${isCPIGood ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
            {kpis.cpi.toFixed(2)}
          </div>
          <div className="text-xs text-gray-400">
            Cost Performance Index
          </div>
          <div className="mt-2 flex items-center gap-1">
            <span className={`text-xs ${isCPIGood ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
              {isCPIGood ? 'Under Budget' : 'Over Budget'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
