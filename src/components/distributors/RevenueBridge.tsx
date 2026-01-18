'use client';

import { motion } from 'framer-motion';

export interface RiskItem {
  name: string;
  amount: number;
  reason: string;
  days_inactive?: number;
}

export interface OpportunityItem {
  name: string;
  amount: number;
  type: 'quick-win' | 'strategic';
  action: string;
}

interface RevenueBridgeProps {
  currentRevenue: number;
  targetRevenue: number;
  atRisk: RiskItem[];
  quickWins: OpportunityItem[];
  strategicGrowth: OpportunityItem[];
  entityType: 'distributor' | 'location';
}

export default function RevenueBridge({
  currentRevenue,
  targetRevenue,
  atRisk,
  quickWins,
  strategicGrowth,
  entityType,
}: RevenueBridgeProps) {
  const totalAtRisk = atRisk.reduce((sum, item) => sum + item.amount, 0);
  const totalQuickWins = quickWins.reduce((sum, item) => sum + item.amount, 0);
  const totalStrategicGrowth = strategicGrowth.reduce((sum, item) => sum + item.amount, 0);

  const netImpact = -totalAtRisk + totalQuickWins + totalStrategicGrowth;
  const projectedRevenue = currentRevenue + netImpact;
  const gapToTarget = targetRevenue - projectedRevenue;

  const formatCurrency = (value: number) => {
    const absValue = Math.abs(value);
    if (absValue >= 1000000) return `$${(absValue / 1000000).toFixed(2)}M`;
    if (absValue >= 1000) return `$${(absValue / 1000).toFixed(0)}K`;
    return `$${absValue.toFixed(0)}`;
  };

  const formatCurrencySigned = (value: number) => {
    const formatted = formatCurrency(value);
    return value >= 0 ? `+${formatted}` : `-${formatted}`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white">Revenue Bridge Analysis</h3>
        <p className="text-sm text-[#64748B] mt-1">
          Gap between current state and revenue target
        </p>
      </div>

      {/* Visual Bridge */}
      <div className="bg-[#151F2E] rounded-xl p-6 border border-white/[0.04]">
        {/* Current Revenue */}
        <BridgeItem
          label="Current Revenue"
          amount={currentRevenue}
          type="baseline"
          formatCurrency={formatCurrency}
          delay={0}
        />

        {/* At Risk */}
        {totalAtRisk > 0 && (
          <BridgeSection
            title="Revenue At Risk (90 days)"
            totalAmount={-totalAtRisk}
            items={atRisk.slice(0, 4)}
            remainingCount={Math.max(0, atRisk.length - 4)}
            formatCurrency={formatCurrency}
            formatCurrencySigned={formatCurrencySigned}
            type="risk"
            icon="⚠️"
            expandable={true}
            allItems={atRisk}
            delay={0.1}
          />
        )}

        {/* Quick Wins */}
        {totalQuickWins > 0 && (
          <BridgeSection
            title="Quick Wins Available"
            totalAmount={totalQuickWins}
            items={quickWins.slice(0, 4)}
            remainingCount={Math.max(0, quickWins.length - 4)}
            formatCurrency={formatCurrency}
            formatCurrencySigned={formatCurrencySigned}
            type="opportunity"
            icon="💡"
            expandable={true}
            allItems={quickWins}
            delay={0.2}
          />
        )}

        {/* Strategic Growth */}
        {totalStrategicGrowth > 0 && (
          <BridgeSection
            title="Strategic Growth Initiatives"
            totalAmount={totalStrategicGrowth}
            items={strategicGrowth.slice(0, 4)}
            remainingCount={Math.max(0, strategicGrowth.length - 4)}
            formatCurrency={formatCurrency}
            formatCurrencySigned={formatCurrencySigned}
            type="strategic"
            icon="📈"
            expandable={true}
            allItems={strategicGrowth}
            delay={0.3}
          />
        )}

        {/* Projected Revenue */}
        <BridgeItem
          label="Projected Revenue (if all actions taken)"
          amount={projectedRevenue}
          type={netImpact >= 0 ? 'positive' : 'negative'}
          formatCurrency={formatCurrency}
          delay={0.4}
        />

        {/* Gap to Target */}
        {gapToTarget !== 0 && (
          <BridgeItem
            label="Gap to Target"
            amount={gapToTarget}
            type={gapToTarget >= 0 ? 'neutral' : 'negative'}
            formatCurrency={formatCurrencySigned}
            delay={0.5}
          />
        )}

        {/* Target Revenue */}
        <BridgeItem
          label="TARGET Revenue"
          amount={targetRevenue}
          type="target"
          formatCurrency={formatCurrency}
          delay={0.6}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          title="At Risk"
          amount={totalAtRisk}
          count={atRisk.length}
          entityType={entityType}
          type="risk"
          formatCurrency={formatCurrency}
        />
        <SummaryCard
          title="Quick Wins"
          amount={totalQuickWins}
          count={quickWins.length}
          entityType={entityType}
          type="opportunity"
          formatCurrency={formatCurrency}
        />
        <SummaryCard
          title="Strategic"
          amount={totalStrategicGrowth}
          count={strategicGrowth.length}
          entityType={entityType}
          type="strategic"
          formatCurrency={formatCurrency}
        />
      </div>
    </div>
  );
}

