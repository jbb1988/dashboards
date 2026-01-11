import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

// Debug endpoint to find where COGS data lives in NetSuite for Test Bench projects
export async function GET() {
  try {
    const results: Record<string, any> = {};

    // Query 1: Try TransactionAccountingLine for GL entries
    console.log('Query 1: TransactionAccountingLine for COGS accounts...');
    const q1 = `
      SELECT
        tal.account,
        a.acctnumber,
        a.fullname AS account_name,
        SUM(tal.amount) AS total_amount,
        SUM(tal.debit) AS total_debit,
        SUM(tal.credit) AS total_credit
      FROM TransactionAccountingLine tal
      INNER JOIN Transaction t ON t.id = tal.transaction
      INNER JOIN Account a ON a.id = tal.account
      WHERE a.acctnumber LIKE '5%'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      GROUP BY tal.account, a.acctnumber, a.fullname
      ORDER BY total_debit DESC
    `;

    const r1 = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: q1 }, params: { limit: '100' } }
    );
    results.accountingLines = r1.items || [];

    // Query 2: Sample TransactionAccountingLine entries for 5011
    console.log('Query 2: Sample accounting lines for 5011...');
    const q2 = `
      SELECT
        t.tranid,
        t.type,
        t.trandate,
        BUILTIN.DF(t.entity) AS entity_name,
        tal.amount,
        tal.debit,
        tal.credit
      FROM TransactionAccountingLine tal
      INNER JOIN Transaction t ON t.id = tal.transaction
      INNER JOIN Account a ON a.id = tal.account
      WHERE a.acctnumber = '5011'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      ORDER BY t.trandate DESC
    `;

    const r2 = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: q2 }, params: { limit: '50' } }
    );
    results.account5011Accounting = r2.items || [];

    // Query 3: Try using the AccountingPeriod table for totals
    console.log('Query 3: All transaction types for COGS...');
    const q3 = `
      SELECT
        t.type,
        a.acctnumber,
        COUNT(*) AS trans_count
      FROM Transaction t
      INNER JOIN TransactionAccountingLine tal ON tal.transaction = t.id
      INNER JOIN Account a ON a.id = tal.account
      WHERE a.acctnumber LIKE '5%'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      GROUP BY t.type, a.acctnumber
      ORDER BY a.acctnumber
    `;

    const r3 = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: q3 }, params: { limit: '100' } }
    );
    results.transactionTypes = r3.items || [];

    // Query 4: Sample TransactionAccountingLine entries for 5100 (MCC)
    console.log('Query 4: Sample accounting lines for 5100...');
    const q4 = `
      SELECT
        t.tranid,
        t.type,
        t.trandate,
        BUILTIN.DF(t.entity) AS entity_name,
        tal.amount,
        tal.debit,
        tal.credit
      FROM TransactionAccountingLine tal
      INNER JOIN Transaction t ON t.id = tal.transaction
      INNER JOIN Account a ON a.id = tal.account
      WHERE a.acctnumber = '5100'
        AND t.trandate >= TO_DATE('01/01/2025', 'MM/DD/YYYY')
      ORDER BY t.trandate DESC
    `;

    const r4 = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      { method: 'POST', body: { q: q4 }, params: { limit: '50' } }
    );
    results.account5100Accounting = r4.items || [];

    // Summarize
    const uniqueAccounts = [...new Set((results.accountingLines || []).map((t: any) => t.acctnumber))];
    const totalDebit = (results.accountingLines || []).reduce((sum: number, a: any) => sum + (parseFloat(a.total_debit) || 0), 0);

    return NextResponse.json({
      success: true,
      results,
      summary: {
        cogsAccountsWithAccountingLines: uniqueAccounts.length,
        uniqueAccounts,
        totalCogsDebit: totalDebit,
        account5011Count: results.account5011Accounting?.length || 0,
        account5100Count: results.account5100Accounting?.length || 0,
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Debug COGS error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
