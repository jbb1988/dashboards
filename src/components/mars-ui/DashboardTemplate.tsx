'use client';

/**
 * MARS Dashboard Template
 *
 * Copy this file when creating a new dashboard to ensure A+ design consistency.
 *
 * Usage:
 * 1. Copy this file to your new dashboard: src/app/[your-dashboard]/page.tsx
 * 2. Rename the component and update the title/subtitle
 * 3. Choose a background preset or customize colors
 * 4. Replace placeholder content with your dashboard content
 *
 * Design Checklist:
 * □ DashboardBackground with appropriate preset
 * □ KPI cards at the top (3-6 cards)
 * □ Sticky table headers if showing data tables
 * □ Skeleton loading states during data fetch
 * □ Empty states with gradient icons and CTAs
 * □ Hover effects on interactive elements
 * □ Pulse animations on urgent/overdue items
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import {
  DashboardBackground,
  backgroundPresets,
  KPICard,
  KPIIcons,
  KPICardSkeleton,
  TableRowSkeleton,
  tokens,
  colors,
} from '@/components/mars-ui';

// =============================================================================
// TYPES - Define your data types here
// =============================================================================

interface DashboardData {
  // Define your data structure
  items: Array<{
    id: string;
    name: string;
    status: string;
    value: number;
  }>;
  kpis: {
    total: number;
    active: number;
    completed: number;
    overdue: number;
  };
}

// =============================================================================
// LOADING STATE - Skeleton UI while fetching data
// =============================================================================

function LoadingState() {
  return (
    <div className="space-y-6">
      {/* KPI Skeletons */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>

      {/* Table Skeletons */}
      <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
        <div className="px-5 py-3 border-b border-white/5">
          <div className="h-4 w-32 bg-white/5 rounded animate-pulse" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <TableRowSkeleton key={i} columns={5} />
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// EMPTY STATE - When no data matches filters
// =============================================================================

function EmptyState({
  title = "No items found",
  description = "Try adjusting your filters or add new items.",
  actionLabel,
  onAction,
}: {
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`text-center py-20 ${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle}`}
    >
      {/* Gradient Icon Container */}
      <div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
        style={{
          background: `linear-gradient(135deg, ${colors.accent.blue}20, ${colors.accent.blue}05)`,
          boxShadow: `0 0 40px ${colors.accent.blue}15`,
        }}
      >
        <svg className="w-10 h-10 text-[#5B8DEF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>

      <h3 className={`text-xl font-semibold ${tokens.text.primary} mb-2`}>{title}</h3>
      <p className={`${tokens.text.muted} text-sm max-w-md mx-auto mb-6`}>{description}</p>

      {actionLabel && onAction && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onAction}
          className="px-4 py-2 rounded-lg bg-[#5B8DEF] text-white text-sm font-medium hover:bg-[#4A7DE0] transition-colors"
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}

// =============================================================================
// DATA ROW COMPONENT - Example row with hover effects
// =============================================================================

