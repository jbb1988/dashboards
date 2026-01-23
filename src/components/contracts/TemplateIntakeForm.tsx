'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface TemplateField {
  name: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'boolean';
  label: string;
  required?: boolean;
  default?: string | number | boolean;
  placeholder?: string;
  options?: string[];
  min?: number;
  max?: number;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fields: TemplateField[];
}

interface TemplateIntakeFormProps {
  template: Template;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
  onBack: () => void;
}

export default function TemplateIntakeForm({ template, onSubmit, onBack }: TemplateIntakeFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    // Initialize with default values
    const initial: Record<string, unknown> = {};
    template.fields.forEach(field => {
      if (field.default !== undefined) {
        initial[field.name] = field.default;
      } else if (field.type === 'boolean') {
        initial[field.name] = false;
      } else {
        initial[field.name] = '';
      }
    });
    return initial;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  function renderField(field: TemplateField) {
    const baseInputClasses = "w-full px-3 py-2 bg-[#0B1220] border border-white/10 rounded-lg text-white text-sm placeholder-[#64748B] focus:outline-none focus:border-teal-500 transition-colors";

    switch (field.type) {
      case 'textarea':
        return (
          <textarea
            value={values[field.name] as string || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
            className={`${baseInputClasses} resize-none`}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={values[field.name] as number || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value ? Number(e.target.value) : '' }))}
            placeholder={field.placeholder}
            required={field.required}
            min={field.min}
            max={field.max}
            className={baseInputClasses}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={values[field.name] as string || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
            required={field.required}
            className={baseInputClasses}
          />
        );

      case 'select':
        return (
          <select
            value={values[field.name] as string || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
            required={field.required}
            className={baseInputClasses}
          >
            <option value="">Select {field.label}...</option>
            {field.options?.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'boolean':
        return (
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setValues(prev => ({ ...prev, [field.name]: !prev[field.name] }))}
              className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                values[field.name] ? 'bg-teal-500' : 'bg-white/10'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  values[field.name] ? 'translate-x-5' : 'translate-x-1'
                }`}
              />
            </div>
            <span className="text-sm text-[#8FA3BF]">
              {values[field.name] ? 'Yes' : 'No'}
            </span>
          </label>
        );

      default: // text
        return (
          <input
            type="text"
            value={values[field.name] as string || ''}
            onChange={(e) => setValues(prev => ({ ...prev, [field.name]: e.target.value }))}
            placeholder={field.placeholder}
            required={field.required}
            className={baseInputClasses}
          />
        );
    }
  }

  // Group fields into sections for better UX
  const partyFields = template.fields.filter(f =>
    f.name.includes('counterparty') || f.name.includes('party') || f.name.includes('signer')
  );
  const termFields = template.fields.filter(f =>
    f.name.includes('date') || f.name.includes('term') || f.name.includes('renew')
  );
  const valueFields = template.fields.filter(f =>
    f.name.includes('value') || f.name.includes('payment') || f.name.includes('billing') || f.name.includes('price')
  );
  const otherFields = template.fields.filter(f =>
    !partyFields.includes(f) && !termFields.includes(f) && !valueFields.includes(f)
  );

  const sections = [
    { title: 'Counterparty Information', fields: partyFields },
    { title: 'Term & Dates', fields: termFields },
    { title: 'Value & Payment', fields: valueFields },
    { title: 'Additional Details', fields: otherFields },
  ].filter(s => s.fields.length > 0);

  return (
    <div className="bg-[#151F2E] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1 hover:bg-white/5 rounded transition-colors"
          >
            <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-lg font-semibold text-white">{template.name}</h2>
            <p className="text-xs text-[#8FA3BF]">{template.description || 'Complete the form to generate your contract'}</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="space-y-8">
          {sections.map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: sectionIndex * 0.1 }}
            >
              <h3 className="text-sm font-semibold text-[#8FA3BF] uppercase tracking-wider mb-4">
                {section.title}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {section.fields.map(field => (
                  <div
                    key={field.name}
                    className={field.type === 'textarea' ? 'col-span-2' : ''}
                  >
                    <label className="block text-sm font-medium text-white mb-2">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-1">*</span>}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/10">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 text-sm bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
          >
            Back
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 text-sm font-medium bg-teal-500 text-white rounded-lg hover:bg-teal-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Generate Contract
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
