// Document Types - Centralized definitions for contract documents

export const REQUIRED_DOCUMENT_TYPES = [
  'Original Contract',
  'MARS Redlines',
  'Final Agreement',
  'Executed Contract',
] as const;

export const ANALYSIS_DOCUMENT_TYPES = [
  'Comparison Report',
  'AI Recommendations',
] as const;

export const SUPPORTING_DOCUMENT_TYPES = [
  'Client Response',
  'Purchase Order',
  'Amendment',
  'Other',
] as const;

export const ALL_DOCUMENT_TYPES = [
  ...REQUIRED_DOCUMENT_TYPES,
  ...ANALYSIS_DOCUMENT_TYPES,
  ...SUPPORTING_DOCUMENT_TYPES,
] as const;

export type RequiredDocumentType = typeof REQUIRED_DOCUMENT_TYPES[number];
export type AnalysisDocumentType = typeof ANALYSIS_DOCUMENT_TYPES[number];
export type SupportingDocumentType = typeof SUPPORTING_DOCUMENT_TYPES[number];
export type DocumentType = typeof ALL_DOCUMENT_TYPES[number];

// Document type categories for grouping
export const DOCUMENT_CATEGORIES = {
  required: {
    label: 'Required',
    types: REQUIRED_DOCUMENT_TYPES,
    defaultExpanded: true,
  },
  analysis: {
    label: 'Analysis & Reports',
    types: ANALYSIS_DOCUMENT_TYPES,
    defaultExpanded: false,
    accentColor: '#8B5CF6', // Purple
  },
  supporting: {
    label: 'Supporting Documents',
    types: SUPPORTING_DOCUMENT_TYPES,
    defaultExpanded: false,
  },
} as const;

// Document type metadata for display
export const DOCUMENT_TYPE_META: Record<DocumentType, {
  icon: string;
  description: string;
  category: keyof typeof DOCUMENT_CATEGORIES;
}> = {
  'Original Contract': {
    icon: '📄',
    description: 'The original contract document from the client',
    category: 'required',
  },
  'MARS Redlines': {
    icon: '📝',
    description: 'MARS team redlined version of the contract',
    category: 'required',
  },
  'Final Agreement': {
    icon: '✅',
    description: 'Final negotiated agreement',
    category: 'required',
  },
  'Executed Contract': {
    icon: '🖊️',
    description: 'Signed and executed contract',
    category: 'required',
  },
  'Comparison Report': {
    icon: '📊',
    description: 'AI-generated contract comparison report',
    category: 'analysis',
  },
  'AI Recommendations': {
    icon: '🤖',
    description: 'AI analysis and negotiation recommendations',
    category: 'analysis',
  },
  'Client Response': {
    icon: '💬',
    description: 'Client response or counter-proposal',
    category: 'supporting',
  },
  'Purchase Order': {
    icon: '🧾',
    description: 'Purchase order document',
    category: 'supporting',
  },
  'Amendment': {
    icon: '📋',
    description: 'Contract amendment or modification',
    category: 'supporting',
  },
  'Other': {
    icon: '📁',
    description: 'Other supporting documents',
    category: 'supporting',
  },
};

// Helper to check if a document type is required
export function isRequiredDocType(type: string): type is RequiredDocumentType {
  return REQUIRED_DOCUMENT_TYPES.includes(type as RequiredDocumentType);
}

// Helper to check if a document type is analysis
export function isAnalysisDocType(type: string): type is AnalysisDocumentType {
  return ANALYSIS_DOCUMENT_TYPES.includes(type as AnalysisDocumentType);
}

// Helper to get category for a document type
export function getDocumentCategory(type: string): keyof typeof DOCUMENT_CATEGORIES {
  if (isRequiredDocType(type)) return 'required';
  if (isAnalysisDocType(type)) return 'analysis';
  return 'supporting';
}
