'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, useSidebar } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';

interface GuideCategory {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  topics: string[];
  href: string;
}

const guideCategories: GuideCategory[] = [
  {
    id: 'pipeline',
    title: 'Contracts Pipeline',
    description: 'Master the contract lifecycle from lead to close with powerful pipeline management tools.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: '#38BDF8',
    topics: [
      'Understanding Pipeline Stages',
      'Filtering & Search',
      'Date Management',
      'Salesforce Integration',
      'KPI Cards & Metrics',
    ],
    href: '/guides/pipeline',
  },
  {
    id: 'documents',
    title: 'Document Management',
    description: 'Track contract documents, ensure completeness, and manage the document lifecycle.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    color: '#8B5CF6',
    topics: [
      'Document Types',
      'Completeness Tracking',
      'Smart Views (Needs Attention, Closing Soon)',
      'Uploading Documents',
      'Version Control',
    ],
    href: '/guides/documents',
  },
  {
    id: 'tasks',
    title: 'Task Management',
    description: 'Stay on top of contract activities with auto-generated tasks and powerful tracking.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: '#F59E0B',
    topics: [
      'Auto-Generated Tasks',
      'Task Views (List, Board, By Contract)',
      'Due Dates & Priorities',
      'Quick Filters',
      'Command Palette (Cmd+K)',
    ],
    href: '/guides/tasks',
  },
  {
    id: 'bundles',
    title: 'Contract Bundles',
    description: 'Group related contracts together and manage shared tasks and documents across the bundle.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: '#A855F7',
    topics: [
      'Creating & Managing Bundles',
      'Bundle Tasks & Documents',
      'By Bundle View Mode',
      'Bundle Badges & Indicators',
      'Use Cases & Best Practices',
    ],
    href: '/guides/bundles',
  },
  {
    id: 'review',
    title: 'Contract Review',
    description: 'AI-powered contract review with redlines, risk scoring, approval workflow, and playbook comparison.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: '#22C55E',
    topics: [
      'AI-First Approach',
      'Risk Scoring (High/Medium/Low)',
      'Approval Workflow & CC Others',
      '@Mentions & Discussions',
      'Version Diff Comparison',
      'Automated Reminders',
      'Playbooks & Standard Agreements',
    ],
    href: '/guides/review',
  },
  {
    id: 'insights',
    title: 'Sales Insights',
    description: 'Customer intelligence, behavioral segmentation, and AI-powered recommendations with ROI tracking.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: '#A855F7',
    topics: [
      'Customer Behavioral Segmentation',
      'Insight Eligibility Filtering',
      'AI Recommendations',
      'ROI Tracking via Asana',
      'Cross-Sell Opportunities',
      'Attrition Analysis',
    ],
    href: '/guides/insights',
  },
  {
    id: 'distributors',
    title: 'Distributor Intelligence',
    description: 'Location health scores, priority actions, peer benchmarking, and strategic recommendations for distributor management.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: '#14B8A6',
    topics: [
      'Location Health Scores (0-100)',
      'Priority Action Cards',
      'Competitive Position Metrics',
      'Peer Benchmarking',
      'Product Context & Categories',
      'Task Creation from Insights',
    ],
    href: '/guides/distributors',
  },
];

const quickStartItems = [
  {
    title: 'Use the Sidebar',
    description: 'Navigate between dashboards using the sidebar. Click collapse to save space.',
    icon: '📍',
  },
  {
    title: 'Pipeline Stages',
    description: 'Understand the 6 contract stages from Discussions to PO Received',
    icon: '📊',
  },
  {
    title: 'Auto-Generated Tasks',
    description: 'Tasks are automatically created based on contract stage transitions',
    icon: '✨',
  },
  {
    title: 'Get Help Anytime',
    description: 'Click the help button in the bottom-right corner to search or ask AI',
    icon: '💡',
  },
];

