import { NextRequest, NextResponse } from 'next/server';
import { getContractReview } from '@/lib/supabase';

/**
 * GET /api/contracts/review/by-id/[id]
 * Get a single contract review by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing review ID' },
        { status: 400 }
      );
    }

    const review = await getContractReview(id);

    if (!review) {
      return NextResponse.json(
        { error: 'Review not found' },
        { status: 404 }
      );
    }

    // Transform to match frontend ReviewHistory interface
    return NextResponse.json({
      id: review.id,
      contractId: review.contract_id || '',
      contractName: review.contract_name || '',
      provisionName: review.provision_name,
      createdAt: review.created_at,
      status: review.status,
      originalText: review.original_text,
      redlinedText: review.redlined_text,
      modifiedText: review.modified_text,
      summary: review.summary,
    });
  } catch (error) {
    console.error('Error fetching review by ID:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review' },
      { status: 500 }
    );
  }
}
