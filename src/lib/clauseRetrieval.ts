/**
 * Clause Retrieval for RAG (Retrieval Augmented Generation)
 *
 * This module fetches approved clauses from the database and formats them
 * for injection into the AI prompt, providing concrete examples of MARS's
 * approved language rather than just abstract positions.
 */

import { getSupabaseAdmin } from './supabase';

// Clause structure from the database
export interface Clause {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  primary_text: string;
  fallback_text: string | null;
  last_resort_text: string | null;
  position_type: 'favorable' | 'neutral' | 'unfavorable';
  risk_level: 'high' | 'medium' | 'low';
  tags: string[];
  usage_count: number;
  is_active: boolean;
  category?: {
    id: string;
    name: string;
    description: string | null;
  };
}

// Category structure
export interface ClauseCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

// Clauses organized by category for prompt injection
export interface ClausesByCategory {
  [categoryName: string]: {
    categoryId: string;
    clauses: Array<{
      name: string;
      primary_text: string;
      fallback_text: string | null;
      last_resort_text: string | null;
      risk_level: string;
    }>;
  };
}

/**
 * Fetch all active approved clauses from the database, grouped by category.
 * Returns clauses sorted by usage count (most used first).
 */
export async function getApprovedClauses(): Promise<ClausesByCategory> {
  const admin = getSupabaseAdmin();

  const { data: clauses, error } = await admin
    .from('clause_library')
    .select(`
      id,
      category_id,
      name,
      description,
      primary_text,
      fallback_text,
      last_resort_text,
      position_type,
      risk_level,
      tags,
      usage_count,
      is_active,
      category:clause_categories(id, name, description)
    `)
    .eq('is_active', true)
    .order('usage_count', { ascending: false })
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching approved clauses:', error);
    return {};
  }

  if (!clauses || clauses.length === 0) {
    console.log('No approved clauses found in database');
    return {};
  }

  // Group by category
  const byCategory: ClausesByCategory = {};

  for (const clause of clauses) {
    // Handle category - Supabase returns joined data as an array or object depending on relationship
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCategory = clause.category as any;
    const categoryData = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
    const categoryName = categoryData?.name || 'Uncategorized';
    const categoryId = categoryData?.id || 'uncategorized';

    if (!byCategory[categoryName]) {
      byCategory[categoryName] = {
        categoryId,
        clauses: [],
      };
    }

    byCategory[categoryName].clauses.push({
      name: clause.name,
      primary_text: clause.primary_text,
      fallback_text: clause.fallback_text,
      last_resort_text: clause.last_resort_text,
      risk_level: clause.risk_level,
    });
  }

  console.log(`Fetched ${clauses.length} approved clauses across ${Object.keys(byCategory).length} categories`);
  return byCategory;
}

/**
 * Get clauses for specific categories relevant to contract review.
 * This is more targeted than getApprovedClauses() and focuses on
 * the most critical clause types for risk analysis.
 */
export async function getClausesForCategories(
  categoryNames: string[]
): Promise<ClausesByCategory> {
  const admin = getSupabaseAdmin();

  // First, get the category IDs for the requested names
  const { data: categories, error: catError } = await admin
    .from('clause_categories')
    .select('id, name')
    .in('name', categoryNames);

  if (catError || !categories || categories.length === 0) {
    console.log('Could not find requested categories:', categoryNames);
    return {};
  }

  const categoryIds = categories.map(c => c.id);

  // Fetch clauses for those categories
  const { data: clauses, error } = await admin
    .from('clause_library')
    .select(`
      id,
      category_id,
      name,
      primary_text,
      fallback_text,
      last_resort_text,
      risk_level,
      usage_count,
      category:clause_categories(id, name, description)
    `)
    .eq('is_active', true)
    .in('category_id', categoryIds)
    .order('usage_count', { ascending: false })
    .limit(3); // Get top 3 most-used clauses per category

  if (error || !clauses) {
    console.error('Error fetching targeted clauses:', error);
    return {};
  }

  // Group by category
  const byCategory: ClausesByCategory = {};

  for (const clause of clauses) {
    // Handle category - Supabase returns joined data as an array or object depending on relationship
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawCategory = clause.category as any;
    const categoryData = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
    const categoryName = categoryData?.name || 'Uncategorized';
    const categoryId = categoryData?.id || 'uncategorized';

    if (!byCategory[categoryName]) {
      byCategory[categoryName] = {
        categoryId,
        clauses: [],
      };
    }

    byCategory[categoryName].clauses.push({
      name: clause.name,
      primary_text: clause.primary_text,
      fallback_text: clause.fallback_text,
      last_resort_text: clause.last_resort_text,
      risk_level: clause.risk_level,
    });
  }

  return byCategory;
}

