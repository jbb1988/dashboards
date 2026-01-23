import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List company terminology
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const category = searchParams.get('category');
    const domain = searchParams.get('domain');
    const search = searchParams.get('search');
    const activeOnly = searchParams.get('active_only') !== 'false';

    let query = admin
      .from('company_terminology')
      .select('*')
      .order('term', { ascending: true });

    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (category) {
      query = query.eq('category', category);
    }
    if (domain) {
      query = query.eq('domain', domain);
    }
    if (search) {
      query = query.or(`term.ilike.%${search}%,definition.ilike.%${search}%`);
    }

    const { data: terminology, error } = await query;

    if (error) {
      console.error('Failed to fetch terminology:', error);
      return NextResponse.json(
        { error: 'Failed to fetch terminology' },
        { status: 500 }
      );
    }

    // Get unique categories and domains for filtering
    const categories = [...new Set(terminology?.map(t => t.category).filter(Boolean))];
    const domains = [...new Set(terminology?.map(t => t.domain).filter(Boolean))];

    return NextResponse.json({
      terminology: terminology || [],
      categories,
      domains,
    });
  } catch (error) {
    console.error('Error fetching terminology:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add new terminology
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      term,
      definition,
      preferred_usage,
      avoid_usage,
      context,
      category,
      domain,
      aliases,
      is_preferred,
    } = body;

    if (!term?.trim()) {
      return NextResponse.json(
        { error: 'Term is required' },
        { status: 400 }
      );
    }
    if (!definition?.trim()) {
      return NextResponse.json(
        { error: 'Definition is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Check for duplicate term
    const { data: existing } = await admin
      .from('company_terminology')
      .select('id')
      .ilike('term', term.trim())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This term already exists in the glossary' },
        { status: 409 }
      );
    }

    const { data: terminology, error } = await admin
      .from('company_terminology')
      .insert({
        term: term.trim(),
        definition: definition.trim(),
        preferred_usage: preferred_usage?.trim() || null,
        avoid_usage: avoid_usage || [],
        context: context?.trim() || null,
        category: category?.trim() || null,
        domain: domain?.trim() || null,
        aliases: aliases || [],
        is_preferred: is_preferred !== false,
        created_by: user.email || 'unknown',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to add terminology:', error);
      return NextResponse.json(
        { error: 'Failed to add terminology' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      terminology,
    });
  } catch (error) {
    console.error('Error adding terminology:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update terminology
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      term,
      definition,
      preferred_usage,
      avoid_usage,
      context,
      category,
      domain,
      aliases,
      is_preferred,
      is_active,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Terminology ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {
      updated_by: user.email || 'unknown',
    };

    if (term !== undefined) updateData.term = term.trim();
    if (definition !== undefined) updateData.definition = definition.trim();
    if (preferred_usage !== undefined) updateData.preferred_usage = preferred_usage?.trim() || null;
    if (avoid_usage !== undefined) updateData.avoid_usage = avoid_usage;
    if (context !== undefined) updateData.context = context?.trim() || null;
    if (category !== undefined) updateData.category = category?.trim() || null;
    if (domain !== undefined) updateData.domain = domain?.trim() || null;
    if (aliases !== undefined) updateData.aliases = aliases;
    if (is_preferred !== undefined) updateData.is_preferred = is_preferred;
    if (is_active !== undefined) updateData.is_active = is_active;

    const { data: terminology, error } = await admin
      .from('company_terminology')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update terminology:', error);
      return NextResponse.json(
        { error: 'Failed to update terminology' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      terminology,
    });
  } catch (error) {
    console.error('Error updating terminology:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Soft delete terminology
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Terminology ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('company_terminology')
      .update({
        is_active: false,
        updated_by: user.email || 'unknown',
      })
      .eq('id', id);

    if (error) {
      console.error('Failed to delete terminology:', error);
      return NextResponse.json(
        { error: 'Failed to delete terminology' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting terminology:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
