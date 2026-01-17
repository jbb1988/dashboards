'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AIRecommendation } from './UnifiedInsightsPanel';

export interface TaskCreationData {
  title: string;
  description: string;
  priority: 'urgent' | 'high' | 'medium' | 'low';
  due_date?: string;
  customer_name?: string;
  source: 'ai_insight';
  insight_id: string;
  insight_category: string;
}

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: TaskCreationData) => Promise<void>;
  insight: AIRecommendation;
  actionItem?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  attrition: 'Attrition Risk',
  growth: 'Growth Opportunity',
  crosssell: 'Cross-Sell',
  concentration: 'Concentration',
  general: 'General',

  // Distributor-specific categories
  attrisk: 'At Risk',
  categorygap: 'Category Gap',
  expansion: 'Expansion Opportunity',
  inactive: 'Inactive Location',
  newlocation: 'New Location Onboarding',
};

export function CreateTaskModal({
  isOpen,
  onClose,
  onSave,
  insight,
  actionItem = '',
}: CreateTaskModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [priority, setPriority] = useState<'urgent' | 'high' | 'medium' | 'low'>('medium');
  const [dueDate, setDueDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-fill form when modal opens or insight changes
  useEffect(() => {
    if (isOpen && insight) {
      // Set title from action item or insight title
      const defaultTitle = actionItem || insight.title;
      setTitle(defaultTitle);

      // Build description with full context
      const descriptionText = `From AI Insight: ${insight.title}

Problem:
${insight.problem}

Recommendation:
${insight.recommendation}

Expected Impact: ${insight.expected_impact}

----
Action Items:
${insight.action_items.map(item => `- ${item}`).join('\n')}`;

      setDescription(descriptionText);

      // Extract customer name from title using regex
      const customerMatch = defaultTitle.match(/(?:Call|Contact|Follow up with|Quote|Reach out to|Email)\s+([^-–—]+?)(?:\s+(?:about|on|for|regarding|-|–|—)|$)/i);
      if (customerMatch && customerMatch[1]) {
        setCustomerName(customerMatch[1].trim());
      } else {
        setCustomerName('');
      }

      // Map priority from insight
      const priorityMapping: Record<string, 'urgent' | 'high' | 'medium' | 'low'> = {
        high: 'high',
        medium: 'medium',
        low: 'low',
      };
      setPriority(priorityMapping[insight.priority] || 'medium');

      // Set default due date based on priority
      const today = new Date();
      let daysToAdd = 7; // default for medium/low
      if (insight.priority === 'high') daysToAdd = 3;
      const defaultDueDate = new Date(today);
      defaultDueDate.setDate(today.getDate() + daysToAdd);
      setDueDate(defaultDueDate.toISOString().split('T')[0]);

      // Reset states
      setError('');
      setIsSaving(false);
    }
  }, [isOpen, insight, actionItem]);

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const taskData: TaskCreationData = {
        title: title.trim(),
        description: description.trim(),
        priority,
        due_date: dueDate || undefined,
        customer_name: customerName.trim() || undefined,
        source: 'ai_insight',
        insight_id: `${insight.category}-${Date.now()}`, // Generate unique ID
        insight_category: insight.category,
      };

      await onSave(taskData);

      // Close modal on success
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (!isSaving) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-2xl bg-[#0F1123] border border-white/10 rounded-2xl shadow-2xl pointer-events-auto max-h-[90vh] flex flex-col"
            >
              {/* Header */}
              <div className="flex items-start justify-between p-6 border-b border-white/10">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Create Task in Asana</h2>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 rounded-md text-[11px] font-medium border ${
                      insight.category === 'attrition' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                      insight.category === 'growth' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                      insight.category === 'crosssell' ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' :
                      insight.category === 'concentration' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                      'bg-gray-500/20 text-gray-400 border-gray-500/30'
                    }`}>
                      {CATEGORY_LABELS[insight.category] || insight.category}
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={isSaving}
                  className="p-2 hover:bg-white/5 rounded-lg transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5 text-[#94A3B8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Body (scrollable) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Error Display */}
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                    <p className="text-red-400 text-[13px]">{error}</p>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label className="block text-[13px] font-medium text-[#94A3B8] mb-2">
                    Task Title <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Enter task title"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#64748B] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all text-[14px]"
                    disabled={isSaving}
                  />
                </div>

                {/* Customer Name */}
                <div>
                  <label className="block text-[13px] font-medium text-[#94A3B8] mb-2">
                    Customer Name
                    <span className="text-[#64748B] text-[11px] ml-2">(optional)</span>
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Auto-extracted from title"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#64748B] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all text-[14px]"
                    disabled={isSaving}
                  />
                </div>

                {/* Priority & Due Date (side by side) */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Priority */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#94A3B8] mb-2">
                      Priority
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as 'urgent' | 'high' | 'medium' | 'low')}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all text-[14px] appearance-none cursor-pointer"
                      disabled={isSaving}
                    >
                      <option value="urgent" className="bg-[#1E293B]">Urgent</option>
                      <option value="high" className="bg-[#1E293B]">High</option>
                      <option value="medium" className="bg-[#1E293B]">Medium</option>
                      <option value="low" className="bg-[#1E293B]">Low</option>
                    </select>
                  </div>

                  {/* Due Date */}
                  <div>
                    <label className="block text-[13px] font-medium text-[#94A3B8] mb-2">
                      Due Date
                      <span className="text-[#64748B] text-[11px] ml-2">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all text-[14px]"
                      disabled={isSaving}
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-[13px] font-medium text-[#94A3B8] mb-2">
                    Description
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Task description with insight context"
                    rows={12}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#64748B] focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition-all text-[13px] leading-relaxed font-mono resize-none"
                    disabled={isSaving}
                  />
                  <p className="text-[11px] text-[#64748B] mt-1.5">
                    Full insight context is included for reference
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={handleClose}
                  disabled={isSaving}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#94A3B8] font-medium text-[14px] transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !title.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 text-[14px] flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <motion.div
                        className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      />
                      Creating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Create Task in Asana
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
