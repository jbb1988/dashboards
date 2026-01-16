'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency, CHART_COLORS } from './ChartContainer';

interface ConcentrationData {
  name: string;
  value: number;
  percentage: number;
  [key: string]: any; // Allow Recharts to access additional properties
}

interface LocationConcentrationChartProps {
  data: ConcentrationData[];
  totalRevenue: number;
  hhi: number; // Herfindahl-Hirschman Index (concentration metric)
  index?: number;
}

const CONCENTRATION_COLORS = [
  CHART_COLORS.teal,
  CHART_COLORS.cyan,
  CHART_COLORS.emerald,
  CHART_COLORS.purple,
  CHART_COLORS.blue,
  '#64748B', // Gray for "Other"
];

export function LocationConcentrationChart({
  data,
  totalRevenue,
  hhi,
  index = 0
}: LocationConcentrationChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          backgroundColor: '#1B1F39',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '12px 16px',
        }}>
          <p className="text-white font-semibold mb-2">{payload[0].name}</p>
          <p className="text-[#94A3B8] text-[13px]">
            {formatChartCurrency(payload[0].value)}
          </p>
          <p className="text-[#14B8A6] text-[12px] font-medium">
            {payload[0].payload.percentage.toFixed(1)}% of total
          </p>
        </div>
      );
    }
    return null;
  };

  const CustomLabel = ({ cx, cy }: any) => {
    const getConcentrationLevel = () => {
      if (hhi > 2500) return { text: 'High', color: '#EF4444' };
      if (hhi > 1500) return { text: 'Medium', color: '#F59E0B' };
      return { text: 'Low', color: '#22C55E' };
    };

    const level = getConcentrationLevel();

    return (
      <g>
        <text
          x={cx}
          y={cy - 10}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-white text-[18px] font-bold"
        >
          HHI
        </text>
        <text
          x={cx}
          y={cy + 15}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[14px] font-semibold"
          fill={level.color}
        >
          {hhi.toFixed(0)}
        </text>
        <text
          x={cx}
          y={cy + 32}
          textAnchor="middle"
          dominantBaseline="middle"
          className="fill-[#64748B] text-[11px]"
        >
          {level.text}
        </text>
      </g>
    );
  };

  return (
    <ChartContainer
      title="Location Revenue Concentration"
      subtitle="Top locations by revenue contribution with HHI score"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
      }
      index={index}
      height={320}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={110}
            paddingAngle={2}
            dataKey="value"
            label={(entry: any) => `${entry.percentage.toFixed(1)}%`}
            labelLine={{
              stroke: '#64748B',
              strokeWidth: 1,
            }}
            animationDuration={1000}
            animationBegin={index * 100}
          >
            {data.map((entry, idx) => (
              <Cell
                key={`cell-${idx}`}
                fill={CONCENTRATION_COLORS[idx % CONCENTRATION_COLORS.length]}
                stroke="#0F1123"
                strokeWidth={2}
              />
            ))}
            <CustomLabel />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend
            verticalAlign="bottom"
            height={60}
            formatter={(value, entry: any) => (
              <span className="text-[12px]">
                {value} <span className="text-[#64748B]">({entry.payload.percentage.toFixed(1)}%)</span>
              </span>
            )}
            wrapperStyle={{ color: '#94A3B8', fontSize: 12, paddingTop: 20 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
