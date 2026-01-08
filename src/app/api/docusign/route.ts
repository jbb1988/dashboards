import { NextRequest, NextResponse } from 'next/server';
import {
  listEnvelopes,
  getEnvelope,
  calculateEnvelopeStats,
  isDocuSignConfigured,
  getEnvelopeViewUrl,
  getDocumentDownload,
  DocuSignEnvelope,
} from '@/lib/docusign';

export const dynamic = 'force-dynamic';

// Mock data for testing when DocuSign isn't configured
const MOCK_ENVELOPES: DocuSignEnvelope[] = [
  {
    envelopeId: 'env-001',
    status: 'completed',
    emailSubject: 'Project Acceptance - City of Phoenix Water Treatment',
    sentDateTime: '2025-12-15T10:00:00Z',
    completedDateTime: '2025-12-18T14:30:00Z',
    statusChangedDateTime: '2025-12-18T14:30:00Z',
    sender: { userName: 'John Smith', email: 'jsmith@marswater.com' },
  },
  {
    envelopeId: 'env-002',
    status: 'sent',
    emailSubject: 'Project Acceptance - Tucson MCC 2026',
    sentDateTime: '2026-01-02T09:00:00Z',
    statusChangedDateTime: '2026-01-02T09:00:00Z',
    sender: { userName: 'Sarah Johnson', email: 'sjohnson@marswater.com' },
  },
  {
    envelopeId: 'env-003',
    status: 'delivered',
    emailSubject: 'Project Acceptance - Seattle Water Authority',
    sentDateTime: '2026-01-03T11:00:00Z',
    deliveredDateTime: '2026-01-03T11:05:00Z',
    statusChangedDateTime: '2026-01-03T11:05:00Z',
    sender: { userName: 'Mike Williams', email: 'mwilliams@marswater.com' },
  },
  {
    envelopeId: 'env-004',
    status: 'completed',
    emailSubject: 'Project Acceptance - Denver Metro Water',
    sentDateTime: '2025-11-20T08:00:00Z',
    completedDateTime: '2025-11-22T16:00:00Z',
    statusChangedDateTime: '2025-11-22T16:00:00Z',
    sender: { userName: 'John Smith', email: 'jsmith@marswater.com' },
  },
  {
    envelopeId: 'env-005',
    status: 'declined',
    emailSubject: 'Project Acceptance - Portland Water Bureau',
    sentDateTime: '2025-12-10T14:00:00Z',
    declinedDateTime: '2025-12-12T09:00:00Z',
    statusChangedDateTime: '2025-12-12T09:00:00Z',
    sender: { userName: 'Sarah Johnson', email: 'sjohnson@marswater.com' },
  },
  {
    envelopeId: 'env-006',
    status: 'sent',
    emailSubject: 'Project Acceptance - Las Vegas Valley Water',
    sentDateTime: '2026-01-05T10:00:00Z',
    statusChangedDateTime: '2026-01-05T10:00:00Z',
    sender: { userName: 'Mike Williams', email: 'mwilliams@marswater.com' },
  },
  {
    envelopeId: 'env-007',
    status: 'completed',
    emailSubject: 'Project Acceptance - Sacramento Municipal',
    sentDateTime: '2025-12-01T09:00:00Z',
    completedDateTime: '2025-12-03T11:00:00Z',
    statusChangedDateTime: '2025-12-03T11:00:00Z',
    sender: { userName: 'John Smith', email: 'jsmith@marswater.com' },
  },
  {
    envelopeId: 'env-008',
    status: 'created',
    emailSubject: 'Project Acceptance - San Diego Water Authority',
    statusChangedDateTime: '2026-01-06T08:00:00Z',
    sender: { userName: 'Sarah Johnson', email: 'sjohnson@marswater.com' },
  },
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const useMock = searchParams.get('mock') === 'true';
    const status = searchParams.get('status');
    const fromDate = searchParams.get('fromDate');
    const toDate = searchParams.get('toDate');
    const search = searchParams.get('search');
    const envelopeId = searchParams.get('envelopeId');
    const action = searchParams.get('action');

    // Check if DocuSign is configured (JWT auth)
    const hasDocuSign = isDocuSignConfigured();

    // Handle action requests
    if (action === 'viewUrl' && envelopeId) {
      // Return the DocuSign web interface URL for viewing the envelope
      const viewUrl = getEnvelopeViewUrl(envelopeId);
      return NextResponse.json({ viewUrl, envelopeId });
    }

    if (action === 'download' && envelopeId) {
      // Download the combined PDF document
      if (!hasDocuSign) {
        return NextResponse.json({
          error: 'DocuSign not configured',
          message: 'Cannot download documents without DocuSign authentication',
        }, { status: 400 });
      }

      try {
        const pdfBuffer = await getDocumentDownload(envelopeId, 'combined');
        return new NextResponse(pdfBuffer, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="envelope-${envelopeId}.pdf"`,
          },
        });
      } catch (error) {
        console.error('Document download error:', error);
        return NextResponse.json({
          error: 'Failed to download document',
          message: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    // Get single envelope detail
    if (envelopeId && hasDocuSign && !useMock) {
      try {
        const envelope = await getEnvelope(envelopeId);
        return NextResponse.json({ envelope });
      } catch (error) {
        console.error('Error fetching envelope:', error);
        return NextResponse.json({
          error: 'Failed to fetch envelope',
          message: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
      }
    }

    let envelopes: DocuSignEnvelope[];
    let isLive = false;
    let authError: string | null = null;

    if (hasDocuSign && !useMock) {
      try {
        // Fetch from DocuSign API with JWT auth
        envelopes = await listEnvelopes({
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          status: status || undefined,
          searchText: search || undefined,
        });
        isLive = true;
      } catch (error) {
        console.error('DocuSign API error:', error);
        // Fall back to mock data on auth error
        authError = error instanceof Error ? error.message : 'Authentication failed';
        envelopes = [...MOCK_ENVELOPES];

        // Apply filters to mock data
        if (status) {
          envelopes = envelopes.filter(e => e.status === status);
        }
        if (search) {
          const searchLower = search.toLowerCase();
          envelopes = envelopes.filter(e =>
            e.emailSubject.toLowerCase().includes(searchLower)
          );
        }
      }
    } else {
      // Use mock data
      envelopes = [...MOCK_ENVELOPES];

      // Apply filters to mock data
      if (status) {
        envelopes = envelopes.filter(e => e.status === status);
      }
      if (search) {
        const searchLower = search.toLowerCase();
        envelopes = envelopes.filter(e =>
          e.emailSubject.toLowerCase().includes(searchLower)
        );
      }
    }

    // Sort by status changed date (most recent first)
    envelopes.sort((a, b) => {
      const dateA = new Date(a.statusChangedDateTime || 0);
      const dateB = new Date(b.statusChangedDateTime || 0);
      return dateB.getTime() - dateA.getTime();
    });

    // Calculate stats
    const stats = calculateEnvelopeStats(envelopes);

    // Group by status for summary
    const byStatus = {
      pending: envelopes.filter(e => ['sent', 'delivered', 'created'].includes(e.status)),
      completed: envelopes.filter(e => ['completed', 'signed'].includes(e.status)),
      declined: envelopes.filter(e => e.status === 'declined'),
      voided: envelopes.filter(e => e.status === 'voided'),
    };

    return NextResponse.json({
      envelopes,
      stats,
      byStatus,
      count: envelopes.length,
      isLive,
      authError,
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching DocuSign data:', error);
    return NextResponse.json({
      error: 'Failed to fetch DocuSign data',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
