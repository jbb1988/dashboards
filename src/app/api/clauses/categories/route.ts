import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List all clause categories
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();

    const { data: categories, error } = await admin
      .from('clause_categories')
      .select(`
        *,
        clause_count:clause_library(count)
      `)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch categories:', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    // Transform count format
    const categoriesWithCount = categories?.map(cat => ({
      ...cat,
      clause_count: cat.clause_count?.[0]?.count || 0,
    }));

    return NextResponse.json({ categories: categoriesWithCount || [] });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new category
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, parent_id, sort_order } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Category name is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Get max sort order if not provided
    let finalSortOrder = sort_order;
    if (finalSortOrder === undefined) {
      const { data: maxSort } = await admin
        .from('clause_categories')
        .select('sort_order')
        .order('sort_order', { ascending: false })
        .limit(1)
        .single();

      finalSortOrder = (maxSort?.sort_order || 0) + 1;
    }

    const { data: category, error } = await admin
      .from('clause_categories')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        parent_id: parent_id || null,
        sort_order: finalSortOrder,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create category:', error);
      return NextResponse.json(
        { error: 'Failed to create category' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      category,
    });
  } catch (error) {
    console.error('Error creating category:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
