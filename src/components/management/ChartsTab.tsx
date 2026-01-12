'use client';

import { motion } from 'framer-motion';
import PillarStatusChart from './charts/PillarStatusChart';
import TimeframeDonut from './charts/TimeframeDonut';
import OwnerWorkloadChart from './charts/OwnerWorkloadChart';
import PillarGauges from './charts/PillarGauges';

interface PillarStats {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  complete: number;
  avgProgress: number;
}

interface Initiative {
  id: number;
  owner: string | null;
  status: string | null;
  percentComplete: number;
  isPillarRow: boolean;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byTimeframe: Record<string, number>;
  byPillar: Record<string, PillarStats>;
}

interface ChartsTabProps {
  summary: Summary;
  initiatives: Initiative[];
  pillarColors: Record<string, string>;
  onOwnerClick?: (owner: string) => void;
}

// Chart container with consistent styling
function ChartCard({
  title,
  subtitle,
  icon,
  children,
  delay = 0,
  className = '',
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={`bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden ${className}`}
    >
      <div className="px-5 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <span className="text-orange-400">{icon}</span>
          <h3 className="text-white font-semibold text-[15px]">{title}</h3>
        </div>
        {subtitle && (
          <p className="text-[#64748B] text-[12px] mt-1">{subtitle}</p>
        )}
      </div>
      <div className="p-4">
        {children}
      </div>
    </motion.div>
  );
}

export default function ChartsTab({
  summary,
  initiatives,
  pillarColors,
  onOwnerClick,
}: ChartsTabProps) {
  const totalInitiatives = initiatives.filter(i => !i.isPillarRow).length;

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Chart 1: Pillar Status Breakdown */}
      <ChartCard
        title="Pillar Status Breakdown"
        subtitle="Initiative health by strategic pillar"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        }
        delay={0}
      >
        <div className="h-[280px]">
          <PillarStatusChart data={summary.byPillar} pillarColors={pillarColors} />
        </div>
      </ChartCard>

      {/* Chart 2: Timeframe Urgency */}
      <ChartCard
        title="Delivery Timeline"
        subtitle="Initiatives by delivery timeframe"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        }
        delay={0.1}
      >
        <div className="h-[280px]">
          <TimeframeDonut data={summary.byTimeframe} total={totalInitiatives} />
        </div>
      </ChartCard>

      {/* Chart 3: Owner Workload */}
      <ChartCard
        title="Owner Accountability"
        subtitle="Initiative count and health by owner"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        }
        delay={0.2}
      >
        <div className="h-[280px]">
          <OwnerWorkloadChart initiatives={initiatives} onOwnerClick={onOwnerClick} />
        </div>
      </ChartCard>

      {/* Chart 4: Progress Gauges */}
      <ChartCard
        title="Progress by Pillar"
        subtitle="Average completion percentage"
        icon={
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        }
        delay={0.3}
      >
        <div className="h-[280px]">
          <PillarGauges data={summary.byPillar} pillarColors={pillarColors} />
        </div>
      </ChartCard>
    </div>
  );
}
