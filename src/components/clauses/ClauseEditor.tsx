'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

interface ClauseCategory {
  id: string;
  name: string;
  description: string | null;
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
}

interface ClauseEditorProps {
  clause: Clause | null;
  categories: ClauseCategory[];
  onSave: (data: Partial<Clause>) => Promise<void>;
  onClose: () => void;
}

export default function ClauseEditor({ clause, categories, onSave, onClose }: ClauseEditorProps) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'primary' | 'fallback' | 'last_resort'>('primary');
  const [tagInput, setTagInput] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category_id: '',
    primary_text: '',
    fallback_text: '',
    last_resort_text: '',
    position_type: 'favorable' as const,
    risk_level: 'medium' as const,
    tags: [] as string[],
  });

  useEffect(() => {
    if (clause) {
      setFormData({
        name: clause.name || '',
        description: clause.description || '',
        category_id: clause.category_id || '',
        primary_text: clause.primary_text || '',
        fallback_text: clause.fallback_text || '',
        last_resort_text: clause.last_resort_text || '',
        position_type: clause.position_type || 'favorable',
        risk_level: clause.risk_level || 'medium',
        tags: clause.tags || [],
      });
    }
  }, [clause]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim() || !formData.primary_text.trim()) return;

    setSaving(true);
    try {
      await onSave({
        ...formData,
        category_id: formData.category_id || null,
      });
    } finally {
      setSaving(false);
    }
  }

  function addTag() {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tag),
    }));
  }

  const positionLabels = {
    primary: 'Favorable Position',
    fallback: 'Fallback Position',
    last_resort: 'Last Resort Position',
  };

  const positionDescriptions = {
    primary: 'The preferred language that protects MARS interests',
    fallback: 'Acceptable middle ground for negotiations',
    last_resort: 'Minimum acceptable terms - use only if necessary',
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#151F2E] border border-white/10 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">
              {clause ? 'Edit Clause' : 'Create New Clause'}
            </h3>
            <p className="text-xs text-[#8FA3BF] mt-1">
              Define approved language with multiple negotiation positions
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Clause Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Limitation of Liability - Service Provider"
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Category
                </label>
                <select
                  value={formData.category_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of when to use this clause"
                className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500"
              />
            </div>

            {/* Risk Level and Position Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Risk Level
                </label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as const).map(level => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, risk_level: level }))}
                      className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        formData.risk_level === level
                          ? level === 'low' ? 'bg-green-500/20 text-green-400 border border-green-500/40'
                            : level === 'medium' ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40'
                            : 'bg-red-500/20 text-red-400 border border-red-500/40'
                          : 'bg-[#0B1220] text-[#8FA3BF] border border-white/10 hover:border-white/20'
                      }`}
                    >
                      {level.charAt(0).toUpperCase() + level.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                  Position Type
                </label>
                <select
                  value={formData.position_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, position_type: e.target.value as 'favorable' | 'neutral' | 'fallback' }))}
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-teal-500"
                >
                  <option value="favorable">Favorable</option>
                  <option value="neutral">Neutral</option>
                  <option value="fallback">Fallback</option>
                </select>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Tags
              </label>
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {formData.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-teal-500/20 text-teal-400 text-xs rounded-full flex items-center gap-1"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="hover:text-white"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag..."
                  className="flex-1 px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-[#8FA3BF] hover:text-white hover:border-white/20 transition-colors text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            {/* Position Texts */}
            <div>
              <label className="block text-sm font-medium text-[#8FA3BF] mb-2">
                Clause Text Positions <span className="text-red-400">*</span>
              </label>

              {/* Tab Navigation */}
              <div className="flex border-b border-white/10 mb-4">
                {(['primary', 'fallback', 'last_resort'] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                      activeTab === tab
                        ? 'text-teal-400'
                        : 'text-[#8FA3BF] hover:text-white'
                    }`}
                  >
                    {positionLabels[tab]}
                    {tab === 'primary' && <span className="text-red-400 ml-1">*</span>}
                    {activeTab === tab && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-500"
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="space-y-2">
                <p className="text-xs text-[#64748B]">
                  {positionDescriptions[activeTab]}
                </p>
                <textarea
                  value={activeTab === 'primary' ? formData.primary_text
                    : activeTab === 'fallback' ? formData.fallback_text
                    : formData.last_resort_text}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    [activeTab === 'primary' ? 'primary_text'
                      : activeTab === 'fallback' ? 'fallback_text'
                      : 'last_resort_text']: e.target.value,
                  }))}
                  placeholder={`Enter ${positionLabels[activeTab].toLowerCase()} clause text...`}
                  rows={8}
                  className="w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500 resize-none font-mono"
                  required={activeTab === 'primary'}
                />
              </div>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/10 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !formData.name.trim() || !formData.primary_text.trim()}
            className="px-4 py-2 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : clause ? 'Update Clause' : 'Create Clause'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
