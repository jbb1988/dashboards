import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { sendMentionNotificationEmail } from '@/lib/email';

// GET: Fetch comments for a review (by review_id, token, or cc_token)
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const reviewId = searchParams.get('reviewId');
    const token = searchParams.get('token');
    const ccToken = searchParams.get('cc_token');

    if (!reviewId && !token && !ccToken) {
      return NextResponse.json(
        { error: 'Either reviewId, token, or cc_token is required' },
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

    // If cc_token provided, look up the review by cc_token
    if (ccToken && !reviewId && !token) {
      const { data: review, error: reviewError } = await admin
        .from('contract_reviews')
        .select('id')
        .eq('cc_token', ccToken)
        .single();

      if (reviewError || !review) {
        return NextResponse.json(
          { error: 'Invalid CC token' },
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
    const { reviewId, token, cc_token, authorEmail, authorName, comment } = body;

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

    if (!reviewId && !token && !cc_token) {
      return NextResponse.json(
        { error: 'Either reviewId, token, or cc_token is required' },
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

    // If cc_token provided, look up the review by cc_token
    if (cc_token && !reviewId && !token) {
      const { data: review, error: reviewError } = await admin
        .from('contract_reviews')
        .select('id, token_expires_at')
        .eq('cc_token', cc_token)
        .single();

      if (reviewError || !review) {
        return NextResponse.json(
          { error: 'Invalid CC token' },
          { status: 404 }
        );
      }

      // Check if token has expired
      if (review.token_expires_at) {
        const expiresAt = new Date(review.token_expires_at);
        if (expiresAt < new Date()) {
          return NextResponse.json(
            { error: 'This link has expired' },
            { status: 410 }
          );
        }
      }

      actualReviewId = review.id;
    }

    // Parse @mentions (email format: @email@domain.com)
    const mentionPattern = /@([\w.+-]+@[\w.-]+\.\w+)/g;
    const mentionedEmails = [...comment.matchAll(mentionPattern)].map(m => m[1]);
    const uniqueMentionedEmails = [...new Set(mentionedEmails)];

    // Insert the comment with mentions
    const { data: newComment, error } = await admin
      .from('approval_comments')
      .insert({
        review_id: actualReviewId,
        author_email: authorEmail.trim(),
        author_name: authorName?.trim() || null,
        comment: comment.trim(),
        mentioned_emails: uniqueMentionedEmails.length > 0 ? uniqueMentionedEmails : null,
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

    // Send notification to each mentioned user
    if (uniqueMentionedEmails.length > 0) {
      // Get review info for the email
      const { data: reviewInfo } = await admin
        .from('contract_reviews')
        .select('contract_name, approval_token, cc_token')
        .eq('id', actualReviewId)
        .single();

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://mars-dashboards.vercel.app';
      const viewUrl = reviewInfo?.approval_token
        ? `${baseUrl}/contracts/review/approve/${reviewInfo.approval_token}`
        : reviewInfo?.cc_token
        ? `${baseUrl}/contracts/review/cc/${reviewInfo.cc_token}`
        : `${baseUrl}/contracts/review?id=${actualReviewId}`;

      for (const email of uniqueMentionedEmails) {
        try {
          await sendMentionNotificationEmail({
            mentionedEmail: email,
            mentionerName: authorName?.trim() || authorEmail.trim(),
            contractName: reviewInfo?.contract_name || 'Contract Review',
            commentPreview: comment.slice(0, 100),
            viewUrl,
          });
        } catch (emailError) {
          // Log but don't fail the comment if email fails
          console.error(`Failed to send mention notification to ${email}:`, emailError);
        }
      }
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
