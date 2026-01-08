import { NextRequest, NextResponse } from 'next/server';
import { listTasks } from '@/lib/asana';
import { listEnvelopes, isDocuSignConfigured, DocuSignEnvelope } from '@/lib/docusign';
import {
  matchProjectsWithAcceptance,
  calculateComplianceStats,
  sortByPriority,
  ProjectAcceptanceStatus,
  AcceptanceComplianceStats,
} from '@/lib/project-acceptance';

export const dynamic = 'force-dynamic';

// Project IDs from environment
const MASTER_TIMELINE_PROJECT_ID = process.env.ASANA_MASTER_TIMELINE_PROJECT_ID || '';
const MCC_PROJECT_ID = process.env.ASANA_MCC_PROJECT_ID || '';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filterMissing = searchParams.get('filterMissing') === 'true';
    const filterOverdue = searchParams.get('filterOverdue') === 'true';

    // Fetch data from both sources in parallel
    const [asanaTasks, docusignEnvelopes] = await Promise.all([
      // Fetch from Master Timeline project
      listTasks(MASTER_TIMELINE_PROJECT_ID),
      // Fetch all envelopes from DocuSign
      isDocuSignConfigured()
        ? listEnvelopes({ count: 200 }) // Get more to ensure we catch all
        : Promise.resolve([] as DocuSignEnvelope[]),
    ]);

    // Match projects with acceptance documents
    let statuses = matchProjectsWithAcceptance(asanaTasks, docusignEnvelopes, {
      mccProjectId: MCC_PROJECT_ID,
      overdueThresholdDays: 7,
    });

    // Apply filters
    if (filterMissing) {
      statuses = statuses.filter(s => !s.acceptanceSent);
    }
    if (filterOverdue) {
      statuses = statuses.filter(s => s.isOverdue);
    }

    // Sort by priority (overdue and missing first)
    statuses = sortByPriority(statuses);

    // Calculate compliance stats
    const stats = calculateComplianceStats(
      matchProjectsWithAcceptance(asanaTasks, docusignEnvelopes, {
        mccProjectId: MCC_PROJECT_ID,
      })
    );

    return NextResponse.json({
      statuses,
      stats,
      count: statuses.length,
      totalProjects: asanaTasks.length,
      totalEnvelopes: docusignEnvelopes.length,
      hasDocuSign: isDocuSignConfigured(),
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error fetching project acceptance data:', error);
    return NextResponse.json({
      error: 'Failed to fetch project acceptance data',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
