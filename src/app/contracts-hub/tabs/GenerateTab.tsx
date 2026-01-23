'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';
import { tokens } from '@/components/mars-ui';
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
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  amendment: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
};

export default function GenerateTab() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [generatedContract, setGeneratedContract] = useState<GeneratedContract | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('contract_templates')
        .select('*')
        .eq('is_active', true)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setTemplates(data?.map(t => ({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        fields: t.fields || [],
        usage_count: t.usage_count || 0,
      })) || []);
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    setStep('form');
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    if (!selectedTemplate) return;

    setIsGenerating(true);
    try {
      const response = await fetch('/api/contracts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          formData,
        }),
      });

      if (!response.ok) throw new Error('Generation failed');

      const result = await response.json();
      setGeneratedContract(result);
      setStep('preview');
    } catch (err) {
      console.error('Failed to generate contract:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBack = () => {
    if (step === 'form') {
      setStep('select');
      setSelectedTemplate(null);
    } else if (step === 'preview') {
      setStep('form');
      setGeneratedContract(null);
    }
  };

  const handleStartOver = () => {
    setStep('select');
    setSelectedTemplate(null);
    setGeneratedContract(null);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`h-40 rounded-xl ${tokens.bg.card} animate-pulse`} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center gap-4 mb-8">
        {['Select Template', 'Fill Details', 'Review & Sign'].map((label, idx) => {
          const stepIdx = idx + 1;
          const currentStepIdx = step === 'select' ? 1 : step === 'form' ? 2 : 3;
          const isActive = stepIdx === currentStepIdx;
          const isComplete = stepIdx < currentStepIdx;

          return (
            <div key={label} className="flex items-center gap-3">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                ${isComplete ? 'bg-[#22C55E] text-white' :
                  isActive ? 'bg-[#38BDF8] text-white' :
                  'bg-[#1E293B] text-[#64748B]'}
              `}>
                {isComplete ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepIdx}
              </div>
              <span className={`text-sm ${isActive ? 'text-white' : 'text-[#64748B]'}`}>{label}</span>
              {idx < 2 && <div className="w-12 h-px bg-[#2A3544]" />}
            </div>
          );
        })}
      </div>

      {/* Step: Select Template */}
      {step === 'select' && (
        <div className="grid grid-cols-3 gap-4">
          {templates.map((template) => (
            <motion.button
              key={template.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleTemplateSelect(template)}
              className={`p-6 rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} text-left hover:border-[#38BDF8]/50 transition-all`}
            >
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-lg bg-[#1E293B] text-[#38BDF8]">
                  {categoryIcons[template.category.toLowerCase()] || categoryIcons.msa}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-medium mb-1">{template.name}</h3>
                  <p className="text-[#64748B] text-sm line-clamp-2">{template.description}</p>
                  <p className="text-[#475569] text-xs mt-2">Used {template.usage_count} times</p>
                </div>
              </div>
            </motion.button>
          ))}

          {templates.length === 0 && (
            <div className="col-span-3 text-center py-12 text-[#64748B]">
              <p>No templates available.</p>
              <p className="text-sm mt-1">Contact admin to add contract templates.</p>
            </div>
          )}
        </div>
      )}

      {/* Step: Fill Form */}
      {step === 'form' && selectedTemplate && (
        <div className={`rounded-xl ${tokens.bg.card} border ${tokens.border.subtle} p-6`}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-white">{selectedTemplate.name}</h3>
              <p className="text-[#64748B] text-sm">{selectedTemplate.description}</p>
            </div>
            <button
              onClick={handleBack}
              className="px-4 py-2 text-[#64748B] hover:text-white text-sm transition-colors"
            >
              ← Back
            </button>
          </div>

          <TemplateIntakeForm
            template={selectedTemplate}
            onSubmit={handleFormSubmit}
            onBack={handleBack}
          />
        </div>
      )}

      {/* Step: Preview */}
      {step === 'preview' && generatedContract && selectedTemplate && (
        <GeneratedPreview
          generation={generatedContract}
          templateName={selectedTemplate.name}
          onEdit={handleBack}
          onSubmitForApproval={async () => {
            // Submit for approval logic
            console.log('Submitting for approval:', generatedContract.id);
          }}
          onDownload={() => {
            // Download logic
            const blob = new Blob([generatedContract.content], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${selectedTemplate.name.toLowerCase().replace(/\s+/g, '-')}-contract.txt`;
            a.click();
            URL.revokeObjectURL(url);
          }}
          onStartOver={handleStartOver}
        />
      )}
    </div>
  );
}
