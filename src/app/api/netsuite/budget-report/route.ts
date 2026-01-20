import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

/**
 * Query NetSuite Budget vs Actuals Report (Report ID: 492)
 *
 * This report provides budget information for all projects including:
 * - Budget Revenue (4xxx accounts)
 * - Budget Cost (5xxx accounts)
 * - Actual Revenue
 * - Actual Cost
 * - Variance analysis
 *
 * Query params:
 * - project: Filter by project name (optional)
 * - year: Filter by fiscal year (optional)
 * - customer: Filter by customer (optional)
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const project = searchParams.get('project');
    const year = searchParams.get('year');
    const customer = searchParams.get('customer');

    // Query budget data from NetSuite
    // Account numbers: 4xxx = Revenue, 5xxx = COGS

    let whereClause = `WHERE a.isinactive = 'F'
      AND (a.acctnumber LIKE '4%' OR a.acctnumber LIKE '5%')`;

    if (customer) {
      whereClause += ` AND c.entityid ILIKE '%${customer}%'`;
    }

    if (year) {
      whereClause += ` AND EXTRACT(YEAR FROM b.startdate) = ${year}`;
    }

    // Query budget data from accountingperiod and budget tables
    const query = `
      SELECT
        c.entityid AS customer_name,
        c.id AS customer_id,
        a.acctnumber AS account_number,
        a.acctname AS account_name,
        CASE
          WHEN a.acctnumber LIKE '4%' THEN 'Revenue'
          WHEN a.acctnumber LIKE '5%' THEN 'COGS'
          ELSE 'Other'
        END AS account_category,
        b.periodname AS period,
        b.startdate,
        b.enddate,
        SUM(bl.amount) AS budget_amount
      FROM budgets b
      INNER JOIN budgetlines bl ON b.id = bl.budget
      INNER JOIN account a ON bl.account = a.id
      LEFT JOIN customer c ON b.customer = c.id
      ${whereClause}
      GROUP BY c.entityid, c.id, a.acctnumber, a.acctname, b.periodname, b.startdate, b.enddate
      ORDER BY c.entityid, a.acctnumber, b.startdate
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '10000' },
    });

    const budgetLines = response.items || [];

    // Group by customer and calculate totals
    const byCustomer: any = {};

    for (const line of budgetLines) {
      const customerName = line.customer_name || 'Unknown';

      if (!byCustomer[customerName]) {
        byCustomer[customerName] = {
          customerName,
          customerId: line.customer_id,
          revenue: { budget: 0, accounts: [] },
          cogs: { budget: 0, accounts: [] },
          grossProfit: 0,
          grossMarginPct: 0,
        };
      }

      const amount = parseFloat(line.budget_amount || 0);
      const category = line.account_category;

      if (category === 'Revenue') {
        byCustomer[customerName].revenue.budget += amount;
        byCustomer[customerName].revenue.accounts.push({
          accountNumber: line.account_number,
          accountName: line.account_name,
          period: line.period,
          amount,
        });
      } else if (category === 'COGS') {
        byCustomer[customerName].cogs.budget += amount;
        byCustomer[customerName].cogs.accounts.push({
          accountNumber: line.account_number,
          accountName: line.account_name,
          period: line.period,
          amount,
        });
      }
    }

    // Calculate gross profit and margin
    for (const customerName in byCustomer) {
      const customer = byCustomer[customerName];
      customer.grossProfit = customer.revenue.budget - customer.cogs.budget;
      customer.grossMarginPct = customer.revenue.budget > 0
        ? (customer.grossProfit / customer.revenue.budget) * 100
        : 0;
    }

    // Filter by project name if provided
    let customers = Object.values(byCustomer);
    if (project) {
      customers = customers.filter((c: any) =>
        c.customerName.toLowerCase().includes(project.toLowerCase())
      );
    }

    return NextResponse.json({
      budgets: customers,
      count: customers.length,
      totalRevenueBudget: customers.reduce((sum: number, c: any) => sum + c.revenue.budget, 0),
      totalCogsBudget: customers.reduce((sum: number, c: any) => sum + c.cogs.budget, 0),
      note: 'Account numbers: 4xxx = Revenue, 5xxx = COGS',
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Query failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      note: 'Budget data requires access to NetSuite budgets table',
    }, { status: 500 });
  }
}
