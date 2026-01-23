/**
 * Debug script to compare Seattle vs Fairfax data flow
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '../.env.local') });

import { getSupabaseAdmin } from '../src/lib/supabase';

async function debugProjectDataFlow(projectName: string) {
  const supabase = getSupabaseAdmin();

  console.log(`\n${'='.repeat(80)}`);
  console.log(`Debugging: ${projectName} 2025`);
  console.log(`${'='.repeat(80)}\n`);

  // STEP 1: Check closeout_projects (Excel data)
  const { data: excelProjects } = await supabase
    .from('closeout_projects')
    .select('*')
    .ilike('project_name', `%${projectName}%`)
    .eq('project_year', 2025);

  console.log(`STEP 1: closeout_projects (Excel)`);
  console.log(`  Found: ${excelProjects?.length || 0} projects`);
  if (excelProjects && excelProjects.length > 0) {
    for (const proj of excelProjects) {
      console.log(`    - ${proj.project_name} (${proj.project_type}): Revenue=$${proj.actual_revenue}`);
    }
  }

  // STEP 2: Check closeout_work_orders
  const { data: excelWOs } = await supabase
    .from('closeout_work_orders')
    .select('wo_number, closeout_project_id, actual_revenue')
    .in('closeout_project_id', excelProjects?.map(p => p.id) || []);

  console.log(`\nSTEP 2: closeout_work_orders`);
  console.log(`  Found: ${excelWOs?.length || 0} work orders`);
  if (excelWOs && excelWOs.length > 0) {
    excelWOs.forEach(wo => {
      console.log(`    - WO${wo.wo_number}: Revenue=$${wo.actual_revenue}`);
    });
  }

  const uniqueWONumbers = [...new Set((excelWOs || []).map(wo => `WO${wo.wo_number}`))];
  console.log(`  Unique WO numbers: ${uniqueWONumbers.join(', ')}`);

  // STEP 3: Check netsuite_work_orders
  const { data: nsWOs } = await supabase
    .from('netsuite_work_orders')
    .select('wo_number, created_from_so_id, created_from_so_number, status')
    .in('wo_number', uniqueWONumbers);

  console.log(`\nSTEP 3: netsuite_work_orders`);
  console.log(`  Found: ${nsWOs?.length || 0} NetSuite WOs`);
  if (nsWOs && nsWOs.length > 0) {
    nsWOs.forEach(wo => {
      console.log(`    - ${wo.wo_number}: SO=${wo.created_from_so_number || 'NONE'} (${wo.status})`);
    });
  }

  const linkedSOIds = new Set(nsWOs?.filter(wo => wo.created_from_so_id).map(wo => wo.created_from_so_id) || []);
  console.log(`  Linked SO IDs: ${Array.from(linkedSOIds).join(', ') || 'NONE'}`);

  // STEP 4: Check netsuite_sales_orders
  if (linkedSOIds.size > 0) {
    const { data: nsSOs } = await supabase
      .from('netsuite_sales_orders')
      .select('so_number, customer_name, total_amount, status')
      .in('netsuite_id', Array.from(linkedSOIds));

    console.log(`\nSTEP 4: netsuite_sales_orders`);
    console.log(`  Found: ${nsSOs?.length || 0} Sales Orders`);
    if (nsSOs && nsSOs.length > 0) {
      nsSOs.forEach(so => {
        console.log(`    - ${so.so_number}: ${so.customer_name}, Amount=$${so.total_amount} (${so.status})`);
      });
    }

    // STEP 5: Check SO line items
    const { data: soLines } = await supabase
      .from('netsuite_sales_order_lines')
      .select('so_id, item_name, amount, account_number')
      .in('so_id', Array.from(linkedSOIds));

    console.log(`\nSTEP 5: netsuite_sales_order_lines`);
    console.log(`  Found: ${soLines?.length || 0} line items`);
    const totalRevenue = soLines?.reduce((sum, line) => sum + Math.abs(line.amount || 0), 0) || 0;
    console.log(`  Total Revenue from SO lines: $${totalRevenue.toFixed(2)}`);
  } else {
    console.log(`\nSTEP 4-5: SKIPPED - No linked Sales Orders found`);
    console.log(`  ⚠️  This is why revenue shows $0.00!`);
  }

  console.log('\n');
}

async function main() {
  await debugProjectDataFlow('Seattle');
  await debugProjectDataFlow('Fairfax');
}

main().catch(console.error);
