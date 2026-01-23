'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
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
import ClauseEditor from '@/components/clauses/ClauseEditor';

interface ClauseCategory {
  id: string;
  name: string;
  description: string | null;
  clause_count: number;
}

interface Clause {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  primary_text: string;
  fallback_text: string | null;
  last_resort_text: string | null;
  position_type: 'favorable' | 'neutral' | 'fallback';
  risk_level: 'low' | 'medium' | 'high';
  tags: string[];
  usage_count: number;
  created_at: string;
  category?: ClauseCategory;
}

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
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

function EmptyState({ onAction }: { onAction: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`text-center py-20 ${tokens.bg.card} ${tokens.radius.card} border ${tokens.border.subtle}`}
    >
      <div
        className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
        style={{
          background: `linear-gradient(135deg, ${colors.accent.cyan}20, ${colors.accent.cyan}05)`,
          boxShadow: `0 0 40px ${colors.accent.cyan}15`,
        }}
      >
        <svg className="w-10 h-10 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>

      <h3 className={`text-xl font-semibold ${tokens.text.primary} mb-2`}>No Clauses Yet</h3>
      <p className={`${tokens.text.muted} text-sm max-w-md mx-auto mb-6`}>
        Build your clause library with approved language for contracts.
        Start by creating your first clause or importing from existing contracts.
      </p>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onAction}
        className="px-4 py-2 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
      >
        Create Clause
      </motion.button>
    </motion.div>
  );
}

const riskColors = {
  low: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  medium: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
  high: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
};

