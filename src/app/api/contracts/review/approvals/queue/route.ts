import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status') || 'pending';
    const limit = parseInt(searchParams.get('limit') || '50');

    const admin = getSupabaseAdmin();

    // Build query based on status filter
    let query = admin
      .from('contract_reviews')
      .select('id, contract_id, contract_name, provision_name, summary, approval_status, approval_token, approver_email, approval_feedback, approved_at, submitted_by_email, submitted_at')
      .not('approval_token', 'is', null); // Only reviews that have been submitted for approval

    // Apply status filter
    if (status !== 'all') {
      query = query.eq('approval_status', status);
    }

    // Order by submission date (newest first)
    query = query.order('submitted_at', { ascending: false });

    // Apply limit
    if (limit > 0) {
      query = query.limit(limit);
    }

    const { data: reviews, error } = await query;

    if (error) {
      console.error('Failed to fetch approval queue:', error);
      return NextResponse.json(
        { error: 'Failed to fetch approval queue' },
        { status: 500 }
      );
    }

    // Get comment counts for all reviews
    const reviewIds = (reviews || []).map(r => r.id);
    let commentCountsMap: Record<string, number> = {};

    if (reviewIds.length > 0) {
      const { data: commentCounts } = await admin
        .from('approval_comments')
        .select('review_id')
        .in('review_id', reviewIds);

      // Count comments per review
      if (commentCounts) {
        for (const c of commentCounts) {
          commentCountsMap[c.review_id] = (commentCountsMap[c.review_id] || 0) + 1;
        }
      }
    }

    // Calculate urgency and days in queue
    const now = new Date();
    const approvals = (reviews || []).map(review => {
      const submittedAt = review.submitted_at ? new Date(review.submitted_at) : now;
      const daysInQueue = Math.floor((now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60 * 24));

      // Determine urgency based on days in queue
      let urgency: 'critical' | 'high' | 'normal' = 'normal';
      if (review.approval_status === 'pending') {
        if (daysInQueue > 5) {
          urgency = 'critical';
        } else if (daysInQueue > 2) {
          urgency = 'high';
        }
      }

      return {
        reviewId: review.id,
        contractId: review.contract_id,
        contractName: review.contract_name || review.provision_name || 'Unnamed Contract',
        provisionName: review.provision_name,
        submittedBy: review.submitted_by_email,
        submittedAt: review.submitted_at,
        approvalStatus: review.approval_status,
        approver: review.approver_email,
        approvedAt: review.approved_at,
        feedback: review.approval_feedback,
        daysInQueue,
        summary: review.summary || [],
        urgency,
        approvalToken: review.approval_token,
        commentCount: commentCountsMap[review.id] || 0,
      };
    });

    // Calculate counts for all statuses
    const { data: countData } = await admin
      .from('contract_reviews')
      .select('approval_status')
      .not('approval_token', 'is', null);

    const counts = {
      total: approvals.length,
      pending: countData?.filter(r => r.approval_status === 'pending').length || 0,
      approved: countData?.filter(r => r.approval_status === 'approved').length || 0,
      rejected: countData?.filter(r => r.approval_status === 'rejected').length || 0,
      expired: countData?.filter(r => r.approval_status === 'expired').length || 0,
    };

    return NextResponse.json({
      approvals,
      ...counts,
    });

  } catch (error) {
    console.error('Error fetching approval queue:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contracts/review/approvals/queue
 * Delete a pending approval (clears approval fields from the review)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get('reviewId');

    if (!reviewId) {
      return NextResponse.json(
        { error: 'Missing required parameter: reviewId' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Clear the approval-related fields to "cancel" the approval request
    // This keeps the review in history but removes it from the approval queue
    const { error } = await admin
      .from('contract_reviews')
      .update({
        approval_token: null,
        approval_status: null,
        submitted_by_email: null,
        submitted_at: null,
        approver_email: null,
        approval_feedback: null,
        approved_at: null,
        status: 'draft', // Return to draft status
      })
      .eq('id', reviewId);

    if (error) {
      console.error('Failed to delete approval:', error);
      return NextResponse.json(
        { error: 'Failed to delete approval' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting approval:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
