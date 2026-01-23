'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import {
  DashboardBackground,
  backgroundPresets,
  tokens,
  colors,
} from '@/components/mars-ui';
import TemplateIntakeForm from '@/components/contracts/TemplateIntakeForm';
import GeneratedPreview from '@/components/contracts/GeneratedPreview';

interface TemplateField {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean';
  label: string;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: string[];
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fields: TemplateField[];
  usage_count: number;
}

interface GeneratedContract {
  id: string;
  content: string;
  risk_score: number;
  risk_factors: Array<{ factor: string; impact: number; description: string }>;
  approval_status: 'pending' | 'approved' | 'rejected' | 'auto_approved';
  approval_required: boolean;
  approvers: string[];
}

type Step = 'select' | 'form' | 'preview';

const categoryIcons: Record<string, JSX.Element> = {
  nda: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  ),
  msa: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  sow: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
    </svg>
  ),
};

const categoryColors: Record<string, string> = {
  nda: '#8B5CF6',
  msa: '#14B8A6',
  sow: '#F59E0B',
};

function TemplateCard({
  template,
  onClick,
}: {
  template: Template;
  onClick: () => void;
}) {
  const color = categoryColors[template.category] || '#64748B';
  const icon = categoryIcons[template.category] || categoryIcons.msa;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="bg-[#151F2E] border border-white/10 rounded-xl p-6 cursor-pointer hover:border-white/20 transition-all group"
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {icon}
      </div>

      <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-teal-400 transition-colors">
        {template.name}
      </h3>

      <p className="text-sm text-[#8FA3BF] line-clamp-2 mb-4">
        {template.description || 'No description provided'}
      </p>

      <div className="flex items-center justify-between">
        <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-[#8FA3BF] uppercase">
          {template.category}
        </span>
        <span className="text-xs text-[#64748B]">
          {template.usage_count} generated
        </span>
      </div>
    </motion.div>
  );
}

export default function ContractGeneratePage() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generation, setGeneration] = useState<GeneratedContract | null>(null);
  const [step, setStep] = useState<Step>('select');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    try {
      const response = await fetch('/api/contracts/templates');
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectTemplate(template: Template) {
    setSelectedTemplate(template);
    setStep('form');
    setError(null);
  }

  async function handleGenerateContract(values: Record<string, unknown>) {
    if (!selectedTemplate) return;

    setError(null);
    try {
      const response = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate.id,
          field_values: values,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate contract');
      }

      setGeneration(data.generation);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate contract');
    }
  }

  async function handleSubmitForApproval() {
    // In a real implementation, this would send the contract for approval
    alert('Contract submitted for approval!');
  }

  function handleDownload() {
    if (!generation) return;

    const blob = new Blob([generation.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedTemplate?.name.replace(/\s+/g, '_') || 'contract'}_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleStartOver() {
    setSelectedTemplate(null);
    setGeneration(null);
    setStep('select');
    setError(null);
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
          <div className="max-w-[1200px] mx-auto px-8 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-[20px] font-semibold text-white">Generate Contract</h1>
                <p className="text-[12px] text-[#8FA3BF] mt-1">
                  Create contracts from templates with AI assistance
                </p>
              </div>

              {/* Progress Indicator */}
              <div className="flex items-center gap-2">
                {(['select', 'form', 'preview'] as const).map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                        step === s
                          ? 'bg-teal-500 text-white'
                          : ['select', 'form', 'preview'].indexOf(step) > i
                          ? 'bg-teal-500/20 text-teal-400'
                          : 'bg-white/5 text-[#64748B]'
                      }`}
                    >
                      {i + 1}
                    </div>
                    {i < 2 && (
                      <div
                        className={`w-8 h-0.5 ${
                          ['select', 'form', 'preview'].indexOf(step) > i
                            ? 'bg-teal-500/50'
                            : 'bg-white/10'
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-[1200px] mx-auto px-8 py-6">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm text-red-400 font-medium">Error</p>
                <p className="text-xs text-[#8FA3BF]">{error}</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="grid grid-cols-3 gap-6">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-[#151F2E] border border-white/10 rounded-xl p-6 animate-pulse">
                  <div className="w-12 h-12 bg-white/5 rounded-xl mb-4" />
                  <div className="h-5 bg-white/5 rounded w-3/4 mb-2" />
                  <div className="h-4 bg-white/5 rounded w-full mb-4" />
                  <div className="h-4 bg-white/5 rounded w-1/3" />
                </div>
              ))}
            </div>
          ) : step === 'select' ? (
            <div>
              <h2 className="text-lg font-semibold text-white mb-4">Select a Template</h2>
              {templates.length === 0 ? (
                <div className="text-center py-20 bg-[#151F2E] border border-white/10 rounded-xl">
                  <svg className="w-16 h-16 text-[#64748B] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-[#8FA3BF]">No templates available yet.</p>
                  <p className="text-sm text-[#64748B] mt-1">Run the database migrations to add default templates.</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  {templates.map(template => (
                    <TemplateCard
                      key={template.id}
                      template={template}
                      onClick={() => handleSelectTemplate(template)}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : step === 'form' && selectedTemplate ? (
            <TemplateIntakeForm
              template={selectedTemplate}
              onSubmit={handleGenerateContract}
              onBack={() => setStep('select')}
            />
          ) : step === 'preview' && generation && selectedTemplate ? (
            <GeneratedPreview
              generation={generation}
              templateName={selectedTemplate.name}
              onEdit={() => setStep('form')}
              onSubmitForApproval={handleSubmitForApproval}
              onDownload={handleDownload}
              onStartOver={handleStartOver}
            />
          ) : null}
        </main>
      </motion.div>
    </div>
  );
}
