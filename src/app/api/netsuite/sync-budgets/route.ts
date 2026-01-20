import { NextResponse } from 'next/server';
import { netsuiteRequest } from '@/lib/netsuite';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

/**
 * Sync budget data from NetSuite Budget vs Actuals report
 *
 * This syncs budget revenue and cost data for all projects/customers
 * to be used in profitability dashboard calculations
 */
export async function POST() {
  try {
    // Try to query budget data from NetSuite
    // The Budget vs Actuals report (cr=492) likely queries from these tables

    const query = `
      SELECT
        c.entityid AS customer_name,
        c.id AS customer_id,
        a.acctnumber AS account_number,
        a.acctname AS account_name,
        EXTRACT(YEAR FROM t.trandate) AS fiscal_year,
        SUM(CASE WHEN tl.amount > 0 THEN tl.amount ELSE 0 END) AS actual_amount,
        -- Budget data would come from budget tables if accessible
        0 AS budget_amount
      FROM transaction t
      INNER JOIN transactionline tl ON t.id = tl.transaction
      INNER JOIN account a ON tl.account = a.id
      LEFT JOIN customer c ON t.entity = c.id
      WHERE a.isinactive = 'F'
        AND (a.acctnumber LIKE '4%' OR a.acctnumber LIKE '5%')
        AND t.trandate >= '2025-01-01'
        AND c.id IS NOT NULL
      GROUP BY c.entityid, c.id, a.acctnumber, a.acctname, EXTRACT(YEAR FROM t.trandate)
      ORDER BY c.entityid, fiscal_year, a.acctnumber
    `;

    const response = await netsuiteRequest<{ items: any[] }>('/services/rest/query/v1/suiteql', {
      method: 'POST',
      body: { q: query },
      params: { limit: '10000' },
    });

    const results = response.items || [];

    // Group by customer and year to create project budgets
    const projectBudgets: any = {};

    for (const line of results) {
      const key = `${line.customer_name}_${line.fiscal_year}`;

      if (!projectBudgets[key]) {
        projectBudgets[key] = {
          project_name: line.customer_name,
          project_year: parseInt(line.fiscal_year),
          customer_id: line.customer_id,
          budget_revenue: 0,
          budget_cost: 0,
          actual_revenue: 0,
          actual_cost: 0,
        };
      }

      const amount = parseFloat(line.actual_amount || 0);
      const accountNumber = line.account_number || '';

      // 4xxx = Revenue, 5xxx = COGS
      if (accountNumber.startsWith('4')) {
        projectBudgets[key].actual_revenue += amount;
        projectBudgets[key].budget_revenue += parseFloat(line.budget_amount || 0);
      } else if (accountNumber.startsWith('5')) {
        projectBudgets[key].actual_cost += amount;
        projectBudgets[key].budget_cost += parseFloat(line.budget_amount || 0);
      }
    }

    const budgets = Object.values(projectBudgets);

    // TODO: Store in a new table netsuite_project_budgets
    // For now, return the data structure

    return NextResponse.json({
      success: true,
      budgets,
      count: budgets.length,
      note: 'Budget data structure ready. Need to create table to store this data.',
      nextSteps: [
        'Create netsuite_project_budgets table in Supabase',
        'Store budget_revenue and budget_cost for each project/year',
        'Use this data in profitability dashboard KPIs',
      ],
    });
  } catch (error) {
    return NextResponse.json({
      error: 'Sync failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