export default function GuidesPage() {
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
        <div className="max-w-6xl mx-auto px-8 py-12">
          {/* Hero Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#38BDF8]/10 rounded-full mb-6">
              <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
              <span className="text-[#38BDF8] text-sm font-medium">Documentation</span>
            </div>

            <h1 className="text-5xl font-bold text-white mb-4">
              MARS <span className="text-[#38BDF8]">Guides</span>
            </h1>
            <p className="text-xl text-[#8FA3BF] max-w-2xl mx-auto">
              Everything you need to master contract management. From pipeline tracking to document completeness, learn how to work smarter with MARS.
            </p>
          </motion.div>

          {/* Quick Links - Getting Started & FAQ */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-4 mb-12"
          >
            <Link
              href="/guides/getting-started"
              className="group flex items-center gap-4 p-5 bg-gradient-to-r from-[#22C55E]/10 to-transparent rounded-2xl border border-[#22C55E]/20 hover:border-[#22C55E]/40 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-[#22C55E]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white group-hover:text-[#22C55E] transition-colors">
                  Getting Started
                </h3>
                <p className="text-sm text-[#64748B]">5-minute overview for new users</p>
              </div>
              <svg className="w-5 h-5 text-[#64748B] group-hover:text-[#22C55E] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/guides/faq"
              className="group flex items-center gap-4 p-5 bg-gradient-to-r from-[#8B5CF6]/10 to-transparent rounded-2xl border border-[#8B5CF6]/20 hover:border-[#8B5CF6]/40 transition-all"
            >
              <div className="w-12 h-12 rounded-xl bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white group-hover:text-[#8B5CF6] transition-colors">
                  FAQ
                </h3>
                <p className="text-sm text-[#64748B]">Quick answers to common questions</p>
              </div>
              <svg className="w-5 h-5 text-[#64748B] group-hover:text-[#8B5CF6] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </motion.div>

          {/* Guide Categories Grid */}
          <div className="grid grid-cols-2 gap-6 mb-16">
            {guideCategories.map((category, index) => (
              <motion.div
                key={category.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4, boxShadow: '0 12px 32px rgba(0,0,0,0.4), 0 0 20px rgba(56,189,248,0.15)' }}
              >
                <Link href={category.href}>
                  <div
                    className="group relative overflow-hidden rounded-2xl p-6 bg-[#111827] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-300 h-full"
                    style={{ boxShadow: `0 0 0 1px ${category.color}10` }}
                  >
                    {/* Gradient background on hover */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ background: `linear-gradient(135deg, ${category.color}08 0%, transparent 60%)` }}
                    />

                    {/* Icon */}
                    <div
                      className="relative w-14 h-14 rounded-xl flex items-center justify-center mb-4"
                      style={{ backgroundColor: `${category.color}15` }}
                    >
                      <span style={{ color: category.color }}>{category.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="relative">
                      <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-[#38BDF8] transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-[#8FA3BF] text-sm mb-4">
                        {category.description}
                      </p>

                      {/* Topics */}
                      <div className="flex flex-wrap gap-2">
                        {category.topics.slice(0, 4).map((topic) => (
                          <span
                            key={topic}
                            className="px-2 py-1 bg-white/[0.04] rounded-md text-xs text-[#64748B]"
                          >
                            {topic}
                          </span>
                        ))}
                        {category.topics.length > 4 && (
                          <span className="px-2 py-1 text-xs text-[#64748B]">
                            +{category.topics.length - 4} more
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Arrow */}
                    <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all">
                      <svg className="w-5 h-5 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>

          {/* Quick Start Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-[#111827] rounded-2xl border border-white/[0.06] p-8"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#F59E0B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">Quick Start</h2>
                <p className="text-sm text-[#64748B]">Essential tips to get started quickly</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {quickStartItems.map((item, index) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  className="flex items-start gap-3 p-4 bg-[#0B1220] rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-colors"
                >
                  <span className="text-2xl">{item.icon}</span>
                  <div>
                    <h4 className="text-white font-medium mb-1">{item.title}</h4>
                    <p className="text-sm text-[#64748B]">{item.description}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="mt-12 text-center"
          >
            <p className="text-[#64748B] text-sm">
              Need help? Contact{' '}
              <a href="mailto:support@marswater.com" className="text-[#38BDF8] hover:underline">
                support@marswater.com
              </a>
            </p>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
