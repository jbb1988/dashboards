import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Query all GL accounts from NetSuite
    const query = `
      SELECT
        a.id,
        a.acctnumber,
        a.acctname,
        a.accttype,
        a.description,
        a.parent,
        BUILTIN.DF(a.parent) AS parent_name,
        a.isinactive
      FROM account a
      WHERE a.isinactive = 'F'
        AND a.acctnumber IS NOT NULL
      ORDER BY a.acctnumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '1000' },
    });

    const accounts = response.items || [];

    // Group by account number prefix to understand the structure
    const byPrefix = accounts.reduce((acc, acct) => {
      const num = acct.acctnumber || '';
      const prefix = num.substring(0, 2);
      if (!acc[prefix]) {
        acc[prefix] = [];
      }
      acc[prefix].push({
        number: acct.acctnumber,
        name: acct.acctname,
        type: acct.accttype,
        parent: acct.parent_name,
      });
      return acc;
    }, {} as any);

    // Find all 4xxx and 5xxx accounts (revenue accounts)
    const revenueAccounts = accounts.filter(a => {
      const num = a.acctnumber || '';
      return num.startsWith('4') || num.startsWith('5');
    });

    // Look for MCC deferred revenue accounts
    const mccAccounts = revenueAccounts.filter(a => {
      const name = (a.acctname || '').toLowerCase();
      return name.includes('mcc') || name.includes('maintenance') || name.includes('calibration');
    });

    // Look for deferred revenue accounts
    const deferredAccounts = revenueAccounts.filter(a => {
      const name = (a.acctname || '').toLowerCase();
      return name.includes('deferred') || name.includes('contract');
    });

    return NextResponse.json({
      total: accounts.length,
      revenueAccountCount: revenueAccounts.length,
      byPrefix,
      mccAccounts,
      deferredAccounts,
      sample40x: accounts.filter(a => a.acctnumber?.startsWith('40')).slice(0, 20),
      sample41x: accounts.filter(a => a.acctnumber?.startsWith('41')).slice(0, 20),
      sample50x: accounts.filter(a => a.acctnumber?.startsWith('50')).slice(0, 20),
      sample51x: accounts.filter(a => a.acctnumber?.startsWith('51')).slice(0, 20),
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
