import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'mars-word-addin-secret';

// Verify token helper
function verifyToken(request: NextRequest): { email: string; name: string } | null {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) return null;

  try {
    return jwt.verify(token, JWT_SECRET) as { email: string; name: string };
  } catch {
    return null;
  }
}

// GET: Get clauses for Word add-in
export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Get clauses
    let query = admin
      .from('clause_library')
      .select(`
        id,
        name,
        description,
        category_id,
        risk_level,
        primary_text,
        fallback_text,
        last_resort_text,
        tags,
        usage_count
      `)
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,primary_text.ilike.%${search}%`);
    }

    const { data: clauses, error } = await query;

    if (error) {
      console.error('Failed to fetch clauses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clauses' },
        { status: 500 }
      );
    }

    // Get categories
    const categoryIds = [...new Set(clauses?.map(c => c.category_id).filter(Boolean) || [])];
    const { data: categories } = await admin
      .from('clause_categories')
      .select('id, name, description')
      .in('id', categoryIds.length > 0 ? categoryIds : ['none']);

    const categoryMap = new Map(categories?.map(c => [c.id, c]) || []);

    // Get all categories for filtering
    const { data: allCategories } = await admin
      .from('clause_categories')
      .select('id, name')
      .order('sort_order', { ascending: true });

    // Format response
    const formattedClauses = clauses?.map(clause => ({
      id: clause.id,
      name: clause.name,
      description: clause.description,
      category: categoryMap.get(clause.category_id)?.name || 'Uncategorized',
      category_id: clause.category_id,
      risk_level: clause.risk_level || 'medium',
      primary_text: clause.primary_text,
      fallback_text: clause.fallback_text,
      last_resort_text: clause.last_resort_text,
      tags: clause.tags || [],
      usage_count: clause.usage_count || 0,
    })) || [];

    // Filter by category if specified
    const filteredClauses = category
      ? formattedClauses.filter(c => c.category_id === category)
      : formattedClauses;

    return NextResponse.json({
      clauses: filteredClauses,
      categories: allCategories || [],
    });
  } catch (error) {
    console.error('Error fetching clauses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Record clause usage
export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { clause_id, position_used, document_name } = body;

    if (!clause_id) {
      return NextResponse.json(
        { error: 'Clause ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Record usage
    await admin.from('clause_usage_history').insert({
      clause_id,
      contract_name: document_name || 'Word Document',
      used_position: position_used || 'primary',
      accepted: true,
      used_by: user.email,
    });

    // Increment usage count (trigger should handle this, but backup)
    try {
      await admin.rpc('increment_clause_usage', { clause_uuid: clause_id });
    } catch {
      // Fallback if function doesn't exist - get current count and increment
      const { data: clause } = await admin
        .from('clause_library')
        .select('usage_count')
        .eq('id', clause_id)
        .single();

      if (clause) {
        await admin
          .from('clause_library')
          .update({ usage_count: (clause.usage_count || 0) + 1 })
          .eq('id', clause_id);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording clause usage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
