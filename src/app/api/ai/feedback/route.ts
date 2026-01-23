import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/apiAuth';

// GET: List AI feedback entries
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);

    const rating = searchParams.get('rating');
    const clauseType = searchParams.get('clause_type');
    const useForTraining = searchParams.get('use_for_training');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = admin
      .from('ai_feedback')
      .select('*', { count: 'exact' })
      .order('submitted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (rating) {
      query = query.eq('rating', rating);
    }
    if (clauseType) {
      query = query.eq('clause_type', clauseType);
    }
    if (useForTraining !== null) {
      query = query.eq('use_for_training', useForTraining === 'true');
    }

    const { data: feedback, error, count } = await query;

    if (error) {
      console.error('Failed to fetch AI feedback:', error);
      return NextResponse.json(
        { error: 'Failed to fetch feedback' },
        { status: 500 }
      );
    }

    // Get stats
    const { data: stats } = await admin
      .from('ai_feedback')
      .select('rating');

    const summary = {
      total: stats?.length || 0,
      positive: stats?.filter(s => s.rating === 'positive').length || 0,
      negative: stats?.filter(s => s.rating === 'negative').length || 0,
      neutral: stats?.filter(s => s.rating === 'neutral').length || 0,
    };

    return NextResponse.json({
      feedback: feedback || [],
      total: count,
      summary,
    });
  } catch (error) {
    console.error('Error fetching AI feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Submit new AI feedback
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      review_id,
      contract_name,
      clause_type,
      section_title,
      ai_suggestion,
      original_text,
      rating,
      rating_reason,
      corrected_text,
      correction_notes,
      training_category,
    } = body;

    if (!ai_suggestion?.trim()) {
      return NextResponse.json(
        { error: 'AI suggestion is required' },
        { status: 400 }
      );
    }
    if (!rating || !['positive', 'negative', 'neutral'].includes(rating)) {
      return NextResponse.json(
        { error: 'Valid rating is required (positive, negative, or neutral)' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const { data: feedback, error } = await admin
      .from('ai_feedback')
      .insert({
        review_id: review_id || null,
        contract_name: contract_name || null,
        clause_type: clause_type || null,
        section_title: section_title || null,
        ai_suggestion: ai_suggestion.trim(),
        original_text: original_text?.trim() || null,
        rating,
        rating_reason: rating_reason?.trim() || null,
        corrected_text: corrected_text?.trim() || null,
        correction_notes: correction_notes?.trim() || null,
        use_for_training: rating !== 'neutral', // Use positive/negative for training
        training_category: training_category || clause_type || null,
        submitted_by: user.email || 'unknown',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to submit feedback:', error);
      return NextResponse.json(
        { error: 'Failed to submit feedback' },
        { status: 500 }
      );
    }

    // If negative with correction, consider auto-creating a few-shot example
    if (rating === 'negative' && corrected_text) {
      try {
        await admin.from('few_shot_examples').insert({
          task_type: 'clause_review',
          clause_category: clause_type || null,
          input_example: original_text || ai_suggestion,
          output_example: corrected_text,
          explanation: correction_notes || 'User-corrected AI suggestion',
          quality_score: 4, // Default high quality for user corrections
          derived_from_feedback_id: feedback.id,
          is_active: false, // Pending review
          created_by: user.email || 'feedback-system',
        });
      } catch (exampleError) {
        console.error('Failed to create few-shot example:', exampleError);
        // Don't fail the feedback submission
      }
    }

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error('Error submitting AI feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT: Update feedback (e.g., toggle use_for_training)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, use_for_training, training_category } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Feedback ID is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    const updateData: Record<string, unknown> = {};
    if (use_for_training !== undefined) {
      updateData.use_for_training = use_for_training;
    }
    if (training_category !== undefined) {
      updateData.training_category = training_category;
    }

    const { data: feedback, error } = await admin
      .from('ai_feedback')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Failed to update feedback:', error);
      return NextResponse.json(
        { error: 'Failed to update feedback' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      feedback,
    });
  } catch (error) {
    console.error('Error updating AI feedback:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
