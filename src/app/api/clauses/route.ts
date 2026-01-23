import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List all clauses with optional filtering
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    // Optional filters
    const categoryId = searchParams.get('category_id');
    const riskLevel = searchParams.get('risk_level');
    const search = searchParams.get('search');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = admin
      .from('clause_library')
      .select(`
        *,
        category:clause_categories(id, name, description)
      `)
      .eq('is_active', true)
      .order('usage_count', { ascending: false })
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }
    if (riskLevel) {
      query = query.eq('risk_level', riskLevel);
    }
    if (tags && tags.length > 0) {
      query = query.overlaps('tags', tags);
    }
    if (search) {
      // Use full-text search
      query = query.textSearch('name', search, { type: 'websearch' });
    }

    const { data: clauses, error, count } = await query;

    if (error) {
      console.error('Failed to fetch clauses:', error);
      return NextResponse.json(
        { error: 'Failed to fetch clauses' },
        { status: 500 }
      );
    }

    // Get categories for filtering UI
    const { data: categories } = await admin
      .from('clause_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    return NextResponse.json({
      clauses: clauses || [],
      categories: categories || [],
      total: count,
    });
  } catch (error) {
    console.error('Error fetching clauses:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new clause
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      category_id,
      name,
      description,
      primary_text,
      fallback_text,
      last_resort_text,
      position_type,
      risk_level,
      tags,
      source_contract_id,
      source_contract_name,
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Clause name is required' },
        { status: 400 }
      );
    }
    if (!primary_text?.trim()) {
      return NextResponse.json(
        { error: 'Primary clause text is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: clause, error } = await admin
      .from('clause_library')
      .insert({
        category_id: category_id || null,
        name: name.trim(),
        description: description?.trim() || null,
        primary_text: primary_text.trim(),
        fallback_text: fallback_text?.trim() || null,
        last_resort_text: last_resort_text?.trim() || null,
        position_type: position_type || 'favorable',
        risk_level: risk_level || 'medium',
        tags: tags || [],
        source_contract_id: source_contract_id || null,
        source_contract_name: source_contract_name || null,
        created_by: user.email || 'unknown',
      })
      .select(`
        *,
        category:clause_categories(id, name, description)
      `)
      .single();

    if (error) {
      console.error('Failed to create clause:', error);
      return NextResponse.json(
        { error: 'Failed to create clause' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clause,
    });
  } catch (error) {
    console.error('Error creating clause:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
