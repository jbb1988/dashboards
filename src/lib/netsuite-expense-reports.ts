/**
 * NetSuite Expense Report Functions
 * Handles fetching expense reports and their line items from NetSuite
 */

import { netsuiteRequest } from './netsuite';

export interface ExpenseReportRecord {
  id: string;
  tranid: string;
  trandate: string;
  posting_period?: string;
  status?: string;
  memo?: string;
  employee_id?: string;
  employee_name?: string;
  customer_id?: string;
  customer_name?: string;
  class_id?: string;
  class_name?: string;
  total_amount?: number;
  subsidiary_id?: string;
  subsidiary_name?: string;
  location_id?: string;
  location_name?: string;
}

export interface ExpenseReportLineRecord {
  expense_report_id: string;
  line_id: string;
  line_number?: number;
  expense_date?: string;
  category?: string;
  expense_account?: string;
  expense_account_name?: string;
  item_id?: string;
  item_name?: string;
  memo?: string;
  amount?: number;
  customer_id?: string;
  customer_name?: string;
  class_id?: string;
  class_name?: string;
}

export async function getAllExpenseReports(options?: {
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
  customerId?: string;
  limit?: number;
}): Promise<{ headers: ExpenseReportRecord[]; linesByReportId: Record<string, ExpenseReportLineRecord[]> }> {
  const { limit = 5000 } = options || {};
  const PAGE_SIZE = 1000; // NetSuite max per request

  // Build date filter
  let dateFilter = '';
  if (options?.startDate) {
    const [y, m, d] = options.startDate.split('-');
    dateFilter += ` AND er.trandate >= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }
  if (options?.endDate) {
    const [y, m, d] = options.endDate.split('-');
    dateFilter += ` AND er.trandate <= TO_DATE('${m}/${d}/${y}', 'MM/DD/YYYY')`;
  }

  // Build customer filter
  let customerFilter = '';
  if (options?.customerId) {
    customerFilter = ` AND er.entity = '${options.customerId}'`;
  }

  const headerQuery = `
    SELECT
      er.id,
      er.tranid,
      er.trandate,
      BUILTIN.DF(er.postingperiod) AS posting_period,
      er.status,
      er.memo,
      er.employee,
      BUILTIN.DF(er.employee) AS employee_name,
      er.entity AS customer_id,
      BUILTIN.DF(er.entity) AS customer_name,
      er.class AS class_id,
      BUILTIN.DF(er.class) AS class_name,
      er.total,
      er.subsidiary,
      BUILTIN.DF(er.subsidiary) AS subsidiary_name,
      er.location,
      BUILTIN.DF(er.location) AS location_name
    FROM transaction er
    WHERE er.type = 'ExpRept'
      ${dateFilter}
      ${customerFilter}
    ORDER BY er.trandate DESC, er.id DESC
  `;

  try {
    console.log(`Fetching expense reports (limit: ${limit})...`);
    console.log(`Date range: ${options?.startDate || 'all'} to ${options?.endDate || 'all'}`);

    // Paginate through results
    let allHeaders: any[] = [];
    let offset = 0;

    while (allHeaders.length < limit) {
      const params = {
        limit: Math.min(PAGE_SIZE, limit - allHeaders.length).toString(),
        offset: offset.toString(),
      };

      const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
        method: 'POST',
        body: { q: headerQuery },
        params,
      });

      if (!response.items || response.items.length === 0) break;

      allHeaders = allHeaders.concat(response.items);
      offset += response.items.length;

      if (response.items.length < PAGE_SIZE) break;
    }

    console.log(`Found ${allHeaders.length} expense reports`);

    const headers: ExpenseReportRecord[] = allHeaders.map(row => ({
      id: row.id,
      tranid: row.tranid,
      trandate: row.trandate,
      posting_period: row.posting_period,
      status: row.status,
      memo: row.memo,
      employee_id: row.employee,
      employee_name: row.employee_name,
      customer_id: row.customer_id,
      customer_name: row.customer_name,
      class_id: row.class_id,
      class_name: row.class_name,
      total_amount: parseFloat(row.total) || 0,
      subsidiary_id: row.subsidiary,
      subsidiary_name: row.subsidiary_name,
      location_id: row.location,
      location_name: row.location_name,
    }));

    // Fetch line items if we have expense reports
    const linesByReportId: Record<string, ExpenseReportLineRecord[]> = {};

    if (headers.length > 0) {
      const reportIds = headers.map(h => h.id);

      // Query in batches of 100
      for (let i = 0; i < reportIds.length; i += 100) {
        const batch = reportIds.slice(i, i + 100);
        const idsString = batch.join(',');

        const linesQuery = `
          SELECT
            tl.transaction AS expense_report_id,
            tl.id AS line_id,
            tl.linesequencenumber,
            tl.expensedate,
            tl.category,
            tl.account,
            BUILTIN.DF(tl.account) AS account_name,
            tl.item,
            BUILTIN.DF(tl.item) AS item_name,
            tl.memo,
            tl.amount,
            tl.entity AS customer_id,
            BUILTIN.DF(tl.entity) AS customer_name,
            tl.class AS class_id,
            BUILTIN.DF(tl.class) AS class_name
          FROM transactionline tl
          WHERE tl.transaction IN (${idsString})
            AND tl.mainline = 'F'
          ORDER BY tl.transaction, tl.linesequencenumber
        `;

        let linesOffset = 0;
        let allLines: any[] = [];

        while (true) {
          const linesParams = {
            limit: PAGE_SIZE.toString(),
            offset: linesOffset.toString(),
          };

          const linesResponse = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
            method: 'POST',
            body: { q: linesQuery },
            params: linesParams,
          });

          if (!linesResponse.items || linesResponse.items.length === 0) break;

          allLines = allLines.concat(linesResponse.items);
          linesOffset += linesResponse.items.length;

          if (linesResponse.items.length < PAGE_SIZE) break;
        }

        // Group lines by expense report
        for (const row of allLines) {
          const reportId = row.expense_report_id;
          if (!linesByReportId[reportId]) {
            linesByReportId[reportId] = [];
          }

          linesByReportId[reportId].push({
            expense_report_id: reportId,
            line_id: row.line_id,
            line_number: row.linesequencenumber,
            expense_date: row.expensedate,
            category: row.category,
            expense_account: row.account,
            expense_account_name: row.account_name,
            item_id: row.item,
            item_name: row.item_name,
            memo: row.memo,
            amount: parseFloat(row.amount) || 0,
            customer_id: row.customer_id,
            customer_name: row.customer_name,
            class_id: row.class_id,
            class_name: row.class_name,
          });
        }
      }

      const totalLines = Object.values(linesByReportId).reduce((sum, lines) => sum + lines.length, 0);
      console.log(`Fetched ${totalLines} expense line items`);
    }

    return { headers, linesByReportId };
  } catch (error) {
    console.error('Error fetching expense reports:', error);
    throw error;
  }
}
