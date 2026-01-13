import { NextResponse } from 'next/server';
import { salesforceQuery } from '@/lib/salesforce';

/**
 * Debug endpoint: Query ALL Fairfax opportunities from Salesforce
 * No filters - shows what's being excluded by sync
 */
export async function GET() {
  try {
    console.log('\n🔍 Querying ALL Fairfax opportunities from Salesforce (no filters)...\n');

    const soql = `
      SELECT
        Id,
        Name,
        Account.Name,
        Amount,
        StageName,
        CloseDate,
        IsClosed,
        IsWon,
        CreatedDate,
        LastModifiedDate
      FROM Opportunity
      WHERE (Name LIKE '%Fairfax%' OR Account.Name LIKE '%Fairfax%')
      ORDER BY CloseDate DESC
    `;

    const result = await salesforceQuery(soql);

    // Group by sync eligibility
    const eligible: any[] = [];
    const pastCloseDate: any[] = [];
    const futureCloseDate: any[] = [];
    const closedOpps: any[] = [];
    const closedLost: any[] = [];

    for (const opp of result.records) {
      const closeDate = opp.CloseDate ? new Date(opp.CloseDate) : null;
      const today = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setDate(today.getDate() + 365);

      // Check sync criteria
      const isClosed = opp.IsClosed;
      const isClosedLost = opp.StageName === 'Closed Lost';
      const isPastClose = closeDate && closeDate < today;
      const isFarFutureClose = closeDate && closeDate > oneYearFromNow;

      const oppData = {
        id: opp.Id,
        name: opp.Name,
        accountName: opp.Account?.Name,
        stage: opp.StageName,
        closeDate: opp.CloseDate,
        amount: opp.Amount,
        isClosed: opp.IsClosed,
        isWon: opp.IsWon,
      };

      if (isClosed) {
        closedOpps.push(oppData);
      } else if (isClosedLost) {
        closedLost.push(oppData);
      } else if (isPastClose) {
        pastCloseDate.push(oppData);
      } else if (isFarFutureClose) {
        futureCloseDate.push(oppData);
      } else {
        eligible.push(oppData);
      }
    }

    return NextResponse.json({
      success: true,
      totalFound: result.totalSize,
      breakdown: {
        eligible: {
          count: eligible.length,
          opportunities: eligible,
        },
        excludedPastClose: {
          count: pastCloseDate.length,
          opportunities: pastCloseDate,
          reason: 'CloseDate < TODAY',
        },
        excludedFarFuture: {
          count: futureCloseDate.length,
          opportunities: futureCloseDate,
          reason: 'CloseDate > 365 days from now',
        },
        excludedClosed: {
          count: closedOpps.length,
          opportunities: closedOpps,
          reason: 'IsClosed = true',
        },
        excludedClosedLost: {
          count: closedLost.length,
          opportunities: closedLost,
          reason: 'StageName = "Closed Lost"',
        },
      },
      syncFilters: {
        description: 'Filters applied by /api/contracts/sync',
        location: '/src/lib/salesforce.ts lines 234-242',
        filters: [
          'CloseDate >= TODAY (excludes past dates)',
          'CloseDate <= NEXT_N_DAYS:365 (excludes far future)',
          'IsClosed = false (excludes closed opportunities)',
          'StageName != "Closed Lost" (excludes lost deals)',
        ],
      },
    });

  } catch (error) {
    console.error('❌ Error querying Salesforce:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
