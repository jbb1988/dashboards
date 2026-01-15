import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contract_id,
      contract_name,
      provision_name,
      original_text,
      redlined_text,
      modified_text,
      summary,
      status = 'draft',
    } = body;

    // Validate required fields
    if (!provision_name || !original_text || !redlined_text) {
      return NextResponse.json(
        { error: 'Missing required fields: provision_name, original_text, redlined_text' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Create the review
    const { data: review, error } = await admin
      .from('contract_reviews')
      .insert({
        contract_id: contract_id || null,
        contract_name: contract_name || null,
        provision_name,
        original_text,
        redlined_text,
        modified_text: modified_text || null,
        summary: summary || [],
        status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create review:', error);
      return NextResponse.json(
        { error: 'Failed to create review', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      id: review.id,
      review,
    });

  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
