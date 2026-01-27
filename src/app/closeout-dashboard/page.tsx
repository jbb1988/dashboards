'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, DataSourceIndicator } from '@/components/mars-ui';
import ProfitabilityDashboard from './components/ProfitabilityDashboard';

export default function CloseoutDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);


  const mainStyle = {
    marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    transition: 'margin-left 0.3s ease',
  };

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <DashboardBackground {...backgroundPresets.finance} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.div className="relative z-10 text-white" style={mainStyle}>
        {/* Header */}
        <header className="border-b border-white/[0.04] bg-[#0B1220]/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-[#8FA3BF]">
                  Project Profitability
                </h1>
                <p className="text-[11px] text-[#475569]">
                  Financial Performance & Margin Analysis
                </p>
              </div>
              <DataSourceIndicator
                source="netsuite"
                lastUpdated={new Date().toISOString()}
              />
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          <ProfitabilityDashboard />
        </main>
      </motion.div>
    </div>
  );
}