function DataRow({
  item,
  index,
  onClick,
}: {
  item: DashboardData['items'][0];
  index: number;
  onClick?: () => void;
}) {
  const isOverdue = item.status === 'overdue';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className={`
        grid grid-cols-4 gap-4 px-5 py-4 items-center
        border-b ${tokens.border.subtle}
        ${index % 2 === 0 ? tokens.bg.section : tokens.bg.card}
        hover:bg-[#1E293B] transition-colors cursor-pointer group
      `}
    >
      {/* Status Indicator with pulse for overdue */}
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`}
        />
        <span className={`text-sm ${tokens.text.primary} group-hover:text-[#38BDF8] transition-colors`}>
          {item.name}
        </span>
      </div>

      {/* Status Badge */}
      <div>
        <span className={`
          text-xs px-2 py-1 rounded-full font-medium
          ${isOverdue
            ? 'bg-red-500/10 text-red-400 border border-red-500/20'
            : 'bg-green-500/10 text-green-400 border border-green-500/20'
          }
        `}>
          {item.status}
        </span>
      </div>

      {/* Value */}
      <div className={`text-sm ${tokens.text.secondary}`}>
        ${item.value.toLocaleString()}
      </div>

      {/* Action Icon */}
      <div className="flex justify-end">
        <svg
          className={`w-4 h-4 ${tokens.text.muted} group-hover:text-[#38BDF8] transition-colors`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </motion.div>
  );
}

// =============================================================================
// MAIN DASHBOARD COMPONENT
// =============================================================================

export default function DashboardTemplate() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  // Fetch data on mount
  useEffect(() => {
    async function fetchData() {
      try {
        // Replace with your API call
        // const response = await fetch('/api/your-endpoint');
        // const data = await response.json();

        // Simulated data for template
        await new Promise(resolve => setTimeout(resolve, 1000));
        setData({
          items: [
            { id: '1', name: 'Item One', status: 'active', value: 10000 },
            { id: '2', name: 'Item Two', status: 'completed', value: 25000 },
            { id: '3', name: 'Item Three', status: 'overdue', value: 15000 },
          ],
          kpis: { total: 50, active: 30, completed: 15, overdue: 5 },
        });
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <div className="min-h-screen bg-[#0F1722] relative overflow-hidden">
      {/* Premium Animated Background - Choose preset or customize */}
      <DashboardBackground {...backgroundPresets.contracts} />

      {/* Global Sidebar */}
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      {/* Main Content */}
      <motion.div
        className="relative z-10 text-white"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        {/* Header - Sticky with solid background */}
        <header className="border-b border-white/[0.06] bg-[#0F1722]/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.3)] sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Dashboard Title</h1>
                <p className="text-[12px] text-[#8FA3BF] mt-1">Dashboard subtitle or description</p>
              </div>
              <div className="flex items-center gap-4">
                {/* Header actions - refresh, filters, etc. */}
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-4 py-2 rounded-lg bg-[#1E293B] text-sm text-[#8FA3BF] hover:text-white transition-colors"
                >
                  Refresh
                </motion.button>
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {loading ? (
            <LoadingState />
          ) : !data || data.items.length === 0 ? (
            <EmptyState
              title="No data yet"
              description="Start by adding your first item to this dashboard."
              actionLabel="Add Item"
              onAction={() => console.log('Add item clicked')}
            />
          ) : (
            <div className="space-y-6">
              {/* KPI Cards Grid */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard
                  title="Total Items"
                  value={data.kpis.total}
                  subtitle="All time"
                  icon={KPIIcons.folder}
                  color="#38BDF8"
                  delay={0.1}
                />
                <KPICard
                  title="Active"
                  value={data.kpis.active}
                  subtitle="In progress"
                  icon={KPIIcons.clock}
                  color="#F59E0B"
                  delay={0.2}
                />
                <KPICard
                  title="Completed"
                  value={data.kpis.completed}
                  subtitle="This period"
                  icon={KPIIcons.checkCircle}
                  color="#22C55E"
                  delay={0.3}
                />
                <KPICard
                  title="Overdue"
                  value={data.kpis.overdue}
                  subtitle="Need attention"
                  icon={KPIIcons.alert}
                  color="#EF4444"
                  delay={0.4}
                />
              </div>

              {/* Data Table */}
              <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                {/* Table Header - Sticky */}
                <div className="grid grid-cols-4 gap-4 px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-white/5 sticky top-0 z-10 bg-[#151F2E] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                  <div>Name</div>
                  <div>Status</div>
                  <div>Value</div>
                  <div className="text-right">Action</div>
                </div>

                {/* Table Body */}
                <div className="max-h-[500px] overflow-y-auto">
                  {data.items.map((item, index) => (
                    <DataRow
                      key={item.id}
                      item={item}
                      index={index}
                      onClick={() => console.log('Row clicked:', item.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </main>
      </motion.div>
    </div>
  );
}

// =============================================================================
// DESIGN TOKENS QUICK REFERENCE
// =============================================================================
/*
Background Presets:
  - backgroundPresets.contracts  (cyan/blue - for contracts)
  - backgroundPresets.pm         (red/orange - for project management)
  - backgroundPresets.finance    (green/cyan - for finance dashboards)
  - backgroundPresets.admin      (purple/blue - for admin pages)
  - backgroundPresets.guides     (cyan/purple - for documentation)

Colors:
  - colors.accent.blue    (#5B8DEF) - Primary actions, info
  - colors.accent.cyan    (#38BDF8) - Analytics, stages
  - colors.accent.green   (#30A46C) - Success, complete
  - colors.accent.amber   (#D4A72C) - Warning, attention
  - colors.accent.red     (#E5484D) - Danger, overdue
  - colors.accent.purple  (#8B5CF6) - Analysis, special
  - colors.accent.orange  (#F97316) - Revenue, costs

Token Classes:
  - tokens.bg.app       - Page background
  - tokens.bg.section   - Section panels
  - tokens.bg.card      - Card backgrounds
  - tokens.bg.elevated  - Expanded/focus states
  - tokens.border.subtle   - Subtle borders
  - tokens.border.default  - Standard borders
  - tokens.text.primary    - Main text
  - tokens.text.secondary  - Secondary text
  - tokens.text.muted      - De-emphasized text

KPI Icons:
  - KPIIcons.dollar, calendar, alert, trending, document
  - KPIIcons.clipboard, checkCircle, clock, folder, warning, users
*/
