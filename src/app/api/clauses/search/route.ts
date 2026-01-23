import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: Full-text search across clauses
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const categoryId = searchParams.get('category_id');
    const riskLevel = searchParams.get('risk_level');
    const limit = parseInt(searchParams.get('limit') || '20');

    if (!query?.trim()) {
      return NextResponse.json(
        { error: 'Search query is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Use PostgreSQL full-text search
    let searchQuery = admin
      .from('clause_library')
      .select(`
        *,
        category:clause_categories(id, name, description)
      `)
      .eq('is_active', true)
      .textSearch(
        'primary_text',
        query.split(' ').map(word => `'${word}'`).join(' | '),
        { type: 'websearch', config: 'english' }
      )
      .order('usage_count', { ascending: false })
      .limit(limit);

    // Apply additional filters
    if (categoryId) {
      searchQuery = searchQuery.eq('category_id', categoryId);
    }
    if (riskLevel) {
      searchQuery = searchQuery.eq('risk_level', riskLevel);
    }

    const { data: clauses, error } = await searchQuery;

    if (error) {
      console.error('Search error:', error);

      // Fallback to ILIKE search if full-text fails
      const fallbackQuery = admin
        .from('clause_library')
        .select(`
          *,
          category:clause_categories(id, name, description)
        `)
        .eq('is_active', true)
        .or(`name.ilike.%${query}%,description.ilike.%${query}%,primary_text.ilike.%${query}%`)
        .order('usage_count', { ascending: false })
        .limit(limit);

      if (categoryId) {
        fallbackQuery.eq('category_id', categoryId);
      }
      if (riskLevel) {
        fallbackQuery.eq('risk_level', riskLevel);
      }

      const { data: fallbackResults, error: fallbackError } = await fallbackQuery;

      if (fallbackError) {
        return NextResponse.json(
          { error: 'Search failed' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        clauses: fallbackResults || [],
        searchType: 'fallback',
      });
    }

    return NextResponse.json({
      clauses: clauses || [],
      searchType: 'fulltext',
    });
  } catch (error) {
    console.error('Error searching clauses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: AI-powered semantic search for similar clauses
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clause_text, category_id, limit = 5 } = body;

    if (!clause_text?.trim()) {
      return NextResponse.json(
        { error: 'Clause text is required for similarity search' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get all clauses from the same category (or all if no category)
    let query = admin
      .from('clause_library')
      .select(`
        *,
        category:clause_categories(id, name, description)
      `)
      .eq('is_active', true);

    if (category_id) {
      query = query.eq('category_id', category_id);
    }

    const { data: clauses, error } = await query;

    if (error) {
      console.error('Failed to fetch clauses for similarity:', error);
      return NextResponse.json(
        { error: 'Failed to search clauses' },
        { status: 500 }
      );
    }

    // Calculate similarity scores using word overlap
    const inputWords = new Set(
      clause_text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
    );

    const scoredClauses = (clauses || []).map(clause => {
      const clauseWords = new Set(
        clause.primary_text.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
      );

      // Jaccard similarity
      const intersection = new Set([...inputWords].filter(x => clauseWords.has(x)));
      const union = new Set([...inputWords, ...clauseWords]);
      const similarity = intersection.size / union.size;

      return {
        ...clause,
        similarity_score: similarity,
      };
    });

    // Sort by similarity and return top results
    const topResults = scoredClauses
      .filter(c => c.similarity_score > 0.1) // Minimum threshold
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, limit);

    return NextResponse.json({
      clauses: topResults,
      searchType: 'similarity',
    });
  } catch (error) {
    console.error('Error in similarity search:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
