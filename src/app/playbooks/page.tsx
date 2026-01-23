'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
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

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  current_version: number;
  created_at: string;
  updated_at: string;
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
        {[1, 2, 3, 4].map((i) => (
          <TableRowSkeleton key={i} columns={4} />
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
          background: `linear-gradient(135deg, ${colors.accent.purple}20, ${colors.accent.purple}05)`,
          boxShadow: `0 0 40px ${colors.accent.purple}15`,
        }}
      >
        <svg className="w-10 h-10 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      </div>

      <h3 className={`text-xl font-semibold ${tokens.text.primary} mb-2`}>No Playbooks Yet</h3>
      <p className={`${tokens.text.muted} text-sm max-w-md mx-auto mb-6`}>
        Playbooks store your standard agreements and templates with version history.
        Start by creating your first playbook.
      </p>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onAction}
        className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-white text-sm font-medium hover:bg-[#7C3AED] transition-colors"
      >
        Create Playbook
      </motion.button>
    </motion.div>
  );
}

function PlaybookRow({
  playbook,
  index,
  onClick,
}: {
  playbook: Playbook;
  index: number;
  onClick: () => void;
}) {
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
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <span className={`text-sm font-medium ${tokens.text.primary} group-hover:text-[#A78BFA] transition-colors`}>
            {playbook.name}
          </span>
          {playbook.description && (
            <p className={`text-xs ${tokens.text.muted} truncate max-w-[200px]`}>
              {playbook.description}
            </p>
          )}
        </div>
      </div>

      <div>
        <span className="text-xs px-2 py-1 rounded-full font-medium bg-[#8B5CF6]/10 text-[#A78BFA] border border-[#8B5CF6]/20">
          v{playbook.current_version}
        </span>
      </div>

      <div className={`text-sm ${tokens.text.secondary}`}>
        {new Date(playbook.updated_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })}
      </div>

      <div className="flex justify-end">
        <svg
          className={`w-4 h-4 ${tokens.text.muted} group-hover:text-[#A78BFA] transition-colors`}
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

export default function PlaybooksPage() {
  const router = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPlaybook, setNewPlaybook] = useState({ name: '', description: '', content: '' });
  const [creating, setCreating] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Get current user from session
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
    fetchPlaybooks();
  }, []);

  async function fetchPlaybooks() {
    try {
      const response = await fetch('/api/playbooks');
      const data = await response.json();
      setPlaybooks(data.playbooks || []);
    } catch (error) {
      console.error('Failed to fetch playbooks:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newPlaybook.name.trim()) return;

    setCreating(true);
    try {
      const response = await fetch('/api/playbooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newPlaybook.name.trim(),
          description: newPlaybook.description.trim() || null,
          content: newPlaybook.content.trim() || null,
          createdBy: userEmail || null,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewPlaybook({ name: '', description: '', content: '' });
        fetchPlaybooks();
      }
    } catch (error) {
      console.error('Failed to create playbook:', error);
    } finally {
      setCreating(false);
    }
  }

  const withContent = playbooks.filter(p => p.current_version > 0).length;

  // Filter playbooks by search query
  const filteredPlaybooks = playbooks.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                <h1 className="text-[20px] font-semibold text-white">Playbooks</h1>
                <p className="text-[12px] text-[#8FA3BF] mt-1">
                  Manage MARS standard agreements and templates with version history
                </p>
              </div>
              <div className="flex items-center gap-4">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => fetchPlaybooks()}
                  className="px-4 py-2 rounded-lg bg-[#1E293B] text-sm text-[#8FA3BF] hover:text-white transition-colors"
                >
                  Refresh
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-lg bg-[#8B5CF6] text-sm text-white font-medium hover:bg-[#7C3AED] transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Playbook
                </motion.button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {loading ? (
            <LoadingState />
          ) : playbooks.length === 0 ? (
            <EmptyState onAction={() => setShowCreateModal(true)} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-4">
                <KPICard
                  title="Total Playbooks"
                  value={playbooks.length}
                  subtitle="Standard agreements"
                  icon={KPIIcons.document}
                  color="#8B5CF6"
                  delay={0.1}
                />
                <KPICard
                  title="With Content"
                  value={withContent}
                  subtitle="Have versions"
                  icon={KPIIcons.checkCircle}
                  color="#22C55E"
                  delay={0.2}
                />
                <KPICard
                  title="Total Versions"
                  value={playbooks.reduce((sum, p) => sum + p.current_version, 0)}
                  subtitle="All time"
                  icon={KPIIcons.clock}
                  color="#38BDF8"
                  delay={0.3}
                />
                <KPICard
                  title="Recently Updated"
                  value={playbooks.filter(p => {
                    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    return new Date(p.updated_at).getTime() > weekAgo;
                  }).length}
                  subtitle="This week"
                  icon={KPIIcons.trending}
                  color="#F59E0B"
                  delay={0.4}
                />
              </div>

              {/* Search Input */}
              <div className="mb-4">
                <div className="relative max-w-md">
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
                    placeholder="Search playbooks..."
                    className="w-full pl-10 pr-4 py-2 bg-[#151F2E] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]/50"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[#64748B] hover:text-white"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                <div className="grid grid-cols-4 gap-4 px-5 py-3 text-xs font-semibold text-[#64748B] uppercase tracking-wider border-b border-white/5 sticky top-0 z-10 bg-[#151F2E] shadow-[0_1px_0_rgba(255,255,255,0.05)]">
                  <div>Playbook</div>
                  <div>Version</div>
                  <div>Last Updated</div>
                  <div className="text-right">Action</div>
                </div>

                <div className="max-h-[500px] overflow-y-auto">
                  {filteredPlaybooks.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#64748B] text-sm">
                      {searchQuery ? 'No playbooks match your search' : 'No playbooks yet'}
                    </div>
                  ) : (
                    filteredPlaybooks.map((playbook, index) => (
                      <PlaybookRow
                        key={playbook.id}
                        playbook={playbook}
                        index={index}
                        onClick={() => router.push(`/playbooks/${playbook.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
      </motion.div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-[#151F2E] border border-white/10 rounded-lg p-6 max-w-lg w-full"
          >
            <h3 className="text-lg font-bold text-white mb-4">Create New Playbook</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={newPlaybook.name}
                  onChange={(e) => setNewPlaybook(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., MARS NDA"
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Description
                </label>
                <input
                  type="text"
                  value={newPlaybook.description}
                  onChange={(e) => setNewPlaybook(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description of this playbook"
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Initial Content (Optional)
                </label>
                <textarea
                  value={newPlaybook.content}
                  onChange={(e) => setNewPlaybook(prev => ({ ...prev, content: e.target.value }))}
                  placeholder="Paste the full agreement text here..."
                  rows={6}
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-[#8B5CF6] resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setNewPlaybook({ name: '', description: '', content: '' });
                }}
                className="flex-1 px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newPlaybook.name.trim()}
                className="flex-1 px-4 py-2 text-sm font-medium bg-[#8B5CF6] text-white rounded-lg hover:bg-[#7C3AED] transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Playbook'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
