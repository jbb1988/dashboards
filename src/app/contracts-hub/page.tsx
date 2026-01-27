'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';

// Lazy load tab content to improve initial load
const PipelineTab = dynamic(() => import('./tabs/PipelineTab'), {
  loading: () => <TabLoadingState label="Loading Pipeline..." />,
});
const ReviewTab = dynamic(() => import('./tabs/ReviewTab'), {
  loading: () => <TabLoadingState label="Loading Review..." />,
});
const GenerateTab = dynamic(() => import('./tabs/GenerateTab'), {
  loading: () => <TabLoadingState label="Loading Generator..." />,
});
const ObligationsTab = dynamic(() => import('./tabs/ObligationsTab'), {
  loading: () => <TabLoadingState label="Loading Obligations..." />,
});

type TabId = 'pipeline' | 'review' | 'generate' | 'obligations';

interface Tab {
  id: TabId;
  label: string;
  icon: JSX.Element;
  badge?: string;
}

const tabs: Tab[] = [
  {
    id: 'pipeline',
    label: 'Pipeline',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    badge: 'Salesforce',
  },
  {
    id: 'review',
    label: 'Review',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    badge: 'Claude',
  },
  {
    id: 'generate',
    label: 'Generate',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    ),
    badge: 'Claude',
  },
  {
    id: 'obligations',
    label: 'Obligations',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    badge: 'Claude',
  },
];

function TabLoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-[var(--accent-blue)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[var(--text-muted)] text-sm">{label}</p>
      </div>
    </div>
  );
}

function getBadgeColor(badge: string): string {
  switch (badge) {
    case 'Salesforce':
      return 'bg-[var(--accent-blue)]/20 text-[var(--accent-blue)]';
    case 'Claude':
      return 'bg-[#A855F7]/20 text-[#A855F7]';
    default:
      return 'bg-[var(--text-muted)]/20 text-[var(--text-muted)]';
  }
}

function ContractsHubContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>('pipeline');
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
    router.push(`/contracts-hub?tab=${tabId}`, { scroll: false });
  };

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  return (
    <>
      {/* L0 - Base Canvas */}
      <div
        className="fixed inset-0 z-0"
        style={{
          background: 'radial-gradient(1200px 800px at 50% -20%, rgba(90,130,255,0.22), rgba(10,14,20,0.98) 60%)',
        }}
      />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="min-h-screen relative z-10"
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-[rgba(235,240,255,0.92)] mb-1">Contracts Hub</h1>
            <p className="text-[rgba(200,210,235,0.75)] text-sm">Manage your contract pipeline, reviews, and obligations</p>
          </div>

          {/* L2 - Tab Navigation Toolbar */}
          <div
            className="mb-6 rounded-2xl p-1.5"
            style={{
              background: 'linear-gradient(180deg, rgba(36,46,66,0.92), rgba(22,30,44,0.98))',
              boxShadow: '0 30px 90px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.08)' : 'transparent',
                    borderLeft: activeTab === tab.id ? '2px solid rgba(90,130,255,0.95)' : '2px solid transparent',
                    color: activeTab === tab.id ? 'rgba(235,240,255,0.95)' : 'rgba(235,240,255,0.5)',
                  }}
                >
                  <span style={{ color: activeTab === tab.id ? 'rgba(90,130,255,0.95)' : 'inherit' }}>{tab.icon}</span>
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
              {activeTab === 'pipeline' && <PipelineTab />}
              {activeTab === 'review' && <ReviewTab />}
              {activeTab === 'generate' && <GenerateTab />}
              {activeTab === 'obligations' && <ObligationsTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.main>
    </>
  );
}

export default function ContractsHubPage() {
  return (
    <Suspense fallback={<TabLoadingState label="Loading..." />}>
      <ContractsHubContent />
    </Suspense>
  );
}
