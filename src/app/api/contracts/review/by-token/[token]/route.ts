import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { error: 'Token is required' },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();

    // Fetch review by approval token
    const { data: review, error } = await admin
      .from('contract_reviews')
      .select('*')
      .eq('approval_token', token)
      .single();

    if (error || !review) {
      return NextResponse.json(
        { error: 'Invalid approval link. The token may be incorrect.' },
        { status: 404 }
      );
    }

    // Check if token has expired
    if (review.token_expires_at) {
      const expiresAt = new Date(review.token_expires_at);
      if (expiresAt < new Date()) {
        // Mark as expired in database
        await admin
          .from('contract_reviews')
          .update({ approval_status: 'expired', updated_at: new Date().toISOString() })
          .eq('id', review.id);

        return NextResponse.json(
          { error: 'This approval link has expired. Please request a new approval.' },
          { status: 410 } // Gone
        );
      }
    }

    // Log view activity when approval is accessed (only once - first view)
    if (review.approval_status === 'pending') {
      const currentLog = review.activity_log || [];
      // Only log first view (no existing 'viewed' entries)
      const hasBeenViewed = currentLog.some(
        (entry: { action: string }) => entry.action === 'viewed'
      );

      if (!hasBeenViewed) {
        const viewEntry = {
          action: 'viewed',
          by: 'Approver',
          at: new Date().toISOString(),
        };

        await admin
          .from('contract_reviews')
          .update({
            activity_log: [...currentLog, viewEntry],
            updated_at: new Date().toISOString(),
          })
          .eq('id', review.id);

        // Update local review object for response
        review.activity_log = [...currentLog, viewEntry];
      }
    }

    // Fetch related documents (by contract_id or salesforce_id)
    let documents: Array<{
      id: string;
      file_name: string;
      file_url: string;
      document_type: string;
      uploaded_at: string;
      file_mime_type: string | null;
      converted_pdf_url: string | null;
    }> = [];

    if (review.contract_id) {
      // Try contract_id first (UUID), then salesforce_id (Salesforce ID string)
      let { data: docs } = await admin
        .from('documents')
        .select('id, file_name, file_url, document_type, uploaded_at, file_mime_type, converted_pdf_url')
        .eq('salesforce_id', review.contract_id)
        .order('uploaded_at', { ascending: false });

      // If no docs found by salesforce_id, try contract_id (for UUID references)
      if (!docs || docs.length === 0) {
        const result = await admin
          .from('documents')
          .select('id, file_name, file_url, document_type, uploaded_at, file_mime_type, converted_pdf_url')
          .eq('contract_id', review.contract_id)
          .order('uploaded_at', { ascending: false });
        docs = result.data;
      }

      documents = docs || [];
    }

    // Fetch comments for this review
    const { data: comments } = await admin
      .from('approval_comments')
      .select('id, author_email, author_name, comment, created_at')
      .eq('review_id', review.id)
      .order('created_at', { ascending: true });

    // Return review data with documents, comments, and OneDrive info
    return NextResponse.json({
      id: review.id,
      contractId: review.contract_id,
      contractName: review.contract_name || 'Unnamed Contract',
      provisionName: review.provision_name,
      submittedBy: review.submitted_by_email,
      submittedAt: review.submitted_at,
      summary: review.summary || [],
      reviewerNotes: review.reviewer_notes || null,
      originalText: review.original_text,
      redlinedText: review.redlined_text,
      modifiedText: review.modified_text,
      approvalStatus: review.approval_status,
      approverEditedText: review.approver_edited_text || null,
      activityLog: review.activity_log || [],
      riskScores: review.risk_scores || null,
      // OneDrive integration fields for embedded document editing
      onedriveFileId: review.onedrive_file_id || null,
      onedriveWebUrl: review.onedrive_web_url || null,
      onedriveEmbedUrl: review.onedrive_embed_url || null,
      documentVersions: review.document_versions || [],
      documents: documents.map(doc => ({
        id: doc.id,
        fileName: doc.file_name,
        fileUrl: doc.file_url,
        documentType: doc.document_type,
        uploadedAt: doc.uploaded_at,
        mimeType: doc.file_mime_type,
        convertedPdfUrl: doc.converted_pdf_url,
      })),
      comments: (comments || []).map(c => ({
        id: c.id,
        authorEmail: c.author_email,
        authorName: c.author_name,
        comment: c.comment,
        createdAt: c.created_at,
      })),
    });

  } catch (error) {
    console.error('Error fetching review by token:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
