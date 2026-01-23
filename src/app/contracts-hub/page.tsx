'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets, tokens } from '@/components/mars-ui';

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
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-[#64748B] text-sm">{label}</p>
      </div>
    </div>
  );
}

function getBadgeColor(badge: string): string {
  switch (badge) {
    case 'Salesforce':
      return 'bg-[#38BDF8]/20 text-[#38BDF8]';
    case 'Claude':
      return 'bg-[#A855F7]/20 text-[#A855F7]';
    default:
      return 'bg-[#64748B]/20 text-[#64748B]';
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
      <DashboardBackground {...backgroundPresets.contracts} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.main
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="min-h-screen relative z-10"
      >
        <div className="p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-white mb-1">Contracts Hub</h1>
            <p className="text-[#64748B] text-sm">Manage your contract pipeline, reviews, and obligations</p>
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
