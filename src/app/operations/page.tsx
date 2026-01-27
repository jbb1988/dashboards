'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';
import OperationsCommandCenter from './components/OperationsCommandCenter';

function OperationsContent() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') as 'orders' | 'inventory' | 'wip' | null;

  const mainStyle = {
    marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
    transition: 'margin-left 0.3s ease',
  };

  return (
    <div className="min-h-screen bg-[#0B1220]">
      <DashboardBackground {...backgroundPresets.pm} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.div className="relative z-10 text-white" style={mainStyle}>
        {/* Header */}
        <header className="border-b border-white/[0.04] bg-[#0B1220]/90 backdrop-blur-xl sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[22px] font-bold mb-1 bg-clip-text text-transparent bg-gradient-to-r from-white via-white to-[#8FA3BF]">
                  Operations Center
                </h1>
                <p className="text-[11px] text-[#475569]">
                  Order → Cash Visibility & Inventory Status
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          <OperationsCommandCenter initialTab={initialTab || 'orders'} />
        </main>
      </motion.div>
    </div>
  );
}

export default function OperationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0B1220]" />}>
      <OperationsContent />
    </Suspense>
  );
}
