import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Search for MCC and deferred revenue accounts
    const query = `
      SELECT
        a.acctnumber,
        a.acctname
      FROM account a
      WHERE a.isinactive = 'F'
        AND a.acctnumber LIKE '41%'
        AND (
          LOWER(a.acctname) LIKE '%deferred%'
          OR LOWER(a.acctname) LIKE '%contract%'
        )
        AND (
          LOWER(a.acctname) LIKE '%mcc%'
          OR LOWER(a.acctname) LIKE '%maintenance%'
          OR LOWER(a.acctname) LIKE '%calibration%'
        )
      ORDER BY a.acctnumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '50' },
    });

    // Also get all 41xx accounts for reference
    const allQuery = `
      SELECT
        a.acctnumber,
        a.acctname
      FROM account a
      WHERE a.isinactive = 'F'
        AND (a.acctnumber LIKE '41%' OR a.acctnumber LIKE '51%')
      ORDER BY a.acctnumber
    `;

    const allResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: allQuery },
      params: { limit: '100' },
    });

    return NextResponse.json({
      deferredMCC: response.items || [],
      all41xxAccounts: allResponse.items || [],
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
