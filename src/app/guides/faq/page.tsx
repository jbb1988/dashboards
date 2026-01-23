'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, useSidebar } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';

interface FAQ {
  question: string;
  answer: string;
  category: string;
  link?: {
    href: string;
    text: string;
  };
}

const faqs: FAQ[] = [
  {
    category: 'Pipeline',
    question: 'What are the different pipeline stages?',
    answer: 'MARS uses 6 stages: Discussions Not Started, Initial Agreement Development, Review & Redlines, Approval & Signature, Agreement Submission, and PO Received. Each stage represents a milestone in the contract lifecycle from lead to close.',
    link: { href: '/guides/pipeline#stages', text: 'Learn about stages' },
  },
  {
    category: 'Pipeline',
    question: 'How do I filter contracts by multiple criteria?',
    answer: 'Use the filter panel (click the filter icon) to combine filters like status, year, contract type, and probability. You can also click KPI cards to quickly filter by that metric, or use the search bar at the top.',
    link: { href: '/guides/pipeline#filters', text: 'Learn about filtering' },
  },
  {
    category: 'Tasks',
    question: 'Are tasks created automatically?',
    answer: 'Yes! When a contract moves to a new stage, MARS automatically creates relevant tasks. For example, moving to "Review & Redlines" creates a "Review contract terms" task. You can also create custom tasks manually.',
    link: { href: '/guides/tasks#auto-tasks', text: 'Learn about auto tasks' },
  },
  {
    category: 'Tasks',
    question: 'What task views are available?',
    answer: 'Three views: List View (flat list sorted by due date), Board View (Kanban with drag-and-drop), and By Contract (tasks grouped by their contract). Switch views using the tabs above the task list.',
    link: { href: '/guides/tasks#views', text: 'Learn about task views' },
  },
  {
    category: 'Documents',
    question: 'What documents are required for each contract?',
    answer: 'Required documents are: Original Contract, MARS Redlines, Final Agreement, and Executed Contract. The completeness score shows how many required documents are uploaded. Optional documents include Client Response, Purchase Order, and Amendments.',
    link: { href: '/guides/documents#types', text: 'Learn about document types' },
  },
  {
    category: 'Documents',
    question: 'How do Contract Bundles work?',
    answer: 'Bundles group related contracts that share documents. When you upload a document to a bundle, all contracts in that bundle can access it. This avoids duplicate uploads for multi-site deals or related opportunities.',
    link: { href: '/guides/bundles', text: 'Learn about bundles' },
  },
  {
    category: 'Review',
    question: 'How does AI contract comparison work?',
    answer: 'Upload two PDFs and MARS AI analyzes them section-by-section. Unlike Word compare (character-level), MARS matches sections semantically and rates each change by legal significance (High/Medium/Low). You get 14 meaningful changes instead of 200+ false positives.',
    link: { href: '/guides/review#mars-approach', text: 'Learn about AI review' },
  },
  {
    category: 'Review',
    question: 'What do Accept, Negotiate, and Push Back mean?',
    answer: 'These are AI recommendations for each contract change. Accept means the change is favorable or standard. Negotiate means some risk, with suggested counter-language provided. Push Back means materially unfavorable and should be rejected or significantly revised.',
    link: { href: '/guides/review#ai-recommendations', text: 'Learn about verdicts' },
  },
  {
    category: 'Review',
    question: 'How do I send a contract for approval?',
    answer: 'After completing your AI review, click "Send for Approval", enter the approver\'s email, optionally add CC recipients, and click Send. The approver receives a secure link to view, comment, edit, and approve or reject. All actions are logged.',
    link: { href: '/guides/review#approval-workflow', text: 'Learn about approvals' },
  },
  {
    category: 'Review',
    question: 'What are Playbooks?',
    answer: 'Playbooks store your standard agreements with version history. When reviewing a counterparty contract, select a playbook to compare against. The AI highlights where the incoming contract deviates from your standard positions.',
    link: { href: '/guides/review#playbooks', text: 'Learn about playbooks' },
  },
  {
    category: 'Insights',
    question: 'What is the Attrition Score?',
    answer: 'A 0-100 score predicting churn risk based on: Recency (35% - days since last purchase), Frequency (30% - order count change), Monetary (25% - revenue change), and Product Mix (10% - category variety change). Higher scores mean higher risk.',
    link: { href: '/guides/insights#attrition', text: 'Learn about attrition' },
  },
  {
    category: 'Insights',
    question: 'How do Cross-Sell recommendations work?',
    answer: 'The system finds customers with similar purchase patterns and identifies products that 30%+ of similar customers buy but the target hasn\'t purchased. Each recommendation includes an affinity score, estimated revenue, and margin projection.',
    link: { href: '/guides/insights#cross-sell', text: 'Learn about cross-sell' },
  },
  {
    category: 'Insights',
    question: 'What customer segments does MARS identify?',
    answer: 'Five segments: Steady Repeaters (regular orders), Project Buyers (one-time projects), Seasonal Buyers (clustered orders), New Accounts (less than 6 months), and Irregular Buyers (unpredictable patterns). Each segment gets tailored recommendations.',
    link: { href: '/guides/insights#customer-segments', text: 'Learn about segments' },
  },
  {
    category: 'Distributors',
    question: 'What is the Location Health Score?',
    answer: 'A 0-100 composite score combining: Revenue Health (35%), Engagement Health (25%), Margin Health (20%), and Category Health (20%). Scores are compared against peer locations within the same distributor.',
    link: { href: '/guides/distributors#health-scores', text: 'Learn about health scores' },
  },
  {
    category: 'General',
    question: 'How do I get help?',
    answer: 'Click the help button in the bottom-right corner of any page. Search the guides, ask the AI assistant, or see relevant guides for your current page. For additional support, email support@marswater.com.',
  },
];

