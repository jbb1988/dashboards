'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, useSidebar } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';

const steps = [
  {
    number: '01',
    title: 'Explore the Pipeline',
    description: 'Start by viewing your contracts in the Pipeline tab. Each contract shows its current stage, value, and key dates.',
    tips: [
      'Use Cmd+K to open the command palette for quick searches',
      'Click any KPI card at the top to filter by that metric',
      'Hover over a contract row for quick actions',
    ],
    link: '/contracts-dashboard',
    linkText: 'Open Pipeline',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    number: '02',
    title: 'Track Your Tasks',
    description: 'Switch to the Tasks tab to see auto-generated tasks based on contract stages, plus any custom tasks you create.',
    tips: [
      'Tasks are automatically created when contracts change stages',
      'Use List, Board, or By Contract view modes',
      'Filter by priority, status, or due date',
    ],
    link: '/contracts-dashboard?tab=tasks',
    linkText: 'View Tasks',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    number: '03',
    title: 'Manage Documents',
    description: 'The Documents tab shows all contract documents with completeness tracking. Upload, preview, and organize files.',
    tips: [
      'Required documents are marked with a red badge',
      'Completeness score shows upload progress',
      'Use Smart Views for quick filtering',
    ],
    link: '/contracts-dashboard?tab=documents',
    linkText: 'View Documents',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
  },
  {
    number: '04',
    title: 'Review Contracts with AI',
    description: 'Use the Contract Review tool to compare documents, get AI recommendations, and send contracts for approval.',
    tips: [
      'Upload two PDFs to compare changes section-by-section',
      'AI rates each change as Accept, Negotiate, or Push Back',
      'Export comparison and recommendations as PDFs',
    ],
    link: '/review',
    linkText: 'Open Review Tool',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    number: '05',
    title: 'Get Sales Insights',
    description: 'Explore customer intelligence, attrition analysis, and AI-powered recommendations in the Sales Insights dashboard.',
    tips: [
      'View customer detail by clicking any customer name',
      'Cross-sell recommendations based on similar customers',
      'Track ROI of insights via Asana integration',
    ],
    link: '/insights',
    linkText: 'Open Insights',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

const features = [
  {
    title: 'Contract Bundles',
    description: 'Group related contracts to share documents and tasks across multiple opportunities.',
    href: '/guides/bundles',
  },
  {
    title: 'Playbooks',
    description: 'Store standard agreements and compare incoming contracts against your templates.',
    href: '/guides/review#playbooks',
  },
  {
    title: 'Approval Workflow',
    description: 'Send contracts for approval with tracking, comments, and activity logging.',
    href: '/guides/review#approval-workflow',
  },
  {
    title: 'Distributor Intelligence',
    description: 'Location health scores, priority actions, and peer benchmarking for distributors.',
    href: '/guides/distributors',
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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#22C55E]/10 rounded-full mb-6">
              <svg className="w-5 h-5 text-[#22C55E]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-[#22C55E] text-sm font-medium">5-Minute Overview</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Getting Started with MARS</h1>
            <p className="text-xl text-[#8FA3BF] max-w-2xl">
              Welcome to MARS! This quick guide will help you understand the core features and get productive in just a few minutes.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="space-y-6 mb-16">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6"
              >
                <div className="flex items-start gap-6">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-2xl bg-[#38BDF8]/10 flex items-center justify-center text-[#38BDF8]">
                      {step.icon}
                    </div>
                    <div className="text-center mt-2">
                      <span className="text-[#64748B] text-sm font-mono">{step.number}</span>
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-white mb-2">{step.title}</h3>
                    <p className="text-[#8FA3BF] mb-4">{step.description}</p>

                    <div className="bg-[#0B1220] rounded-xl p-4 mb-4">
                      <p className="text-xs text-[#64748B] uppercase tracking-wider mb-2">Quick Tips</p>
                      <ul className="space-y-2">
                        {step.tips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-[#8FA3BF]">
                            <svg className="w-4 h-4 text-[#22C55E] mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href={step.link}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-[#38BDF8]/10 hover:bg-[#38BDF8]/20 text-[#38BDF8] rounded-lg transition-colors text-sm font-medium"
                    >
                      {step.linkText}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* More Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-r from-[#8B5CF6]/10 to-[#38BDF8]/10 rounded-2xl border border-white/[0.06] p-8"
          >
            <h2 className="text-xl font-semibold text-white mb-6">Explore More Features</h2>
            <div className="grid grid-cols-2 gap-4">
              {features.map((feature) => (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group p-4 bg-[#0B1220] rounded-xl border border-white/[0.04] hover:border-white/[0.08] transition-all"
                >
                  <h4 className="text-white font-medium mb-1 group-hover:text-[#38BDF8] transition-colors">
                    {feature.title}
                  </h4>
                  <p className="text-[#64748B] text-sm">{feature.description}</p>
                </Link>
              ))}
            </div>
          </motion.div>

          {/* Help */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="mt-12 text-center"
          >
            <p className="text-[#64748B]">
              Need help? Click the help button in the bottom-right corner, or email{' '}
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
