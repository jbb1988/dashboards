import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

interface DiscoveryResult {
  classes: Array<{
    id: string;
    name: string;
    fullname: string;
    parent: string;
    parent_name: string;
  }>;
  revenueAccounts: Array<{
    id: string;
    acctnumber: string;
    fullname: string;
    accttype: string;
  }>;
  cogsAccounts: Array<{
    id: string;
    acctnumber: string;
    fullname: string;
    accttype: string;
  }>;
  sampleTransactions: Array<{
    transaction_id: string;
    tranid: string;
    trandate: string;
    tran_type: string;
    customer_name: string;
    class_id: string;
    class_name: string;
    account_number: string;
    account_name: string;
    net_amount: number;
    line_amount: number;
    debit_amt: number;
    credit_amt: number;
  }>;
}

export async function GET() {
  try {
    const results: DiscoveryResult = {
      classes: [],
      revenueAccounts: [],
      cogsAccounts: [],
      sampleTransactions: [],
    };

    // Query 1: Find ALL classes (to discover naming patterns)
    console.log('Discovering all classes...');
    const classQuery = `
      SELECT
        c.id,
        c.name,
        c.fullname,
        c.parent,
        BUILTIN.DF(c.parent) AS parent_name
      FROM Classification c
      ORDER BY c.fullname
    `;

    const classResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: classQuery },
        params: { limit: '200' },
      }
    );

    results.classes = (classResult.items || []).map(row => ({
      id: row.id?.toString() || '',
      name: row.name || '',
      fullname: row.fullname || '',
      parent: row.parent?.toString() || '',
      parent_name: row.parent_name || '',
    }));
    console.log(`Found ${results.classes.length} TB/MCC classes`);

    // Query 2: Find revenue accounts (4xxx accounts)
    console.log('Discovering revenue accounts...');
    const revenueQuery = `
      SELECT a.id, a.acctnumber, a.fullname, a.accttype
      FROM Account a
      WHERE a.acctnumber LIKE '4%'
        AND a.accttype = 'Income'
      ORDER BY a.acctnumber
    `;

    const revenueResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: revenueQuery },
        params: { limit: '200' },
      }
    );

    results.revenueAccounts = (revenueResult.items || []).map(row => ({
      id: row.id?.toString() || '',
      acctnumber: row.acctnumber || '',
      fullname: row.fullname || '',
      accttype: row.accttype || '',
    }));
    console.log(`Found ${results.revenueAccounts.length} revenue accounts`);

    // Query 3: Find COGS accounts (5xxx accounts)
    console.log('Discovering COGS accounts...');
    const cogsQuery = `
      SELECT a.id, a.acctnumber, a.fullname, a.accttype
      FROM Account a
      WHERE a.acctnumber LIKE '5%'
        AND a.accttype IN ('Cost of Goods Sold', 'COGS', 'Expense')
      ORDER BY a.acctnumber
    `;

    const cogsResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: cogsQuery },
        params: { limit: '200' },
      }
    );

    results.cogsAccounts = (cogsResult.items || []).map(row => ({
      id: row.id?.toString() || '',
      acctnumber: row.acctnumber || '',
      fullname: row.fullname || '',
      accttype: row.accttype || '',
    }));
    console.log(`Found ${results.cogsAccounts.length} COGS accounts`);

    // Query 4: Sample transactions - look at 5xxx account transactions with ANY amount
    console.log('Fetching sample COGS transactions...');
    const sampleQuery = `
      SELECT
        t.id AS transaction_id,
        t.tranid,
        t.trandate,
        t.type AS tran_type,
        BUILTIN.DF(t.entity) AS customer_name,
        tl.class AS class_id,
        BUILTIN.DF(tl.class) AS class_name,
        a.acctnumber AS account_number,
        a.fullname AS account_name,
        tl.netamount AS net_amount,
        tl.amount AS line_amount,
        tl.debitforeignamount AS debit_amt,
        tl.creditforeignamount AS credit_amt
      FROM Transaction t
      INNER JOIN TransactionLine tl ON tl.transaction = t.id
      LEFT JOIN Account a ON a.id = tl.account
      WHERE a.acctnumber LIKE '5%'
        AND (tl.netamount IS NOT NULL OR tl.amount IS NOT NULL)
      ORDER BY t.trandate DESC
    `;

    const sampleResult = await netsuiteRequest<{ items: any[] }>(
      '/services/rest/query/v1/suiteql',
      {
        method: 'POST',
        body: { q: sampleQuery },
        params: { limit: '100' },
      }
    );

    results.sampleTransactions = (sampleResult.items || []).map(row => ({
      transaction_id: row.transaction_id?.toString() || '',
      tranid: row.tranid || '',
      trandate: row.trandate || '',
      tran_type: row.tran_type || '',
      customer_name: row.customer_name || '',
      class_id: row.class_id?.toString() || '',
      class_name: row.class_name || '',
      account_number: row.account_number || '',
      account_name: row.account_name || '',
      net_amount: parseFloat(row.net_amount) || 0,
      line_amount: parseFloat(row.line_amount) || 0,
      debit_amt: parseFloat(row.debit_amt) || 0,
      credit_amt: parseFloat(row.credit_amt) || 0,
    }));
    console.log(`Found ${results.sampleTransactions.length} sample transactions`);

    // Generate summary statistics
    const summary = {
      totalClasses: results.classes.length,
      totalRevenueAccounts: results.revenueAccounts.length,
      totalCogsAccounts: results.cogsAccounts.length,
      totalSampleTransactions: results.sampleTransactions.length,
      uniqueClassesInTransactions: [...new Set(results.sampleTransactions.map(t => t.class_name))],
      uniqueAccountsInTransactions: [...new Set(results.sampleTransactions.map(t => t.account_number))].sort(),
    };

    return NextResponse.json({
      success: true,
      ...results,
      summary,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Discovery error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
