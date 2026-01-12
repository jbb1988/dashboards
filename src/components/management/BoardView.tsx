'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

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
  title: string;
  owner: string | null;
  status: string | null;
  statusLabel: string;
  parentPillar: string | null;
  isPillarRow: boolean;
}

interface Summary {
  total: number;
  byStatus: Record<string, number>;
  byTimeframe: Record<string, number>;
  byPillar: Record<string, PillarStats>;
}

interface BoardViewProps {
  summary: Summary;
  initiatives: Initiative[];
  pillarColors: Record<string, string>;
  lastSynced: string;
}

// Animated health score gauge
function HealthScoreGauge({ score, total, onTrack, atRisk, critical }: {
  score: number;
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-[#151F2E] rounded-2xl border border-white/[0.04] p-8"
    >
      <h2 className="text-[#64748B] text-lg text-center mb-6 font-medium">OVERALL HEALTH SCORE</h2>

      <div className="flex items-center justify-center mb-6">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative"
        >
          <span
            className="text-7xl font-bold"
            style={{
              color: score >= 75 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444',
            }}
          >
            {score}%
          </span>
        </motion.div>
      </div>

      {/* Progress bar */}
      <div className="h-4 bg-white/5 rounded-full overflow-hidden mb-8">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 1, delay: 0.3 }}
          className="h-full rounded-full"
          style={{
            backgroundColor: score >= 75 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444',
          }}
        />
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-8 text-center">
        <div>
          <p className="text-3xl font-bold text-white">{total}</p>
          <p className="text-[#64748B] text-sm">Total</p>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div>
          <p className="text-3xl font-bold text-[#22C55E]">{onTrack}</p>
          <p className="text-[#64748B] text-sm">On Track</p>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div>
          <p className="text-3xl font-bold text-[#F59E0B]">{atRisk}</p>
          <p className="text-[#64748B] text-sm">At Risk</p>
        </div>
        <div className="w-px h-12 bg-white/10" />
        <div>
          <p className="text-3xl font-bold text-[#EF4444]">{critical}</p>
          <p className="text-[#64748B] text-sm">Critical</p>
        </div>
      </div>
    </motion.div>
  );
}

// Pillar card for board view
function PillarBoardCard({
  name,
  stats,
  color,
  delay,
}: {
  name: string;
  stats: PillarStats;
  color: string;
  delay: number;
}) {
  const healthScore = stats.total > 0
    ? Math.round(((stats.onTrack + stats.complete) / stats.total) * 100)
    : 0;

  // Create dot array for visual indicator
  const dots = Array(10).fill(0).map((_, i) => i < Math.round(healthScore / 10));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-6"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-white font-semibold text-lg">{name.replace(' SATISFACTION', '')}</h3>
      </div>

      <div className="text-center mb-4">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.3 }}
          className="text-5xl font-bold"
          style={{ color }}
        >
          {healthScore}%
        </motion.p>
      </div>

      {/* Dot indicator */}
      <div className="flex justify-center gap-1.5 mb-4">
        {dots.map((filled, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: delay + 0.1 * i }}
            className={`w-3 h-3 rounded-full ${filled ? '' : 'opacity-30'}`}
            style={{ backgroundColor: filled ? color : '#475569' }}
          />
        ))}
      </div>

      <div className="text-center space-y-1">
        <p className="text-[#94A3B8]">
          <span className="text-white font-semibold">{stats.total}</span> initiatives
        </p>
        <p className="text-[#64748B] text-sm">
          {stats.onTrack} on track
        </p>
      </div>
    </motion.div>
  );
}

// Attention items section
function AttentionItems({ items }: { items: Initiative[] }) {
  const atRiskItems = items
    .filter(i => !i.isPillarRow && (i.status === 'Red' || i.status === 'Yellow'))
    .slice(0, 5);

  if (atRiskItems.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.6 }}
        className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-white font-semibold text-lg">All Initiatives On Track</h3>
        </div>
        <p className="text-[#64748B] text-center py-4">No items require immediate attention</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.6 }}
      className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-[#EF4444]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-white font-semibold text-lg">Items Requiring Attention</h3>
        </div>
        <span className="text-[#64748B] text-sm">{atRiskItems.length} items</span>
      </div>

      <div className="space-y-3">
        {atRiskItems.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7 + index * 0.1 }}
            className="flex items-center gap-4 p-3 rounded-lg bg-white/[0.02]"
          >
            <span
              className={`w-3 h-3 rounded-full flex-shrink-0 ${
                item.status === 'Red' ? 'bg-[#EF4444]' : 'bg-[#F59E0B]'
              }`}
            />
            <span className="flex-1 text-white font-medium truncate">{item.title}</span>
            <span className="text-[#64748B] text-sm truncate max-w-[150px]">
              {item.parentPillar?.replace(' SATISFACTION', '')}
            </span>
            <span className="text-[#94A3B8] text-sm truncate max-w-[100px]">
              {item.owner || 'Unassigned'}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

export default function BoardView({
  summary,
  initiatives,
  pillarColors,
  lastSynced,
}: BoardViewProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Calculate overall health score
  const totalInitiatives = initiatives.filter(i => !i.isPillarRow).length;
  const onTrack = summary.byStatus['Green'] || 0;
  const atRisk = summary.byStatus['Yellow'] || 0;
  const critical = summary.byStatus['Red'] || 0;
  const complete = summary.byStatus['Gray'] || 0;
  const healthScore = totalInitiatives > 0
    ? Math.round(((onTrack + complete) / totalInitiatives) * 100)
    : 0;

  // Handle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Get current quarter
  const now = new Date();
  const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

  return (
    <div className="space-y-6">
      {/* Header with fullscreen button */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">2026 Strategic Initiatives</h1>
          <p className="text-[#64748B] text-lg mt-1">Board Summary • {quarter}</p>
        </div>
        <button
          onClick={toggleFullscreen}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {isFullscreen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            )}
          </svg>
          {isFullscreen ? 'Exit Fullscreen' : 'Present Mode'}
        </button>
      </div>

      {/* Overall Health Score */}
      <HealthScoreGauge
        score={healthScore}
        total={totalInitiatives}
        onTrack={onTrack}
        atRisk={atRisk}
        critical={critical}
      />

      {/* Pillar Cards */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(pillarColors).map(([name, color], index) => (
          <PillarBoardCard
            key={name}
            name={name}
            stats={summary.byPillar[name] || { total: 0, onTrack: 0, atRisk: 0, critical: 0, complete: 0, avgProgress: 0 }}
            color={color}
            delay={0.2 + index * 0.1}
          />
        ))}
      </div>

      {/* Attention Items */}
      <AttentionItems items={initiatives} />

      {/* Footer */}
      <div className="text-center text-[#64748B] text-sm">
        Last Updated: {new Date(lastSynced).toLocaleString()}
      </div>
    </div>
  );
}
