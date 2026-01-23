'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { KPICard, KPIIcons, tokens } from '@/components/mars-ui';

interface Playbook {
  id: string;
  name: string;
  description: string | null;
  contract_type: string;
  counterparty_type: string | null;
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  is_default: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  rules_count?: number;
}

const riskColors = {
  conservative: '#22C55E',
  moderate: '#F59E0B',
  aggressive: '#EF4444',
};

export default function PlaybooksTab() {
  const router = useRouter();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadPlaybooks();
  }, []);

  const loadPlaybooks = async () => {
    try {
      const { data, error } = await supabase
        .from('negotiation_playbooks')
        .select('*, rules:playbook_rules(count)')
        .eq('is_active', true)
        .order('is_default', { ascending: false })
        .order('usage_count', { ascending: false });

      if (error) throw error;

      setPlaybooks(data?.map(p => ({
        ...p,
        rules_count: p.rules?.[0]?.count || 0,
      })) || []);
    } catch (err) {
      console.error('Failed to load playbooks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewPlaybook = (id: string) => {
    router.push(`/playbooks/${id}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`h-48 rounded-xl ${tokens.bg.card} animate-pulse`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[#64748B] text-sm">
            {playbooks.length} playbook{playbooks.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-[#38BDF8] text-white rounded-lg text-sm font-medium hover:bg-[#38BDF8]/90 transition-colors"
        >
          + Create Playbook
        </button>
      </div>

      {/* Playbooks Grid */}
      <div className="grid grid-cols-3 gap-4">
        {playbooks.map((playbook, idx) => (
          <motion.div
            key={playbook.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => handleViewPlaybook(playbook.id)}
            className={`p-6 rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} cursor-pointer hover:border-[#38BDF8]/50 transition-all group`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-[#1E293B] text-[#38BDF8]">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              {playbook.is_default && (
                <span className="px-2 py-1 bg-[#38BDF8]/20 text-[#38BDF8] text-xs rounded-full">
                  Default
                </span>
              )}
            </div>

            <h3 className="text-white font-medium mb-2 group-hover:text-[#38BDF8] transition-colors">
              {playbook.name}
            </h3>

            {playbook.description && (
              <p className="text-[#64748B] text-sm mb-4 line-clamp-2">
                {playbook.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs">
              <span
                className="px-2 py-1 rounded"
                style={{
                  backgroundColor: `${riskColors[playbook.risk_tolerance]}20`,
                  color: riskColors[playbook.risk_tolerance],
                }}
              >
                {playbook.risk_tolerance}
              </span>
              <span className="text-[#64748B]">{playbook.rules_count} rules</span>
              <span className="text-[#64748B]">{playbook.usage_count} uses</span>
            </div>
          </motion.div>
        ))}

        {playbooks.length === 0 && (
          <div className="col-span-3 text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-[#1E293B] flex items-center justify-center">
              <svg className="w-8 h-8 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <p className="text-[#64748B]">No playbooks yet</p>
            <p className="text-[#475569] text-sm mt-1">Create your first negotiation playbook</p>
          </div>
        )}
      </div>

      {/* Create Modal Placeholder */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className={`w-full max-w-md p-6 rounded-xl ${tokens.bg.card} border ${tokens.border.subtle}`}>
            <h3 className="text-lg font-semibold text-white mb-4">Create Playbook</h3>
            <p className="text-[#64748B] text-sm mb-4">
              Playbook creation coming soon. For now, playbooks can be created via the API or database.
            </p>
            <button
              onClick={() => setShowCreateModal(false)}
              className="w-full px-4 py-2 bg-[#1E293B] text-white rounded-lg text-sm hover:bg-[#2A3544] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
