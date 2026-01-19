import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get basic WO fields
    const query = `
      SELECT
        wo.id,
        wo.tranid,
        wo.trandate,
        wo.status,
        wo.total
      FROM transaction wo
      WHERE wo.tranid IN ('WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583')
      ORDER BY wo.tranid
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '100' },
    });

    const wos = response.items || [];

    // Now check transaction accounting lines for actual GL postings
    const accountingQuery = `
      SELECT
        tl.transaction,
        wo.tranid AS wo_number,
        tl.account,
        BUILTIN.DF(tl.account) AS account_name,
        SUM(ABS(tl.debit)) AS debit,
        SUM(ABS(tl.credit)) AS credit,
        SUM(ABS(tl.amount)) AS net_amount
      FROM transactionaccountingline tl
      INNER JOIN transaction wo ON tl.transaction = wo.id
      WHERE wo.tranid IN ('WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583')
      GROUP BY tl.transaction, wo.tranid, tl.account, BUILTIN.DF(tl.account)
      ORDER BY wo.tranid, tl.account
    `;

    const accountingResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: accountingQuery },
      params: { limit: '1000' },
    });

    const accountingLines = accountingResponse.items || [];

    // Group by WO
    const byWO: any = {};
    for (const line of accountingLines) {
      if (!byWO[line.wo_number]) {
        byWO[line.wo_number] = {
          wo_number: line.wo_number,
          accounts: [],
          totalDebit: 0,
          totalCredit: 0,
        };
      }
      byWO[line.wo_number].accounts.push({
        account: line.account,
        account_name: line.account_name,
        debit: parseFloat(line.DEBIT || 0),
        credit: parseFloat(line.CREDIT || 0),
        net: parseFloat(line.NET_AMOUNT || 0),
      });
      byWO[line.wo_number].totalDebit += parseFloat(line.DEBIT || 0);
      byWO[line.wo_number].totalCredit += parseFloat(line.CREDIT || 0);
    }

    return NextResponse.json({
      workOrders: wos,
      accountingByWO: Object.values(byWO),
      totalAccountingLines: accountingLines.length,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
