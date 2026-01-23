// Searchable index of all guide content for the Help system
// Each entry contains extractable text content for search and AI context

export interface GuideEntry {
  id: string;
  category: string;
  title: string;
  content: string;
  keywords: string[];
  path: string;
}

export const guideIndex: GuideEntry[] = [
  // Pipeline Guide
  {
    id: 'pipeline-stages',
    category: 'pipeline',
    title: 'Understanding Pipeline Stages',
    content: `MARS uses a 6-stage pipeline to track contracts from initial discussions to purchase order:
    1. Discussions Not Started - Lead identified, no engagement yet
    2. Initial Agreement Development - Active negotiations, drafting terms
    3. Review & Redlines - Legal review, tracking changes
    4. Approval & Signature - Final approval and signing
    5. Agreement Submission - Contract submitted to customer
    6. PO Received - Purchase order received, deal won!`,
    keywords: ['pipeline', 'stages', 'discussions', 'drafting', 'review', 'redlines', 'approval', 'signature', 'submission', 'PO', 'lifecycle'],
    path: '/guides/pipeline#stages'
  },
  {
    id: 'pipeline-kpis',
    category: 'pipeline',
    title: 'KPI Cards & Metrics',
    content: `The interactive KPI cards at the top of the Pipeline view show key metrics and can be clicked to filter the contract list:
    - Total Pipeline: Click to see all active contracts
    - Due Next 30 Days: Contracts with close dates in the next month
    - Overdue: Contracts past their expected close date
    - High Value: Contracts above the average deal size
    Click any KPI card to filter the pipeline view to those specific contracts.`,
    keywords: ['KPI', 'metrics', 'pipeline', 'total', 'overdue', 'due', 'high value', 'filter', 'cards'],
    path: '/guides/pipeline#kpis'
  },
  {
    id: 'pipeline-filters',
    category: 'pipeline',
    title: 'Filtering & Search',
    content: `Use the powerful filtering system to find specific contracts:
    - Status: Filter by pipeline stage
    - Year: Filter by close date year
    - Contract Type: Equipment, Service, etc.
    - Budgeted: Show only forecasted deals
    - Probability: Filter by close probability
    - Search: Full-text search on contract names
    Pro tip: Use Cmd+K to open the command palette for quick filtering and searching.`,
    keywords: ['filter', 'search', 'status', 'year', 'contract type', 'budgeted', 'probability', 'find', 'Cmd+K'],
    path: '/guides/pipeline#filters'
  },
  {
    id: 'pipeline-salesforce',
    category: 'pipeline',
    title: 'Salesforce Integration',
    content: `MARS syncs with Salesforce to keep your pipeline data up-to-date:
    - Automatic Sync: Contract data syncs from Salesforce automatically, including stage, value, and dates
    - Direct Links: Click the SF link on any contract to open it directly in Salesforce
    Data flows from Salesforce opportunities to MARS pipeline in real-time.`,
    keywords: ['salesforce', 'sync', 'integration', 'SF', 'automatic', 'link', 'opportunity'],
    path: '/guides/pipeline#salesforce'
  },

  // Documents Guide
  {
    id: 'documents-types',
    category: 'documents',
    title: 'Document Types',
    content: `MARS tracks several document types for each contract:
    Required Documents:
    - Original Contract: Initial contract from customer
    - MARS Redlines: Our tracked changes version
    - Final Agreement: Agreed final version
    - Executed Contract: Signed contract

    Analysis Documents:
    - Comparison Report: Section-by-section comparison of document versions
    - AI Recommendations: AI analysis with accept/negotiate/push back verdicts

    Optional Documents:
    - Client Response: Customer's response to redlines
    - Purchase Order: Customer PO document
    - Amendment: Contract amendments or modifications
    - Other: Any additional relevant documents`,
    keywords: ['document', 'types', 'original', 'redlines', 'final', 'executed', 'comparison', 'AI', 'PO', 'amendment'],
    path: '/guides/documents#types'
  },
  {
    id: 'documents-completeness',
    category: 'documents',
    title: 'Completeness Tracking',
    content: `The completeness score shows what percentage of required documents are uploaded.
    A visual progress indicator displays the percentage (e.g., 75% means 3 of 4 required documents uploaded).
    Track which documents are missing and prioritize uploading them to reach 100% completeness.`,
    keywords: ['completeness', 'tracking', 'progress', 'percentage', 'required', 'missing', 'upload'],
    path: '/guides/documents#completeness'
  },
  {
    id: 'documents-views',
    category: 'documents',
    title: 'Smart Views',
    content: `Smart views help you focus on what matters most:
    - Needs Attention: Contracts missing documents or overdue
    - Closing Soon: Contracts with dates in the next 90 days
    - Budgeted: Only budgeted/forecasted contracts
    - By Account: Grouped by customer account
    - Recently Updated: Documents uploaded in the last 7 days`,
    keywords: ['views', 'smart views', 'needs attention', 'closing soon', 'budgeted', 'account', 'recently updated', 'filter'],
    path: '/guides/documents#views'
  },
  {
    id: 'documents-bundles',
    category: 'documents',
    title: 'Contract Bundles in Documents',
    content: `Contract Bundles group related Salesforce opportunities that share documents. Common example: M3 software renewal + MCC renewal that share the same master agreement.
    Why Bundle Contracts?
    - Shared Documents: Upload once, see from all bundled contracts
    - No Duplication: Avoid uploading the same master agreement multiple times
    - Clear Attribution: See which contract a document came from
    - Flexible: Add/remove contracts from bundles anytime

    Creating a Bundle:
    1. Expand any contract card in the Pipeline view
    2. Find the Bundle field
    3. Click Create to start a new bundle
    4. Name the bundle (e.g., "Cleveland 2025 Renewal")
    5. Select related contracts to include
    6. Choose a primary contract (source of truth)

    Bundle Indicators:
    - Star icon: Primary contract in bundle
    - Link icon: Secondary contract in bundle`,
    keywords: ['bundle', 'bundles', 'group', 'shared', 'documents', 'primary', 'secondary', 'create', 'link'],
    path: '/guides/documents#bundles'
  },

  // Tasks Guide
  {
    id: 'tasks-auto',
    category: 'tasks',
    title: 'Auto-Generated Tasks',
    content: `MARS automatically creates tasks based on contract stage transitions. When a contract moves to a new stage, relevant tasks are created automatically. For example:
    - Moving to "Review & Redlines" creates "Review contract terms" task
    - Moving to "Approval & Signature" creates "Obtain signature" task
    Tasks inherit the contract's due date when applicable.`,
    keywords: ['auto', 'automatic', 'generated', 'tasks', 'stage', 'transition', 'create'],
    path: '/guides/tasks#auto-tasks'
  },
  {
    id: 'tasks-views',
    category: 'tasks',
    title: 'Task Views',
    content: `View your tasks in three different ways:
    - By Contract: Tasks grouped by their associated contract
    - List View: Flat list sorted by due date
    - Board View: Kanban board with drag-and-drop`,
    keywords: ['views', 'list', 'board', 'kanban', 'by contract', 'grouped', 'drag-and-drop'],
    path: '/guides/tasks#views'
  },
  {
    id: 'tasks-priorities',
    category: 'tasks',
    title: 'Due Dates & Priorities',
    content: `Prioritize tasks effectively with due dates and priority levels:
    - Urgent: Red indicator, requires immediate attention
    - High: Orange indicator, important but not critical
    - Medium: Blue indicator, standard priority
    - Low: Green indicator, can be done when time permits`,
    keywords: ['priority', 'due date', 'urgent', 'high', 'medium', 'low', 'deadline'],
    path: '/guides/tasks#priorities'
  },

  // Bundles Guide
  {
    id: 'bundles-what',
    category: 'bundles',
    title: 'What are Contract Bundles?',
    content: `Contract Bundles allow you to group related contracts together and manage them as a single unit. This is perfect for:
    - Multi-Site Deals: One customer, multiple locations with separate contracts
    - Phased Projects: Multi-year projects with contracts for each phase
    - Renewal Groups: Multiple contracts renewing together
    - Related Opportunities: Connected contracts that need coordinated management

    Key Benefit: When you link a task or document to a bundle, it automatically applies to all contracts in that bundle—no need to upload the same document multiple times or create duplicate tasks.`,
    keywords: ['bundle', 'bundles', 'group', 'multi-site', 'phased', 'renewal', 'related', 'linked'],
    path: '/guides/bundles#what-are-bundles'
  },
  {
    id: 'bundles-creating',
    category: 'bundles',
    title: 'Creating & Managing Bundles',
    content: `Creating a bundle is simple and takes just a few clicks:
    1. Select Contracts: In the Pipeline view, select 2 or more related contracts
    2. Create Bundle: Click "Create Bundle" and give it a descriptive name (e.g., "Acme Corp - 2025 Multi-Site")
    3. Designate Primary: Choose which contract is the primary one (usually the first or largest contract)

    Managing Bundles:
    - View Bundle: Click any bundled contract to see all contracts in the bundle
    - Add Contract: Select additional contracts and add them to an existing bundle
    - Remove Contract: Unbundle individual contracts if they no longer belong together
    - Rename Bundle: Update the bundle name as the project evolves
    - Delete Bundle: Dissolve the bundle (contracts remain, just unlinked)`,
    keywords: ['create', 'manage', 'bundle', 'select', 'primary', 'add', 'remove', 'rename', 'delete'],
    path: '/guides/bundles#creating-bundles'
  },
  {
    id: 'bundles-tasks-docs',
    category: 'bundles',
    title: 'Bundle Tasks & Documents',
    content: `The power of bundles shines when managing tasks and documents:

    Bundle Tasks:
    - When creating a task, you can link it to a bundle instead of a single contract
    - Task applies to all contracts in bundle
    - Shows purple BUNDLE badge
    - Displays bundle name instead of contract
    - Visible in "By Bundle" view mode

    Bundle Documents:
    - Upload documents once and have them available across all bundled contracts
    - No need for duplicate uploads
    - Shows purple bundle indicator
    - All bundle members can access it
    - Version control applies to entire bundle

    Example: You have 5 contracts for Acme Corp's different warehouses. Instead of creating 5 separate tasks for "Schedule kickoff calls" and uploading the master service agreement 5 times, create one bundle task and upload the document once to the bundle.`,
    keywords: ['bundle', 'task', 'document', 'shared', 'upload', 'purple', 'badge', 'linked'],
    path: '/guides/bundles#bundle-tasks'
  },
  {
    id: 'bundles-views',
    category: 'bundles',
    title: 'By Bundle View Mode',
    content: `The Tasks tab includes a special "By Bundle" view mode for managing bundle tasks. This view groups tasks into two sections:
    - Bundle Tasks: Tasks linked to bundles, grouped by bundle name with expandable sections
    - Individual Tasks: Tasks linked to single contracts, not part of any bundle

    Each group shows overdue count and active/total task counts for quick status overview.`,
    keywords: ['by bundle', 'view', 'mode', 'grouped', 'expandable', 'overdue', 'status'],
    path: '/guides/bundles#bundle-views'
  },
  {
    id: 'bundles-badges',
    category: 'bundles',
    title: 'Bundle Badges & Indicators',
    content: `Bundle items are visually distinct throughout MARS with purple indicators:
    - Task Badge: Purple BUNDLE badge appears on tasks linked to bundles in all views (Kanban, List, By Contract)
    - Document Badge: Bundle name displayed on documents with purple styling in document lists and detail views
    - Purple Text & Icons: Bundle names always appear in purple (vs blue for individual contracts) for instant recognition

    Individual contracts use blue indicators, bundles use purple indicators.`,
    keywords: ['badge', 'indicator', 'purple', 'bundle', 'visual', 'color'],
    path: '/guides/bundles#visual-indicators'
  },
  {
    id: 'bundles-best-practices',
    category: 'bundles',
    title: 'Bundle Best Practices',
    content: `Get the most out of contract bundles with these tips:
    - Descriptive Naming: Use clear bundle names like "Acme Corp - 2025 Multi-Site Expansion" instead of "Bundle 1"
    - Primary Contract Selection: Choose the largest or first contract as primary—it makes reporting and navigation easier
    - Shared Documents Only: Upload documents to bundles when they truly apply to all contracts. Site-specific docs should stay on individual contracts
    - Bundle-Level Tasks: Create bundle tasks for activities that need to happen once for the group (e.g., "Schedule project kickoff")
    - Review Periodically: As projects evolve, contracts may no longer need to be bundled. Review and unbundle as needed
    - Use Bundle View: Switch to "By Bundle" view regularly to see all bundle tasks at a glance

    Pro Tip: Bundles work best when contracts have a natural relationship. Don't over-bundle—if contracts don't truly share tasks or documents, keeping them separate is cleaner and more maintainable.`,
    keywords: ['best practices', 'tips', 'naming', 'primary', 'shared', 'review', 'bundle view'],
    path: '/guides/bundles#best-practices'
  },

  // Review Guide
  {
    id: 'review-traditional',
    category: 'review',
    title: 'Why Word & Acrobat Fall Short',
    content: `Traditional tools like Microsoft Word Track Changes and Adobe Acrobat Compare treat documents as raw text, not structured legal content. This creates problems:

    - Character-Level Comparison: These tools compare character-by-character, flagging formatting changes, whitespace differences, and paragraph reflows as "changes." A simple font change can generate hundreds of false positives.
    - PDF Text Extraction Issues: PDFs store visual rendering instructions, not semantic text. Multi-column layouts, headers, footers, and tables often extract incorrectly.
    - No Legal Understanding: Word and Acrobat cannot distinguish between trivial changes ("will" → "shall") and material ones (liability cap removed). They show everything with equal weight.`,
    keywords: ['word', 'acrobat', 'compare', 'traditional', 'problems', 'character', 'false positives', 'PDF'],
    path: '/guides/review#why-traditional-fails'
  },
  {
    id: 'review-professional',
    category: 'review',
    title: 'How Professional Legal Software Works',
    content: `Professional contract software (Litera, Draftable, LexCheck) uses a fundamentally different approach: parse first, then compare.

    The Parse → Structure → Compare Pipeline:
    1. Parse Document Structure: Identify sections, headings, and clause boundaries using AI/NLP—not regex patterns that break on formatting variations
    2. Match Sections Semantically: Match "Section 5: Indemnification" to "Article V - Indemnification" even with different numbering or naming conventions
    3. Compare Matched Sections: Compare content within each matched section, filtering noise and highlighting substantive changes
    4. Assess Significance: Rate each change (High/Medium/Low) based on legal impact, not just text difference`,
    keywords: ['professional', 'legal', 'software', 'parse', 'structure', 'compare', 'semantic', 'sections', 'significance'],
    path: '/guides/review#legal-software-approach'
  },
  {
    id: 'review-mars',
    category: 'review',
    title: 'The MARS AI-First Approach',
    content: `MARS uses an AI-first methodology that goes beyond even professional legal software:
    - Section-by-Section Analysis: AI reads both documents and extracts sections with full understanding of legal structure
    - Semantic Matching: Matches sections by meaning, not just headings. "Payment Terms" and "Compensation Schedule" are recognized as the same section
    - Legal Impact Assessment: Each change is rated High/Medium/Low based on actual legal significance—liability changes rank high, formatting changes rank none
    - Key Takeaways: Automatically generates executive summary of material changes—no need to read through hundreds of diffs

    Result: Instead of 200+ false positives, you see 14 meaningful section changes with clear explanations of what changed and why it matters.`,
    keywords: ['MARS', 'AI', 'analysis', 'section', 'semantic', 'matching', 'impact', 'assessment', 'summary'],
    path: '/guides/review#mars-approach'
  },
  {
    id: 'review-recommendations',
    category: 'review',
    title: 'AI Recommendations',
    content: `After comparing documents, MARS can analyze changes against your standard negotiating positions:

    Verdict System:
    - ACCEPT (Green): Change is favorable or industry standard—no action needed
    - NEGOTIATE (Yellow): Change has some risk—AI provides suggested counter-language
    - PUSH BACK (Red): Materially unfavorable—reject or significantly revise with provided alternative

    Each recommendation includes reasoning and specific counter-language you can use in negotiations, aligned with MARS standard positions on liability, indemnification, IP, termination, and more.`,
    keywords: ['AI', 'recommendations', 'accept', 'negotiate', 'push back', 'verdict', 'counter-language'],
    path: '/guides/review#ai-recommendations'
  },
  {
    id: 'review-compare-workflow',
    category: 'review',
    title: 'Using Document Compare',
    content: `The Compare Documents workflow:
    1. Upload Documents: Upload the original contract and the revised version (PDF format)
    2. AI Comparison: AI extracts sections, matches them, and identifies changes with significance ratings
    3. Review Results: Filter by status (Changed/Added/Removed) or significance (High/Medium/Low)
    4. Get AI Recommendations: Click "Get AI Recommendations" for Accept/Negotiate/Push Back guidance with counter-language
    5. Download or Save: Download PDFs to share, or save to contract record for tracking

    Export Options:
    - Comparison PDF: Section-by-section changes with original vs. revised text
    - AI Recommendations PDF: Verdicts, reasoning, and suggested counter-language`,
    keywords: ['compare', 'workflow', 'upload', 'AI', 'filter', 'download', 'export', 'PDF'],
    path: '/guides/review#compare-workflow'
  },
  {
    id: 'review-redlines',
    category: 'review',
    title: 'AI Redlines (Upload Tab)',
    content: `The Upload tab provides AI-powered redlining of a single contract against MARS standard provisions:
    1. Upload a contract document (PDF, Word, or paste text)
    2. AI analyzes each section against MARS negotiating positions
    3. Review suggested redlines with strikethrough and insertions
    4. Accept, modify, or reject each suggestion
    5. Save to contract record for tracking

    MARS positions cover liability caps, indemnification, IP ownership, termination rights, warranties, payment terms, audit rights, dispute resolution, and insurance requirements.`,
    keywords: ['redlines', 'upload', 'AI', 'redlining', 'strikethrough', 'insertions', 'positions'],
    path: '/guides/review#ai-redlines'
  },
  {
    id: 'review-risk-scoring',
    category: 'review',
    title: 'Risk Scoring',
    content: `Every AI-suggested redline is automatically classified by risk level to help you prioritize your review:

    - HIGH (Red): Critical changes requiring immediate attention: liability, indemnification, IP/work product, termination for cause, insurance requirements
    - MEDIUM (Yellow): Important but negotiable: payment terms, warranties, confidentiality periods, audit rights, dispute resolution
    - LOW (Green): Minor changes: formatting, word choices, clarifications, notice periods, standard boilerplate

    Risk Summary Banner: At the top of the review, you'll see a summary showing the count of High, Medium, and Low risk items. This gives you an instant overview of the contract's risk profile before diving into details.`,
    keywords: ['risk', 'scoring', 'high', 'medium', 'low', 'priority', 'liability', 'indemnification'],
    path: '/guides/review#risk-scoring'
  },
  {
    id: 'review-approval',
    category: 'review',
    title: 'Approval Workflow',
    content: `After AI analysis, send contracts for approval with tracking and notifications:

    Sending for Approval:
    1. Complete your AI review and make any adjustments
    2. Click "Send for Approval" button
    3. Enter the approver's email address
    4. Optionally add CC recipients (stakeholders who should be notified)
    5. Click Send - approver receives email with secure link

    Approver Access: Approvers can view the full redlined contract, add comments, make edits, and approve or reject. All actions are logged.

    CC Recipients: CC'd parties receive a notification email with a read-only link. They can view the contract and comments but cannot approve or reject.

    Activity Log: Every action is tracked, including when approval request was sent, when approver viewed the contract, comments and annotations added, and final approval or rejection with timestamp.`,
    keywords: ['approval', 'workflow', 'send', 'approver', 'CC', 'email', 'activity log', 'tracking'],
    path: '/guides/review#approval-workflow'
  },
  {
    id: 'review-playbooks',
    category: 'review',
    title: 'Playbooks & Standard Agreements',
    content: `Playbooks store MARS's own standard agreements with version history. Use them as a baseline when reviewing counterparty contracts.

    Creating a Playbook:
    1. Go to Playbooks in the sidebar
    2. Click "New Playbook"
    3. Enter name (e.g., "MARS NDA") and optional description
    4. Upload PDF/Word file or paste the agreement text
    5. Text is automatically extracted for AI comparison

    Version History: Each time you update a playbook, a new version is created. Track who made changes and when, with change notes for context.

    File Storage: Original PDF and Word documents are stored for download. The extracted text is used for AI comparison against incoming contracts.

    Compare Against Playbook: When reviewing a counterparty contract, select a playbook from the dropdown. The AI will compare the incoming contract against your standard terms and highlight deviations.

    Recommended Playbooks:
    - MARS Warranty General Terms & Conditions
    - MARS MCC Maintenance and Services Agreement
    - MARS M3 EULA
    - MARS NDA`,
    keywords: ['playbook', 'playbooks', 'standard', 'agreement', 'version', 'history', 'compare', 'template'],
    path: '/guides/review#playbooks'
  },

  // Insights Guide
  {
    id: 'insights-products',
    category: 'insights',
    title: 'Products Tab',
    content: `The Products tab provides a product-centric view of your sales data:

    Product Table columns:
    - Item Name: Product identifier from NetSuite
    - Class: Product category/classification
    - R12 Revenue: Rolling 12-month revenue
    - Change %: Comparison vs prior rolling 12 months
    - Customers: Number of unique customers buying this product
    - Margin %: Average gross profit margin

    Charts:
    - Top 10 Products: Bar chart showing highest revenue products
    - Class Breakdown: Pie chart of revenue by product class

    Tip: Click any row to expand and see the top customers for that product. Click a customer name to open their detail drawer.`,
    keywords: ['products', 'revenue', 'margin', 'customers', 'R12', 'top 10', 'class', 'NetSuite'],
    path: '/guides/insights#products-tab'
  },
  {
    id: 'insights-customer-detail',
    category: 'insights',
    title: 'Customer Detail Drawer',
    content: `Click any customer name in the dashboard to open the Customer Detail Drawer:

    Drawer Sections:
    - Header: Customer name, total R12 revenue, status badge
    - Monthly Trend: Bar chart showing last 24 months of purchases
    - Products Tab: All products this customer buys with status indicators
    - Transactions Tab: Last 50 orders with expandable line items

    Product Status Indicators:
    - Active (Green): Recent purchases, healthy
    - Warning (Yellow): 3-4 months since last purchase
    - Stopped (Red): 6+ months, was buying before

    The drawer helps answer: "What does this customer buy? What did they stop buying? When was their last order?"`,
    keywords: ['customer', 'detail', 'drawer', 'products', 'transactions', 'status', 'active', 'warning', 'stopped'],
    path: '/guides/insights#customer-detail'
  },
  {
    id: 'insights-stopped-buying',
    category: 'insights',
    title: 'Stopped Buying Report',
    content: `The Stopped Buying report identifies customer-product combinations where a customer used to buy a product but hasn't purchased it in the last 6 months.

    Detection Logic:
    - Prior Period: 6-18 months ago (what they used to buy)
    - Current Period: Last 6 months (no purchases = stopped)
    - Result: Products bought in prior period but NOT in current

    Two Views:
    - By Product: "Which products are losing customers?" See products ranked by revenue at risk, with drill-down to affected customers
    - By Customer: "Which customers stopped buying what?" See customers ranked by lost revenue, with list of products they dropped

    Why This Matters: A customer might still be "active" overall but have quietly stopped buying specific products. This report catches those early warning signs before they become full churn.`,
    keywords: ['stopped', 'buying', 'report', 'churn', 'products', 'customers', 'warning', 'early'],
    path: '/guides/insights#stopped-buying'
  },
  {
    id: 'insights-attrition',
    category: 'insights',
    title: 'Customer Attrition Analysis',
    content: `The Attrition Score predicts how likely a customer is to stop buying. Higher scores mean more risk.

    Score Components (0-100):
    - Recency (35%): Days since last purchase
    - Frequency (30%): Order count change vs prior year
    - Monetary (25%): Revenue change vs prior year
    - Product Mix (10%): Change in product variety

    Customer Status:
    - Active (0-40): Healthy engagement, no risk
    - Declining (40-70): Negative trends, needs attention
    - At-Risk (70+): High churn probability, act now
    - Churned: No purchase in 12+ months`,
    keywords: ['attrition', 'score', 'risk', 'churn', 'recency', 'frequency', 'monetary', 'active', 'declining'],
    path: '/guides/insights#attrition'
  },
  {
    id: 'insights-yoy',
    category: 'insights',
    title: 'Year-over-Year Performance',
    content: `Compare current year revenue and margins against the prior year to identify growth and decline trends.

    Chart Features:
    - Grouped bars: Current year (cyan) vs Prior year (purple)
    - Toggle filters: Show/hide growing or declining entities
    - View switch: Compare by Customer or by Product Class
    - Hover tooltip: See exact revenue, change %, and margin details

    Indicators:
    - Green: Growing (>5% increase)
    - Red: Declining (>5% decrease)
    - Gray: Stable (within 5%)`,
    keywords: ['year-over-year', 'YoY', 'performance', 'growth', 'decline', 'comparison', 'revenue', 'margin'],
    path: '/guides/insights#yoy'
  },
  {
    id: 'insights-cross-sell',
    category: 'insights',
    title: 'Cross-Sell Opportunities',
    content: `The Cross-Sell table recommends products that similar customers buy but the target customer hasn't purchased yet.

    How Recommendations Work:
    1. System finds customers with similar purchase patterns (Jaccard similarity)
    2. Identifies products that 30%+ of similar customers buy
    3. Filters out products the target already purchases
    4. Scores by coverage rate and margin potential

    Table Columns:
    - Customer: Target customer name
    - Recommended Product: Product class to pitch
    - Affinity Score: 0-100, higher = stronger match
    - Est. Revenue: Projected annual revenue if sold
    - Margin: Average gross margin % for this product

    Click the expand arrow to see which products the customer currently buys and why this recommendation was made.`,
    keywords: ['cross-sell', 'opportunities', 'recommendations', 'similar', 'affinity', 'revenue', 'margin'],
    path: '/guides/insights#cross-sell'
  },
  {
    id: 'insights-concentration',
    category: 'insights',
    title: 'Revenue Concentration',
    content: `The Concentration chart shows how revenue is distributed across customers, helping identify dependency risk.

    HHI Index (Herfindahl-Hirschman Index):
    Measures revenue concentration. Calculated as the sum of squared revenue percentages.
    - < 1,500: Diversified - Low Risk
    - 1,500-2,500: Moderate - Some concentration
    - > 2,500: Concentrated - High Risk

    Customer Tiers:
    - Platinum (White): Top 5%
    - Gold (Gold): Next 15%
    - Silver (Silver): Next 30%
    - Bronze (Bronze): Bottom 50%`,
    keywords: ['concentration', 'HHI', 'risk', 'diversified', 'platinum', 'gold', 'silver', 'bronze', 'tiers'],
    path: '/guides/insights#concentration'
  },
  {
    id: 'insights-ai',
    category: 'insights',
    title: 'AI-Powered Recommendations',
    content: `Click "Generate AI Insights" to get AI-powered recommendations based on your current data.

    What AI Analyzes:
    - At-risk customers and potential retention strategies
    - Revenue concentration and diversification suggestions
    - Top cross-sell opportunities with talking points
    - YoY trends and growth opportunities

    Recommendation Cards Priority Levels:
    - HIGH (Red): Immediate action needed - material revenue impact
    - MEDIUM (Yellow): Should address soon - meaningful opportunity
    - LOW (Blue): Nice to have - lower priority

    Each recommendation includes: the problem identified, specific actions to take, and expected impact.`,
    keywords: ['AI', 'recommendations', 'generate', 'insights', 'priority', 'high', 'medium', 'low', 'action'],
    path: '/guides/insights#ai-insights'
  },
  {
    id: 'insights-segments',
    category: 'insights',
    title: 'Customer Behavioral Segmentation',
    content: `The system automatically classifies each customer into behavioral segments based on their purchase history.

    Customer Segments:
    - Steady Repeaters (Green): Orders regularly (5+ months out of 12), consistent order sizes, active in last 90 days. These are your core accounts.
    - Project Buyers (Gray): 1-3 orders total, all within 90-day window, no orders in 6+ months, >$10K total. One-time project purchases.
    - Seasonal Buyers (Purple): Orders cluster in specific months (>60% in 4-month window), pattern repeats across years.
    - New Accounts (Blue): First order less than 6 months ago, or fewer than 3 total orders. Need nurturing.
    - Irregular Buyers (Yellow): Sporadic, unpredictable ordering patterns. May need individual assessment.

    Product Focus Classification:
    - Single Product (Red): >80% revenue from one class
    - Narrow (Yellow): >60% from one class
    - Diverse (Green): Buys across multiple classes`,
    keywords: ['segments', 'behavioral', 'steady', 'project', 'seasonal', 'new', 'irregular', 'classification'],
    path: '/guides/insights#customer-segments'
  },
  {
    id: 'insights-eligibility',
    category: 'insights',
    title: 'Insight Eligibility Filtering',
    content: `Not every insight applies to every customer. The system automatically filters insights based on customer segment.

    Eligibility Rules:
    - Attrition Alerts: Only for Steady repeaters and diverse buyers. Excluded: Project buyers (they're done, not churning)
    - Cross-Sell: Only for Narrow and diverse product focus. Excluded: Single-product customers (low conversion rate)
    - Repeat Orders: Only for Steady repeaters, seasonal, and new accounts. Excluded: Project buyers (won't reorder)

    Why This Matters: Before eligibility filtering, the system would flag project buyers as "at risk" (wrong) and recommend cross-sell to single-product customers (low conversion). These filters dramatically improve insight relevance and sales team trust.`,
    keywords: ['eligibility', 'filtering', 'attrition', 'cross-sell', 'repeat', 'segment', 'relevant'],
    path: '/guides/insights#insight-eligibility'
  },
  {
    id: 'insights-roi',
    category: 'insights',
    title: 'ROI Tracking via Asana',
    content: `Track which insights convert into real business results using the integrated Asana task system.

    How It Works:
    1. Create Task from Insight: Click any action item on an AI recommendation to create an Asana task
    2. Metadata Embedded: Task notes include: source, insight ID, category, customer name, creation date
    3. Work the Task: Complete the task in Asana when the action is done
    4. Analytics Calculated: System parses all insight tasks to calculate conversion rates by category

    ROI Tracking Tab shows:
    - Tasks Created count
    - Completed count
    - Completion Rate percentage
    - By Category Breakdown showing which insight types perform best

    Self-Improving System: Over time, these analytics reveal which insight types actually convert. Low-performing categories can be refined or deprioritized.`,
    keywords: ['ROI', 'tracking', 'Asana', 'task', 'conversion', 'analytics', 'completion'],
    path: '/guides/insights#roi-tracking'
  },

  // Distributors Guide
  {
    id: 'distributors-overview',
    category: 'distributors',
    title: 'Distributor Intelligence Overview',
    content: `The Distributor Intelligence system transforms basic location data into actionable business insights. Instead of just showing revenue numbers, it answers: "What should I do about this location?"

    Three Core Components:
    1. AI-Powered Insights: Distributor-level recommendations with inline product context and activity status
    2. Location Health Scoring: 0-100 scores across revenue, engagement, margin, and category metrics
    3. Strategic Actions: Priority-ranked recommendations with opportunity sizing and Asana integration`,
    keywords: ['distributor', 'intelligence', 'location', 'insights', 'health', 'scoring', 'actions'],
    path: '/guides/distributors#overview'
  },
  {
    id: 'distributors-health',
    category: 'distributors',
    title: 'Location Health Scores',
    content: `Every location receives a comprehensive health score (0-100) combining four dimensions:

    Score Components:
    - Revenue Health (35%): Percentile rank among peer locations
    - Engagement Health (25%): Purchase frequency vs. peer average
    - Margin Health (20%): Margin % vs. distributor average
    - Category Health (20%): Category diversity vs. peers

    Health Tiers:
    - Excellent: 80-100 (Green)
    - Good: 60-79 (Blue)
    - Fair: 40-59 (Yellow)
    - Poor: 0-39 (Red)`,
    keywords: ['health', 'score', 'location', 'revenue', 'engagement', 'margin', 'category', 'percentile'],
    path: '/guides/distributors#health-scores'
  },
  {
    id: 'distributors-priority',
    category: 'distributors',
    title: 'Priority Action Cards',
    content: `Priority Actions provide specific, ranked recommendations for each location based on health analysis. Each action includes impact assessment, effort estimation, and revenue opportunity sizing.

    Priority Levels:
    - Critical (Red): Reactivate Inactive Location - Triggered when no purchases in 90+ days. Immediate outreach required.
    - High (Yellow): Expand to Missing Categories - Identifies categories purchased by 75%+ of peers but missing from this location. Cross-sell opportunity.
    - Medium (Blue): Increase Order Frequency - When location orders less frequently than peer average. Low-effort way to boost annual revenue.

    Direct Task Creation: Click "Create Task" on any action to open the Asana integration modal. Tasks are pre-filled with action details, opportunity sizing, and distributor metadata.`,
    keywords: ['priority', 'action', 'critical', 'high', 'medium', 'reactivate', 'expand', 'frequency', 'Asana'],
    path: '/guides/distributors#priority-actions'
  },
  {
    id: 'distributors-product-context',
    category: 'distributors',
    title: 'Product Context & Categories',
    content: `Distributor insights now include inline product context:

    Category Badges: Top 3 categories by revenue with total count. Hover for revenue and percentage breakdown.

    Activity Status Indicators:
    - Active (Green): Purchased within last 30 days
    - At Risk (Yellow): Last purchase 30-90 days ago
    - Inactive (Red): No purchases in 90+ days

    Expansion Opportunities: Categories purchased by 75%+ of peer locations but missing from this distributor are flagged as expansion opportunities.`,
    keywords: ['product', 'context', 'categories', 'activity', 'status', 'active', 'at risk', 'inactive', 'expansion'],
    path: '/guides/distributors#product-context'
  },
  {
    id: 'distributors-benchmarking',
    category: 'distributors',
    title: 'Peer Benchmarking',
    content: `Compare each location against similar peers within the same distributor to identify performance gaps:

    Similarity Scoring (0-100):
    - Revenue Similarity (50 pts): How close is the revenue to the current location
    - Category Overlap (50 pts): How many categories do they purchase in common

    Competitive Position Metrics (percentile rankings):
    - Revenue: Percentile rank vs all locations
    - Order Frequency: How often they order vs peers
    - Margin: Profit margin vs distributor average
    - Category Diversity: Number of categories purchased vs peers`,
    keywords: ['benchmarking', 'peer', 'similarity', 'percentile', 'competitive', 'position', 'compare'],
    path: '/guides/distributors#peer-benchmarking'
  },
  {
    id: 'distributors-asana',
    category: 'distributors',
    title: 'Asana Task Integration',
    content: `All distributor insights and actions integrate directly with your Asana workflow.

    Individual Task Creation:
    1. Click "Add Task" or "Create Task" on any insight/action
    2. Modal pre-fills with recommendation details and metadata
    3. Customize title, assignee, due date, and section
    4. Task created in Asana with distributor metadata embedded
    5. Button updates to "Task Created" to prevent duplicates

    Task Metadata includes: source, distributor name, location, action type, priority, opportunity size, creation date.`,
    keywords: ['Asana', 'task', 'integration', 'create', 'metadata', 'workflow'],
    path: '/guides/distributors#task-integration'
  },
];