const categories = ['All', ...Array.from(new Set(faqs.map(faq => faq.category)))];

function FAQItem({ faq, isOpen, onToggle }: { faq: FAQ; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-white/[0.06] last:border-b-0">
      <button
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between text-left group"
      >
        <span className="text-white font-medium group-hover:text-[#38BDF8] transition-colors pr-4">
          {faq.question}
        </span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 text-[#64748B]"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pb-4">
              <p className="text-[#8FA3BF] text-sm leading-relaxed mb-3">
                {faq.answer}
              </p>
              {faq.link && (
                <Link
                  href={faq.link.href}
                  className="inline-flex items-center gap-1 text-[#38BDF8] text-sm hover:underline"
                >
                  {faq.link.text}
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function FAQPage() {
  const { isCollapsed } = useSidebar();
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const filteredFaqs = activeCategory === 'All'
    ? faqs
    : faqs.filter(faq => faq.category === activeCategory);

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
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#8B5CF6]/10 rounded-full mb-6">
              <svg className="w-5 h-5 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[#8B5CF6] text-sm font-medium">Quick Answers</span>
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">Frequently Asked Questions</h1>
            <p className="text-xl text-[#8FA3BF] max-w-2xl">
              Find quick answers to common questions about MARS. Click any question to expand the answer.
            </p>
          </motion.div>

          {/* Category Filter */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap gap-2 mb-8"
          >
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => {
                  setActiveCategory(category);
                  setOpenIndex(null);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeCategory === category
                    ? 'bg-[#38BDF8] text-white'
                    : 'bg-[#111827] text-[#8FA3BF] hover:text-white border border-white/[0.06]'
                }`}
              >
                {category}
              </button>
            ))}
          </motion.div>

          {/* FAQ List */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="bg-[#111827] rounded-2xl border border-white/[0.06] p-6"
          >
            {filteredFaqs.map((faq, index) => (
              <FAQItem
                key={`${faq.category}-${index}`}
                faq={faq}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex(openIndex === index ? null : index)}
              />
            ))}
          </motion.div>

          {/* Still Need Help */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 bg-gradient-to-r from-[#38BDF8]/10 to-[#22C55E]/10 rounded-2xl border border-white/[0.06] p-6 text-center"
          >
            <h3 className="text-lg font-semibold text-white mb-2">Still have questions?</h3>
            <p className="text-[#8FA3BF] text-sm mb-4">
              Our team is here to help. Click the help button to chat with AI, or reach out directly.
            </p>
            <a
              href="mailto:support@marswater.com"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#38BDF8] hover:bg-[#0EA5E9] text-white rounded-lg transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              Contact Support
            </a>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
