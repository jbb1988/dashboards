'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, useSidebar } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';

const dashboards = [
  {
    number: '01',
    title: 'Contracts Pipeline',
    description: 'Track contracts from initial discussions through PO received. Manage documents, tasks, and approvals all in one place.',
    tips: [
      'View contracts by stage with the Pipeline tab',
      'Track document completeness for each contract',
      'Auto-generated tasks keep you on schedule',
    ],
    link: '/contracts-dashboard',
    linkText: 'Open Contracts',
    color: '#38BDF8',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Contract Review',
    description: 'AI-powered contract analysis with redlines, risk scoring, and approval workflows. Compare documents and get recommendations.',
    tips: [
      'Upload PDFs to compare changes section-by-section',
      'AI rates changes as Accept, Negotiate, or Push Back',
      'Send contracts for approval with tracking',
    ],
    link: '/review',
    linkText: 'Open Review',
    color: '#22C55E',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Sales Insights',
    description: 'Customer intelligence with attrition analysis, cross-sell opportunities, and AI-powered recommendations.',
    tips: [
      'Click any customer name for detailed purchase history',
      'View Stopped Buying report to catch early churn signals',
      'AI recommendations include specific action items',
    ],
    link: '/diversified-dashboard',
    linkText: 'Open Insights',
    color: '#A855F7',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
  {
    number: '04',
    title: 'Distributor Intelligence',
    description: 'Location health scores, priority actions, and peer benchmarking for strategic distributor management.',
    tips: [
      'Health scores combine revenue, engagement, margin, and category metrics',
      'Priority Actions show exactly what to do next',
      'Create Asana tasks directly from recommendations',
    ],
    link: '/distributors-dashboard',
    linkText: 'Open Distributors',
    color: '#14B8A6',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    number: '05',
    title: 'Project Closeout',
    description: 'Track project profitability from quote to completion. Monitor actual costs vs. estimates.',
    tips: [
      'Import projects from NetSuite sales orders',
      'Compare quoted vs. actual labor and materials',
      'Identify margin trends across project types',
    ],
    link: '/closeout-dashboard',
    linkText: 'Open Closeout',
    color: '#F59E0B',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    number: '06',
    title: 'Management Dashboard',
    description: 'Strategic initiatives tracking with Smartsheet integration. Monitor progress across all company pillars.',
    tips: [
      'View initiatives by pillar or owner',
      'Board view for drag-and-drop status updates',
      'Charts show progress and workload distribution',
    ],
    link: '/management-dashboard',
    linkText: 'Open Management',
    color: '#EC4899',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

const quickTips = [
  {
    title: 'Use the Sidebar',
    description: 'Navigate between dashboards using the sidebar on the left. Click the collapse button to save space.',
    icon: '📍',
  },
  {
    title: 'Click for Details',
    description: 'Most tables support click-to-expand. Click any row to see more details in a drawer or modal.',
    icon: '👆',
  },
  {
    title: 'Filter Everything',
    description: 'Look for filter icons and dropdowns. Most views support filtering by date, status, and more.',
    icon: '🔍',
  },
  {
    title: 'Get Help Anytime',
    description: 'Click the help button in the bottom-right corner to search guides or ask the AI assistant.',
    icon: '💡',
  },
];

export default function GettingStartedPage() {
  const { isCollapsed } = useSidebar();

  return (
    <div className="flex min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.guides} />
      <Sidebar />

      <motion.main
        animate={{
          marginLeft: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
          width: `calc(100% - ${isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px)`,
        }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="flex-1 min-h-screen relative z-10"
      >
        <div className="max-w-4xl mx-auto px-8 py-12">
          {/* Back Link */}
          <Link
            href="/guides"
            className="inline-flex items-center gap-2 text-[#64748B] hover:text-white transition-colors mb-8"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Guides
          </Link>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <div className="flex items-center gap-4 mb-6">
              <Image
                src="/drop-white.png"
                alt="MARS"
                width={48}
                height={48}
                className="drop-shadow-lg"
              />
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#22C55E]/10 rounded-full">
                <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-[#22C55E] text-sm font-medium">5-Minute Overview</span>
              </div>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Getting Started with MARS</h1>
            <p className="text-xl text-[#8FA3BF] max-w-2xl">
              Welcome to MARS! Explore the executive dashboards for contracts, sales insights, distributors, project closeout, and more.
            </p>
          </motion.div>

          {/* Quick Tips */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6 mb-12"
          >
            <h2 className="text-lg font-semibold text-white mb-4">Quick Tips</h2>
            <div className="grid grid-cols-2 gap-4">
              {quickTips.map((tip, index) => (
                <div
                  key={tip.title}
                  className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-xl border border-white/[0.04]"
                >
                  <span className="text-2xl">{tip.icon}</span>
                  <div>
                    <h4 className="text-white font-medium text-sm mb-1">{tip.title}</h4>
                    <p className="text-[#64748B] text-xs">{tip.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Dashboards */}
          <h2 className="text-2xl font-bold text-white mb-6">Explore the Dashboards</h2>
          <div className="space-y-6 mb-12">
            {dashboards.map((dashboard, index) => (
              <motion.div
                key={dashboard.number}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.08 }}
                className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: `${dashboard.color}15`, color: dashboard.color }}
                    >
                      {dashboard.icon}
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-[#64748B] text-sm font-mono">{dashboard.number}</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">{dashboard.title}</h3>
                    <p className="text-[#8FA3BF] mb-4">{dashboard.description}</p>

                    <div className="bg-[#0B1220] rounded-xl p-4 mb-4">
                      <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">Key Features</p>
                      <ul className="space-y-2">
                        {dashboard.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#8FA3BF]">
                            <svg className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: dashboard.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href={dashboard.link}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                      style={{
                        backgroundColor: `${dashboard.color}15`,
                        color: dashboard.color,
                      }}
                    >
                      {dashboard.linkText}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Help */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-center bg-gradient-to-r from-[#38BDF8]/10 to-[#8B5CF6]/10 rounded-2xl border border-white/[0.06] p-8"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Need Help?</h3>
            <p className="text-[#8FA3BF] mb-4">
              Click the help button in the bottom-right corner to search guides or chat with the AI assistant.
            </p>
            <a
              href="mailto:support@marswater.com"
              className="inline-flex items-center gap-2 text-[#38BDF8] hover:underline"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              support@marswater.com
            </a>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
