'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ReferenceLine } from 'recharts';
import { motion } from 'framer-motion';

interface Initiative {
  id: number;
  owner: string | null;
  status: string | null;
  percentComplete: number;
  isPillarRow: boolean;
}

interface OwnerWorkloadChartProps {
  initiatives: Initiative[];
  onOwnerClick?: (owner: string) => void;
}

export default function OwnerWorkloadChart({ initiatives, onOwnerClick }: OwnerWorkloadChartProps) {
  // Group initiatives by owner
  const ownerStats: Record<string, { count: number; onTrack: number; avgProgress: number }> = {};

  initiatives
    .filter(i => !i.isPillarRow && i.owner)
    .forEach(init => {
      const owner = init.owner!;
      if (!ownerStats[owner]) {
        ownerStats[owner] = { count: 0, onTrack: 0, avgProgress: 0 };
      }
      ownerStats[owner].count++;
      if (init.status === 'Green') ownerStats[owner].onTrack++;
      ownerStats[owner].avgProgress += init.percentComplete;
    });

  // Calculate averages and prepare chart data
  const chartData = Object.entries(ownerStats)
    .map(([owner, stats]) => ({
      owner: owner.length > 15 ? owner.substring(0, 15) + '...' : owner,
      fullName: owner,
      count: stats.count,
      onTrackPercent: Math.round((stats.onTrack / stats.count) * 100),
      avgProgress: Math.round(stats.avgProgress / stats.count),
      isAtRisk: (stats.onTrack / stats.count) < 0.6,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Top 10 owners

  const getBarColor = (onTrackPercent: number) => {
    if (onTrackPercent >= 75) return '#22C55E'; // Green
    if (onTrackPercent >= 50) return '#F59E0B'; // Amber
    return '#EF4444'; // Red
  };

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload || !payload[0]) return null;
    const item = payload[0].payload;

    return (
      <div className="bg-[#1B1F39] border border-white/10 rounded-xl p-4 shadow-xl">
        <p className="text-white font-semibold mb-2">{item.fullName}</p>
        <div className="space-y-1 text-[13px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8]">Initiatives:</span>
            <span className="text-white font-medium">{item.count}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8]">On Track:</span>
            <span className="font-medium" style={{ color: getBarColor(item.onTrackPercent) }}>
              {item.onTrackPercent}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#94A3B8]">Avg Progress:</span>
            <span className="text-white font-medium">{item.avgProgress}%</span>
          </div>
          {item.isAtRisk && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <span className="text-[#EF4444] text-[12px] flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Needs attention
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const handleClick = (data: { payload?: typeof chartData[0] }) => {
    if (onOwnerClick && data.payload) {
      onOwnerClick(data.payload.fullName);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
        >
          <XAxis type="number" stroke="#475569" tick={{ fill: '#64748B', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="owner"
            stroke="#475569"
            tick={{ fill: '#94A3B8', fontSize: 12 }}
            width={75}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <ReferenceLine x={0} stroke="#475569" />
          <Bar
            dataKey="count"
            animationDuration={1000}
            radius={[0, 4, 4, 0]}
            onClick={(data) => handleClick(data)}
            style={{ cursor: onOwnerClick ? 'pointer' : 'default' }}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.onTrackPercent)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