function ClauseRow({
  clause,
  index,
  onClick,
}: {
  clause: Clause;
  index: number;
  onClick: () => void;
}) {
  const risk = riskColors[clause.risk_level] || riskColors.medium;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      onClick={onClick}
      className={`
        grid grid-cols-[2fr,1fr,1fr,1fr,80px] gap-4 px-5 py-4 items-center
        border-b ${tokens.border.subtle}
        ${index % 2 === 0 ? tokens.bg.section : tokens.bg.card}
        hover:bg-[#1E293B] transition-colors cursor-pointer group
      `}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div className="min-w-0">
          <span className={`text-sm font-medium ${tokens.text.primary} group-hover:text-teal-400 transition-colors truncate block`}>
            {clause.name}
          </span>
          {clause.description && (
            <p className={`text-xs ${tokens.text.muted} truncate`}>
              {clause.description}
            </p>
          )}
        </div>
      </div>

      <div>
        {clause.category && (
          <span className="text-xs px-2 py-1 rounded-full bg-[#1E293B] text-[#8FA3BF] border border-white/10">
            {clause.category.name}
          </span>
        )}
      </div>

      <div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${risk.bg} ${risk.text} ${risk.border} border capitalize`}>
          {clause.risk_level}
        </span>
      </div>

      <div className={`text-sm ${tokens.text.secondary}`}>
        {clause.usage_count} uses
      </div>

      <div className="flex justify-end">
        <svg
          className={`w-4 h-4 ${tokens.text.muted} group-hover:text-teal-400 transition-colors`}
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

export default function ClauseLibraryPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [categories, setCategories] = useState<ClauseCategory[]>([]);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedRisk, setSelectedRisk] = useState<string>('');

  useEffect(() => {
    const getUser = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email || '');
    };
    getUser();
  }, []);

  useEffect(() => {
    fetchClauses();
  }, [selectedCategory, selectedRisk]);

  async function fetchClauses() {
    try {
      const params = new URLSearchParams();
      if (selectedCategory) params.append('category_id', selectedCategory);
      if (selectedRisk) params.append('risk_level', selectedRisk);

      const response = await fetch(`/api/clauses?${params.toString()}`);
      const data = await response.json();
      setClauses(data.clauses || []);
      setCategories(data.categories || []);
    } catch (error) {
      console.error('Failed to fetch clauses:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleClauseClick(clause: Clause) {
    setSelectedClause(clause);
    setShowEditor(true);
  }

  function handleCreateNew() {
    setSelectedClause(null);
    setShowEditor(true);
  }

  async function handleSaveClause(clauseData: Partial<Clause>) {
    try {
      const url = selectedClause
        ? `/api/clauses/${selectedClause.id}`
        : '/api/clauses';
      const method = selectedClause ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clauseData),
      });

      if (response.ok) {
        setShowEditor(false);
        setSelectedClause(null);
        fetchClauses();
      }
    } catch (error) {
      console.error('Failed to save clause:', error);
    }
  }

  // Filter clauses by search query
  const filteredClauses = clauses.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.primary_text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats
  const highRiskCount = clauses.filter(c => c.risk_level === 'high').length;
  const totalUsage = clauses.reduce((sum, c) => sum + c.usage_count, 0);

  return (
    <div className="min-h-screen bg-[#0F1722] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.admin} />

      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <motion.div
        className="relative z-10 text-white"
        animate={{ marginLeft: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
      >
        <header className="border-b border-white/[0.06] bg-[#0F1722]/95 backdrop-blur-sm shadow-[0_4px_12px_rgba(0,0,0,0.3)] sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Clause Library</h1>
                <p className="text-[12px] text-[#8FA3BF] mt-1">
                  Manage reusable contract clauses with approved language positions
                </p>
              </div>
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchClauses()}
                  className="px-4 py-2 rounded-lg bg-[#1E293B] text-sm text-[#8FA3BF] hover:text-white transition-colors"
                >
                  Refresh
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleCreateNew}
                  className="px-4 py-2 rounded-lg bg-teal-500 text-sm text-white font-medium hover:bg-teal-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Clause
                </motion.button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {loading ? (
            <LoadingState />
          ) : clauses.length === 0 && !selectedCategory && !selectedRisk ? (
            <EmptyState onAction={handleCreateNew} />
          ) : (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard
                  title="Total Clauses"
                  value={clauses.length}
                  subtitle="In library"
                  icon={KPIIcons.document}
                  color="#14B8A6"
                  delay={0.1}
                />
                <KPICard
                  title="Categories"
                  value={categories.length}
                  subtitle="Clause types"
                  icon={KPIIcons.folder}
                  color="#8B5CF6"
                  delay={0.2}
                />
                <KPICard
                  title="High Risk"
                  value={highRiskCount}
                  subtitle="Need review"
                  icon={KPIIcons.alert}
                  color="#EF4444"
                  delay={0.3}
                />
                <KPICard
                  title="Total Usage"
                  value={totalUsage}
                  subtitle="Across contracts"
                  icon={KPIIcons.trending}
                  color="#F59E0B"
                  delay={0.4}
                />
              </div>

              {/* Filters */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px] max-w-md">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search clauses..."
                    className="w-full pl-10 pr-4 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500/50"
                  />
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>

                {/* Risk Filter */}
                <select
                  value={selectedRisk}
                  onChange={(e) => setSelectedRisk(e.target.value)}
                  className="px-3 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500/50"
                >
                  <option value="">All Risk Levels</option>
                  <option value="low">Low Risk</option>
                  <option value="medium">Medium Risk</option>
                  <option value="high">High Risk</option>
                </select>

                {(selectedCategory || selectedRisk || searchQuery) && (
                  <button
                    onClick={() => {
                      setSelectedCategory('');
                      setSelectedRisk('');
                      setSearchQuery('');
                    }}
                    className="px-3 py-2 text-sm text-[#8FA3BF] hover:text-white transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {/* Clauses Table */}
              <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                <div className="grid grid-cols-[2fr,1fr,1fr,1fr,80px] gap-4 px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-white/5 sticky top-0 z-10 bg-[#151F2E] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                  <div>Clause</div>
                  <div>Category</div>
                  <div>Risk Level</div>
                  <div>Usage</div>
                  <div className="text-right">Action</div>
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  {filteredClauses.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#64748B] text-sm">
                      {searchQuery ? 'No clauses match your search' : 'No clauses found'}
                    </div>
                  ) : (
                    filteredClauses.map((clause, index) => (
                      <ClauseRow
                        key={clause.id}
                        clause={clause}
                        index={index}
                        onClick={() => handleClauseClick(clause)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </motion.div>

      {/* Clause Editor Modal */}
      {showEditor && (
        <ClauseEditor
          clause={selectedClause}
          categories={categories}
          onSave={handleSaveClause}
          onClose={() => {
            setShowEditor(false);
            setSelectedClause(null);
          }}
        />
      )}
    </div>
  );
}
