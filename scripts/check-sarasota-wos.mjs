import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSarasotaWOs() {
  // Step 1: Get Sarasota projects from closeout_projects
  console.log('=== Sarasota Projects from Excel (closeout_projects) ===');
  const { data: projects, error: projError } = await supabase
    .from('closeout_projects')
    .select('id, project_name, project_year, project_type, actual_revenue')
    .ilike('project_name', '%Sarasota%');

  if (projError) {
    console.error('Error:', projError);
    return;
  }

  console.log(`Found ${projects.length} Sarasota projects:`);
  projects.forEach(p => {
    console.log(`  - ${p.project_name} ${p.project_year} (${p.project_type}) - $${p.actual_revenue?.toLocaleString()}`);
  });

  // Step 2: Get work orders for these projects from closeout_work_orders
  console.log('\n=== Work Orders from Excel (closeout_work_orders) ===');
  const projectIds = projects.map(p => p.id);

  const { data: workOrders, error: woError } = await supabase
    .from('closeout_work_orders')
    .select('*')
    .in('closeout_project_id', projectIds)
    .not('wo_number', 'is', null)
    .neq('wo_number', '');

  if (woError) {
    console.error('Error:', woError);
    return;
  }

  // Group by project
  const woByProject = {};
  workOrders.forEach(wo => {
    if (!woByProject[wo.closeout_project_id]) {
      woByProject[wo.closeout_project_id] = [];
    }
    woByProject[wo.closeout_project_id].push(wo);
  });

  for (const proj of projects) {
    const wos = woByProject[proj.id] || [];
    console.log(`\n${proj.project_name} ${proj.project_year} (${proj.project_type}):`);
    if (wos.length === 0) {
      console.log('  (no work orders with WO# in Excel)');
    } else {
      wos.forEach(wo => {
        console.log(`  - ${wo.wo_number} - $${wo.actual_revenue?.toLocaleString()}`);
      });
    }
  }

  // Step 3: Cross-check with NetSuite work_orders table
  // Excel has WO numbers like "4043", NetSuite stores them as "WO4043"
  const rawWoNumbers = [...new Set(workOrders.map(wo => wo.wo_number).filter(Boolean))];
  const woNumbers = rawWoNumbers.map(n => `WO${n}`);
  console.log('\n=== Cross-check with NetSuite (netsuite_work_orders) ===');
  console.log(`Looking for WO numbers: ${woNumbers.join(', ')}`);

  const { data: nsWorkOrders, error: nsError } = await supabase
    .from('netsuite_work_orders')
    .select('id, wo_number, created_from_so_id, status, total_amount')
    .in('wo_number', woNumbers);

  if (nsError) {
    console.error('Error:', nsError);
    return;
  }

  console.log(`\nFound ${nsWorkOrders.length} matching WOs in NetSuite table:`);
  nsWorkOrders.forEach(wo => {
    console.log(`  - ${wo.wo_number}: created_from_so_id=${wo.created_from_so_id || 'null'}, status=${wo.status}, amount=$${wo.total_amount?.toLocaleString()}`);
  });

  // Step 4: Look up the Sales Orders these WOs are linked to
  const soIds = [...new Set(nsWorkOrders.map(wo => wo.created_from_so_id).filter(Boolean))];
  if (soIds.length > 0) {
    console.log('\n=== Linked Sales Orders (netsuite_sales_orders) ===');
    const { data: salesOrders, error: soError } = await supabase
      .from('netsuite_sales_orders')
      .select('id, so_number, customer_name, total_amount, status')
      .in('id', soIds);

    if (soError) {
      console.error('Error:', soError);
      return;
    }

    salesOrders.forEach(so => {
      console.log(`  - ${so.so_number}: ${so.customer_name} - $${so.total_amount?.toLocaleString()} (${so.status})`);
    });
  } else {
    console.log('\n=== No linked Sales Orders found ===');
  }
}

checkSarasotaWOs().catch(console.error);
