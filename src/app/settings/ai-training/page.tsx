'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import {
  DashboardBackground,
  backgroundPresets,
  KPICard,
  KPIIcons,
  tokens,
} from '@/components/mars-ui';

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
  positive: { bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
  negative: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
  neutral: { bg: 'bg-yellow-500/10', text: 'text-yellow-400', border: 'border-yellow-500/20' },
};

export default function AITrainingPage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('feedback');

  // Feedback state
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [feedbackSummary, setFeedbackSummary] = useState({ total: 0, positive: 0, negative: 0, neutral: 0 });

  // Terminology state
  const [terminology, setTerminology] = useState<Terminology[]>([]);
  const [showTermForm, setShowTermForm] = useState(false);
  const [newTerm, setNewTerm] = useState({ term: '', definition: '', preferred_usage: '', category: '' });

  // Examples state
  const [examples, setExamples] = useState<Example[]>([]);
  const [showExampleForm, setShowExampleForm] = useState(false);
  const [newExample, setNewExample] = useState({
    task_type: 'clause_review',
    clause_category: '',
    input_example: '',
    output_example: '',
    explanation: '',
  });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  async function loadData() {
    setLoading(true);
    try {
      if (activeTab === 'feedback') {
        const response = await fetch('/api/ai/feedback');
        const data = await response.json();
        setFeedback(data.feedback || []);
        setFeedbackSummary(data.summary || { total: 0, positive: 0, negative: 0, neutral: 0 });
      } else if (activeTab === 'terminology') {
        const response = await fetch('/api/ai/terminology');
        const data = await response.json();
        setTerminology(data.terminology || []);
      } else if (activeTab === 'examples') {
        const response = await fetch('/api/ai/examples');
        const data = await response.json();
        setExamples(data.examples || []);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function addTerminology() {
    if (!newTerm.term || !newTerm.definition) return;

    try {
      const response = await fetch('/api/ai/terminology', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTerm),
      });

      if (response.ok) {
        setShowTermForm(false);
        setNewTerm({ term: '', definition: '', preferred_usage: '', category: '' });
        loadData();
      }
    } catch (error) {
      console.error('Failed to add terminology:', error);
    }
  }

  async function addExample() {
    if (!newExample.input_example || !newExample.output_example) return;

    try {
      const response = await fetch('/api/ai/examples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newExample),
      });

      if (response.ok) {
        setShowExampleForm(false);
        setNewExample({
          task_type: 'clause_review',
          clause_category: '',
          input_example: '',
          output_example: '',
          explanation: '',
        });
        loadData();
      }
    } catch (error) {
      console.error('Failed to add example:', error);
    }
  }

  async function toggleExampleActive(example: Example) {
    try {
      await fetch('/api/ai/examples', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: example.id, is_active: !example.is_active }),
      });
      loadData();
    } catch (error) {
      console.error('Failed to toggle example:', error);
    }
  }

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
                <h1 className="text-[20px] font-semibold text-white">AI Training</h1>
                <p className="text-[12px] text-[#8FA3BF] mt-1">
                  Improve AI accuracy with feedback, terminology, and examples
                </p>
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => loadData()}
                className="px-4 py-2 rounded-lg bg-[#1E293B] text-sm text-[#8FA3BF] hover:text-white transition-colors"
              >
                Refresh
              </motion.button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-8 py-6">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {(['feedback', 'terminology', 'examples'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-purple-500 text-white'
                    : 'bg-white/5 text-[#8FA3BF] hover:bg-white/10'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Feedback Tab */}
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-4 gap-4">
                <KPICard
                  title="Total Feedback"
                  value={feedbackSummary.total}
                  subtitle="All time"
                  icon={KPIIcons.trending}
                  color="#8B5CF6"
                  delay={0.1}
                />
                <KPICard
                  title="Positive"
                  value={feedbackSummary.positive}
                  subtitle="Good suggestions"
                  icon={KPIIcons.checkCircle}
                  color="#22C55E"
                  delay={0.2}
                />
                <KPICard
                  title="Negative"
                  value={feedbackSummary.negative}
                  subtitle="Need improvement"
                  icon={KPIIcons.alert}
                  color="#EF4444"
                  delay={0.3}
                />
                <KPICard
                  title="Neutral"
                  value={feedbackSummary.neutral}
                  subtitle="Acceptable"
                  icon={KPIIcons.clock}
                  color="#F59E0B"
                  delay={0.4}
                />
              </div>

              {/* Feedback List */}
              <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Recent Feedback</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                  {loading ? (
                    <div className="px-5 py-8 text-center text-[#64748B]">Loading...</div>
                  ) : feedback.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#64748B]">No feedback yet</div>
                  ) : (
                    feedback.map((item, index) => {
                      const colors = ratingColors[item.rating];
                      return (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          className="px-5 py-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text} ${colors.border} border capitalize`}>
                                  {item.rating}
                                </span>
                                {item.clause_type && (
                                  <span className="text-xs text-[#64748B]">{item.clause_type}</span>
                                )}
                              </div>
                              <p className="text-sm text-white/80 line-clamp-2">{item.ai_suggestion}</p>
                              {item.rating_reason && (
                                <p className="text-xs text-[#8FA3BF] mt-1">Reason: {item.rating_reason}</p>
                              )}
                              {item.corrected_text && (
                                <p className="text-xs text-green-400 mt-1">Correction provided</p>
                              )}
                            </div>
                            <div className="text-xs text-[#64748B] whitespace-nowrap">
                              {new Date(item.submitted_at).toLocaleDateString()}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Terminology Tab */}
          {activeTab === 'terminology' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowTermForm(true)}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-sm text-white font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Term
                </button>
              </div>

              <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                <div className="px-5 py-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-white">Company Terminology</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                  {loading ? (
                    <div className="px-5 py-8 text-center text-[#64748B]">Loading...</div>
                  ) : terminology.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#64748B]">No terminology defined yet</div>
                  ) : (
                    terminology.map((term, index) => (
                      <motion.div
                        key={term.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h4 className="text-sm font-semibold text-white">{term.term}</h4>
                            <p className="text-sm text-[#8FA3BF] mt-1">{term.definition}</p>
                            {term.preferred_usage && (
                              <p className="text-xs text-green-400 mt-1">Usage: {term.preferred_usage}</p>
                            )}
                            {term.avoid_usage?.length > 0 && (
                              <p className="text-xs text-red-400 mt-1">Avoid: {term.avoid_usage.join(', ')}</p>
                            )}
                          </div>
                          {term.category && (
                            <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-[#8FA3BF]">
                              {term.category}
                            </span>
                          )}
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Term Modal */}
              {showTermForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#151F2E] border border-white/10 rounded-xl w-full max-w-lg p-6"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4">Add Terminology</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Term</label>
                        <input
                          type="text"
                          value={newTerm.term}
                          onChange={(e) => setNewTerm(prev => ({ ...prev, term: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Definition</label>
                        <textarea
                          value={newTerm.definition}
                          onChange={(e) => setNewTerm(prev => ({ ...prev, definition: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Preferred Usage</label>
                        <input
                          type="text"
                          value={newTerm.preferred_usage}
                          onChange={(e) => setNewTerm(prev => ({ ...prev, preferred_usage: e.target.value }))}
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Category</label>
                        <input
                          type="text"
                          value={newTerm.category}
                          onChange={(e) => setNewTerm(prev => ({ ...prev, category: e.target.value }))}
                          placeholder="e.g., legal, technical, business"
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => setShowTermForm(false)}
                        className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addTerminology}
                        disabled={!newTerm.term || !newTerm.definition}
                        className="px-4 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                      >
                        Add Term
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          )}

          {/* Examples Tab */}
          {activeTab === 'examples' && (
            <div className="space-y-6">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowExampleForm(true)}
                  className="px-4 py-2 rounded-lg bg-purple-500 text-sm text-white font-medium hover:bg-purple-600 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Example
                </button>
              </div>

              <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} overflow-hidden`}>
                <div className="px-5 py-3 border-b border-white/5">
                  <h3 className="text-sm font-semibold text-white">Few-Shot Examples</h3>
                </div>
                <div className="max-h-[500px] overflow-y-auto divide-y divide-white/5">
                  {loading ? (
                    <div className="px-5 py-8 text-center text-[#64748B]">Loading...</div>
                  ) : examples.length === 0 ? (
                    <div className="px-5 py-8 text-center text-[#64748B]">No examples yet</div>
                  ) : (
                    examples.map((example, index) => (
                      <motion.div
                        key={example.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.03 }}
                        className="px-5 py-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                {example.task_type}
                              </span>
                              {example.clause_category && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-[#8FA3BF]">
                                  {example.clause_category}
                                </span>
                              )}
                              <span className={`text-xs px-2 py-0.5 rounded-full ${example.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                {example.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                              <div>
                                <span className="text-[#64748B]">Input:</span>
                                <p className="text-white/80 mt-1 line-clamp-2">{example.input_example}</p>
                              </div>
                              <div>
                                <span className="text-[#64748B]">Output:</span>
                                <p className="text-white/80 mt-1 line-clamp-2">{example.output_example}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-xs text-[#64748B]">
                              <span>Quality: {example.quality_score}/5</span>
                              <span>Used: {example.times_used} times</span>
                            </div>
                          </div>
                          <button
                            onClick={() => toggleExampleActive(example)}
                            className={`px-3 py-1 text-xs rounded-lg transition-colors ${
                              example.is_active
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            }`}
                          >
                            {example.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Add Example Modal */}
              {showExampleForm && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#151F2E] border border-white/10 rounded-xl w-full max-w-2xl p-6"
                  >
                    <h3 className="text-lg font-semibold text-white mb-4">Add Few-Shot Example</h3>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Task Type</label>
                          <select
                            value={newExample.task_type}
                            onChange={(e) => setNewExample(prev => ({ ...prev, task_type: e.target.value }))}
                            className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          >
                            <option value="clause_review">Clause Review</option>
                            <option value="risk_assessment">Risk Assessment</option>
                            <option value="redline">Redline Generation</option>
                            <option value="extraction">Extraction</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Clause Category</label>
                          <input
                            type="text"
                            value={newExample.clause_category}
                            onChange={(e) => setNewExample(prev => ({ ...prev, clause_category: e.target.value }))}
                            placeholder="e.g., indemnification"
                            className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Input Example</label>
                        <textarea
                          value={newExample.input_example}
                          onChange={(e) => setNewExample(prev => ({ ...prev, input_example: e.target.value }))}
                          placeholder="The clause or scenario to analyze..."
                          rows={4}
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Expected Output</label>
                        <textarea
                          value={newExample.output_example}
                          onChange={(e) => setNewExample(prev => ({ ...prev, output_example: e.target.value }))}
                          placeholder="The ideal AI response..."
                          rows={4}
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500 resize-none font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-[#8FA3BF] mb-2">Explanation (Optional)</label>
                        <input
                          type="text"
                          value={newExample.explanation}
                          onChange={(e) => setNewExample(prev => ({ ...prev, explanation: e.target.value }))}
                          placeholder="Why is this a good example?"
                          className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-purple-500"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={() => setShowExampleForm(false)}
                        className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={addExample}
                        disabled={!newExample.input_example || !newExample.output_example}
                        className="px-4 py-2 text-sm font-medium bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50"
                      >
                        Add Example
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </div>
          )}
        </main>
      </motion.div>
    </div>
  );
}
