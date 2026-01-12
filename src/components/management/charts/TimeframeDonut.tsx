'use client';

import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { motion } from 'framer-motion';

interface TimeframeDonutProps {
  data: Record<string, number>;
  total: number;
}

const TIMEFRAME_CONFIG = [
  { key: '30-60', label: '30-60 Days', color: '#EF4444', description: 'Due soon - needs attention' },
  { key: '90', label: '90 Days', color: '#F59E0B', description: 'Coming up' },
  { key: '90+', label: '90+ Days', color: '#22C55E', description: 'Long-term initiatives' },
];

export default function TimeframeDonut({ data, total }: TimeframeDonutProps) {
  // Transform data for pie chart
  const chartData = TIMEFRAME_CONFIG.map(tf => ({
    name: tf.label,
    value: data[tf.key] || 0,
    color: tf.color,
    description: tf.description,
    percent: total > 0 ? Math.round(((data[tf.key] || 0) / total) * 100) : 0,
  })).filter(d => d.value > 0);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof chartData[0] }> }) => {
    if (!active || !payload || !payload[0]) return null;
    const item = payload[0].payload;

    return (
      <div className="bg-[#1B1F39] border border-white/10 rounded-xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
          <p className="text-white font-semibold">{item.name}</p>
        </div>
        <p className="text-[#64748B] text-[12px] mb-2">{item.description}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#94A3B8] text-[13px]">Initiatives:</span>
          <span className="text-white font-semibold">{item.value}</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#94A3B8] text-[13px]">Percentage:</span>
          <span className="text-white font-semibold">{item.percent}%</span>
        </div>
      </div>
    );
  };

  const renderLegend = () => (
    <div className="flex flex-col gap-2 ml-4">
      {chartData.map((entry, index) => (
        <div key={entry.name} className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-[#94A3B8] text-[13px]">{entry.name}:</span>
          <span className="text-white font-medium">{entry.value}</span>
          <span className="text-[#64748B] text-[12px]">({entry.percent}%)</span>
        </div>
      ))}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="h-full flex items-center"
    >
      <ResponsiveContainer width="60%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="55%"
            outerRadius="85%"
            paddingAngle={3}
            dataKey="value"
            animationDuration={1000}
            animationBegin={0}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {/* Center label */}
          <text x="50%" y="46%" textAnchor="middle" fill="#fff" fontSize={28} fontWeight={700}>
            {total}
          </text>
          <text x="50%" y="56%" textAnchor="middle" fill="#64748B" fontSize={12}>
            Total
          </text>
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 pl-4">
        {renderLegend()}
      </div>
    </motion.div>
  );
}