interface BridgeItemProps {
  label: string;
  amount: number;
  type: 'baseline' | 'positive' | 'negative' | 'neutral' | 'target';
  formatCurrency: (value: number) => string;
  delay: number;
}

function BridgeItem({ label, amount, type, formatCurrency, delay }: BridgeItemProps) {
  const typeConfig = {
    baseline: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-300' },
    positive: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-300' },
    negative: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-300' },
    neutral: { bg: 'bg-amber-500/20', border: 'border-amber-500/30', text: 'text-amber-300' },
    target: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-300' },
  };

  const config = typeConfig[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`flex items-center justify-between p-4 rounded-lg ${config.bg} border ${config.border} mb-3`}
    >
      <span className="text-sm font-medium text-white">{label}</span>
      <span className={`text-lg font-bold ${config.text}`}>
        {formatCurrency(amount)}
      </span>
    </motion.div>
  );
}

interface BridgeSectionProps {
  title: string;
  totalAmount: number;
  items: (RiskItem | OpportunityItem)[];
  remainingCount: number;
  formatCurrency: (value: number) => string;
  formatCurrencySigned: (value: number) => string;
  type: 'risk' | 'opportunity' | 'strategic';
  icon: string;
  expandable: boolean;
  allItems: (RiskItem | OpportunityItem)[];
  delay: number;
}

function BridgeSection({
  title,
  totalAmount,
  items,
  remainingCount,
  formatCurrency,
  formatCurrencySigned,
  type,
  icon,
  delay,
}: BridgeSectionProps) {
  const typeConfig = {
    risk: { bg: 'bg-red-500/10', border: 'border-red-500/20', text: 'text-red-300' },
    opportunity: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-300' },
    strategic: { bg: 'bg-purple-500/10', border: 'border-purple-500/20', text: 'text-purple-300' },
  };

  const config = typeConfig[type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className={`p-4 rounded-lg ${config.bg} border ${config.border} mb-3`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{icon}</span>
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        <span className={`text-lg font-bold ${config.text}`}>
          {formatCurrencySigned(totalAmount)}
        </span>
      </div>

      <div className="space-y-2 pl-7">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <div className="flex-1">
              <span className="text-[#94A3B8]">{item.name}:</span>
              <span className="text-[#64748B] ml-2">
                {'reason' in item ? item.reason : item.action}
              </span>
            </div>
            <span className="text-white font-medium ml-4">
              {formatCurrencySigned(type === 'risk' ? -item.amount : item.amount)}
            </span>
          </div>
        ))}
        {remainingCount > 0 && (
          <div className="text-xs text-[#64748B] italic">
            +{remainingCount} more...
          </div>
        )}
      </div>
    </motion.div>
  );
}

interface SummaryCardProps {
  title: string;
  amount: number;
  count: number;
  entityType: 'distributor' | 'location';
  type: 'risk' | 'opportunity' | 'strategic';
  formatCurrency: (value: number) => string;
}

function SummaryCard({
  title,
  amount,
  count,
  entityType,
  type,
  formatCurrency,
}: SummaryCardProps) {
  const typeConfig = {
    risk: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300', icon: '⚠️' },
    opportunity: { bg: 'bg-blue-500/10', border: 'border-blue-500/30', text: 'text-blue-300', icon: '💡' },
    strategic: { bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-300', icon: '📈' },
  };

  const config = typeConfig[type];

  return (
    <div className={`p-4 rounded-lg ${config.bg} border ${config.border}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xl">{config.icon}</span>
        <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">
          {title}
        </span>
      </div>
      <div className={`text-2xl font-bold ${config.text} mb-1`}>
        {formatCurrency(amount)}
      </div>
      <div className="text-xs text-[#94A3B8]">
        {count} {entityType === 'distributor' ? 'distributors' : 'locations'}
      </div>
    </div>
  );
}
