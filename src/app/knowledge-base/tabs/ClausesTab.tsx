'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import { KPICard, KPIIcons, tokens } from '@/components/mars-ui';
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
  risk_level: 'low' | 'medium' | 'high';
  tags: string[];
  usage_count: number;
  created_at: string;
  category?: ClauseCategory;
}

const riskColors = {
  low: '#22C55E',
  medium: '#F59E0B',
  high: '#EF4444',
};

export default function ClausesTab() {
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [categories, setCategories] = useState<ClauseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedClause, setSelectedClause] = useState<Clause | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load categories
      const { data: catData } = await supabase
        .from('clause_categories')
        .select('*, clauses:clause_library(count)')
        .order('name');

      setCategories(catData?.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        clause_count: c.clauses?.[0]?.count || 0,
      })) || []);

      // Load clauses
      const { data: clauseData } = await supabase
        .from('clause_library')
        .select('*, category:clause_categories(*)')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      setClauses(clauseData || []);
    } catch (err) {
      console.error('Failed to load clauses:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredClauses = clauses.filter(c => {
    if (selectedCategory !== 'all' && c.category_id !== selectedCategory) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        c.name.toLowerCase().includes(query) ||
        c.primary_text.toLowerCase().includes(query) ||
        c.tags?.some(t => t.toLowerCase().includes(query))
      );
    }
    return true;
  });

  const handleSaveClause = async (clause: Partial<Clause>) => {
    try {
      if (selectedClause?.id) {
        await supabase.from('clause_library').update(clause).eq('id', selectedClause.id);
      } else {
        await supabase.from('clause_library').insert(clause);
      }
      loadData();
      setIsEditorOpen(false);
      setSelectedClause(null);
    } catch (err) {
      console.error('Failed to save clause:', err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-24 rounded-xl ${tokens.bg.card} animate-pulse`} />
          ))}
        </div>
        <div className={`h-96 rounded-xl ${tokens.bg.card} animate-pulse`} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          title="Total Clauses"
          value={clauses.length}
          subtitle="in library"
          icon={KPIIcons.document}
          color="#38BDF8"
        />
        <KPICard
          title="Categories"
          value={categories.length}
          subtitle="defined"
          icon={KPIIcons.folder}
          color="#A855F7"
        />
        <KPICard
          title="High Risk"
          value={clauses.filter(c => c.risk_level === 'high').length}
          subtitle="clauses"
          icon={KPIIcons.warning}
          color="#EF4444"
        />
        <KPICard
          title="Most Used"
          value={clauses[0]?.usage_count || 0}
          subtitle={clauses[0]?.name?.substring(0, 20) || '-'}
          icon={KPIIcons.trending}
          color="#22C55E"
        />
      </div>

      {/* Filters & Actions */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex gap-2 flex-1">
          <input
            type="text"
            placeholder="Search clauses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 max-w-xs px-4 py-2 bg-[#0F172A] border border-[#2A3544] rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8]"
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 bg-[#0F172A] border border-[#2A3544] rounded-lg text-white text-sm focus:outline-none focus:border-[#38BDF8]"
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name} ({cat.clause_count})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setSelectedClause(null);
            setIsEditorOpen(true);
          }}
          className="px-4 py-2 bg-[#38BDF8] text-white rounded-lg text-sm font-medium hover:bg-[#38BDF8]/90 transition-colors"
        >
          + Add Clause
        </button>
      </div>

      {/* Clauses Table */}
      <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Name</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Category</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Risk</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Uses</th>
              <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredClauses.map((clause, idx) => (
              <motion.tr
                key={clause.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="border-b border-white/5 hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3">
                  <div>
                    <p className="text-[#EAF2FF] text-sm font-medium">{clause.name}</p>
                    <p className="text-[#64748B] text-xs line-clamp-1">
                      {clause.primary_text.substring(0, 80)}...
                    </p>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#64748B] text-sm">
                  {clause.category?.name || '-'}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: `${riskColors[clause.risk_level]}20`,
                      color: riskColors[clause.risk_level],
                    }}
                  >
                    {clause.risk_level}
                  </span>
                </td>
                <td className="px-4 py-3 text-[#64748B] text-sm tabular-nums">
                  {clause.usage_count}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => {
                      setSelectedClause(clause);
                      setIsEditorOpen(true);
                    }}
                    className="text-[#38BDF8] hover:text-[#38BDF8]/80 text-sm"
                  >
                    Edit
                  </button>
                </td>
              </motion.tr>
            ))}
            {filteredClauses.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#64748B] text-sm">
                  No clauses found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Clause Editor Modal */}
      {isEditorOpen && (
        <ClauseEditor
          clause={selectedClause}
          categories={categories}
          onSave={handleSaveClause}
          onClose={() => {
            setIsEditorOpen(false);
            setSelectedClause(null);
          }}
        />
      )}
    </div>
  );
}
