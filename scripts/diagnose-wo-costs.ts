/**
 * Diagnostic script to analyze WO cost calculation
 *
 * Run with: npx tsx scripts/diagnose-wo-costs.ts WO5428
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const woNumber = process.argv[2] || 'WO5428';

  console.log(`\n🔍 Analyzing costs for ${woNumber}...\n`);

  const { data: wo, error } = await supabase
    .from('netsuite_work_orders')
    .select(`
      wo_number,
      status,
      total_actual_cost,
      netsuite_work_order_lines (
        line_number,
        item_id,
        item_name,
        item_type,
        quantity,
        unit_cost,
        line_cost,
        cost_estimate,
        actual_cost
      )
    `)
    .eq('wo_number', woNumber)
    .single();

  if (error || !wo) {
    console.error(`Error fetching ${woNumber}:`, error);
    return;
  }

  console.log(`Work Order: ${wo.wo_number}`);
  console.log(`Status: ${wo.status}`);
  console.log(`NetSuite Total Actual Cost: $${wo.total_actual_cost?.toLocaleString() || 'N/A'}\n`);

  console.log('=' .repeat(120));
  console.log('LINE ITEM ANALYSIS');
  console.log('=' .repeat(120));

  let dashboardTotal = 0;
  let allQuantityTotal = 0;
  let allLineCostTotal = 0;
  let allActualCostTotal = 0;

  const lines = wo.netsuite_work_order_lines || [];

  console.log('\n| Line | Item Type | Item Name | Quantity | Line Cost | Actual Cost | Dashboard Uses | Amount |');
  console.log('|------|-----------|-----------|----------|-----------|-------------|----------------|--------|');

  for (const line of lines) {
    const itemName = (line.item_name || '').toLowerCase();
    const itemType = line.item_type || '';
    const quantity = line.quantity || 0;
    const lineCost = line.line_cost || 0;
    const actualCost = line.actual_cost || 0;

    allQuantityTotal += Math.abs(quantity);
    allLineCostTotal += Math.abs(lineCost);
    allActualCostTotal += Math.abs(actualCost);

    // Mirror the dashboard logic
    let dashboardAmount = 0;
    let usedField = 'line_cost';

    if (itemType === 'OthCharge' && Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
      const usesQuantityField =
        itemName.includes('expense') ||
        itemName.includes('expense report') ||
        itemName.includes('exp rpt') ||
        itemName.includes('travel') ||
        itemName.includes('freight') ||
        itemName.includes('-freight') ||
        itemName.includes('shipping') ||
        itemName.includes('-material') ||
        itemName.includes('outside service') ||
        itemName.includes('misc material');

      if (usesQuantityField) {
        dashboardAmount = Math.abs(quantity);
        usedField = 'quantity';
      } else {
        dashboardAmount = Math.abs(lineCost);
        usedField = 'line_cost (0)';
      }
    } else {
      dashboardAmount = Math.abs(lineCost);
    }

    dashboardTotal += dashboardAmount;

    // Highlight lines where dashboard might be missing costs
    const potentialIssue = (Math.abs(quantity) > 0.01 && dashboardAmount < 0.01) ? '⚠️' : '';

    console.log(
      `| ${String(line.line_number).padEnd(4)} ` +
      `| ${(itemType || 'N/A').substring(0, 9).padEnd(9)} ` +
      `| ${(line.item_name || 'N/A').substring(0, 35).padEnd(35)} ` +
      `| ${quantity.toFixed(2).padStart(8)} ` +
      `| ${lineCost.toFixed(2).padStart(9)} ` +
      `| ${actualCost.toFixed(2).padStart(11)} ` +
      `| ${usedField.padEnd(14)} ` +
      `| ${dashboardAmount.toFixed(2).padStart(6)} ${potentialIssue}|`
    );
  }

  console.log('\n' + '=' .repeat(120));
  console.log('TOTALS COMPARISON');
  console.log('=' .repeat(120));

  console.log(`\nDashboard Calculated Total: $${dashboardTotal.toLocaleString()}`);
  console.log(`Sum of all quantity fields: $${allQuantityTotal.toLocaleString()}`);
  console.log(`Sum of all line_cost fields: $${allLineCostTotal.toLocaleString()}`);
  console.log(`Sum of all actual_cost fields: $${allActualCostTotal.toLocaleString()}`);
  console.log(`NetSuite total_actual_cost: $${wo.total_actual_cost?.toLocaleString() || 'N/A'}`);

  // Find potentially missed items
  console.log('\n' + '=' .repeat(120));
  console.log('POTENTIALLY MISSED ITEMS (OthCharge with quantity but not matched by patterns)');
  console.log('=' .repeat(120));

  let missedTotal = 0;
  for (const line of lines) {
    const itemName = (line.item_name || '').toLowerCase();
    const itemType = line.item_type || '';
    const quantity = line.quantity || 0;
    const lineCost = line.line_cost || 0;

    if (itemType === 'OthCharge' && Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
      const usesQuantityField =
        itemName.includes('expense') ||
        itemName.includes('expense report') ||
        itemName.includes('exp rpt') ||
        itemName.includes('travel') ||
        itemName.includes('freight') ||
        itemName.includes('-freight') ||
        itemName.includes('shipping') ||
        itemName.includes('-material') ||
        itemName.includes('outside service') ||
        itemName.includes('misc material');

      if (!usesQuantityField) {
        missedTotal += Math.abs(quantity);
        console.log(`\n⚠️  Line ${line.line_number}: "${line.item_name}"`);
        console.log(`    Type: ${itemType}`);
        console.log(`    Quantity: $${quantity.toLocaleString()} (MISSED - not matching patterns)`);
        console.log(`    Line Cost: $${lineCost.toLocaleString()}`);
      }
    }
  }

  if (missedTotal > 0) {
    console.log(`\n📊 Total potentially missed: $${missedTotal.toLocaleString()}`);
    console.log(`   Expected dashboard total: $${(dashboardTotal + missedTotal).toLocaleString()}`);
  } else {
    console.log('\n✅ No missed OthCharge items detected');
  }

  // Check for items with actual_cost that aren't being used
  console.log('\n' + '=' .repeat(120));
  console.log('ITEMS WITH ACTUAL_COST FIELD POPULATED');
  console.log('=' .repeat(120));

  for (const line of lines) {
    const actualCost = line.actual_cost || 0;
    if (Math.abs(actualCost) > 0.01) {
      console.log(`\nLine ${line.line_number}: "${line.item_name}"`);
      console.log(`  actual_cost: $${actualCost.toLocaleString()}`);
      console.log(`  line_cost: $${(line.line_cost || 0).toLocaleString()}`);
      console.log(`  quantity: $${(line.quantity || 0).toLocaleString()}`);
    }
  }

  console.log('\n');
}

main().catch(console.error);
