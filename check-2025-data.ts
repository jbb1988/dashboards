// Quick script to check 2025 diversified sales data
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Read .env.local manually
const envFile = readFileSync('.env.local', 'utf-8');
const env: Record<string, string> = {};
for (const line of envFile.split('\n')) {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    env[key.trim()] = valueParts.join('=').trim();
  }
}

const supabase = createClient(
  env['NEXT_PUBLIC_SUPABASE_URL'],
  env['SUPABASE_SERVICE_ROLE_KEY']
);

async function check2025Data() {
  console.log('Checking 2025 diversified sales data...\n');

  // Get total count and revenue for 2025
  let totalRevenue = 0;
  let totalRecords = 0;
  let offset = 0;
  const batchSize = 1000;

  // Fetch by month to see monthly breakdown
  const monthlyTotals: Record<number, { revenue: number; count: number }> = {};

  while (true) {
    const { data, error } = await supabase
      .from('diversified_sales')
      .select('month, revenue')
      .eq('year', 2025)
      .range(offset, offset + batchSize - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }

    if (!data || data.length === 0) break;

    for (const row of data) {
      totalRevenue += row.revenue || 0;
      totalRecords++;

      if (!monthlyTotals[row.month]) {
        monthlyTotals[row.month] = { revenue: 0, count: 0 };
      }
      monthlyTotals[row.month].revenue += row.revenue || 0;
      monthlyTotals[row.month].count++;
    }

    offset += batchSize;
    if (data.length < batchSize) break;
  }

  console.log(`Total 2025 Records: ${totalRecords}`);
  console.log(`Total 2025 Revenue: $${totalRevenue.toLocaleString()}`);
  console.log(`\nMonthly Breakdown:`);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  for (let m = 1; m <= 12; m++) {
    const data = monthlyTotals[m] || { revenue: 0, count: 0 };
    console.log(`  ${months[m-1]}: $${data.revenue.toLocaleString()} (${data.count} records)`);
  }

  // Also check budget
  const { data: budgetData } = await supabase
    .from('diversified_budgets')
    .select('month, budget_revenue')
    .eq('year', 2025);

  const budgetByMonth: Record<number, number> = {};
  let totalBudget = 0;

  if (budgetData) {
    for (const row of budgetData) {
      if (!budgetByMonth[row.month]) budgetByMonth[row.month] = 0;
      budgetByMonth[row.month] += row.budget_revenue || 0;
      totalBudget += row.budget_revenue || 0;
    }
  }

  console.log(`\nTotal 2025 Budget: $${totalBudget.toLocaleString()}`);
  console.log(`\nVariance: $${(totalRevenue - totalBudget).toLocaleString()} (${(((totalRevenue - totalBudget) / totalBudget) * 100).toFixed(1)}%)`);
}

check2025Data().catch(console.error);