// Simple keyword-based search with fuzzy matching
export function searchGuides(query: string): GuideEntry[] {
  if (!query.trim()) return [];

  const searchTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 1);

  return guideIndex
    .map(entry => {
      let score = 0;
      const titleLower = entry.title.toLowerCase();
      const contentLower = entry.content.toLowerCase();
      const keywordsLower = entry.keywords.join(' ').toLowerCase();

      for (const term of searchTerms) {
        // Title match (highest weight)
        if (titleLower.includes(term)) score += 10;
        // Keyword match (high weight)
        if (keywordsLower.includes(term)) score += 5;
        // Content match (standard weight)
        if (contentLower.includes(term)) score += 2;
      }

      return { entry, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ entry }) => entry);
}

// Get relevant guide content for AI context based on current page
export function getContextForPage(pathname: string): string {
  // Map pathnames to relevant guide categories
  const categoryMap: Record<string, string[]> = {
    '/contracts-dashboard': ['pipeline', 'documents', 'tasks', 'bundles'],
    '/contracts': ['pipeline', 'documents', 'tasks', 'bundles'],
    '/pipeline': ['pipeline'],
    '/tasks': ['tasks', 'bundles'],
    '/documents': ['documents', 'bundles'],
    '/bundles': ['bundles', 'documents', 'tasks'],
    '/review': ['review'],
    '/playbooks': ['review'],
    '/insights': ['insights'],
    '/distributors': ['distributors'],
    '/guides': ['pipeline', 'documents', 'tasks', 'bundles', 'review', 'insights', 'distributors'],
  };

  // Find matching categories for the current page
  let relevantCategories: string[] = [];
  for (const [path, categories] of Object.entries(categoryMap)) {
    if (pathname.includes(path)) {
      relevantCategories = categories;
      break;
    }
  }

  // If no specific match, include all categories
  if (relevantCategories.length === 0) {
    relevantCategories = ['pipeline', 'documents', 'tasks', 'bundles', 'review', 'insights', 'distributors'];
  }

  // Get entries for relevant categories
  const relevantEntries = guideIndex.filter(entry =>
    relevantCategories.includes(entry.category)
  );

  // Format as context string for AI
  return relevantEntries
    .map(entry => `## ${entry.title}\n${entry.content}`)
    .join('\n\n');
}

// Get guide entries for a specific page (for showing relevant guides in the drawer)
export function getGuidesForPage(pathname: string): GuideEntry[] {
  const categoryMap: Record<string, string[]> = {
    '/contracts-dashboard': ['pipeline', 'documents', 'tasks'],
    '/contracts': ['pipeline', 'documents', 'tasks'],
    '/pipeline': ['pipeline'],
    '/tasks': ['tasks'],
    '/documents': ['documents'],
    '/bundles': ['bundles'],
    '/review': ['review'],
    '/playbooks': ['review'],
    '/insights': ['insights'],
    '/distributors': ['distributors'],
  };

  let relevantCategories: string[] = [];
  for (const [path, categories] of Object.entries(categoryMap)) {
    if (pathname.includes(path)) {
      relevantCategories = categories;
      break;
    }
  }

  if (relevantCategories.length === 0) return [];

  return guideIndex
    .filter(entry => relevantCategories.includes(entry.category))
    .slice(0, 5); // Return up to 5 relevant guides
}
