'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TopItem {
  item_id: string;
  item_name: string;
  units: number;
  revenue: number;
}

interface TopItemsByClassProps {
  data: Record<string, TopItem[]>;
  title?: string;
  subtitle?: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
};

const formatNumber = (value: number): string => {
  return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
};

export function TopItemsByClass({
  data,
  title = 'Top Items by Class',
  subtitle = 'Click to expand and see top-selling items in each class',
}: TopItemsByClassProps) {
  const [expandedClass, setExpandedClass] = useState<string | null>(null);

  const classes = Object.keys(data).sort((a, b) => {
    const aTotalUnits = data[a].reduce((sum, item) => sum + item.units, 0);
    const bTotalUnits = data[b].reduce((sum, item) => sum + item.units, 0);
    return bTotalUnits - aTotalUnits;
  });

  const toggleClass = (className: string) => {
    setExpandedClass(expandedClass === className ? null : className);
  };

  return (
    <div className="bg-[#151F2E] rounded-xl border border-[#2A3F5F] overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[#2A3F5F]">
        <div className="flex items-center gap-3">
          <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          <div>
            <h3 className="text-[16px] font-semibold text-white">{title}</h3>
            <p className="text-[12px] text-[#64748B] mt-0.5">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Accordion List */}
      <div className="divide-y divide-[#2A3F5F]">
        {classes.map((className, idx) => {
          const items = data[className];
          const totalUnits = items.reduce((sum, item) => sum + item.units, 0);
          const totalRevenue = items.reduce((sum, item) => sum + item.revenue, 0);
          const isExpanded = expandedClass === className;

          return (
            <div key={className} className={idx % 2 === 0 ? 'bg-[#151F2E]' : 'bg-[#0F1722]'}>
              {/* Class Header */}
              <button
                onClick={() => toggleClass(className)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#1A2942] transition-colors"
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    animate={{ rotate: isExpanded ? 90 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <svg className="w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </motion.div>
                  <span className="text-[14px] font-semibold text-white">{className}</span>
                  <span className="text-[11px] text-[#64748B] bg-[#334155] px-2 py-0.5 rounded">
                    {items.length} items
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-[11px] text-[#64748B] uppercase tracking-wider">Units</div>
                    <div className="text-[14px] font-semibold text-cyan-400">{formatNumber(totalUnits)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-[#64748B] uppercase tracking-wider">Revenue</div>
                    <div className="text-[14px] font-semibold text-white">{formatCurrency(totalRevenue)}</div>
                  </div>
                </div>
              </button>

              {/* Expanded Items */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="px-6 pb-4 pt-2 bg-[#0A1118]">
                      <div className="space-y-2">
                        {items.map((item, itemIdx) => {
                          const pctOfClass = totalUnits > 0 ? (item.units / totalUnits) * 100 : 0;

                          return (
                            <motion.div
                              key={item.item_id}
                              initial={{ x: -20, opacity: 0 }}
                              animate={{ x: 0, opacity: 1 }}
                              transition={{ duration: 0.2, delay: itemIdx * 0.05 }}
                              className="flex items-center justify-between py-3 px-4 bg-[#151F2E] rounded-lg border border-[#2A3F5F] hover:border-[#38BDF8] transition-colors"
                            >
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <span className="text-[11px] font-bold text-[#64748B] w-6 text-center">
                                  #{itemIdx + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-white truncate">
                                    {item.item_name}
                                  </div>
                                  <div className="text-[11px] text-[#64748B]">
                                    {pctOfClass.toFixed(1)}% of class units
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-6 ml-4">
                                <div className="text-right">
                                  <div className="text-[11px] text-[#64748B]">Units</div>
                                  <div className="text-[13px] font-semibold text-cyan-400">
                                    {formatNumber(item.units)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-[#64748B]">Revenue</div>
                                  <div className="text-[13px] font-semibold text-white">
                                    {formatCurrency(item.revenue)}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-[11px] text-[#64748B]">Avg Price</div>
                                  <div className="text-[13px] font-semibold text-[#94A3B8]">
                                    {formatCurrency(item.units > 0 ? item.revenue / item.units : 0)}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[#0F1722] border-t border-[#2A3F5F] text-center">
        <span className="text-[11px] text-[#64748B]">
          {classes.length} classes • Showing top 10 items per class
        </span>
      </div>
    </div>
  );
}
