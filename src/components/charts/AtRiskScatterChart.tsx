'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
  ReferenceLine,
} from 'recharts';
import { ChartContainer, tooltipStyle, formatChartCurrency } from './ChartContainer';

interface ScatterPoint {
  name: string; // Location name
  distributor: string;
  x: number; // YoY Change %
  y: number; // Revenue
  z: number; // Opportunity score (for sizing)
  tier: 'high' | 'medium' | 'low';
}

interface AtRiskScatterChartProps {
  data: ScatterPoint[];
  index?: number;
}

const TIER_COLORS = {
  high: '#EF4444',    // Red
  medium: '#F59E0B',  // Amber
  low: '#06B6D4',     // Cyan
};

export function AtRiskScatterChart({ data, index = 0 }: AtRiskScatterChartProps) {
  // Group by tier for separate scatter series
  const highRisk = data.filter(d => d.tier === 'high');
  const mediumRisk = data.filter(d => d.tier === 'medium');
  const lowRisk = data.filter(d => d.tier === 'low');

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const point = payload[0].payload;
      return (
        <div style={{
          backgroundColor: '#1B1F39',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '12px',
          padding: '12px 16px',
        }}>
          <p className="text-white font-semibold mb-2">{point.name}</p>
          <p className="text-[#64748B] text-[11px] mb-1">{point.distributor}</p>
          <div className="space-y-1">
            <p className="text-[#94A3B8] text-[12px]">
              Revenue: <span className="text-white font-medium">{formatChartCurrency(point.y)}</span>
            </p>
            <p className="text-[#94A3B8] text-[12px]">
              YoY Change: <span className={point.x >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                {point.x >= 0 ? '+' : ''}{point.x.toFixed(1)}%
              </span>
            </p>
            <p className="text-[#94A3B8] text-[12px]">
              Risk Tier: <span
                className="font-medium"
                style={{ color: TIER_COLORS[point.tier as keyof typeof TIER_COLORS] }}
              >
                {point.tier.charAt(0).toUpperCase() + point.tier.slice(1)}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ChartContainer
      title="At-Risk Location Analysis"
      subtitle="Revenue vs YoY growth showing location health (size = opportunity score)"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      }
      index={index}
      height={360}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            type="number"
            dataKey="x"
            name="YoY Change %"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
            label={{
              value: 'YoY Change %',
              position: 'insideBottom',
              offset: -10,
              style: { fill: '#64748B', fontSize: 11 }
            }}
            tickFormatter={(value) => `${value >= 0 ? '+' : ''}${value}%`}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Revenue"
            stroke="#64748B"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => formatChartCurrency(value)}
            label={{
              value: 'Revenue',
              angle: -90,
              position: 'insideLeft',
              style: { fill: '#64748B', fontSize: 11 }
            }}
          />
          <ZAxis type="number" dataKey="z" range={[100, 1000]} />
          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: '3 3' }} />

          {/* Reference lines */}
          <ReferenceLine
            x={0}
            stroke="#64748B"
            strokeDasharray="5 5"
            strokeOpacity={0.3}
            label={{
              value: 'Flat YoY',
              position: 'top',
              fill: '#64748B',
              fontSize: 10
            }}
          />
          <ReferenceLine
            x={-10}
            stroke="#F59E0B"
            strokeDasharray="3 3"
            strokeOpacity={0.2}
            label={{
              value: '-10%',
              position: 'top',
              fill: '#F59E0B',
              fontSize: 10
            }}
          />

          {/* High Risk Points */}
          {highRisk.length > 0 && (
            <Scatter
              name="High Risk"
              data={highRisk}
              fill={TIER_COLORS.high}
              animationDuration={1000}
              animationBegin={index * 100}
            >
              {highRisk.map((entry, idx) => (
                <Cell
                  key={`high-${idx}`}
                  fill={TIER_COLORS.high}
                  fillOpacity={0.8}
                  stroke={TIER_COLORS.high}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          )}

          {/* Medium Risk Points */}
          {mediumRisk.length > 0 && (
            <Scatter
              name="Medium Risk"
              data={mediumRisk}
              fill={TIER_COLORS.medium}
              animationDuration={1000}
              animationBegin={index * 100 + 200}
            >
              {mediumRisk.map((entry, idx) => (
                <Cell
                  key={`medium-${idx}`}
                  fill={TIER_COLORS.medium}
                  fillOpacity={0.7}
                  stroke={TIER_COLORS.medium}
                  strokeWidth={2}
                />
              ))}
            </Scatter>
          )}

          {/* Low Risk Points */}
          {lowRisk.length > 0 && (
            <Scatter
              name="Low Risk"
              data={lowRisk}
              fill={TIER_COLORS.low}
              animationDuration={1000}
              animationBegin={index * 100 + 400}
            >
              {lowRisk.map((entry, idx) => (
                <Cell
                  key={`low-${idx}`}
                  fill={TIER_COLORS.low}
                  fillOpacity={0.6}
                  stroke={TIER_COLORS.low}
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          )}
        </ScatterChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS.high }} />
          <span className="text-[11px] text-[#94A3B8]">
            High Risk ({highRisk.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS.medium }} />
          <span className="text-[11px] text-[#94A3B8]">
            Medium Risk ({mediumRisk.length})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TIER_COLORS.low }} />
          <span className="text-[11px] text-[#94A3B8]">
            Low Risk ({lowRisk.length})
          </span>
        </div>
      </div>
    </ChartContainer>
  );
}
