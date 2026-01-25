/**
 * 2025 MCC Reconciliation Report
 *
 * Compares Excel data (closeout_projects) vs Dashboard calculations (NetSuite WO lines)
 * Shows variance analysis with match/discrepancy status
 *
 * Run with: npx tsx scripts/reconcile-2025-mcc.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface ReconciliationResult {
  projectName: string;
  month: number;
  excelRevenue: number;
  excelCost: number;
  dashboardCost: number;
  costDelta: number;
  deltaPct: number;
  status: 'MATCH' | 'CLOSE' | 'CHECK' | 'NO_WO';
  woNumbers: string[];
}

/**
 * Calculate cost from WO line items using dashboard logic
 *
 * For each WO line:
 * - Material/Labor/Overhead: use line_cost
 * - Expense Reports/Travel/Freight: use quantity (when line_cost is 0)
 * - Maintenance items with unit_cost: use unit_cost * qty
 * - InvtPart with $0 line_cost: use quantity (often mirrors cost)
 */
function calculateLineCost(line: any): number {
  const itemName = (line.item_name || '').toLowerCase();
  const itemType = line.item_type || '';
  const quantity = line.quantity || 0;
  const lineCost = line.line_cost || 0;
  const unitCost = line.unit_cost || 0;

  // For OthCharge items with zero line_cost
  if (itemType === 'OthCharge' && Math.abs(lineCost) < 0.01) {
    // Standard expense types - use quantity as cost
    const isExpenseType =
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

    if (isExpenseType && Math.abs(quantity) > 0.01) {
      return Math.abs(quantity);
    }

    // Maintenance/Calibration with unit_cost - calculate from unit_cost * qty
    if ((itemName.includes('maintenance') || itemName.includes('calibration')) &&
        Math.abs(unitCost) > 0.01 && Math.abs(quantity) > 0.01) {
      return Math.abs(unitCost * quantity);
    }
  }

  // For InvtPart with $0 line_cost, use quantity as cost
  if (itemType === 'InvtPart' && Math.abs(lineCost) < 0.01 && Math.abs(quantity) > 0.01) {
    return Math.abs(quantity);
  }

  // For all other items, use line_cost
  return Math.abs(lineCost);
}

