'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import { KPICard, KPIIcons, tokens } from '@/components/mars-ui';

interface Feedback {
  id: string;
  clause_type: string | null;
  section_title: string | null;
  ai_suggestion: string;
  rating: 'positive' | 'negative' | 'neutral';
  rating_reason: string | null;
  corrected_text: string | null;
  use_for_training: boolean;
  submitted_by: string;
  submitted_at: string;
}

interface Terminology {
  id: string;
  term: string;
  definition: string;
  preferred_usage: string | null;
  avoid_usage: string[];
  category: string | null;
  is_active: boolean;
}

interface Example {
  id: string;
  task_type: string;
  clause_category: string | null;
  input_example: string;
  output_example: string;
  explanation: string | null;
  quality_score: number;
  times_used: number;
  is_active: boolean;
}

type Tab = 'feedback' | 'terminology' | 'examples';

const ratingColors = {
  positive: '#22C55E',
  negative: '#EF4444',
  neutral: '#64748B',
};

export default function AITrainingTab() {
  const [activeTab, setActiveTab] = useState<Tab>('feedback');
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [terminology, setTerminology] = useState<Terminology[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'feedback') {
        const { data } = await supabase
          .from('ai_feedback')
          .select('*')
          .order('submitted_at', { ascending: false })
          .limit(50);
        setFeedback(data || []);
      } else if (activeTab === 'terminology') {
        const { data } = await supabase
          .from('contract_terminology')
          .select('*')
          .order('term');
        setTerminology(data || []);
      } else if (activeTab === 'examples') {
        const { data } = await supabase
          .from('ai_training_examples')
          .select('*')
          .order('quality_score', { ascending: false });
        setExamples(data || []);
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTraining = async (id: string, current: boolean) => {
    try {
      await supabase
        .from('ai_feedback')
        .update({ use_for_training: !current })
        .eq('id', id);
      loadData();
    } catch (err) {
      console.error('Failed to update:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4">
        <KPICard
          label="Feedback Items"
          value={feedback.length || '-'}
          icon={<KPIIcons.chat />}
          accentColor="#A855F7"
        />
        <KPICard
          label="Positive Ratings"
          value={feedback.filter(f => f.rating === 'positive').length || '-'}
          icon={<KPIIcons.check />}
          accentColor="#22C55E"
        />
        <KPICard
          label="Terminology"
          value={terminology.length || '-'}
          icon={<KPIIcons.document />}
          accentColor="#38BDF8"
        />
        <KPICard
          label="Training Examples"
          value={examples.length || '-'}
          icon={<KPIIcons.brain />}
          accentColor="#F59E0B"
        />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[
          { id: 'feedback', label: 'Feedback' },
          { id: 'terminology', label: 'Terminology' },
          { id: 'examples', label: 'Examples' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-[#1E3A5F] text-white'
                : 'bg-[#1E293B] text-[#64748B] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={`h-64 rounded-xl ${tokens.bg.card} animate-pulse`} />
      ) : (
        <>
          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Section</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">AI Suggestion</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Rating</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Use for Training</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((item) => (
                    <tr key={item.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[#EAF2FF] text-sm">
                        {item.section_title || item.clause_type || '-'}
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-sm max-w-xs truncate">
                        {item.ai_suggestion.substring(0, 100)}...
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium"
                          style={{
                            backgroundColor: `${ratingColors[item.rating]}20`,
                            color: ratingColors[item.rating],
                          }}
                        >
                          {item.rating}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleTraining(item.id, item.use_for_training)}
                          className={`w-10 h-5 rounded-full transition-colors ${
                            item.use_for_training ? 'bg-[#22C55E]' : 'bg-[#1E293B]'
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full bg-white transition-transform ${
                              item.use_for_training ? 'translate-x-5' : 'translate-x-0.5'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-sm">
                        {new Date(item.submitted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                  {feedback.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#64748B] text-sm">
                        No feedback collected yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Terminology Tab */}
          {activeTab === 'terminology' && (
            <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Term</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Definition</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Preferred Usage</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {terminology.map((term) => (
                    <tr key={term.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[#EAF2FF] text-sm font-medium">{term.term}</td>
                      <td className="px-4 py-3 text-[#64748B] text-sm max-w-xs">{term.definition}</td>
                      <td className="px-4 py-3 text-[#64748B] text-sm">{term.preferred_usage || '-'}</td>
                      <td className="px-4 py-3 text-[#64748B] text-sm">{term.category || '-'}</td>
                    </tr>
                  ))}
                  {terminology.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-[#64748B] text-sm">
                        No terminology defined yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Examples Tab */}
          {activeTab === 'examples' && (
            <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Task Type</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Input</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Output</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Quality</th>
                    <th className="text-left px-4 py-3 text-[11px] font-semibold text-[#64748B] uppercase">Uses</th>
                  </tr>
                </thead>
                <tbody>
                  {examples.map((ex) => (
                    <tr key={ex.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-3 text-[#EAF2FF] text-sm">{ex.task_type}</td>
                      <td className="px-4 py-3 text-[#64748B] text-sm max-w-xs truncate">
                        {ex.input_example.substring(0, 60)}...
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-sm max-w-xs truncate">
                        {ex.output_example.substring(0, 60)}...
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#22C55E] rounded-full"
                              style={{ width: `${ex.quality_score}%` }}
                            />
                          </div>
                          <span className="text-[#64748B] text-xs">{ex.quality_score}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[#64748B] text-sm tabular-nums">{ex.times_used}</td>
                    </tr>
                  ))}
                  {examples.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-[#64748B] text-sm">
                        No training examples yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