/**
 * Format clauses for injection into the AI prompt.
 * Creates a structured string that provides the AI with concrete examples
 * of MARS's approved language for different clause types.
 */
export function formatClausesForPrompt(clauses: ClausesByCategory): string {
  if (Object.keys(clauses).length === 0) {
    return '';
  }

  const lines: string[] = [
    '',
    '=== MARS APPROVED CLAUSE LANGUAGE ===',
    'Use the following as reference for suggested revisions. When proposing changes,',
    'prefer language that closely matches these approved clauses:',
    '',
  ];

  // Priority order for categories (most important first)
  const priorityOrder = [
    'Limitation of Liability',
    'Indemnification',
    'Intellectual Property',
    'IP/Work Product',
    'Termination',
    'Insurance',
    'Confidentiality',
    'Warranty',
    'Payment Terms',
  ];

  // Sort categories by priority
  const sortedCategories = Object.keys(clauses).sort((a, b) => {
    const aIndex = priorityOrder.findIndex(p => a.toLowerCase().includes(p.toLowerCase()));
    const bIndex = priorityOrder.findIndex(p => b.toLowerCase().includes(p.toLowerCase()));
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b);
    if (aIndex === -1) return 1;
    if (bIndex === -1) return -1;
    return aIndex - bIndex;
  });

  for (const categoryName of sortedCategories) {
    const category = clauses[categoryName];

    // Only include categories with clauses
    if (category.clauses.length === 0) continue;

    lines.push(`[${categoryName}]`);

    // Include up to 2 clauses per category to keep prompt size manageable
    const clausesToInclude = category.clauses.slice(0, 2);

    for (const clause of clausesToInclude) {
      // Primary (preferred) text
      lines.push(`  PRIMARY: "${truncateText(clause.primary_text, 500)}"`);

      // Fallback if available
      if (clause.fallback_text) {
        lines.push(`  FALLBACK: "${truncateText(clause.fallback_text, 400)}"`);
      }

      // Last resort if available
      if (clause.last_resort_text) {
        lines.push(`  LAST RESORT: "${truncateText(clause.last_resort_text, 300)}"`);
      }

      lines.push('');
    }
  }

  lines.push('When suggesting revisions, adapt the above approved language to fit the context.');
  lines.push('');

  return lines.join('\n');
}

/**
 * Truncate text to a maximum length, breaking at word boundaries
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }

  return truncated + '...';
}

/**
 * Get clause context for the contract review prompt.
 * This is the main function called by the review API to get
 * formatted clause examples for RAG.
 *
 * @param includeAll - If true, includes all clauses. If false, only critical categories.
 */
export async function getClauseContextForPrompt(includeAll: boolean = false): Promise<string> {
  try {
    let clauses: ClausesByCategory;

    if (includeAll) {
      clauses = await getApprovedClauses();
    } else {
      // Focus on most critical categories for contract review
      clauses = await getClausesForCategories([
        'Limitation of Liability',
        'Indemnification',
        'Intellectual Property',
        'IP/Work Product',
        'Termination',
        'Insurance',
      ]);

      // If targeted fetch returned nothing, try getting all
      if (Object.keys(clauses).length === 0) {
        clauses = await getApprovedClauses();
      }
    }

    return formatClausesForPrompt(clauses);
  } catch (error) {
    console.error('Error getting clause context for prompt:', error);
    return ''; // Return empty string on error - prompt will work without RAG
  }
}
