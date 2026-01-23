'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, tokens } from '@/components/mars-ui';

// Lazy load tab content
const ClausesTab = dynamic(() => import('./tabs/ClausesTab'), {
  loading: () => <TabLoadingState label="Loading Clause Library..." />,
});
const PlaybooksTab = dynamic(() => import('./tabs/PlaybooksTab'), {
  loading: () => <TabLoadingState label="Loading Playbooks..." />,
});
const AITrainingTab = dynamic(() => import('./tabs/AITrainingTab'), {
  loading: () => <TabLoadingState label="Loading AI Training..." />,
});

type TabId = 'clauses' | 'playbooks' | 'ai-training';

interface Tab {
  id: TabId;
  label: string;
  icon: JSX.Element;
  badge?: string;
}

const tabs: Tab[] = [
  {
    id: 'clauses',
    label: 'Clause Library',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    id: 'playbooks',
    label: 'Playbooks',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
  },
  {
    id: 'ai-training',
    label: 'AI Training',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    badge: 'Claude',
  },
];

function TabLoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#64748B] text-sm">{label}</p>
      </div>
    </div>
  );
}

function getBadgeColor(badge: string): string {
  switch (badge) {
    case 'Claude':
      return 'bg-[#A855F7]/20 text-[#A855F7]';
    default:
      return 'bg-[#64748B]/20 text-[#64748B]';
  }
}

function KnowledgeBaseContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('clauses');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Sync tab with URL
  useEffect(() => {
    const tab = searchParams.get('tab') as TabId;
    if (tab && tabs.find(t => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    router.push(`/knowledge-base?tab=${tabId}`, { scroll: false });
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <DashboardBackground preset={backgroundPresets.subtle}>
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="min-h-screen"
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white mb-1">Knowledge Base</h1>
            <p className="text-[#64748B] text-sm">Manage clauses, playbooks, and AI training data</p>
          </div>

          {/* Tab Navigation */}
          <div className={`mb-6 rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} p-1.5`}>
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${activeTab === tab.id
                      ? 'bg-[#1E3A5F] text-white'
                      : 'text-[#64748B] hover:text-white hover:bg-[#1E293B]'
                    }
                  `}
                >
                  <span className={activeTab === tab.id ? 'text-[#38BDF8]' : ''}>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getBadgeColor(tab.badge)}`}>
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'clauses' && <ClausesTab />}
              {activeTab === 'playbooks' && <PlaybooksTab />}
              {activeTab === 'ai-training' && <AITrainingTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </DashboardBackground>
  );
}

export default function KnowledgeBasePage() {
  return (
    <Suspense fallback={<TabLoadingState label="Loading..." />}>
      <KnowledgeBaseContent />
    </Suspense>
  );
}
