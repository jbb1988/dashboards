'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH, useSidebar } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';

interface GuideTopic {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface GuideData {
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  topics: GuideTopic[];
}

const guideContent: Record<string, GuideData> = {
  pipeline: {
    title: 'Contracts Pipeline Guide',
    description: 'Master the contract lifecycle with powerful pipeline management tools.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    color: '#38BDF8',
    topics: [
      {
        id: 'stages',
        title: 'Understanding Pipeline Stages',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              MARS uses a 6-stage pipeline to track contracts from initial discussions to purchase order:
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { stage: 'Discussions Not Started', desc: 'Lead identified, no engagement yet', color: '#64748B' },
                { stage: 'Initial Agreement Development', desc: 'Active negotiations, drafting terms', color: '#38BDF8' },
                { stage: 'Review & Redlines', desc: 'Legal review, tracking changes', color: '#F59E0B' },
                { stage: 'Approval & Signature', desc: 'Final approval and signing', color: '#EC4899' },
                { stage: 'Agreement Submission', desc: 'Contract submitted to customer', color: '#8B5CF6' },
                { stage: 'PO Received', desc: 'Purchase order received - won!', color: '#22C55E' },
              ].map((item) => (
                <div key={item.stage} className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-white font-medium text-sm">{item.stage}</span>
                  </div>
                  <p className="text-[#64748B] text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'kpis',
        title: 'KPI Cards & Metrics',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The interactive KPI cards at the top of the Pipeline view show key metrics and can be clicked to filter the contract list:
            </p>
            <ul className="space-y-2">
              {[
                { title: 'Total Pipeline', desc: 'Click to see all active contracts' },
                { title: 'Due Next 30 Days', desc: 'Contracts with close dates in the next month' },
                { title: 'Overdue', desc: 'Contracts past their expected close date' },
                { title: 'High Value', desc: 'Contracts above the average deal size' },
              ].map((item) => (
                <li key={item.title} className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[#38BDF8] mt-2" />
                  <div>
                    <span className="text-white font-medium">{item.title}</span>
                    <p className="text-[#64748B] text-sm">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ),
      },
      {
        id: 'filters',
        title: 'Filtering & Search',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Use the powerful filtering system to find specific contracts:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Available Filters</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-[#8FA3BF]"><strong className="text-white">Status:</strong> Filter by pipeline stage</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Year:</strong> Filter by close date year</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Contract Type:</strong> Equipment, Service, etc.</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Budgeted:</strong> Show only forecasted deals</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Probability:</strong> Filter by close probability</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Search:</strong> Full-text search on contract names</li>
              </ul>
            </div>
            <p className="text-[#64748B] text-sm">
              Pro tip: Click any KPI card at the top of the dashboard to quickly filter contracts by that metric.
            </p>
          </div>
        ),
      },
      {
        id: 'salesforce',
        title: 'Salesforce Integration',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              MARS syncs with Salesforce to keep your pipeline data up-to-date:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#38BDF8] font-medium mb-2">Automatic Sync</h4>
                <p className="text-[#64748B] text-sm">Contract data syncs from Salesforce automatically, including stage, value, and dates.</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#38BDF8] font-medium mb-2">Direct Links</h4>
                <p className="text-[#64748B] text-sm">Click the SF link on any contract to open it directly in Salesforce.</p>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  documents: {
    title: 'Document Management Guide',
    description: 'Track contract documents and ensure completeness throughout the contract lifecycle.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
      </svg>
    ),
    color: '#8B5CF6',
    topics: [
      {
        id: 'types',
        title: 'Document Types',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              MARS tracks several document types for each contract:
            </p>
            <h4 className="text-white font-medium mt-4">Required Documents</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'Original Contract', desc: 'Initial contract from customer', required: true },
                { type: 'MARS Redlines', desc: 'Our tracked changes version', required: true },
                { type: 'Final Agreement', desc: 'Agreed final version', required: true },
                { type: 'Executed Contract', desc: 'Signed contract', required: true },
              ].map((doc) => (
                <div key={doc.type} className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{doc.type}</span>
                    <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-xs rounded">Required</span>
                  </div>
                  <p className="text-[#64748B] text-xs">{doc.desc}</p>
                </div>
              ))}
            </div>
            <h4 className="text-white font-medium mt-4">Analysis Documents</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'Comparison Report', desc: 'Section-by-section comparison of document versions', color: '#8B5CF6' },
                { type: 'AI Recommendations', desc: 'AI analysis with accept/negotiate/push back verdicts', color: '#38BDF8' },
              ].map((doc) => (
                <div key={doc.type} className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{doc.type}</span>
                    <span className="px-2 py-0.5 text-xs rounded" style={{ backgroundColor: `${doc.color}20`, color: doc.color }}>Analysis</span>
                  </div>
                  <p className="text-[#64748B] text-xs">{doc.desc}</p>
                </div>
              ))}
            </div>
            <h4 className="text-white font-medium mt-4">Optional Documents</h4>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'Client Response', desc: 'Customer\'s response to redlines' },
                { type: 'Purchase Order', desc: 'Customer PO document' },
                { type: 'Amendment', desc: 'Contract amendments or modifications' },
                { type: 'Other', desc: 'Any additional relevant documents' },
              ].map((doc) => (
                <div key={doc.type} className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-white font-medium text-sm">{doc.type}</span>
                    <span className="px-2 py-0.5 bg-[#64748B]/10 text-[#64748B] text-xs rounded">Optional</span>
                  </div>
                  <p className="text-[#64748B] text-xs">{doc.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'completeness',
        title: 'Completeness Tracking',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The completeness score shows what percentage of required documents are uploaded:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <div className="flex items-center gap-4">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 transform -rotate-90">
                    <circle cx="40" cy="40" r="35" fill="none" stroke="#1E293B" strokeWidth="6" />
                    <circle cx="40" cy="40" r="35" fill="none" stroke="#38BDF8" strokeWidth="6" strokeDasharray="165 220" strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-white font-bold">75%</span>
                </div>
                <div>
                  <p className="text-white font-medium">Document Completeness</p>
                  <p className="text-[#64748B] text-sm">3 of 4 required documents uploaded</p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'views',
        title: 'Smart Views',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Smart views help you focus on what matters most:
            </p>
            <ul className="space-y-2">
              {[
                { name: 'Needs Attention', desc: 'Contracts missing documents or overdue' },
                { name: 'Closing Soon', desc: 'Contracts with dates in the next 90 days' },
                { name: 'Budgeted', desc: 'Only budgeted/forecasted contracts' },
                { name: 'By Account', desc: 'Grouped by customer account' },
                { name: 'Recently Updated', desc: 'Documents uploaded in the last 7 days' },
              ].map((view) => (
                <li key={view.name} className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-[#8B5CF6] mt-2" />
                  <div>
                    <span className="text-white font-medium">{view.name}</span>
                    <p className="text-[#64748B] text-sm">{view.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ),
      },
      {
        id: 'bundles',
        title: 'Contract Bundles',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Contract Bundles group related Salesforce opportunities that share documents. Common example: M3 software renewal + MCC renewal that share the same master agreement.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-[#8B5CF6]/30">
              <h4 className="text-[#8B5CF6] font-medium mb-3 flex items-center gap-2">
                <span className="text-lg">★</span> Why Bundle Contracts?
              </h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li>• <strong className="text-white">Shared Documents:</strong> Upload once, see from all bundled contracts</li>
                <li>• <strong className="text-white">No Duplication:</strong> Avoid uploading the same master agreement multiple times</li>
                <li>• <strong className="text-white">Clear Attribution:</strong> See which contract a document came from</li>
                <li>• <strong className="text-white">Flexible:</strong> Add/remove contracts from bundles anytime</li>
              </ul>
            </div>
            <h4 className="text-white font-medium mt-4">Creating a Bundle</h4>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <ol className="space-y-2 text-sm text-[#8FA3BF]">
                <li>1. Expand any contract card in the Pipeline view</li>
                <li>2. Find the <strong className="text-white">Bundle</strong> field</li>
                <li>3. Click <strong className="text-[#8B5CF6]">Create</strong> to start a new bundle</li>
                <li>4. Name the bundle (e.g., "Cleveland 2025 Renewal")</li>
                <li>5. Select related contracts to include</li>
                <li>6. Choose a primary contract (source of truth)</li>
              </ol>
            </div>
            <h4 className="text-white font-medium mt-4">Bundle Indicators</h4>
            <div className="flex gap-4">
              <div className="flex items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">★</span>
                <span className="text-white text-sm">Primary contract in bundle</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-[#8B5CF6]/15 text-[#8B5CF6]">⚏</span>
                <span className="text-white text-sm">Secondary contract in bundle</span>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  tasks: {
    title: 'Task Management Guide',
    description: 'Stay on top of contract activities with auto-generated tasks and powerful tracking.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
    color: '#F59E0B',
    topics: [
      {
        id: 'auto-tasks',
        title: 'Auto-Generated Tasks',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              MARS automatically creates tasks based on contract stage transitions:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <p className="text-[#64748B] text-sm mb-3">When a contract moves to a new stage, relevant tasks are created automatically. For example:</p>
              <ul className="space-y-2 text-sm">
                <li className="text-[#8FA3BF]">• Moving to "Review & Redlines" creates "Review contract terms" task</li>
                <li className="text-[#8FA3BF]">• Moving to "Approval & Signature" creates "Obtain signature" task</li>
                <li className="text-[#8FA3BF]">• Tasks inherit the contract's due date when applicable</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'views',
        title: 'Task Views',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              View your tasks in three different ways:
            </p>
            <div className="grid grid-cols-3 gap-4">
              {[
                { name: 'By Contract', desc: 'Tasks grouped by their associated contract' },
                { name: 'List View', desc: 'Flat list sorted by due date' },
                { name: 'Board View', desc: 'Kanban board with drag-and-drop' },
              ].map((view) => (
                <div key={view.name} className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04] text-center">
                  <span className="text-white font-medium">{view.name}</span>
                  <p className="text-[#64748B] text-xs mt-1">{view.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'priorities',
        title: 'Due Dates & Priorities',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Prioritize tasks effectively with due dates and priority levels:
            </p>
            <div className="flex gap-4">
              {[
                { level: 'Urgent', color: '#EF4444' },
                { level: 'High', color: '#F59E0B' },
                { level: 'Medium', color: '#38BDF8' },
                { level: 'Low', color: '#22C55E' },
              ].map((priority) => (
                <div key={priority.level} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: priority.color }} />
                  <span className="text-white text-sm">{priority.level}</span>
                </div>
              ))}
            </div>
          </div>
        ),
      },
    ],
  },
  bundles: {
    title: 'Contract Bundles Guide',
    description: 'Group related contracts together and manage shared tasks and documents across the bundle.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    color: '#A855F7',
    topics: [
      {
        id: 'what-are-bundles',
        title: 'What are Contract Bundles?',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Contract Bundles allow you to group related contracts together and manage them as a single unit. This is perfect for:
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: '🏢', title: 'Multi-Site Deals', desc: 'One customer, multiple locations with separate contracts' },
                { icon: '📅', title: 'Phased Projects', desc: 'Multi-year projects with contracts for each phase' },
                { icon: '🔄', title: 'Renewal Groups', desc: 'Multiple contracts renewing together' },
                { icon: '🎯', title: 'Related Opportunities', desc: 'Connected contracts that need coordinated management' },
              ].map((useCase) => (
                <div key={useCase.title} className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="text-2xl mb-2">{useCase.icon}</div>
                  <h5 className="text-white font-medium text-sm mb-1">{useCase.title}</h5>
                  <p className="text-[#64748B] text-xs">{useCase.desc}</p>
                </div>
              ))}
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-300 text-sm">
                <strong>💡 Key Benefit:</strong> When you link a task or document to a bundle, it automatically applies to all contracts in that bundle—no need to upload the same document multiple times or create duplicate tasks.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'creating-bundles',
        title: 'Creating & Managing Bundles',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Creating a bundle is simple and takes just a few clicks:
            </p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm flex-shrink-0">1</div>
                <div>
                  <h5 className="text-white font-medium mb-1">Select Contracts</h5>
                  <p className="text-[#64748B] text-sm">In the Pipeline view, select 2 or more related contracts</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm flex-shrink-0">2</div>
                <div>
                  <h5 className="text-white font-medium mb-1">Create Bundle</h5>
                  <p className="text-[#64748B] text-sm">Click "Create Bundle" and give it a descriptive name (e.g., "Acme Corp - 2025 Multi-Site")</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <div className="w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm flex-shrink-0">3</div>
                <div>
                  <h5 className="text-white font-medium mb-1">Designate Primary</h5>
                  <p className="text-[#64748B] text-sm">Choose which contract is the primary one (this is usually the first or largest contract)</p>
                </div>
              </div>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h5 className="text-white font-medium mb-3">Managing Bundles</h5>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li>• <strong className="text-white">View Bundle:</strong> Click any bundled contract to see all contracts in the bundle in the side drawer</li>
                <li>• <strong className="text-white">Add Contract:</strong> Select additional contracts and add them to an existing bundle</li>
                <li>• <strong className="text-white">Remove Contract:</strong> Unbundle individual contracts if they no longer belong together</li>
                <li>• <strong className="text-white">Rename Bundle:</strong> Update the bundle name as the project evolves</li>
                <li>• <strong className="text-white">Delete Bundle:</strong> Dissolve the bundle (contracts remain, just unlinked)</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'bundle-tasks',
        title: 'Bundle Tasks & Documents',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The power of bundles shines when managing tasks and documents:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-purple-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📦</span>
                  <h5 className="text-purple-400 font-medium">Bundle Tasks</h5>
                </div>
                <p className="text-[#64748B] text-sm mb-3">When creating a task, you can link it to a bundle instead of a single contract:</p>
                <ul className="space-y-1.5 text-xs text-[#8FA3BF]">
                  <li>• Task applies to all contracts in bundle</li>
                  <li>• Shows purple 📦 BUNDLE badge</li>
                  <li>• Displays bundle name instead of contract</li>
                  <li>• Visible in "By Bundle" view mode</li>
                </ul>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-purple-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-2xl">📄</span>
                  <h5 className="text-purple-400 font-medium">Bundle Documents</h5>
                </div>
                <p className="text-[#64748B] text-sm mb-3">Upload documents once and have them available across all bundled contracts:</p>
                <ul className="space-y-1.5 text-xs text-[#8FA3BF]">
                  <li>• No need for duplicate uploads</li>
                  <li>• Shows purple 📦 bundle indicator</li>
                  <li>• All bundle members can access it</li>
                  <li>• Version control applies to entire bundle</li>
                </ul>
              </div>
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <h5 className="text-purple-300 font-medium mb-2 flex items-center gap-2">
                <span>🎯</span>
                <span>Practical Example</span>
              </h5>
              <p className="text-[#8FA3BF] text-sm">
                You have 5 contracts for Acme Corp's different warehouses. Instead of creating 5 separate tasks for "Schedule kickoff calls" and uploading the master service agreement 5 times, create one bundle task and upload the document once to the bundle. All 5 contracts instantly have access.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'bundle-views',
        title: 'By Bundle View Mode',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Tasks tab includes a special "By Bundle" view mode for managing bundle tasks:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <span className="text-white font-medium">By Bundle View</span>
              </div>
              <p className="text-[#64748B] text-sm mb-3">This view groups tasks into two sections:</p>
              <div className="space-y-3">
                <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-purple-400">📦</span>
                    <span className="text-purple-400 font-medium text-sm">Bundle Tasks</span>
                  </div>
                  <p className="text-[#64748B] text-xs">Tasks linked to bundles, grouped by bundle name with expandable sections</p>
                </div>
                <div className="p-3 bg-[#111827] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[#38BDF8]">📄</span>
                    <span className="text-white font-medium text-sm">Individual Tasks</span>
                  </div>
                  <p className="text-[#64748B] text-xs">Tasks linked to single contracts, not part of any bundle</p>
                </div>
              </div>
              <div className="mt-4 flex items-start gap-2">
                <svg className="w-4 h-4 text-purple-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-[#8FA3BF] text-xs">Each group shows overdue count and active/total task counts for quick status overview</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'visual-indicators',
        title: 'Bundle Badges & Indicators',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Bundle items are visually distinct throughout MARS with purple indicators:
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-medium flex items-center gap-1">
                    <span>📦</span>
                    <span>BUNDLE</span>
                  </span>
                  <span className="text-white text-sm font-medium">Task Badge</span>
                </div>
                <p className="text-[#64748B] text-xs">Purple badge appears on tasks linked to bundles in all views (Kanban, List, By Contract)</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-0.5 rounded bg-purple-500/20 text-purple-400 text-xs font-medium flex items-center gap-1">
                    <span>📦</span>
                    <span>Bundle Name</span>
                  </span>
                  <span className="text-white text-sm font-medium">Document Badge</span>
                </div>
                <p className="text-[#64748B] text-xs">Bundle name displayed on documents with purple styling in document lists and detail views</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-purple-400 font-medium text-sm">Purple Text & Icons</span>
                </div>
                <p className="text-[#64748B] text-xs">Bundle names always appear in purple (vs blue for individual contracts) for instant recognition</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-blue-500/5 rounded-lg border border-blue-500/10">
                <div className="text-xs text-[#64748B] mb-1">Individual Contract</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[#38BDF8]">📄</span>
                  <span className="text-[#38BDF8] text-sm">Blue indicators</span>
                </div>
              </div>
              <div className="p-3 bg-purple-500/5 rounded-lg border border-purple-500/10">
                <div className="text-xs text-[#64748B] mb-1">Bundle</div>
                <div className="flex items-center gap-1.5">
                  <span className="text-purple-400">📦</span>
                  <span className="text-purple-400 text-sm">Purple indicators</span>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'best-practices',
        title: 'Best Practices',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Get the most out of contract bundles with these tips:
            </p>
            <div className="space-y-3">
              {[
                {
                  icon: '🏷️',
                  title: 'Descriptive Naming',
                  desc: 'Use clear bundle names like "Acme Corp - 2025 Multi-Site Expansion" instead of "Bundle 1"',
                },
                {
                  icon: '🎯',
                  title: 'Primary Contract Selection',
                  desc: 'Choose the largest or first contract as primary—it makes reporting and navigation easier',
                },
                {
                  icon: '📋',
                  title: 'Shared Documents Only',
                  desc: 'Upload documents to bundles when they truly apply to all contracts. Site-specific docs should stay on individual contracts',
                },
                {
                  icon: '✅',
                  title: 'Bundle-Level Tasks',
                  desc: 'Create bundle tasks for activities that need to happen once for the group (e.g., "Schedule project kickoff")',
                },
                {
                  icon: '🔄',
                  title: 'Review Periodically',
                  desc: 'As projects evolve, contracts may no longer need to be bundled. Review and unbundle as needed',
                },
                {
                  icon: '📊',
                  title: 'Use Bundle View',
                  desc: 'Switch to "By Bundle" view regularly to see all bundle tasks at a glance and ensure nothing falls through the cracks',
                },
              ].map((tip) => (
                <div key={tip.title} className="flex items-start gap-3 p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <span className="text-2xl">{tip.icon}</span>
                  <div>
                    <h5 className="text-white font-medium mb-1">{tip.title}</h5>
                    <p className="text-[#64748B] text-sm">{tip.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
              <p className="text-purple-300 text-sm">
                <strong>💡 Pro Tip:</strong> Bundles work best when contracts have a natural relationship. Don't over-bundle—if contracts don't truly share tasks or documents, keeping them separate is cleaner and more maintainable.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },
  review: {
    title: 'Contract Review Guide',
    description: 'AI-powered contract review with redlines, clause detection, and comparison tools.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: '#22C55E',
    topics: [
      {
        id: 'why-traditional-fails',
        title: 'Why Word & Acrobat Fall Short',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Traditional tools like Microsoft Word Track Changes and Adobe Acrobat Compare treat documents as raw text, not structured legal content. This creates several problems:
            </p>
            <div className="grid grid-cols-1 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/20">
                <h4 className="text-red-400 font-medium mb-2">Character-Level Comparison</h4>
                <p className="text-[#64748B] text-sm">
                  These tools compare character-by-character, flagging formatting changes, whitespace differences, and paragraph reflows as "changes." A simple font change can generate hundreds of false positives, burying the actual legal modifications.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/20">
                <h4 className="text-red-400 font-medium mb-2">PDF Text Extraction Issues</h4>
                <p className="text-[#64748B] text-sm">
                  PDFs store visual rendering instructions, not semantic text. Multi-column layouts, headers, footers, and tables often extract incorrectly—words merge, break mid-word, or appear out of order. What looks perfect on screen becomes garbled text.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/20">
                <h4 className="text-red-400 font-medium mb-2">No Legal Understanding</h4>
                <p className="text-[#64748B] text-sm">
                  Word and Acrobat cannot distinguish between trivial changes ("will" → "shall") and material ones (liability cap removed). They show everything with equal weight, requiring manual review of every difference.
                </p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'legal-software-approach',
        title: 'How Professional Legal Software Works',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Professional contract software (Litera, Draftable, LexCheck) uses a fundamentally different approach: <strong className="text-white">parse first, then compare</strong>.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-[#38BDF8] font-medium mb-3">The Parse → Structure → Compare Pipeline</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <div>
                    <span className="text-white font-medium">Parse Document Structure</span>
                    <p className="text-[#64748B]">Identify sections, headings, and clause boundaries using AI/NLP—not regex patterns that break on formatting variations.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <div>
                    <span className="text-white font-medium">Match Sections Semantically</span>
                    <p className="text-[#64748B]">Match "Section 5: Indemnification" to "Article V - Indemnification" even with different numbering or naming conventions.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <div>
                    <span className="text-white font-medium">Compare Matched Sections</span>
                    <p className="text-[#64748B]">Compare content within each matched section, filtering noise and highlighting substantive changes.</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                  <div>
                    <span className="text-white font-medium">Assess Significance</span>
                    <p className="text-[#64748B]">Rate each change (High/Medium/Low) based on legal impact, not just text difference.</p>
                  </div>
                </li>
              </ol>
            </div>
          </div>
        ),
      },
      {
        id: 'mars-approach',
        title: 'The MARS AI-First Approach',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              MARS uses an <strong className="text-white">AI-first methodology</strong> that goes beyond even professional legal software:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#22C55E]/20">
                <h4 className="text-[#22C55E] font-medium mb-2">Section-by-Section Analysis</h4>
                <p className="text-[#64748B] text-sm">
                  AI reads both documents and extracts sections with full understanding of legal structure—handling variations in numbering, titles, and organization.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#22C55E]/20">
                <h4 className="text-[#22C55E] font-medium mb-2">Semantic Matching</h4>
                <p className="text-[#64748B] text-sm">
                  Matches sections by meaning, not just headings. "Payment Terms" and "Compensation Schedule" are recognized as the same section.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#22C55E]/20">
                <h4 className="text-[#22C55E] font-medium mb-2">Legal Impact Assessment</h4>
                <p className="text-[#64748B] text-sm">
                  Each change is rated High/Medium/Low based on actual legal significance—liability changes rank high, formatting changes rank none.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#22C55E]/20">
                <h4 className="text-[#22C55E] font-medium mb-2">Key Takeaways</h4>
                <p className="text-[#64748B] text-sm">
                  Automatically generates executive summary of material changes—no need to read through hundreds of diffs.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#22C55E]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06]">
              <p className="text-[#8FA3BF] text-sm">
                <strong className="text-white">Result:</strong> Instead of 200+ false positives, you see 14 meaningful section changes with clear explanations of what changed and why it matters.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'ai-recommendations',
        title: 'AI Recommendations',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              After comparing documents, MARS can analyze changes against your standard negotiating positions:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Verdict System</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-[#22C55E]/20 text-[#22C55E] rounded text-xs font-medium">ACCEPT</span>
                  <span className="text-[#64748B] text-sm">Change is favorable or industry standard—no action needed</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-medium">NEGOTIATE</span>
                  <span className="text-[#64748B] text-sm">Change has some risk—AI provides suggested counter-language</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded text-xs font-medium">PUSH BACK</span>
                  <span className="text-[#64748B] text-sm">Materially unfavorable—reject or significantly revise with provided alternative</span>
                </div>
              </div>
            </div>
            <p className="text-[#64748B] text-sm">
              Each recommendation includes reasoning and specific counter-language you can use in negotiations, aligned with MARS standard positions on liability, indemnification, IP, termination, and more.
            </p>
          </div>
        ),
      },
      {
        id: 'compare-workflow',
        title: 'Using Document Compare',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Compare Documents workflow:
            </p>
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                <div>
                  <span className="text-white font-medium">Upload Documents</span>
                  <p className="text-[#64748B]">Upload the original contract and the revised version (PDF format)</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                <div>
                  <span className="text-white font-medium">AI Comparison</span>
                  <p className="text-[#64748B]">AI extracts sections, matches them, and identifies changes with significance ratings</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                <div>
                  <span className="text-white font-medium">Review Results</span>
                  <p className="text-[#64748B]">Filter by status (Changed/Added/Removed) or significance (High/Medium/Low)</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                <div>
                  <span className="text-white font-medium">Get AI Recommendations</span>
                  <p className="text-[#64748B]">Click "Get AI Recommendations" for Accept/Negotiate/Push Back guidance with counter-language</p>
                </div>
              </li>
              <li className="flex items-start gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">5</span>
                <div>
                  <span className="text-white font-medium">Download or Save</span>
                  <p className="text-[#64748B]">Download PDFs to share, or save to contract record for tracking</p>
                </div>
              </li>
            </ol>
            <div className="bg-gradient-to-r from-[#8B5CF6]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <h4 className="text-white font-medium mb-3">Export Options</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-[#0B1220] rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-white text-sm font-medium">Comparison PDF</span>
                  </div>
                  <p className="text-[#64748B] text-xs">Section-by-section changes with original vs. revised text</p>
                </div>
                <div className="p-3 bg-[#0B1220] rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-white text-sm font-medium">AI Recommendations PDF</span>
                  </div>
                  <p className="text-[#64748B] text-xs">Verdicts, reasoning, and suggested counter-language</p>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'ai-redlines',
        title: 'AI Redlines (Upload Tab)',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Upload tab provides AI-powered redlining of a single contract against MARS standard provisions:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <ol className="space-y-2 text-sm list-decimal list-inside text-[#8FA3BF]">
                <li>Upload a contract document (PDF, Word, or paste text)</li>
                <li>AI analyzes each section against MARS negotiating positions</li>
                <li>Review suggested redlines with strikethrough and insertions</li>
                <li>Accept, modify, or reject each suggestion</li>
                <li>Save to contract record for tracking</li>
              </ol>
            </div>
            <p className="text-[#64748B] text-sm">
              MARS positions cover liability caps, indemnification, IP ownership, termination rights, warranties, payment terms, audit rights, dispute resolution, and insurance requirements.
            </p>
          </div>
        ),
      },
      {
        id: 'risk-scoring',
        title: 'Risk Scoring',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Every AI-suggested redline is automatically classified by risk level to help you prioritize your review:
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold">HIGH</span>
                </div>
                <p className="text-[#64748B] text-sm">
                  Critical changes requiring immediate attention: liability, indemnification, IP/work product, termination for cause, insurance requirements.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold">MEDIUM</span>
                </div>
                <p className="text-[#64748B] text-sm">
                  Important but negotiable: payment terms, warranties, confidentiality periods, audit rights, dispute resolution.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold">LOW</span>
                </div>
                <p className="text-[#64748B] text-sm">
                  Minor changes: formatting, word choices, clarifications, notice periods, standard boilerplate.
                </p>
              </div>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04] mt-4">
              <h4 className="text-white font-medium mb-2">Risk Summary Banner</h4>
              <p className="text-[#64748B] text-sm">
                At the top of the review, you'll see a summary showing the count of High, Medium, and Low risk items. This gives you an instant overview of the contract's risk profile before diving into details.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'approval-workflow',
        title: 'Approval Workflow',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              After AI analysis, send contracts for approval with tracking and notifications:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Sending for Approval</h4>
              <ol className="space-y-2 text-sm list-decimal list-inside text-[#8FA3BF]">
                <li>Complete your AI review and make any adjustments</li>
                <li>Click <strong className="text-white">"Send for Approval"</strong> button</li>
                <li>Enter the approver's email address</li>
                <li>Optionally add CC recipients (stakeholders who should be notified)</li>
                <li>Click Send - approver receives email with secure link</li>
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#8B5CF6]/20">
                <h4 className="text-[#8B5CF6] font-medium mb-2">Approver Access</h4>
                <p className="text-[#64748B] text-sm">
                  Approvers can view the full redlined contract, add comments, make edits, and approve or reject. All actions are logged.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#38BDF8]/20">
                <h4 className="text-[#38BDF8] font-medium mb-2">CC Recipients</h4>
                <p className="text-[#64748B] text-sm">
                  CC'd parties receive a notification email with a read-only link. They can view the contract and comments but cannot approve or reject.
                </p>
              </div>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04] mt-4">
              <h4 className="text-white font-medium mb-2">Activity Log</h4>
              <p className="text-[#64748B] text-sm mb-3">
                Every action is tracked in the activity log, including:
              </p>
              <ul className="space-y-1 text-sm text-[#8FA3BF]">
                <li>• When approval request was sent</li>
                <li>• When approver viewed the contract</li>
                <li>• When CC recipients viewed the contract</li>
                <li>• Comments and annotations added</li>
                <li>• Final approval or rejection with timestamp</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'playbooks',
        title: 'Playbooks & Standard Agreements',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Playbooks store MARS's own standard agreements with version history. Use them as a baseline when reviewing counterparty contracts.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Creating a Playbook</h4>
              <ol className="space-y-2 text-sm list-decimal list-inside text-[#8FA3BF]">
                <li>Go to <strong className="text-white">Playbooks</strong> in the sidebar</li>
                <li>Click <strong className="text-white">"New Playbook"</strong></li>
                <li>Enter name (e.g., "MARS NDA") and optional description</li>
                <li>Upload PDF/Word file or paste the agreement text</li>
                <li>Text is automatically extracted for AI comparison</li>
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#22C55E]/20">
                <h4 className="text-[#22C55E] font-medium mb-2">Version History</h4>
                <p className="text-[#64748B] text-sm">
                  Each time you update a playbook, a new version is created. Track who made changes and when, with change notes for context.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#8B5CF6]/20">
                <h4 className="text-[#8B5CF6] font-medium mb-2">File Storage</h4>
                <p className="text-[#64748B] text-sm">
                  Original PDF and Word documents are stored for download. The extracted text is used for AI comparison against incoming contracts.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#22C55E]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <h4 className="text-white font-medium mb-2">Compare Against Playbook</h4>
              <p className="text-[#8FA3BF] text-sm">
                When reviewing a counterparty contract, select a playbook from the dropdown. The AI will compare the incoming contract against your standard terms and highlight deviations—showing where the counterparty's version is more or less favorable than your standard position.
              </p>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04] mt-4">
              <h4 className="text-white font-medium mb-2">Recommended Playbooks</h4>
              <ul className="space-y-1 text-sm text-[#8FA3BF]">
                <li>• MARS Warranty General Terms & Conditions</li>
                <li>• MARS MCC Maintenance and Services Agreement</li>
                <li>• MARS M3 EULA</li>
                <li>• MARS NDA</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'mentions',
        title: '@Mentions in Discussions',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Tag team members in approval discussions to get their input. Mentioned users receive instant email notifications.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">How to Use @Mentions</h4>
              <ol className="space-y-2 text-sm list-decimal list-inside text-[#8FA3BF]">
                <li>Open a contract review in the approval sidebar</li>
                <li>Navigate to the <strong className="text-white">Discussion</strong> tab</li>
                <li>In the comment box, type <strong className="text-[#38BDF8]">@</strong> followed by an email</li>
                <li>Select from the autocomplete dropdown (shows matching users)</li>
                <li>Submit your comment - mentioned users receive email notification</li>
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#38BDF8]/20">
                <h4 className="text-[#38BDF8] font-medium mb-2">Instant Notifications</h4>
                <p className="text-[#64748B] text-sm">
                  Mentioned users receive an email with the comment preview and a link to view the full discussion thread.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#8B5CF6]/20">
                <h4 className="text-[#8B5CF6] font-medium mb-2">Highlighted Mentions</h4>
                <p className="text-[#64748B] text-sm">
                  Mentions are highlighted in blue in the comment thread, making it easy to see who was tagged in each discussion.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#38BDF8]/10 to-[#8B5CF6]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <p className="text-[#8FA3BF] text-sm">
                <strong className="text-white">Tip:</strong> Use @mentions to loop in subject matter experts for specific clauses, or notify stakeholders about important discussion points before final approval.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'reminders',
        title: 'Approval Reminders',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              MARS automatically sends reminder emails for pending approvals to ensure contracts don't get stuck in the queue.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">How Reminders Work</h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li>• Reminders are sent daily at <strong className="text-white">9:00 AM</strong></li>
                <li>• Only pending approvals <strong className="text-white">older than 2 days</strong> receive reminders</li>
                <li>• Each pending review gets at most <strong className="text-white">one reminder per 24 hours</strong></li>
                <li>• Reminders include how long the approval has been pending</li>
                <li>• Direct link to the approval page is included for quick action</li>
              </ul>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-green-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs font-bold">0-2 DAYS</span>
                </div>
                <p className="text-[#64748B] text-sm">
                  Normal queue time. No reminders sent yet.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-yellow-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-bold">3-5 DAYS</span>
                </div>
                <p className="text-[#64748B] text-sm">
                  Daily reminders begin. Marked as "high priority" in queue.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/30">
                <div className="flex items-center gap-2 mb-2">
                  <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-bold">6+ DAYS</span>
                </div>
                <p className="text-[#64748B] text-sm">
                  Marked as "critical" with urgent reminder emails.
                </p>
              </div>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04] mt-4">
              <h4 className="text-white font-medium mb-2">Confirmation Emails</h4>
              <p className="text-[#64748B] text-sm">
                When an approval is completed (approved or rejected), the original submitter automatically receives a confirmation email with the decision, any feedback provided, and a link to view the final review.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'version-diff',
        title: 'Version Diff Comparison',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Compare different versions of playbooks side-by-side to see exactly what changed between updates.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Comparing Playbook Versions</h4>
              <ol className="space-y-2 text-sm list-decimal list-inside text-[#8FA3BF]">
                <li>Open a playbook from the <strong className="text-white">Playbooks</strong> page</li>
                <li>In the <strong className="text-white">Version History</strong> sidebar, find the version to compare</li>
                <li>Click <strong className="text-white">"Compare with vX"</strong> button</li>
                <li>View the side-by-side diff showing additions and deletions</li>
              </ol>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/20">
                <h4 className="text-red-400 font-medium mb-2">Deletions</h4>
                <p className="text-[#64748B] text-sm">
                  Removed text is highlighted in <span className="bg-red-500/20 text-red-400 px-1 line-through">red with strikethrough</span>
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-green-500/20">
                <h4 className="text-green-400 font-medium mb-2">Additions</h4>
                <p className="text-[#64748B] text-sm">
                  New text is highlighted in <span className="bg-green-500/20 text-green-400 px-1">green</span>
                </p>
              </div>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04] mt-4">
              <h4 className="text-white font-medium mb-2">Diff Statistics</h4>
              <p className="text-[#64748B] text-sm mb-3">
                Each comparison shows summary statistics:
              </p>
              <ul className="space-y-1 text-sm text-[#8FA3BF]">
                <li>• Total number of changes</li>
                <li>• Characters added vs removed</li>
                <li>• Percentage of content changed</li>
              </ul>
            </div>
            <div className="bg-gradient-to-r from-[#22C55E]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <p className="text-[#8FA3BF] text-sm">
                <strong className="text-white">Use Case:</strong> Before approving a playbook update, use the diff view to verify only intended changes were made and no unintended modifications slipped through.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'search-filter',
        title: 'Search & Filter',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Quickly find contracts, approvals, and playbooks with powerful search and filter tools throughout MARS.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Search Locations</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <div>
                    <span className="text-white font-medium">Playbooks Page</span>
                    <p className="text-[#64748B] text-sm">Search by playbook name or description</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <div>
                    <span className="text-white font-medium">Approvals Queue</span>
                    <p className="text-[#64748B] text-sm">Search by contract name, submitter, or provision</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#38BDF8]/20 text-[#38BDF8] flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <div>
                    <span className="text-white font-medium">Review History</span>
                    <p className="text-[#64748B] text-sm">Search by contract name or provision name</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#F59E0B]/20">
                <h4 className="text-[#F59E0B] font-medium mb-2">Approval Status Filters</h4>
                <p className="text-[#64748B] text-sm">
                  Filter the approval queue by status: <span className="text-amber-400">Pending</span>, <span className="text-green-400">Approved</span>, <span className="text-red-400">Rejected</span>, or <span className="text-[#38BDF8]">All</span>
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#8B5CF6]/20">
                <h4 className="text-[#8B5CF6] font-medium mb-2">Clear Search</h4>
                <p className="text-[#64748B] text-sm">
                  Click the X button in the search field to quickly clear your search and see all results again.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#F59E0B]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <p className="text-[#8FA3BF] text-sm">
                <strong className="text-white">Tip:</strong> Combine search with status filters in the Approvals Queue to quickly find pending items for a specific contract.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },
  insights: {
    title: 'Sales Insights Guide',
    description: 'Customer intelligence, attrition analysis, and AI-powered recommendations for sales leadership.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    color: '#A855F7',
    topics: [
      {
        id: 'products-tab',
        title: 'Products Tab',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Products tab provides a product-centric view of your sales data, helping you understand which products are performing well and which need attention.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Product Table</h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li><strong className="text-white">Item Name:</strong> Product identifier from NetSuite</li>
                <li><strong className="text-white">Class:</strong> Product category/classification</li>
                <li><strong className="text-white">R12 Revenue:</strong> Rolling 12-month revenue</li>
                <li><strong className="text-white">Change %:</strong> Comparison vs prior rolling 12 months</li>
                <li><strong className="text-white">Customers:</strong> Number of unique customers buying this product</li>
                <li><strong className="text-white">Margin %:</strong> Average gross profit margin</li>
              </ul>
            </div>
            <h4 className="text-white font-medium mt-4">Charts</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <span className="text-[#22C55E] font-medium">Top 10 Products</span>
                <p className="text-[#64748B] text-xs mt-1">Bar chart showing highest revenue products</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <span className="text-[#22C55E] font-medium">Class Breakdown</span>
                <p className="text-[#64748B] text-xs mt-1">Pie chart of revenue by product class</p>
              </div>
            </div>
            <p className="text-[#64748B] text-sm mt-4">
              <strong className="text-white">Tip:</strong> Click any row to expand and see the top customers for that product. Click a customer name to open their detail drawer.
            </p>
          </div>
        ),
      },
      {
        id: 'customer-detail',
        title: 'Customer Detail Drawer',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Click any customer name in the dashboard to open the Customer Detail Drawer, which shows their complete purchase history and product breakdown.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Drawer Sections</h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li><strong className="text-white">Header:</strong> Customer name, total R12 revenue, status badge</li>
                <li><strong className="text-white">Monthly Trend:</strong> Bar chart showing last 24 months of purchases</li>
                <li><strong className="text-white">Products Tab:</strong> All products this customer buys with status indicators</li>
                <li><strong className="text-white">Transactions Tab:</strong> Last 50 orders with expandable line items</li>
              </ul>
            </div>
            <h4 className="text-white font-medium mt-4">Product Status Indicators</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#22C55E]">
                <span className="text-[#22C55E] font-medium">Active</span>
                <p className="text-[#64748B] text-xs mt-1">Recent purchases, healthy</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#F59E0B]">
                <span className="text-[#F59E0B] font-medium">Warning</span>
                <p className="text-[#64748B] text-xs mt-1">3-4 months since last purchase</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#EF4444]">
                <span className="text-[#EF4444] font-medium">Stopped</span>
                <p className="text-[#64748B] text-xs mt-1">6+ months, was buying before</p>
              </div>
            </div>
            <p className="text-[#64748B] text-sm mt-4">
              The drawer helps you answer: "What does this customer buy? What did they stop buying? When was their last order?"
            </p>
          </div>
        ),
      },
      {
        id: 'stopped-buying',
        title: 'Stopped Buying Report',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Stopped Buying report identifies customer-product combinations where a customer used to buy a product but hasn't purchased it in the last 6 months.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Detection Logic</h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li><strong className="text-white">Prior Period:</strong> 6-18 months ago (what they used to buy)</li>
                <li><strong className="text-white">Current Period:</strong> Last 6 months (no purchases = stopped)</li>
                <li><strong className="text-white">Result:</strong> Products bought in prior period but NOT in current</li>
              </ul>
            </div>
            <h4 className="text-white font-medium mt-4">Two Views</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#A855F7]/20">
                <h5 className="text-[#A855F7] font-medium mb-2">By Product</h5>
                <p className="text-[#64748B] text-sm">
                  "Which products are losing customers?" See products ranked by revenue at risk, with drill-down to affected customers.
                </p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-[#A855F7]/20">
                <h5 className="text-[#A855F7] font-medium mb-2">By Customer</h5>
                <p className="text-[#64748B] text-sm">
                  "Which customers stopped buying what?" See customers ranked by lost revenue, with list of products they dropped.
                </p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#A855F7]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <h4 className="text-white font-medium mb-2">Why This Matters</h4>
              <p className="text-[#8FA3BF] text-sm">
                A customer might still be "active" overall but have quietly stopped buying specific products. This report catches those early warning signs before they become full churn.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'attrition',
        title: 'Customer Attrition Analysis',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Attrition Score predicts how likely a customer is to stop buying. Higher scores mean more risk.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Score Components (0-100)</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex justify-between text-[#8FA3BF]">
                  <span><strong className="text-white">Recency (35%)</strong> - Days since last purchase</span>
                </li>
                <li className="flex justify-between text-[#8FA3BF]">
                  <span><strong className="text-white">Frequency (30%)</strong> - Order count change vs prior year</span>
                </li>
                <li className="flex justify-between text-[#8FA3BF]">
                  <span><strong className="text-white">Monetary (25%)</strong> - Revenue change vs prior year</span>
                </li>
                <li className="flex justify-between text-[#8FA3BF]">
                  <span><strong className="text-white">Product Mix (10%)</strong> - Change in product variety</span>
                </li>
              </ul>
            </div>
            <h4 className="text-white font-medium mt-4">Customer Status</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#22C55E]">
                <span className="text-[#22C55E] font-medium">Active (0-40)</span>
                <p className="text-[#64748B] text-xs mt-1">Healthy engagement, no risk</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#F59E0B]">
                <span className="text-[#F59E0B] font-medium">Declining (40-70)</span>
                <p className="text-[#64748B] text-xs mt-1">Negative trends, needs attention</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#EF4444]">
                <span className="text-[#EF4444] font-medium">At-Risk (70+)</span>
                <p className="text-[#64748B] text-xs mt-1">High churn probability, act now</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border-l-4 border-[#64748B]">
                <span className="text-[#64748B] font-medium">Churned</span>
                <p className="text-[#64748B] text-xs mt-1">No purchase in 12+ months</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'yoy',
        title: 'Year-over-Year Performance',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Compare current year revenue and margins against the prior year to identify growth and decline trends.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Chart Features</h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li>• <strong className="text-white">Grouped bars:</strong> Current year (cyan) vs Prior year (purple)</li>
                <li>• <strong className="text-white">Toggle filters:</strong> Show/hide growing or declining entities</li>
                <li>• <strong className="text-white">View switch:</strong> Compare by Customer or by Product Class</li>
                <li>• <strong className="text-white">Hover tooltip:</strong> See exact revenue, change %, and margin details</li>
              </ul>
            </div>
            <div className="flex gap-4 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#22C55E]" />
                <span className="text-[#8FA3BF] text-sm">Growing (&gt;5% increase)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                <span className="text-[#8FA3BF] text-sm">Declining (&gt;5% decrease)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-[#64748B]" />
                <span className="text-[#8FA3BF] text-sm">Stable (within 5%)</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'cross-sell',
        title: 'Cross-Sell Opportunities',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Cross-Sell table recommends products that similar customers buy but the target customer hasn't purchased yet.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">How Recommendations Work</h4>
              <ol className="space-y-2 text-sm text-[#8FA3BF] list-decimal list-inside">
                <li>System finds customers with similar purchase patterns (Jaccard similarity)</li>
                <li>Identifies products that 30%+ of similar customers buy</li>
                <li>Filters out products the target already purchases</li>
                <li>Scores by coverage rate and margin potential</li>
              </ol>
            </div>
            <h4 className="text-white font-medium mt-4">Table Columns</h4>
            <ul className="space-y-2 text-sm text-[#8FA3BF]">
              <li><strong className="text-white">Customer:</strong> Target customer name</li>
              <li><strong className="text-white">Recommended Product:</strong> Product class to pitch</li>
              <li><strong className="text-white">Affinity Score:</strong> 0-100, higher = stronger match</li>
              <li><strong className="text-white">Est. Revenue:</strong> Projected annual revenue if sold</li>
              <li><strong className="text-white">Margin:</strong> Average gross margin % for this product</li>
            </ul>
            <p className="text-[#64748B] text-sm mt-4">
              Click the expand arrow to see which products the customer currently buys and why this recommendation was made.
            </p>
          </div>
        ),
      },
      {
        id: 'concentration',
        title: 'Revenue Concentration',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Concentration chart shows how revenue is distributed across customers, helping identify dependency risk.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">HHI Index (Herfindahl-Hirschman Index)</h4>
              <p className="text-[#64748B] text-sm mb-3">
                Measures revenue concentration. Calculated as the sum of squared revenue percentages.
              </p>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-[#22C55E]/20 text-[#22C55E] rounded text-xs font-medium">&lt; 1,500</span>
                  <span className="text-[#8FA3BF] text-sm">Diversified - Low Risk</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-medium">1,500-2,500</span>
                  <span className="text-[#8FA3BF] text-sm">Moderate - Some concentration</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded text-xs font-medium">&gt; 2,500</span>
                  <span className="text-[#8FA3BF] text-sm">Concentrated - High Risk</span>
                </div>
              </div>
            </div>
            <h4 className="text-white font-medium mt-4">Customer Tiers</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#E5E4E2' }} />
                <span className="text-white text-sm">Platinum (Top 5%)</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#FFD700' }} />
                <span className="text-white text-sm">Gold (Next 15%)</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#C0C0C0' }} />
                <span className="text-white text-sm">Silver (Next 30%)</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-[#0B1220] rounded-lg">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#CD7F32' }} />
                <span className="text-white text-sm">Bronze (Bottom 50%)</span>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'ai-insights',
        title: 'AI-Powered Recommendations',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Click "Generate AI Insights" to get AI-powered recommendations based on your current data.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">What AI Analyzes</h4>
              <ul className="space-y-2 text-sm text-[#8FA3BF]">
                <li>• At-risk customers and potential retention strategies</li>
                <li>• Revenue concentration and diversification suggestions</li>
                <li>• Top cross-sell opportunities with talking points</li>
                <li>• YoY trends and growth opportunities</li>
              </ul>
            </div>
            <h4 className="text-white font-medium mt-4">Recommendation Cards</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded text-xs font-medium">HIGH</span>
                <span className="text-[#8FA3BF] text-sm">Immediate action needed - material revenue impact</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-medium">MEDIUM</span>
                <span className="text-[#8FA3BF] text-sm">Should address soon - meaningful opportunity</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-[#0B1220] rounded-lg">
                <span className="px-2 py-1 bg-[#38BDF8]/20 text-[#38BDF8] rounded text-xs font-medium">LOW</span>
                <span className="text-[#8FA3BF] text-sm">Nice to have - lower priority</span>
              </div>
            </div>
            <p className="text-[#64748B] text-sm mt-4">
              Each recommendation includes: the problem identified, specific actions to take, and expected impact.
            </p>
          </div>
        ),
      },
      {
        id: 'customer-segments',
        title: 'Customer Behavioral Segmentation',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The system automatically classifies each customer into behavioral segments based on their purchase history. This ensures insights are relevant to each customer type.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Customer Segments</h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-[#111827] rounded-lg">
                  <span className="px-2 py-1 bg-[#22C55E]/20 text-[#22C55E] rounded text-xs font-medium whitespace-nowrap">Steady</span>
                  <div>
                    <span className="text-white font-medium">Steady Repeaters</span>
                    <p className="text-[#64748B] text-sm mt-1">
                      Orders regularly (5+ months out of 12), consistent order sizes, active in last 90 days.
                      These are your core accounts—predictable, reliable revenue.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#111827] rounded-lg">
                  <span className="px-2 py-1 bg-[#64748B]/20 text-[#64748B] rounded text-xs font-medium whitespace-nowrap">Project</span>
                  <div>
                    <span className="text-white font-medium">Project Buyers</span>
                    <p className="text-[#64748B] text-sm mt-1">
                      1-3 orders total, all within 90-day window, no orders in 6+ months, &gt;$10K total.
                      One-time project purchases—they're done, not "at risk."
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#111827] rounded-lg">
                  <span className="px-2 py-1 bg-[#8B5CF6]/20 text-[#8B5CF6] rounded text-xs font-medium whitespace-nowrap">Seasonal</span>
                  <div>
                    <span className="text-white font-medium">Seasonal Buyers</span>
                    <p className="text-[#64748B] text-sm mt-1">
                      Orders cluster in specific months (&gt;60% in 4-month window), pattern repeats across years.
                      Only alert them before their buying season.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#111827] rounded-lg">
                  <span className="px-2 py-1 bg-[#38BDF8]/20 text-[#38BDF8] rounded text-xs font-medium whitespace-nowrap">New</span>
                  <div>
                    <span className="text-white font-medium">New Accounts</span>
                    <p className="text-[#64748B] text-sm mt-1">
                      First order less than 6 months ago, or fewer than 3 total orders.
                      Need nurturing, not cross-sell pressure.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 bg-[#111827] rounded-lg">
                  <span className="px-2 py-1 bg-[#F59E0B]/20 text-[#F59E0B] rounded text-xs font-medium whitespace-nowrap">Irregular</span>
                  <div>
                    <span className="text-white font-medium">Irregular Buyers</span>
                    <p className="text-[#64748B] text-sm mt-1">
                      Sporadic, unpredictable ordering patterns that don't fit other segments.
                      May need individual assessment.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <h4 className="text-white font-medium mt-4">Product Focus Classification</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <span className="text-[#EF4444] font-medium">Single Product</span>
                <p className="text-[#64748B] text-xs mt-1">&gt;80% revenue from one class</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <span className="text-[#F59E0B] font-medium">Narrow</span>
                <p className="text-[#64748B] text-xs mt-1">&gt;60% from one class</p>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <span className="text-[#22C55E] font-medium">Diverse</span>
                <p className="text-[#64748B] text-xs mt-1">Buys across multiple classes</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#A855F7]/10 to-[#38BDF8]/10 rounded-lg p-4 border border-white/[0.06] mt-4">
              <h4 className="text-white font-medium mb-2">Segment Summary Display</h4>
              <p className="text-[#8FA3BF] text-sm">
                The AI Insights panel header shows a live summary of your customer segments with colored badges
                (e.g., "45 Steady", "12 Project", "8 Seasonal"). This helps you understand your customer base at a glance.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'insight-eligibility',
        title: 'Insight Eligibility Filtering',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Not every insight applies to every customer. The system automatically filters insights based on customer segment,
              ensuring you only see relevant, actionable recommendations.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Eligibility Rules</h4>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#EF4444]/20 text-[#EF4444] rounded text-xs font-medium">Attrition Alerts</span>
                  </div>
                  <div className="pl-4 border-l-2 border-[#EF4444]/30">
                    <p className="text-[#64748B] text-sm">
                      <strong className="text-white">Only for:</strong> Steady repeaters and diverse buyers
                    </p>
                    <p className="text-[#64748B] text-sm mt-1">
                      <strong className="text-white">Excluded:</strong> Project buyers (they're done, not churning)
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#22C55E]/20 text-[#22C55E] rounded text-xs font-medium">Cross-Sell</span>
                  </div>
                  <div className="pl-4 border-l-2 border-[#22C55E]/30">
                    <p className="text-[#64748B] text-sm">
                      <strong className="text-white">Only for:</strong> Narrow and diverse product focus
                    </p>
                    <p className="text-[#64748B] text-sm mt-1">
                      <strong className="text-white">Excluded:</strong> Single-product customers (low conversion rate)
                    </p>
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-1 bg-[#38BDF8]/20 text-[#38BDF8] rounded text-xs font-medium">Repeat Orders</span>
                  </div>
                  <div className="pl-4 border-l-2 border-[#38BDF8]/30">
                    <p className="text-[#64748B] text-sm">
                      <strong className="text-white">Only for:</strong> Steady repeaters, seasonal, and new accounts
                    </p>
                    <p className="text-[#64748B] text-sm mt-1">
                      <strong className="text-white">Excluded:</strong> Project buyers (won't reorder)
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#EF4444]/10 to-transparent rounded-lg p-4 border border-[#EF4444]/20">
              <h4 className="text-white font-medium mb-2">Why This Matters</h4>
              <p className="text-[#8FA3BF] text-sm">
                Before eligibility filtering, the system would flag project buyers as "at risk" (wrong—they're just done)
                and recommend cross-sell to single-product customers (low conversion). These filters dramatically improve
                insight relevance and sales team trust.
              </p>
            </div>
            <h4 className="text-white font-medium mt-4">AI Prompt Enhancement</h4>
            <p className="text-[#64748B] text-sm">
              When generating AI recommendations, the system now includes customer segment context in the prompt.
              This means the AI understands <em>why</em> a customer matters and tailors its advice accordingly—
              different strategies for steady repeaters vs. project buyers vs. seasonal customers.
            </p>
          </div>
        ),
      },
      {
        id: 'roi-tracking',
        title: 'ROI Tracking via Asana',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Track which insights convert into real business results using the integrated Asana task system.
              When you create a task from an insight, metadata is automatically embedded for analytics.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">How It Works</h4>
              <ol className="space-y-3 text-sm">
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#A855F7]/20 text-[#A855F7] flex items-center justify-center flex-shrink-0 text-xs font-bold">1</span>
                  <div>
                    <span className="text-white font-medium">Create Task from Insight</span>
                    <p className="text-[#64748B]">Click any action item on an AI recommendation to create an Asana task</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#A855F7]/20 text-[#A855F7] flex items-center justify-center flex-shrink-0 text-xs font-bold">2</span>
                  <div>
                    <span className="text-white font-medium">Metadata Embedded</span>
                    <p className="text-[#64748B]">Task notes include: source, insight ID, category, customer name, creation date</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#A855F7]/20 text-[#A855F7] flex items-center justify-center flex-shrink-0 text-xs font-bold">3</span>
                  <div>
                    <span className="text-white font-medium">Work the Task</span>
                    <p className="text-[#64748B]">Complete the task in Asana when the action is done (called, emailed, meeting held, etc.)</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#A855F7]/20 text-[#A855F7] flex items-center justify-center flex-shrink-0 text-xs font-bold">4</span>
                  <div>
                    <span className="text-white font-medium">Analytics Calculated</span>
                    <p className="text-[#64748B]">System parses all insight tasks to calculate conversion rates by category</p>
                  </div>
                </li>
              </ol>
            </div>
            <h4 className="text-white font-medium mt-4">ROI Tracking Tab</h4>
            <p className="text-[#8FA3BF] text-sm mb-3">
              Open the Insights drawer and click the "ROI Tracking" tab to see analytics:
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04] text-center">
                <div className="text-2xl font-bold text-white">24</div>
                <div className="text-[#64748B] text-xs">Tasks Created</div>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04] text-center">
                <div className="text-2xl font-bold text-[#22C55E]">18</div>
                <div className="text-[#64748B] text-xs">Completed</div>
              </div>
              <div className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04] text-center">
                <div className="text-2xl font-bold text-[#38BDF8]">75%</div>
                <div className="text-[#64748B] text-xs">Completion Rate</div>
              </div>
            </div>
            <h4 className="text-white font-medium mt-4">By Category Breakdown</h4>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <p className="text-[#64748B] text-sm mb-3">
                See which insight categories perform best:
              </p>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-sm">Repeat Orders</span>
                  <span className="text-[#22C55E] text-sm">85% completion</span>
                </div>
                <div className="w-full bg-[#1E293B] rounded-full h-2">
                  <div className="bg-[#22C55E] h-2 rounded-full" style={{ width: '85%' }} />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-white text-sm">Cross-Sell</span>
                  <span className="text-[#F59E0B] text-sm">62% completion</span>
                </div>
                <div className="w-full bg-[#1E293B] rounded-full h-2">
                  <div className="bg-[#F59E0B] h-2 rounded-full" style={{ width: '62%' }} />
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-white text-sm">Attrition</span>
                  <span className="text-[#38BDF8] text-sm">45% completion</span>
                </div>
                <div className="w-full bg-[#1E293B] rounded-full h-2">
                  <div className="bg-[#38BDF8] h-2 rounded-full" style={{ width: '45%' }} />
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#22C55E]/10 to-transparent rounded-lg p-4 border border-[#22C55E]/20 mt-4">
              <h4 className="text-white font-medium mb-2">Self-Improving System</h4>
              <p className="text-[#8FA3BF] text-sm">
                Over time, these analytics reveal which insight types actually convert. Low-performing categories
                can be refined or deprioritized, while high-performers get more attention. This feedback loop
                makes the entire insights system smarter.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },
  distributors: {
    title: 'Distributor Intelligence Guide',
    description: 'Strategic location insights, health scoring, and actionable recommendations for distributor management.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
    color: '#14B8A6',
    topics: [
      {
        id: 'overview',
        title: 'System Overview',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Distributor Intelligence system transforms basic location data into actionable business insights. Instead of just showing revenue numbers, it answers the critical question: <span className="text-white font-medium">"What should I do about this location?"</span>
            </p>
            <div className="bg-gradient-to-r from-[#14B8A6]/10 to-transparent rounded-lg p-4 border border-[#14B8A6]/20">
              <h4 className="text-white font-medium mb-2">Three Core Components</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">1.</span>
                  <span className="text-[#8FA3BF]"><span className="text-white">AI-Powered Insights:</span> Distributor-level recommendations with inline product context and activity status</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">2.</span>
                  <span className="text-[#8FA3BF]"><span className="text-white">Location Health Scoring:</span> 0-100 scores across revenue, engagement, margin, and category metrics</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">3.</span>
                  <span className="text-[#8FA3BF]"><span className="text-white">Strategic Actions:</span> Priority-ranked recommendations with opportunity sizing and Asana integration</span>
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'health-scores',
        title: 'Location Health Scores',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Every location receives a comprehensive health score (0-100) that combines four critical dimensions:
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { name: 'Revenue Health (35%)', desc: 'Percentile rank among peer locations', icon: '💰', color: '#14B8A6' },
                { name: 'Engagement Health (25%)', desc: 'Purchase frequency vs. peer average', icon: '📊', color: '#38BDF8' },
                { name: 'Margin Health (20%)', desc: 'Margin % vs. distributor average', icon: '📈', color: '#F59E0B' },
                { name: 'Category Health (20%)', desc: 'Category diversity vs. peers', icon: '🏷️', color: '#A855F7' },
              ].map((metric) => (
                <div key={metric.name} className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{metric.icon}</span>
                    <span className="text-white font-medium text-sm">{metric.name}</span>
                  </div>
                  <p className="text-[#64748B] text-sm">{metric.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Health Tiers</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-green-500/10 rounded border border-green-500/20">
                  <span className="text-white text-sm">Excellent</span>
                  <span className="text-green-300 text-sm font-medium">80-100</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-blue-500/10 rounded border border-blue-500/20">
                  <span className="text-white text-sm">Good</span>
                  <span className="text-blue-300 text-sm font-medium">60-79</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-amber-500/10 rounded border border-amber-500/20">
                  <span className="text-white text-sm">Fair</span>
                  <span className="text-amber-300 text-sm font-medium">40-59</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-red-500/10 rounded border border-red-500/20">
                  <span className="text-white text-sm">Poor</span>
                  <span className="text-red-300 text-sm font-medium">0-39</span>
                </div>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'priority-actions',
        title: 'Priority Action Cards',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Priority Actions provide specific, ranked recommendations for each location based on health analysis. Each action includes impact assessment, effort estimation, and revenue opportunity sizing.
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">🚨</span>
                  <span className="text-red-300 text-xs font-semibold uppercase tracking-wider">Critical Priority</span>
                </div>
                <h4 className="text-white font-medium mb-1">Reactivate Inactive Location</h4>
                <p className="text-[#8FA3BF] text-sm">Triggered when no purchases in 90+ days. Immediate outreach required to prevent complete churn.</p>
              </div>
              <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">⚡</span>
                  <span className="text-amber-300 text-xs font-semibold uppercase tracking-wider">High Priority</span>
                </div>
                <h4 className="text-white font-medium mb-1">Expand to Missing Categories</h4>
                <p className="text-[#8FA3BF] text-sm">Identifies categories purchased by 75%+ of peers but missing from this location. Cross-sell opportunity.</p>
              </div>
              <div className="p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">💡</span>
                  <span className="text-blue-300 text-xs font-semibold uppercase tracking-wider">Medium Priority</span>
                </div>
                <h4 className="text-white font-medium mb-1">Increase Order Frequency</h4>
                <p className="text-[#8FA3BF] text-sm">When location orders less frequently than peer average. Low-effort way to boost annual revenue.</p>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#14B8A6]/10 to-transparent rounded-lg p-4 border border-[#14B8A6]/20">
              <h4 className="text-white font-medium mb-2">Direct Task Creation</h4>
              <p className="text-[#8FA3BF] text-sm">
                Click "Create Task" on any action to open the Asana integration modal. Tasks are pre-filled with action details, opportunity sizing, and distributor metadata for proper attribution.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'product-context',
        title: 'Product Context & Categories',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Distributor insights now include inline product context, eliminating the need to switch tabs to understand purchase behavior:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Category Badges</h4>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-[#64748B] uppercase tracking-wider">Categories:</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">Plumbing</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">HVAC</span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30">Electrical</span>
                <span className="text-[10px] text-[#64748B]">+2 more</span>
              </div>
              <p className="text-[#64748B] text-sm">Top 3 categories by revenue, with total count. Hover for revenue and percentage breakdown.</p>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Activity Status Indicators</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 rounded-lg text-[10px] font-medium bg-green-500/20 text-green-300 border border-green-500/30 flex items-center gap-1">
                    <span>●</span>
                    <span>Active</span>
                  </div>
                  <span className="text-[#64748B] text-sm">Purchased within last 30 days</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 rounded-lg text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <span>◐</span>
                    <span>At Risk</span>
                  </div>
                  <span className="text-[#64748B] text-sm">Last purchase 30-90 days ago</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-2 py-1 rounded-lg text-[10px] font-medium bg-red-500/20 text-red-300 border border-red-500/30 flex items-center gap-1">
                    <span>○</span>
                    <span>Inactive</span>
                  </div>
                  <span className="text-[#64748B] text-sm">No purchases in 90+ days</span>
                </div>
              </div>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Expansion Opportunities</h4>
              <div className="p-2 bg-amber-500/10 rounded-lg border border-amber-500/20">
                <div className="text-[10px] font-semibold text-amber-300 uppercase tracking-wider mb-1">
                  Expansion Opportunity
                </div>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] text-[#94A3B8]">Industrial Controls</span>
                  <span className="text-[10px] text-[#94A3B8]">Safety Equipment</span>
                  <span className="text-[10px] text-[#94A3B8]">Fasteners</span>
                </div>
              </div>
              <p className="text-[#64748B] text-sm mt-2">Categories purchased by 75%+ of peer locations but missing from this distributor.</p>
            </div>
          </div>
        ),
      },
      {
        id: 'peer-benchmarking',
        title: 'Peer Benchmarking',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Compare each location against similar peers within the same distributor to identify performance gaps and opportunities:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Similarity Scoring</h4>
              <p className="text-[#8FA3BF] text-sm mb-3">
                Locations are matched based on two factors (0-100 scale):
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">•</span>
                  <span className="text-[#8FA3BF]"><span className="text-white">Revenue Similarity (50 pts):</span> How close is the revenue to the current location</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">•</span>
                  <span className="text-[#8FA3BF]"><span className="text-white">Category Overlap (50 pts):</span> How many categories do they purchase in common</span>
                </li>
              </ul>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Competitive Position Metrics</h4>
              <p className="text-[#8FA3BF] text-sm mb-3">
                Percentile rankings show where this location stands vs. all locations in the distributor:
              </p>
              <div className="space-y-3">
                {[
                  { label: 'Revenue', percentile: 75, icon: '💰' },
                  { label: 'Order Frequency', percentile: 62, icon: '📊' },
                  { label: 'Margin', percentile: 85, icon: '📈' },
                  { label: 'Category Diversity', percentile: 50, icon: '🏷️' },
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span>{metric.icon}</span>
                        <span className="text-xs text-[#94A3B8]">{metric.label}</span>
                      </div>
                      <span className="text-sm font-semibold text-white">{metric.percentile}th</span>
                    </div>
                    <div className="w-full h-2 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#14B8A6] transition-all duration-500"
                        style={{ width: `${metric.percentile}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'task-integration',
        title: 'Asana Task Integration',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              All distributor insights and actions integrate directly with your Asana workflow. No more isolated task systems.
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Individual Task Creation</h4>
              <p className="text-[#8FA3BF] text-sm mb-3">
                Every insight and action card has an "Add Task" button that opens the Asana modal:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">1.</span>
                  <span className="text-[#8FA3BF]">Click "Add Task" or "Create Task" on any insight/action</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">2.</span>
                  <span className="text-[#8FA3BF]">Modal pre-fills with recommendation details and metadata</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">3.</span>
                  <span className="text-[#8FA3BF]">Customize title, assignee, due date, and section</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">4.</span>
                  <span className="text-[#8FA3BF]">Task created in Asana with distributor metadata embedded</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#14B8A6]">5.</span>
                  <span className="text-[#8FA3BF]">Button updates to "Task Created ✓" to prevent duplicates</span>
                </li>
              </ul>
            </div>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Task Metadata</h4>
              <p className="text-[#8FA3BF] text-sm mb-3">
                Tasks include hidden metadata in the notes field for proper attribution:
              </p>
              <div className="bg-[#1E293B] rounded p-3 font-mono text-xs">
                <div className="text-[#64748B]">---</div>
                <div className="text-[#8FA3BF]">📊 INSIGHT METADATA (do not edit below)</div>
                <div className="text-[#8FA3BF]">distributor: Ferguson Enterprises</div>
                <div className="text-[#8FA3BF]">customer_id: FERG-LOC-12345</div>
                <div className="text-[#8FA3BF]">location: Houston, TX</div>
                <div className="text-[#8FA3BF]">category: expansion</div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#14B8A6]/10 to-transparent rounded-lg p-4 border border-[#14B8A6]/20">
              <h4 className="text-white font-medium mb-2">Task Sources</h4>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#14B8A6]" />
                  <span className="text-[#8FA3BF]">Distributor AI Insights (dashboard)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#14B8A6]" />
                  <span className="text-[#8FA3BF]">Priority Action Cards (location detail)</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#14B8A6]" />
                  <span className="text-[#8FA3BF]">Growth Opportunities (location detail)</span>
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'best-practices',
        title: 'Best Practices',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Get the most value from Distributor Intelligence by following these proven workflows:
            </p>
            <div className="space-y-3">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-white font-medium mb-2">Weekly Review Workflow</h4>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6]">1.</span>
                    <span className="text-[#8FA3BF]">Start with distributor dashboard insights - focus on "Critical" and "High" priority items</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6]">2.</span>
                    <span className="text-[#8FA3BF]">Check activity status badges - reach out to "At Risk" and "Inactive" locations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6]">3.</span>
                    <span className="text-[#8FA3BF]">Review location health scores - drill into "Poor" and "Fair" locations</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6]">4.</span>
                    <span className="text-[#8FA3BF]">Create tasks for top 3-5 actions, assign to appropriate team members</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-[#14B8A6]">5.</span>
                    <span className="text-[#8FA3BF]">Track task completion in Asana to measure ROI</span>
                  </li>
                </ol>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-white font-medium mb-2">Using Peer Benchmarks</h4>
                <p className="text-[#8FA3BF] text-sm mb-2">
                  The peer benchmarking table shows the most similar locations. Use this to:
                </p>
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                    <span className="text-[#8FA3BF]">Identify what high-performing peers are doing differently</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                    <span className="text-[#8FA3BF]">Set realistic targets based on peer performance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6]" />
                    <span className="text-[#8FA3BF]">Find category expansion opportunities from peer purchases</span>
                  </li>
                </ul>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-white font-medium mb-2">Interpreting Health Scores</h4>
                <div className="space-y-2 text-sm">
                  <p className="text-[#8FA3BF]">Health scores below 60 indicate actionable opportunities:</p>
                  <ul className="space-y-1">
                    <li className="flex items-start gap-2">
                      <span className="text-red-300">•</span>
                      <span className="text-[#8FA3BF]"><span className="text-white">Low Revenue Health:</span> Location isn't buying enough - check competitive threats</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-300">•</span>
                      <span className="text-[#8FA3BF]"><span className="text-white">Low Engagement:</span> Infrequent orders - set up recurring delivery or check satisfaction</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-300">•</span>
                      <span className="text-[#8FA3BF]"><span className="text-white">Low Margin:</span> Wrong product mix - recommend higher-margin alternatives</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-red-300">•</span>
                      <span className="text-[#8FA3BF]"><span className="text-white">Low Category:</span> Limited purchases - cross-sell opportunities available</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-r from-[#22C55E]/10 to-transparent rounded-lg p-4 border border-[#22C55E]/20">
              <h4 className="text-white font-medium mb-2">Success Metric</h4>
              <p className="text-[#8FA3BF] text-sm">
                Track the completion rate of created tasks in Asana. High-performing teams consistently act on "Critical" and "High" priority items within 48 hours, resulting in 15-25% average revenue increases per location within 90 days.
              </p>
            </div>
          </div>
        ),
      },
    ],
  },
  operations: {
    title: 'Operations Center Guide',
    description: 'Monitor Order→Cash visibility, inventory status, and operational KPIs in real-time.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: '#F97316',
    topics: [
      {
        id: 'overview',
        title: 'Dashboard Overview',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Operations Center provides real-time visibility into your Order→Cash cycle and inventory status, pulling live data from NetSuite.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'Revenue at Risk', desc: 'Order values weighted by aging (90+ days = 100% risk)', color: '#D4A72C' },
                { title: 'Backlog Value', desc: 'Total value of all open sales orders', color: '#5B8DEF' },
                { title: 'On-Time Delivery', desc: 'Percentage of orders shipped by expected date', color: '#22C55E' },
                { title: 'Low Stock Items', desc: 'Items below reorder point that need attention', color: '#E5484D' },
              ].map((kpi) => (
                <div key={kpi.title} className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: kpi.color }} />
                    <span className="text-white font-medium text-sm">{kpi.title}</span>
                  </div>
                  <p className="text-[#64748B] text-sm">{kpi.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'order-aging',
        title: 'Order Aging Buckets',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Orders are automatically categorized into aging buckets to help prioritize attention:
            </p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { bucket: '0-30 days', desc: 'Healthy - normal processing', color: '#22C55E' },
                { bucket: '31-60 days', desc: 'Watch - needs attention', color: '#D4A72C' },
                { bucket: '61-90 days', desc: 'Warning - follow up required', color: '#F97316' },
                { bucket: '90+ days', desc: 'Critical - immediate action', color: '#E5484D' },
              ].map((item) => (
                <div key={item.bucket} className="p-3 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="w-full h-1 rounded-full mb-2" style={{ backgroundColor: item.color }} />
                  <span className="text-white font-medium text-sm">{item.bucket}</span>
                  <p className="text-[#64748B] text-xs mt-1">{item.desc}</p>
                </div>
              ))}
            </div>
            <div className="bg-[#F97316]/10 rounded-lg p-4 border border-[#F97316]/20">
              <h4 className="text-[#F97316] font-medium mb-2">Revenue at Risk Calculation</h4>
              <p className="text-[#8FA3BF] text-sm">
                Revenue at Risk weights order values by their age: 90+ days = 100%, 61-90 = 70%, 31-60 = 40%, 0-30 = 10%. This helps prioritize which orders to address first.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'orders-tab',
        title: 'Orders Tab',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Orders tab shows all open sales orders with aging information and allows filtering by bucket:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Features</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-[#8FA3BF]"><strong className="text-white">Aging Distribution:</strong> Click any bucket to filter orders</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Order Details:</strong> View order number, customer, date, status, and amount</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Age Badges:</strong> Color-coded badges show which bucket each order falls into</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Sorting:</strong> Orders are sorted by age, with oldest first</li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'inventory-tab',
        title: 'Inventory Tab',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The Inventory tab provides three views into your inventory status:
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <span className="text-red-400 font-medium">Low Stock</span>
                </div>
                <p className="text-[#64748B] text-sm">Items below their reorder point</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-amber-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <span className="text-amber-400 font-medium">Backordered</span>
                </div>
                <p className="text-[#64748B] text-sm">Items with pending backorders</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-purple-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <span className="text-purple-400 font-medium">Value by Type</span>
                </div>
                <p className="text-[#64748B] text-sm">Inventory value breakdown</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'alerts',
        title: 'Alerts & Notifications',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The dashboard automatically shows alerts when exceptions are detected:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Alert Types</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-[#8FA3BF]"><strong className="text-amber-400">Warning:</strong> Orders aging 90+ days or low stock items detected</li>
                <li className="text-[#8FA3BF]"><strong className="text-red-400">Error:</strong> Critical issues requiring immediate attention</li>
                <li className="text-[#8FA3BF]"><strong className="text-blue-400">Info:</strong> General notifications about data changes</li>
              </ul>
            </div>
            <p className="text-[#64748B] text-sm">
              Alerts appear as toast notifications in the top-right corner and auto-dismiss after 8 seconds.
            </p>
          </div>
        ),
      },
      {
        id: 'netsuite',
        title: 'NetSuite Integration',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              All data is pulled directly from NetSuite in real-time via SuiteQL queries:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#F97316] font-medium mb-2">Sales Orders</h4>
                <p className="text-[#64748B] text-sm">Open orders with status, amounts, and aging calculated from transaction date.</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#F97316] font-medium mb-2">Fulfillments</h4>
                <p className="text-[#64748B] text-sm">Item fulfillments with ship dates for on-time delivery tracking.</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#F97316] font-medium mb-2">Inventory</h4>
                <p className="text-[#64748B] text-sm">Item quantities, costs, and reorder points from the Item table.</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#F97316] font-medium mb-2">Backorders</h4>
                <p className="text-[#64748B] text-sm">Items with backordered quantities from open sales order lines.</p>
              </div>
            </div>
          </div>
        ),
      },
    ],
  },
  'wip-operations': {
    title: 'WIP Operations Guide',
    description: 'Track manufacturing operations, work order status, and production progress directly from NetSuite.',
    icon: (
      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    color: '#F59E0B',
    topics: [
      {
        id: 'overview',
        title: 'Dashboard Overview',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The WIP Operations Dashboard provides real-time visibility into manufacturing work orders and their routing operations directly from NetSuite.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: 'Total WIP', desc: 'Count of active work orders in production', color: '#5B8DEF' },
                { title: 'WIP Value', desc: 'Total revenue value currently in progress', color: '#22C55E' },
                { title: 'Operations Behind', desc: 'Work orders exceeding time thresholds', color: '#F59E0B' },
                { title: 'Ready to Ship', desc: 'Work orders at final operations (90%+ complete)', color: '#22C55E' },
              ].map((kpi) => (
                <div key={kpi.title} className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: kpi.color }} />
                    <span className="text-white font-medium text-sm">{kpi.title}</span>
                  </div>
                  <p className="text-[#64748B] text-sm">{kpi.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ),
      },
      {
        id: 'operations',
        title: 'Manufacturing Operations',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Each work order follows a manufacturing routing with sequential operations (Op 10, Op 20, Op 30, etc.) that represent actual production stages:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Typical Operation Sequence</h4>
              <div className="space-y-2">
                {[
                  { op: 'Op 10', name: 'Engineering', desc: 'Design review and documentation' },
                  { op: 'Op 20', name: 'Procurement', desc: 'Material ordering and receiving' },
                  { op: 'Op 30', name: 'Fab/Assembly', desc: 'Manufacturing and assembly' },
                  { op: 'Op 40', name: 'Test Bench', desc: 'Quality testing and calibration' },
                  { op: 'Op 50', name: 'QA/QC', desc: 'Final quality inspection' },
                  { op: 'Op 60', name: 'Ship Prep', desc: 'Packaging and shipping preparation' },
                ].map((step) => (
                  <div key={step.op} className="flex items-center gap-3 p-2 rounded bg-white/[0.02]">
                    <span className="text-[#F59E0B] font-mono text-xs w-12">{step.op}</span>
                    <span className="text-white text-sm font-medium w-28">{step.name}</span>
                    <span className="text-[#64748B] text-sm">{step.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'operation-status',
        title: 'Operation Status',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Each operation has a status indicating its progress:
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-green-400 font-medium">Complete</span>
                </div>
                <p className="text-[#64748B] text-sm">Operation finished successfully</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-blue-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <svg className="w-3 h-3 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-blue-400 font-medium">In Progress</span>
                </div>
                <p className="text-[#64748B] text-sm">Currently being worked on</p>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-gray-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-6 h-6 rounded-full bg-gray-500/10 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gray-500" />
                  </div>
                  <span className="text-gray-400 font-medium">Pending</span>
                </div>
                <p className="text-[#64748B] text-sm">Waiting to start</p>
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'expandable-rows',
        title: 'Work Order Details',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Click any row in the work order table to expand and see all operations for that work order:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Expanded View Shows</h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#8FA3BF]"><span className="text-white">Operation Timeline</span> - Visual progress through all routing steps</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#8FA3BF]"><span className="text-white">Status per Operation</span> - Complete, In Progress, or Pending</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#8FA3BF]"><span className="text-white">Days in Operation</span> - Time spent at each step</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#8FA3BF]"><span className="text-white">Work Center</span> - Where the work is being done</span>
                </li>
                <li className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#8FA3BF]"><span className="text-white">Quantity</span> - Completed vs. total quantity</span>
                </li>
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: 'filtering',
        title: 'Filtering & Search',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              Use the filtering tools to find specific work orders:
            </p>
            <div className="bg-[#0B1220] rounded-lg p-4 border border-white/[0.04]">
              <h4 className="text-white font-medium mb-3">Available Filters</h4>
              <ul className="space-y-2 text-sm">
                <li className="text-[#8FA3BF]"><strong className="text-white">Search:</strong> Find by WO#, customer name, SO#, or description</li>
                <li className="text-[#8FA3BF]"><strong className="text-white">Status:</strong> Filter by work order status (Active, Released, Closed)</li>
              </ul>
            </div>
            <div className="p-4 bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-lg">
              <p className="text-[#F59E0B] text-sm">
                <strong>Tip:</strong> Click any KPI card at the top to quickly filter to that subset of work orders.
              </p>
            </div>
          </div>
        ),
      },
      {
        id: 'netsuite-integration',
        title: 'NetSuite Integration',
        content: (
          <div className="space-y-4">
            <p className="text-[#8FA3BF]">
              The WIP Operations Dashboard pulls data directly from NetSuite in real-time:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#F97316] font-medium mb-2">Data Sources</h4>
                <ul className="space-y-1 text-sm text-[#64748B]">
                  <li>Work Orders (Transactions)</li>
                  <li>Manufacturing Operation Tasks</li>
                  <li>WIP Cost Reports</li>
                </ul>
              </div>
              <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
                <h4 className="text-[#F97316] font-medium mb-2">Refresh</h4>
                <p className="text-[#64748B] text-sm">
                  Click the Refresh button to pull the latest data from NetSuite. Data is queried live on each page load.
                </p>
              </div>
            </div>
            <div className="p-4 bg-[#0B1220] rounded-lg border border-white/[0.04]">
              <h4 className="text-white font-medium mb-2">Required Permissions</h4>
              <p className="text-[#8FA3BF] text-sm mb-2">
                The NetSuite API role needs these permissions to access operations data:
              </p>
              <ul className="space-y-1 text-sm text-[#64748B]">
                <li>Lists {'>'} Manufacturing {'>'} Manufacturing Operation Task - View</li>
                <li>Lists {'>'} Manufacturing {'>'} Manufacturing Routing - View</li>
                <li>Setup {'>'} SuiteQL - Full</li>
              </ul>
            </div>
          </div>
        ),
      },
    ],
  },
};

export default function GuideCategoryPage() {
  const params = useParams();
  const { isCollapsed } = useSidebar();
  const category = params.category as string;
  const guide = guideContent[category];

  if (!guide) {
    return (
      <div className="flex min-h-screen bg-[#0B1220] relative overflow-hidden">
        <DashboardBackground {...backgroundPresets.guides} />
        <Sidebar />
        <motion.main
          animate={{
            marginLeft: isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH,
            width: `calc(100% - ${isCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH}px)`,
          }}
          className="flex-1 flex items-center justify-center relative z-10"
        >
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Guide Not Found</h1>
            <Link href="/guides" className="text-[#38BDF8] hover:underline">
              Return to Guides
            </Link>
          </div>
        </motion.main>
      </div>
    );
  }

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
        <div className="max-w-5xl mx-auto px-8 py-12">
          {/* Back Link */}
          <Link href="/guides" className="inline-flex items-center gap-2 text-[#64748B] hover:text-white mb-8 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Guides
          </Link>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-6 mb-12"
          >
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: `${guide.color}15` }}
            >
              <span style={{ color: guide.color }}>{guide.icon}</span>
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{guide.title}</h1>
              <p className="text-[#8FA3BF] text-lg">{guide.description}</p>
            </div>
          </motion.div>

          {/* Table of Contents */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111827] rounded-xl border border-white/[0.06] p-6 mb-8"
          >
            <h3 className="text-sm font-semibold text-[#64748B] uppercase tracking-wider mb-4">In This Guide</h3>
            <div className="flex flex-wrap gap-2">
              {guide.topics.map((topic) => (
                <a
                  key={topic.id}
                  href={`#${topic.id}`}
                  className="px-3 py-1.5 bg-[#0B1220] hover:bg-[#1E293B] text-[#8FA3BF] hover:text-white rounded-lg text-sm transition-colors"
                >
                  {topic.title}
                </a>
              ))}
            </div>
          </motion.div>

          {/* Topics */}
          <div className="space-y-12">
            {guide.topics.map((topic, index) => (
              <motion.section
                key={topic.id}
                id={topic.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="scroll-mt-8"
              >
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-3">
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: `${guide.color}15`, color: guide.color }}
                  >
                    {index + 1}
                  </span>
                  {topic.title}
                </h2>
                <div className="pl-11">
                  {topic.content}
                </div>
              </motion.section>
            ))}
          </div>

          {/* Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-16 pt-8 border-t border-white/[0.06]"
          >
            <div className="flex items-center justify-between">
              <Link href="/guides" className="text-[#64748B] hover:text-white transition-colors">
                ← All Guides
              </Link>
              <Link
                href="/contracts-dashboard"
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#38BDF8]/10 text-[#38BDF8] rounded-lg hover:bg-[#38BDF8]/20 transition-colors"
              >
                Open Dashboard
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </motion.div>
        </div>
      </motion.main>
    </div>
  );
}