async function main() {
  console.log('\n2025 MCC RECONCILIATION REPORT');
  console.log('==============================\n');

  const results: ReconciliationResult[] = [];

  // Get all 2025 MCC projects from closeout_projects
  const { data: projects, error: projError } = await supabase
    .from('closeout_projects')
    .select(`
      id,
      project_name,
      project_year,
      project_month,
      actual_revenue,
      actual_cost,
      closeout_work_orders (wo_number)
    `)
    .eq('project_type', 'MCC')
    .eq('project_year', 2025)
    .order('project_name')
    .order('project_month');

  if (projError) {
    console.error('Error fetching projects:', projError);
    return;
  }

  if (!projects || projects.length === 0) {
    console.log('No 2025 MCC projects found.\n');
    return;
  }

  console.log(`Found ${projects.length} 2025 MCC projects\n`);
  console.log('Processing...\n');

  // Process each project
  for (const project of projects) {
    const excelRevenue = project.actual_revenue || 0;
    const excelCost = project.actual_cost || 0;

    // Get WO numbers (deduplicated)
    const woNumbers = [...new Set(
      (project.closeout_work_orders || [])
        .map((w: any) => `WO${w.wo_number}`)
        .filter(Boolean)
    )];

    if (woNumbers.length === 0) {
      results.push({
        projectName: project.project_name,
        month: project.project_month,
        excelRevenue,
        excelCost,
        dashboardCost: 0,
        costDelta: excelCost,
        deltaPct: 100,
        status: 'NO_WO',
        woNumbers: [],
      });
      continue;
    }

    // Get NetSuite WO data with line items (including unit_cost for corrections)
    const { data: nsWOs } = await supabase
      .from('netsuite_work_orders')
      .select(`
        wo_number,
        netsuite_work_order_lines (
          item_name,
          item_type,
          quantity,
          line_cost,
          unit_cost
        )
      `)
      .in('wo_number', woNumbers);

    if (!nsWOs || nsWOs.length === 0) {
      results.push({
        projectName: project.project_name,
        month: project.project_month,
        excelRevenue,
        excelCost,
        dashboardCost: 0,
        costDelta: excelCost,
        deltaPct: 100,
        status: 'NO_WO',
        woNumbers,
      });
      continue;
    }

    // Calculate dashboard cost from WO line items
    let dashboardCost = 0;
    for (const wo of nsWOs) {
      for (const line of wo.netsuite_work_order_lines || []) {
        dashboardCost += calculateLineCost(line);
      }
    }

    const costDelta = dashboardCost - excelCost;
    const deltaPct = excelCost > 0 ? (costDelta / excelCost) * 100 : 0;

    // Categorize: MATCH (<$1), CLOSE (<10% or <$200), CHECK (>10% and >$200)
    let status: 'MATCH' | 'CLOSE' | 'CHECK' | 'NO_WO';
    if (Math.abs(costDelta) < 1) {
      status = 'MATCH';
    } else if (Math.abs(deltaPct) < 10 || Math.abs(costDelta) < 200) {
      status = 'CLOSE';
    } else {
      status = 'CHECK';
    }

    results.push({
      projectName: project.project_name,
      month: project.project_month,
      excelRevenue,
      excelCost,
      dashboardCost,
      costDelta,
      deltaPct,
      status,
      woNumbers,
    });
  }

  // Print results table
  const col = {
    project: 22,
    excelRev: 11,
    excelCost: 12,
    dashCost: 11,
    delta: 10,
    pct: 7,
    status: 8,
  };

  const header = [
    'Project'.padEnd(col.project),
    'Excel Rev'.padStart(col.excelRev),
    'Excel Cost'.padStart(col.excelCost),
    'Dash Cost'.padStart(col.dashCost),
    'Cost Δ'.padStart(col.delta),
    'Δ %'.padStart(col.pct),
    'Status'.padStart(col.status),
  ].join(' | ');

  const separator = [
    '-'.repeat(col.project),
    '-'.repeat(col.excelRev),
    '-'.repeat(col.excelCost),
    '-'.repeat(col.dashCost),
    '-'.repeat(col.delta),
    '-'.repeat(col.pct),
    '-'.repeat(col.status),
  ].join('-|-');

  console.log(header);
  console.log(separator);

  for (const r of results) {
    const projectLabel = `${r.projectName} 2025-${r.month}`.substring(0, col.project);
    const deltaStr = r.costDelta >= 0 ? `+$${Math.round(r.costDelta)}` : `-$${Math.abs(Math.round(r.costDelta))}`;
    const pctStr = r.deltaPct >= 0 ? `+${r.deltaPct.toFixed(0)}%` : `${r.deltaPct.toFixed(0)}%`;

    const statusIcon = r.status === 'MATCH' ? '✓' : r.status === 'CLOSE' ? '~' : r.status === 'NO_WO' ? '!' : '⚠';

    const row = [
      projectLabel.padEnd(col.project),
      `$${Math.round(r.excelRevenue).toLocaleString()}`.padStart(col.excelRev),
      `$${Math.round(r.excelCost).toLocaleString()}`.padStart(col.excelCost),
      `$${Math.round(r.dashboardCost).toLocaleString()}`.padStart(col.dashCost),
      deltaStr.padStart(col.delta),
      pctStr.padStart(col.pct),
      `${statusIcon} ${r.status}`.padStart(col.status),
    ].join(' | ');

    console.log(row);
  }

  // Summary statistics
  const matches = results.filter(r => r.status === 'MATCH').length;
  const close = results.filter(r => r.status === 'CLOSE').length;
  const checks = results.filter(r => r.status === 'CHECK').length;
  const noWO = results.filter(r => r.status === 'NO_WO').length;

  const totalExcelCost = results.reduce((sum, r) => sum + r.excelCost, 0);
  const totalDashCost = results.reduce((sum, r) => sum + r.dashboardCost, 0);
  const totalDelta = totalDashCost - totalExcelCost;
  const totalDeltaPct = totalExcelCost > 0 ? (totalDelta / totalExcelCost) * 100 : 0;

  console.log('\n' + '='.repeat(95));
  console.log('\nSUMMARY');
  console.log('-'.repeat(40));
  console.log(`  ✓ MATCH  (Δ < $1):           ${matches.toString().padStart(3)}`);
  console.log(`  ~ CLOSE  (Δ < 10% or <$200): ${close.toString().padStart(3)}`);
  console.log(`  ⚠ CHECK  (needs review):     ${checks.toString().padStart(3)}`);
  console.log(`  ! NO_WO  (no WO data):       ${noWO.toString().padStart(3)}`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  Total projects:              ${results.length.toString().padStart(3)}`);

  console.log('\nAGGREGATE TOTALS');
  console.log('-'.repeat(40));
  console.log(`  Total Excel Cost:     $${Math.round(totalExcelCost).toLocaleString()}`);
  console.log(`  Total Dashboard Cost: $${Math.round(totalDashCost).toLocaleString()}`);
  console.log(`  Total Variance:       ${totalDelta >= 0 ? '+' : ''}$${Math.round(totalDelta).toLocaleString()} (${totalDeltaPct >= 0 ? '+' : ''}${totalDeltaPct.toFixed(1)}%)`);

  // Analysis of patterns
  const dashHigher = results.filter(r => r.costDelta > 1 && r.status !== 'NO_WO');
  const excelHigher = results.filter(r => r.costDelta < -1 && r.status !== 'NO_WO');

  console.log('\nVARIANCE PATTERNS');
  console.log('-'.repeat(40));
  console.log(`  Dashboard > Excel: ${dashHigher.length} projects (avg +$${Math.round(dashHigher.reduce((s, r) => s + r.costDelta, 0) / (dashHigher.length || 1))})`);
  console.log(`  Excel > Dashboard: ${excelHigher.length} projects (avg -$${Math.abs(Math.round(excelHigher.reduce((s, r) => s + r.costDelta, 0) / (excelHigher.length || 1)))})`);

  // Top discrepancies
  const largeDisc = results
    .filter(r => r.status === 'CHECK')
    .sort((a, b) => Math.abs(b.costDelta) - Math.abs(a.costDelta));

  if (largeDisc.length > 0) {
    console.log('\nTOP 10 DISCREPANCIES TO REVIEW');
    console.log('-'.repeat(40));
    for (const r of largeDisc.slice(0, 10)) {
      const dir = r.costDelta > 0 ? 'Dash > Excel' : 'Excel > Dash';
      console.log(`  ${(r.projectName + ' 2025-' + r.month).padEnd(24)} ${('$' + Math.abs(Math.round(r.costDelta))).padStart(8)} (${r.deltaPct > 0 ? '+' : ''}${r.deltaPct.toFixed(0)}%) ${dir}`);
    }
  }

  console.log('\nLEGEND');
  console.log('-'.repeat(40));
  console.log('  Δ = Dashboard Cost - Excel Cost');
  console.log('  Positive Δ: Dashboard calculated more cost than Excel');
  console.log('  Negative Δ: Excel has more cost than Dashboard calculated');
  console.log('');
}

main().catch(console.error);
