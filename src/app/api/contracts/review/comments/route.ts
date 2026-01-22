import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

// GET: Fetch comments for a review (by review_id or token)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get('reviewId');
    const token = searchParams.get('token');

    if (!reviewId && !token) {
      return NextResponse.json(
        { error: 'Either reviewId or token is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // If token provided, look up the review first
    let actualReviewId = reviewId;
    if (token && !reviewId) {
      const { data: review, error: reviewError } = await admin
        .from('contract_reviews')
        .select('id')
        .eq('approval_token', token)
        .single();

      if (reviewError || !review) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 404 }
        );
      }
      actualReviewId = review.id;
    }

    // Fetch comments
    const { data: comments, error } = await admin
      .from('approval_comments')
      .select('*')
      .eq('review_id', actualReviewId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to fetch comments:', error);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      comments: comments || [],
      count: comments?.length || 0,
    });

  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST: Add a new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reviewId, token, authorEmail, authorName, comment } = body;

    if (!comment?.trim()) {
      return NextResponse.json(
        { error: 'Comment text is required' },
        { status: 400 }
      );
    }

    if (!authorEmail?.trim()) {
      return NextResponse.json(
        { error: 'Author email is required' },
        { status: 400 }
      );
    }

    if (!reviewId && !token) {
      return NextResponse.json(
        { error: 'Either reviewId or token is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // If token provided, look up the review first
    let actualReviewId = reviewId;
    if (token && !reviewId) {
      const { data: review, error: reviewError } = await admin
        .from('contract_reviews')
        .select('id, token_expires_at')
        .eq('approval_token', token)
        .single();

      if (reviewError || !review) {
        return NextResponse.json(
          { error: 'Invalid token' },
          { status: 404 }
        );
      }

      // Check if token has expired
      if (review.token_expires_at) {
        const expiresAt = new Date(review.token_expires_at);
        if (expiresAt < new Date()) {
          return NextResponse.json(
            { error: 'This approval link has expired' },
            { status: 410 }
          );
        }
      }

      actualReviewId = review.id;
    }

    // Insert the comment
    const { data: newComment, error } = await admin
      .from('approval_comments')
      .insert({
        review_id: actualReviewId,
        author_email: authorEmail.trim(),
        author_name: authorName?.trim() || null,
        comment: comment.trim(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to insert comment:', error);
      return NextResponse.json(
        { error: 'Failed to add comment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      comment: newComment,
    });

  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
