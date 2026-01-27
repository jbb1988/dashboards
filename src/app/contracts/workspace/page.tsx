'use client';

import { Suspense, useState } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, useSidebar, SidebarContext } from '@/components/Sidebar';
import { ContractCommandCenter } from '@/components/contracts/command-center';
import { elevation } from '@/components/mars-ui/tokens';

function LoadingFallback() {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: elevation.L0.background }}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-3 border-[rgba(90,130,255,0.95)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[14px] text-[rgba(200,210,235,0.60)]">
          Loading Contract Workspace...
        </p>
      </div>
    </div>
  );
}

function ContractWorkspaceContent() {
  const { isCollapsed } = useSidebar();
  const sidebarWidth = isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <motion.main
      className="flex-1 min-h-screen"
      animate={{ marginLeft: sidebarWidth }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <ContractCommandCenter />
    </motion.main>
  );
}

export default function ContractWorkspacePage() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ isCollapsed, setIsCollapsed }}>
      <Suspense fallback={<LoadingFallback />}>
        <div className="flex min-h-screen" style={{ background: elevation.L0.background }}>
          <Sidebar />
          <ContractWorkspaceContent />
        </div>
      </Suspense>
    </SidebarContext.Provider>
  );
}
