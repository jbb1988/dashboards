'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export interface PortfolioEntity {
  id: string;
  name: string;
  revenue: number;
  yoy_change_pct: number;
  margin_pct: number;
  days_since_purchase: number;
  is_growing: boolean; // YoY > 5%
  is_healthy: boolean; // No major risk flags
  health_score?: number;
}

interface StrategicPortfolioMatrixProps {
  entities: PortfolioEntity[];
  onEntityClick?: (entity: PortfolioEntity) => void;
  entityType: 'distributor' | 'location';
}

type Quadrant = 'defend-grow' | 'urgent-intervention' | 'nurture-up' | 'optimize-exit';

interface QuadrantConfig {
  title: string;
  subtitle: string;
  action: string;
  bgColor: string;
  borderColor: string;
  icon: string;
}

const QUADRANT_CONFIGS: Record<Quadrant, QuadrantConfig> = {
  'defend-grow': {
    title: 'DEFEND & GROW',
    subtitle: 'High Value + Healthy',
    action: 'Expand & Protect',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    icon: '✓',
  },
  'urgent-intervention': {
    title: 'URGENT INTERVENTION',
    subtitle: 'High Value + At Risk',
    action: 'Save & Recover NOW',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    icon: '⚠️',
  },
  'nurture-up': {
    title: 'NURTURE UP',
    subtitle: 'Medium Value + Growth Potential',
    action: 'Upsell & Expand',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    icon: '💡',
  },
  'optimize-exit': {
    title: 'OPTIMIZE or EXIT',
    subtitle: 'Low Value + Declining',
    action: 'Review Fit',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    icon: '⬇️',
  },
};

