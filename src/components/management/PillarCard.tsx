'use client';

import { motion } from 'framer-motion';

interface PillarStats {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  complete: number;
  avgProgress: number;
}

interface PillarCardProps {
  name: string;
  color: string;
  stats: PillarStats;
  isSelected: boolean;
  onClick: () => void;
  index: number;
}

const PILLAR_ICONS: Record<string, JSX.Element> = {
  'REVENUE GROWTH': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  ),
  'OPERATING RESULTS': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  'CUSTOMER SATISFACTION': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  'TEAM MEMBER SATISFACTION': (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
};

export default function PillarCard({
  name,
  color,
  stats,
  isSelected,
  onClick,
  index,
}: PillarCardProps) {
  const healthScore = stats.total > 0
    ? Math.round(((stats.onTrack + stats.complete) / stats.total) * 100)
    : 0;

  return (
    <motion.button
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      onClick={onClick}
      className={`w-full p-5 rounded-xl border text-left transition-all ${
        isSelected
          ? 'bg-[#1E293B] border-orange-500/50 ring-1 ring-orange-500/20'
          : 'bg-[#151F2E] border-white/[0.04] hover:border-white/[0.08] hover:bg-[#1A2535]'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            <div style={{ color }}>
              {PILLAR_ICONS[name] || PILLAR_ICONS['REVENUE GROWTH']}
            </div>
          </div>
          <div>
            <h3 className="text-white font-semibold text-[14px] leading-tight">
              {name}
            </h3>
            <span className="text-[11px] text-[#64748B]">
              {stats.total} initiatives
            </span>
          </div>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-2xl font-bold text-white">{stats.avgProgress}%</span>
          <span className="text-[11px] text-[#64748B]">Avg. Progress</span>
        </div>
        <div className="h-2 bg-[#0F1722] rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${stats.avgProgress}%` }}
            transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="text-center">
          <div className="text-[15px] font-semibold text-green-400">{stats.onTrack}</div>
          <div className="text-[10px] text-[#64748B]">On Track</div>
        </div>
        <div className="text-center">
          <div className="text-[15px] font-semibold text-amber-400">{stats.atRisk}</div>
          <div className="text-[10px] text-[#64748B]">At Risk</div>
        </div>
        <div className="text-center">
          <div className="text-[15px] font-semibold text-red-400">{stats.critical}</div>
          <div className="text-[10px] text-[#64748B]">Critical</div>
        </div>
        <div className="text-center">
          <div className="text-[15px] font-semibold text-gray-400">{stats.complete}</div>
          <div className="text-[10px] text-[#64748B]">Done</div>
        </div>
      </div>

      {/* Health indicator */}
      <div className="mt-4 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-[#64748B]">Health Score</span>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                healthScore >= 75 ? 'bg-green-400' :
                healthScore >= 50 ? 'bg-amber-400' : 'bg-red-400'
              }`}
            />
            <span className={`text-[13px] font-medium ${
              healthScore >= 75 ? 'text-green-400' :
              healthScore >= 50 ? 'text-amber-400' : 'text-red-400'
            }`}>
              {healthScore}%
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
