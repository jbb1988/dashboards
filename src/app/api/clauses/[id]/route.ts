import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: Get a single clause by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const admin = getSupabaseAdmin();

    const { data: clause, error } = await admin
      .from('clause_library')
      .select(`
        *,
        category:clause_categories(id, name, description)
      `)
      .eq('id', id)
      .single();

    if (error || !clause) {
      return NextResponse.json(
        { error: 'Clause not found' },
        { status: 404 }
      );
    }

    // Get usage history for this clause
    const { data: usageHistory } = await admin
      .from('clause_usage_history')
      .select('*')
      .eq('clause_id', id)
      .order('used_at', { ascending: false })
      .limit(20);

    return NextResponse.json({
      clause,
      usageHistory: usageHistory || [],
    });
  } catch (error) {
    console.error('Error fetching clause:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update a clause
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
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
      is_active,
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
      .update({
        category_id: category_id || null,
        name: name.trim(),
        description: description?.trim() || null,
        primary_text: primary_text.trim(),
        fallback_text: fallback_text?.trim() || null,
        last_resort_text: last_resort_text?.trim() || null,
        position_type: position_type || 'favorable',
        risk_level: risk_level || 'medium',
        tags: tags || [],
        is_active: is_active !== false,
        updated_by: user.email || 'unknown',
      })
      .eq('id', id)
      .select(`
        *,
        category:clause_categories(id, name, description)
      `)
      .single();

    if (error) {
      console.error('Failed to update clause:', error);
      return NextResponse.json(
        { error: 'Failed to update clause' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clause,
    });
  } catch (error) {
    console.error('Error updating clause:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete a clause (set is_active = false)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('clause_library')
      .update({
        is_active: false,
        updated_by: user.email || 'unknown',
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete clause:', error);
      return NextResponse.json(
        { error: 'Failed to delete clause' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting clause:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
