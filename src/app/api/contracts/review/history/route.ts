import { NextRequest, NextResponse } from 'next/server';
import {
  getContractReviews,
  createContractReview,
  deleteContractReview,
  ContractReview,
} from '@/lib/supabase';

/**
 * GET /api/contracts/review/history
 * Get all contract review history with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const contractId = searchParams.get('contractId') || undefined;
    const status = searchParams.get('status') || undefined;
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;

    const reviews = await getContractReviews({ contractId, status, limit });

    // Transform to match the frontend ReviewHistory interface
    const history = reviews.map(review => ({
      id: review.id,
      contractId: review.contract_id || '',
      contractName: review.contract_name || '',
      provisionName: review.provision_name,
      createdAt: review.created_at,
      status: review.status,
      // Include full review data for when user clicks to view
      originalText: review.original_text,
      redlinedText: review.redlined_text,
      modifiedText: review.modified_text,
      summary: review.summary,
    }));

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Error fetching review history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch review history' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/contracts/review/history
 * Create a new contract review record
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      contractId,
      contractName,
      provisionName,
      originalText,
      redlinedText,
      modifiedText,
      summary,
      status = 'draft',
    } = body;

    if (!provisionName || !originalText || !redlinedText) {
      return NextResponse.json(
        { error: 'Missing required fields: provisionName, originalText, redlinedText' },
        { status: 400 }
      );
    }

    const review: Omit<ContractReview, 'id' | 'created_at' | 'updated_at'> = {
      contract_id: contractId || null,
      contract_name: contractName || null,
      provision_name: provisionName,
      original_text: originalText,
      redlined_text: redlinedText,
      modified_text: modifiedText || null,
      summary: summary || [],
      status,
    };

    const created = await createContractReview(review);

    if (!created) {
      return NextResponse.json(
        { error: 'Failed to create review record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      review: {
        id: created.id,
        contractId: created.contract_id,
        contractName: created.contract_name,
        provisionName: created.provision_name,
        createdAt: created.created_at,
        status: created.status,
      },
    });
  } catch (error) {
    console.error('Error creating review record:', error);
    return NextResponse.json(
      { error: 'Failed to create review record' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts/review/history
 * Delete a contract review record
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const reviewId = searchParams.get('id');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing required parameter: id' },
        { status: 400 }
      );
    }

    const success = await deleteContractReview(reviewId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete review record' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting review record:', error);
    return NextResponse.json(
      { error: 'Failed to delete review record' },
      { status: 500 }
    );
  }
}
