import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check for time entries linked to Seattle WOs
    const woNumbers = ['WO5967', 'WO5968', 'WO5969', 'WO5970', 'WO5971', 'WO5973', 'WO5974', 'WO6583'];

    // First get the WO IDs
    const woQuery = `
      SELECT id, tranid
      FROM transaction
      WHERE tranid IN (${woNumbers.map(w => `'${w}'`).join(',')})
    `;

    const woResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: woQuery },
      params: { limit: '100' },
    });

    const woIds = (woResponse.items || []).map(wo => wo.id);

    if (woIds.length === 0) {
      return NextResponse.json({ message: 'No WOs found', woNumbers });
    }

    // Check for time entries
    const timeQuery = `
      SELECT
        te.id,
        te.trandate,
        te.hours,
        te.rate,
        te.amount,
        te.employee,
        BUILTIN.DF(te.employee) AS employee_name,
        te.customer,
        BUILTIN.DF(te.customer) AS customer_name,
        te.item,
        BUILTIN.DF(te.item) AS item_name,
        te.memo
      FROM timebill te
      WHERE te.customer = '2153'
      ORDER BY te.trandate DESC
    `;

    const timeResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: timeQuery },
      params: { limit: '500' },
    });

    const timeEntries = timeResponse.items || [];
    const totalHours = timeEntries.reduce((sum, te) => sum + parseFloat(te.hours || 0), 0);
    const totalAmount = timeEntries.reduce((sum, te) => sum + parseFloat(te.amount || 0), 0);

    return NextResponse.json({
      woIds,
      woCount: woIds.length,
      timeEntries,
      timeEntryCount: timeEntries.length,
      totalHours,
      totalAmount,
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
