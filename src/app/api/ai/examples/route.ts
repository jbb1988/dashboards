import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List few-shot examples
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const taskType = searchParams.get('task_type');
    const clauseCategory = searchParams.get('clause_category');
    const activeOnly = searchParams.get('active_only') !== 'false';
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = admin
      .from('few_shot_examples')
      .select('*')
      .order('priority', { ascending: false })
      .order('quality_score', { ascending: false })
      .limit(limit);

    if (activeOnly) {
      query = query.eq('is_active', true);
    }
    if (taskType) {
      query = query.eq('task_type', taskType);
    }
    if (clauseCategory) {
      query = query.eq('clause_category', clauseCategory);
    }

    const { data: examples, error } = await query;

    if (error) {
      console.error('Failed to fetch examples:', error);
      return NextResponse.json(
        { error: 'Failed to fetch examples' },
        { status: 500 }
      );
    }

    // Get unique task types and clause categories for filtering
    const { data: allExamples } = await admin
      .from('few_shot_examples')
      .select('task_type, clause_category')
      .eq('is_active', true);

    const taskTypes = [...new Set(allExamples?.map(e => e.task_type).filter(Boolean))];
    const clauseCategories = [...new Set(allExamples?.map(e => e.clause_category).filter(Boolean))];

    return NextResponse.json({
      examples: examples || [],
      taskTypes,
      clauseCategories,
    });
  } catch (error) {
    console.error('Error fetching examples:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Create new few-shot example
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      task_type,
      clause_category,
      scenario_type,
      input_example,
      output_example,
      explanation,
      quality_score,
      source_contract_id,
      source_contract_name,
      is_active,
      priority,
    } = body;

    if (!task_type?.trim()) {
      return NextResponse.json(
        { error: 'Task type is required' },
        { status: 400 }
      );
    }
    if (!input_example?.trim()) {
      return NextResponse.json(
        { error: 'Input example is required' },
        { status: 400 }
      );
    }
    if (!output_example?.trim()) {
      return NextResponse.json(
        { error: 'Output example is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: example, error } = await admin
      .from('few_shot_examples')
      .insert({
        task_type: task_type.trim(),
        clause_category: clause_category?.trim() || null,
        scenario_type: scenario_type?.trim() || null,
        input_example: input_example.trim(),
        output_example: output_example.trim(),
        explanation: explanation?.trim() || null,
        quality_score: quality_score || 3,
        source_contract_id: source_contract_id || null,
        source_contract_name: source_contract_name || null,
        is_active: is_active !== false,
        priority: priority || 0,
        created_by: user.email || 'unknown',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create example:', error);
      return NextResponse.json(
        { error: 'Failed to create example' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      example,
    });
  } catch (error) {
    console.error('Error creating example:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update few-shot example
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      id,
      task_type,
      clause_category,
      scenario_type,
      input_example,
      output_example,
      explanation,
      quality_score,
      is_active,
      priority,
    } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Example ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {
      updated_by: user.email || 'unknown',
    };

    if (task_type !== undefined) updateData.task_type = task_type.trim();
    if (clause_category !== undefined) updateData.clause_category = clause_category?.trim() || null;
    if (scenario_type !== undefined) updateData.scenario_type = scenario_type?.trim() || null;
    if (input_example !== undefined) updateData.input_example = input_example.trim();
    if (output_example !== undefined) updateData.output_example = output_example.trim();
    if (explanation !== undefined) updateData.explanation = explanation?.trim() || null;
    if (quality_score !== undefined) updateData.quality_score = quality_score;
    if (is_active !== undefined) updateData.is_active = is_active;
    if (priority !== undefined) updateData.priority = priority;

    const { data: example, error } = await admin
      .from('few_shot_examples')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update example:', error);
      return NextResponse.json(
        { error: 'Failed to update example' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      example,
    });
  } catch (error) {
    console.error('Error updating example:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Delete example
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
        { error: 'Example ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { error } = await admin
      .from('few_shot_examples')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Failed to delete example:', error);
      return NextResponse.json(
        { error: 'Failed to delete example' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting example:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