export default function StrategicPortfolioMatrix({
  entities,
  onEntityClick,
  entityType,
}: StrategicPortfolioMatrixProps) {
  const [hoveredEntity, setHoveredEntity] = useState<string | null>(null);

  // Calculate thresholds for quadrants
  const revenues = entities.map(e => e.revenue).sort((a, b) => b - a);
  const medianRevenue = revenues[Math.floor(revenues.length / 2)] || 0;

  const categorizeEntity = (entity: PortfolioEntity): Quadrant => {
    const isHighValue = entity.revenue >= medianRevenue;
    const isHealthy = entity.is_healthy && entity.is_growing;

    if (isHighValue && isHealthy) return 'defend-grow';
    if (isHighValue && !isHealthy) return 'urgent-intervention';
    if (!isHighValue && isHealthy) return 'nurture-up';
    return 'optimize-exit';
  };

  // Group entities by quadrant
  const quadrantData: Record<Quadrant, PortfolioEntity[]> = {
    'defend-grow': [],
    'urgent-intervention': [],
    'nurture-up': [],
    'optimize-exit': [],
  };

  entities.forEach(entity => {
    const quadrant = categorizeEntity(entity);
    quadrantData[quadrant].push(entity);
  });

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  const getTrendIcon = (entity: PortfolioEntity) => {
    if (entity.yoy_change_pct > 5) return '↗️';
    if (entity.yoy_change_pct < -5) return '↘️';
    return '→';
  };

  const getStatusColor = (entity: PortfolioEntity) => {
    if (entity.days_since_purchase > 60) return 'bg-red-500';
    if (entity.days_since_purchase > 30) return 'bg-amber-500';
    return 'bg-green-500';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Strategic Portfolio Matrix</h3>
          <p className="text-sm text-[#64748B] mt-1">
            {entityType === 'distributor' ? 'Distributor' : 'Location'} positioning by revenue and health
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-[#64748B]">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>Active (&lt;30d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-amber-500"></div>
            <span>Warning (30-60d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            <span>At Risk (&gt;60d)</span>
          </div>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="grid grid-cols-2 gap-4" style={{ minHeight: '500px' }}>
        {/* Top Left: Defend & Grow */}
        <QuadrantPanel
          quadrant="defend-grow"
          config={QUADRANT_CONFIGS['defend-grow']}
          entities={quadrantData['defend-grow']}
          hoveredEntity={hoveredEntity}
          onEntityHover={setHoveredEntity}
          onEntityClick={onEntityClick}
          formatCurrency={formatCurrency}
          getTrendIcon={getTrendIcon}
          getStatusColor={getStatusColor}
        />

        {/* Top Right: Urgent Intervention */}
        <QuadrantPanel
          quadrant="urgent-intervention"
          config={QUADRANT_CONFIGS['urgent-intervention']}
          entities={quadrantData['urgent-intervention']}
          hoveredEntity={hoveredEntity}
          onEntityHover={setHoveredEntity}
          onEntityClick={onEntityClick}
          formatCurrency={formatCurrency}
          getTrendIcon={getTrendIcon}
          getStatusColor={getStatusColor}
        />

        {/* Bottom Left: Nurture Up */}
        <QuadrantPanel
          quadrant="nurture-up"
          config={QUADRANT_CONFIGS['nurture-up']}
          entities={quadrantData['nurture-up']}
          hoveredEntity={hoveredEntity}
          onEntityHover={setHoveredEntity}
          onEntityClick={onEntityClick}
          formatCurrency={formatCurrency}
          getTrendIcon={getTrendIcon}
          getStatusColor={getStatusColor}
        />

        {/* Bottom Right: Optimize or Exit */}
        <QuadrantPanel
          quadrant="optimize-exit"
          config={QUADRANT_CONFIGS['optimize-exit']}
          entities={quadrantData['optimize-exit']}
          hoveredEntity={hoveredEntity}
          onEntityHover={setHoveredEntity}
          onEntityClick={onEntityClick}
          formatCurrency={formatCurrency}
          getTrendIcon={getTrendIcon}
          getStatusColor={getStatusColor}
        />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/10">
        {Object.entries(quadrantData).map(([quadrant, entities]) => {
          const config = QUADRANT_CONFIGS[quadrant as Quadrant];
          const totalRevenue = entities.reduce((sum, e) => sum + e.revenue, 0);

          return (
            <div key={quadrant} className={`p-4 rounded-lg ${config.bgColor} border ${config.borderColor}`}>
              <div className="text-2xl mb-1">{config.icon}</div>
              <div className="text-xs text-[#64748B] uppercase tracking-wider mb-1">
                {config.title}
              </div>
              <div className="text-xl font-bold text-white">
                {entities.length}
              </div>
              <div className="text-xs text-[#94A3B8] mt-1">
                {formatCurrency(totalRevenue)} revenue
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface QuadrantPanelProps {
  quadrant: Quadrant;
  config: QuadrantConfig;
  entities: PortfolioEntity[];
  hoveredEntity: string | null;
  onEntityHover: (id: string | null) => void;
  onEntityClick?: (entity: PortfolioEntity) => void;
  formatCurrency: (value: number) => string;
  getTrendIcon: (entity: PortfolioEntity) => string;
  getStatusColor: (entity: PortfolioEntity) => string;
}

function QuadrantPanel({
  config,
  entities,
  hoveredEntity,
  onEntityHover,
  onEntityClick,
  formatCurrency,
  getTrendIcon,
  getStatusColor,
}: QuadrantPanelProps) {
  return (
    <div className={`p-6 rounded-xl ${config.bgColor} border ${config.borderColor} relative`}>
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-2xl">{config.icon}</span>
          <h4 className="text-sm font-semibold text-white uppercase tracking-wider">
            {config.title}
          </h4>
        </div>
        <p className="text-xs text-[#64748B]">{config.subtitle}</p>
        <p className="text-xs font-medium text-cyan-400 mt-1">→ {config.action}</p>
      </div>

      {/* Entity List */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto">
        {entities.length === 0 ? (
          <div className="text-center py-8 text-[#64748B] text-sm">
            No {config.title.toLowerCase()} entities
          </div>
        ) : (
          entities.map((entity, idx) => (
            <motion.div
              key={entity.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.05 }}
              onMouseEnter={() => onEntityHover(entity.id)}
              onMouseLeave={() => onEntityHover(null)}
              onClick={() => onEntityClick?.(entity)}
              className={`p-3 rounded-lg bg-[#0B1220] border border-white/[0.04] cursor-pointer transition-all ${
                hoveredEntity === entity.id
                  ? 'border-cyan-500/50 bg-[#151F2E]'
                  : 'hover:border-white/10'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="text-sm font-medium text-white mb-0.5">
                    {entity.name}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-400">
                      {formatCurrency(entity.revenue)}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      {getTrendIcon(entity)} {entity.yoy_change_pct.toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${getStatusColor(entity)}`} />
              </div>

              <div className="flex items-center gap-3 text-[10px] text-[#64748B]">
                <span>Margin: {entity.margin_pct.toFixed(1)}%</span>
                <span>•</span>
                <span>Last order: {entity.days_since_purchase}d ago</span>
              </div>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}
