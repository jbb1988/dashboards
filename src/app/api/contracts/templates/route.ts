import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List all contract templates
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    let query = admin
      .from('contract_templates')
      .select('*')
      .eq('is_active', true)
      .order('usage_count', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Failed to fetch templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (error) {
    console.error('Error fetching templates:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create a new contract template
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      base_document_url,
      base_document_content,
      fields,
      approval_rules,
      risk_threshold,
      playbook_id,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'Template name is required' },
        { status: 400 }
      );
    }
    if (!category?.trim()) {
      return NextResponse.json(
        { error: 'Template category is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: template, error } = await admin
      .from('contract_templates')
      .insert({
        name: name.trim(),
        description: description?.trim() || null,
        category: category.trim().toLowerCase(),
        base_document_url: base_document_url || null,
        base_document_content: base_document_content || null,
        fields: fields || [],
        approval_rules: approval_rules || {},
        risk_threshold: risk_threshold || 50,
        playbook_id: playbook_id || null,
        created_by: user.email || 'unknown',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create template:', error);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('Error creating template:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
