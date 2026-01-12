'use client';

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface PillarStats {
  total: number;
  onTrack: number;
  atRisk: number;
  critical: number;
  complete: number;
  avgProgress: number;
}

interface PillarStatusChartProps {
  data: Record<string, PillarStats>;
  pillarColors: Record<string, string>;
}

const STATUS_COLORS = {
  onTrack: '#22C55E',
  atRisk: '#F59E0B',
  critical: '#EF4444',
  complete: '#64748B',
};

export default function PillarStatusChart({ data, pillarColors }: PillarStatusChartProps) {
  // Transform data for stacked bar chart
  const chartData = Object.entries(data).map(([pillar, stats]) => ({
    pillar: pillar.replace(' SATISFACTION', '').replace('TEAM MEMBER', 'TEAM'),
    fullName: pillar,
    onTrack: stats.onTrack,
    atRisk: stats.atRisk,
    critical: stats.critical,
    complete: stats.complete,
    total: stats.total,
    color: pillarColors[pillar] || '#64748B',
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload || !payload[0]) return null;
    const item = payload[0].payload;

    return (
      <div className="bg-[#1B1F39] border border-white/10 rounded-xl p-4 shadow-xl">
        <p className="text-white font-semibold mb-2">{item.fullName}</p>
        <div className="space-y-1 text-[13px]">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.onTrack }} />
            <span className="text-[#94A3B8]">On Track:</span>
            <span className="text-white font-medium">{item.onTrack}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.atRisk }} />
            <span className="text-[#94A3B8]">At Risk:</span>
            <span className="text-white font-medium">{item.atRisk}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.critical }} />
            <span className="text-[#94A3B8]">Critical:</span>
            <span className="text-white font-medium">{item.critical}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.complete }} />
            <span className="text-[#94A3B8]">Complete:</span>
            <span className="text-white font-medium">{item.complete}</span>
          </div>
          <div className="border-t border-white/10 pt-1 mt-2">
            <span className="text-[#64748B]">Total: </span>
            <span className="text-white font-semibold">{item.total}</span>
          </div>
        </div>
      </div>
    );
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
          margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
        >
          <XAxis type="number" stroke="#475569" tick={{ fill: '#64748B', fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="pillar"
            stroke="#475569"
            tick={{ fill: '#94A3B8', fontSize: 13 }}
            width={95}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.02)' }} />
          <Legend
            wrapperStyle={{ paddingTop: 20 }}
            formatter={(value) => <span className="text-[#94A3B8] text-[12px]">{value}</span>}
          />
          <Bar
            dataKey="onTrack"
            name="On Track"
            stackId="status"
            fill={STATUS_COLORS.onTrack}
            animationDuration={1000}
            animationBegin={0}
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="atRisk"
            name="At Risk"
            stackId="status"
            fill={STATUS_COLORS.atRisk}
            animationDuration={1000}
            animationBegin={200}
          />
          <Bar
            dataKey="critical"
            name="Critical"
            stackId="status"
            fill={STATUS_COLORS.critical}
            animationDuration={1000}
            animationBegin={400}
          />
          <Bar
            dataKey="complete"
            name="Complete"
            stackId="status"
            fill={STATUS_COLORS.complete}
            animationDuration={1000}
            animationBegin={600}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
