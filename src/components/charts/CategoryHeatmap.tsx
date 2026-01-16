'use client';

import { motion } from 'framer-motion';
import { ChartContainer, formatChartCurrency } from './ChartContainer';

interface HeatmapCell {
  distributor: string;
  category: string;
  revenue: number;
  percentage: number; // % of distributor's total revenue
}

interface CategoryHeatmapProps {
  data: HeatmapCell[];
  distributors: string[];
  categories: string[];
  index?: number;
}

export function CategoryHeatmap({
  data,
  distributors,
  categories,
  index = 0
}: CategoryHeatmapProps) {
  // Find max revenue for color scaling
  const maxRevenue = Math.max(...data.map(d => d.revenue), 0);

  // Get cell data for a specific distributor-category combination
  const getCellData = (distributor: string, category: string) => {
    return data.find(d => d.distributor === distributor && d.category === category);
  };

  // Calculate color intensity based on revenue
  const getColorIntensity = (revenue: number) => {
    if (revenue === 0) return 0;
    const normalized = revenue / maxRevenue;
    return Math.max(0.1, normalized); // Min 10% opacity for visibility
  };

  // Get color based on intensity
  const getBackgroundColor = (revenue: number) => {
    const intensity = getColorIntensity(revenue);
    if (intensity === 0) return 'rgba(255, 255, 255, 0.02)';

    // Teal gradient
    const r = Math.round(20 + (20 * intensity));
    const g = Math.round(184 + (71 * intensity));
    const b = Math.round(166 + (89 * intensity));
    return `rgba(${r}, ${g}, ${b}, ${intensity * 0.3})`;
  };

  // Get border color for cells with revenue
  const getBorderColor = (revenue: number) => {
    const intensity = getColorIntensity(revenue);
    if (intensity === 0) return 'rgba(255, 255, 255, 0.04)';
    return `rgba(20, 184, 166, ${intensity * 0.5})`;
  };

  return (
    <ChartContainer
      title="Category Penetration Heatmap"
      subtitle="Revenue distribution across product categories by distributor"
      icon={
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      }
      index={index}
      height={Math.min(400, distributors.length * 60 + 100)}
      expandable={true}
    >
      <div className="overflow-auto max-h-full">
        <div className="min-w-[600px]">
          {/* Header Row - Categories */}
          <div className="grid gap-1 mb-1" style={{
            gridTemplateColumns: `180px repeat(${categories.length}, minmax(100px, 1fr))`
          }}>
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-3 py-2">
              Distributor
            </div>
            {categories.map((category) => (
              <div
                key={category}
                className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-2 py-2 text-center"
                title={category}
              >
                <div className="truncate">{category}</div>
              </div>
            ))}
          </div>

          {/* Data Rows */}
          {distributors.map((distributor, distIdx) => (
            <motion.div
              key={distributor}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: distIdx * 0.05 }}
              className="grid gap-1 mb-1"
              style={{
                gridTemplateColumns: `180px repeat(${categories.length}, minmax(100px, 1fr))`
              }}
            >
              {/* Distributor Name */}
              <div className="text-[13px] font-medium text-white px-3 py-3 bg-[#151F2E] rounded-lg border border-white/[0.04] flex items-center">
                <span className="truncate" title={distributor}>{distributor}</span>
              </div>

              {/* Category Cells */}
              {categories.map((category) => {
                const cellData = getCellData(distributor, category);
                const revenue = cellData?.revenue || 0;
                const percentage = cellData?.percentage || 0;

                return (
                  <motion.div
                    key={`${distributor}-${category}`}
                    className="rounded-lg p-2 flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 group relative"
                    style={{
                      backgroundColor: getBackgroundColor(revenue),
                      border: `1px solid ${getBorderColor(revenue)}`,
                    }}
                    whileHover={{ scale: 1.05 }}
                    title={`${distributor} - ${category}\n${formatChartCurrency(revenue)} (${percentage.toFixed(1)}%)`}
                  >
                    {revenue > 0 ? (
                      <>
                        <div className="text-[12px] font-semibold text-white">
                          {formatChartCurrency(revenue)}
                        </div>
                        <div className="text-[10px] text-[#14B8A6]">
                          {percentage.toFixed(1)}%
                        </div>
                      </>
                    ) : (
                      <div className="text-[11px] text-[#475569]">—</div>
                    )}

                    {/* Hover Tooltip */}
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-[#1B1F39] border border-white/[0.1] rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                      <div className="text-[11px] text-white font-medium">{category}</div>
                      <div className="text-[10px] text-[#94A3B8] mt-1">
                        {revenue > 0 ? (
                          <>
                            {formatChartCurrency(revenue)} ({percentage.toFixed(1)}% of distributor)
                          </>
                        ) : (
                          'No purchases'
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-white/[0.04]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-[#64748B] uppercase tracking-wider">Intensity:</span>
              <div className="flex items-center gap-2">
                <div className="w-8 h-4 rounded" style={{ backgroundColor: 'rgba(20, 184, 166, 0.1)' }} />
                <span className="text-[10px] text-[#64748B]">Low</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-4 rounded" style={{ backgroundColor: 'rgba(20, 184, 166, 0.2)' }} />
                <span className="text-[10px] text-[#64748B]">Medium</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-4 rounded" style={{ backgroundColor: 'rgba(20, 184, 166, 0.3)' }} />
                <span className="text-[10px] text-[#64748B]">High</span>
              </div>
            </div>
            <div className="text-[10px] text-[#475569]">
              Color intensity represents revenue amount
            </div>
          </div>
        </div>
      </div>
    </ChartContainer>
  );
}
