/**
 * Diagnose Denton MCC profitability issue - now with line_memo filtering
 *
 * Run with: npx tsx scripts/diagnose-denton.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('\n=== DENTON MCC PROFITABILITY DIAGNOSIS (with line_memo) ===\n');

  // Get all Denton MCC projects
  const { data: projects } = await supabase
    .from('closeout_projects')
    .select('id, project_name, project_type, project_year, project_month, budget_revenue, actual_revenue')
    .ilike('project_name', '%Denton%')
    .eq('project_type', 'MCC')
    .order('project_year', { ascending: false })
    .order('project_month', { ascending: false });

  console.log('Denton MCC Projects:');
  for (const p of projects || []) {
    console.log(`  ${p.project_year}-${p.project_month}: Budget $${p.budget_revenue}, Actual $${p.actual_revenue}`);
  }

  // Check WOs for each project
  console.log('\n--- Checking each engagement with NEW filtering ---\n');

  for (const project of projects || []) {
    const year = project.project_year;
    const label = `Denton MCC ${project.project_year}-${project.project_month}`;
    console.log(`\n${label}:`);
    console.log(`  Expected Revenue: $${project.budget_revenue}`);

    // Get WOs
    const { data: wos } = await supabase
      .from('closeout_work_orders')
      .select('wo_number')
      .eq('closeout_project_id', project.id);

    const woNumbers = (wos || []).map(w => `WO${w.wo_number}`);
    console.log(`  WOs: ${woNumbers.join(', ') || '(none)'}`);

    if (woNumbers.length === 0) continue;

    // Get NetSuite WO data
    const { data: nsWOs } = await supabase
      .from('netsuite_work_orders')
      .select('wo_number, created_from_so_number')
      .in('wo_number', woNumbers);

    const soNumbers = new Set<string>();
    for (const wo of nsWOs || []) {
      if (wo.created_from_so_number) {
        soNumbers.add(wo.created_from_so_number);
      }
    }

    console.log(`  Linked SOs: ${Array.from(soNumbers).join(', ') || '(none)'}`);

    // Check SO line items with NEW contract year filtering
    for (const soNum of soNumbers) {
      const { data: so } = await supabase
        .from('netsuite_sales_orders')
        .select('id')
        .eq('so_number', soNum)
        .single();

      if (!so) {
        console.log(`  ${soNum}: NOT IN DATABASE`);
        continue;
      }

      const { data: lines } = await supabase
        .from('netsuite_sales_order_lines')
        .select('item_id, item_name, amount, account_number, line_memo, revrecstartdate')
        .eq('sales_order_id', so.id)
        .like('account_number', '410%')
        .order('amount');

      let matchedByYear = 0;
      let matchedRevenue = 0;
      let totalLines = lines?.length || 0;

      console.log(`\n  ${soNum} MCC Lines (${totalLines}) - filtering for year ${year}:`);
      for (const line of lines || []) {
        const amt = parseFloat(line.amount as any) || 0;
        const memo = line.line_memo || '';

        // NEW: Check if line_memo contains "Contracted YYYY" matching engagement year
        const contractYearMatch = memo.match(/Contracted\s+(\d{4})/i);
        const contractYear = contractYearMatch ? parseInt(contractYearMatch[1]) : null;
        const matchesYear = contractYear === year;

        if (matchesYear) {
          matchedByYear++;
          matchedRevenue += amt;
        }

        const marker = matchesYear ? '✓' : '✗';
        const yearInfo = contractYear ? `Year ${contractYear}` : 'No year';

        console.log(`    ${marker} $${amt.toFixed(2).padStart(10)} | ${yearInfo} | ${memo.substring(0, 50)}...`);
      }

      console.log(`  -----`);
      console.log(`  Lines matching year ${year}: ${matchedByYear}/${totalLines}`);
      console.log(`  Calculated revenue: $${Math.abs(matchedRevenue).toFixed(2)}`);
      console.log(`  Expected revenue: $${project.budget_revenue}`);

      const diff = Math.abs(matchedRevenue) - project.budget_revenue;
      if (Math.abs(diff) < 1) {
        console.log(`  ✅ MATCH!`);
      } else {
        console.log(`  ⚠️  Difference: $${diff.toFixed(2)}`);
      }
    }
  }

  console.log('\n' + '='.repeat(60) + '\n');
}

main().catch(console.error);
