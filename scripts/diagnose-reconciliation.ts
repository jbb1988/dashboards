/**
 * Diagnostic script to find projects with potential reconciliation issues
 *
 * Run with: npx tsx scripts/diagnose-reconciliation.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface ProjectIssue {
  project: string;
  woNumber: string;
  soNumber: string;
  issue: string;
  details: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  excelRevenue?: number;
  dashboardRevenue?: number;
}

async function main() {
  console.log('🔍 Scanning for reconciliation issues...\n');

  const issues: ProjectIssue[] = [];

  // Get all MCC closeout projects
  console.log('Fetching MCC closeout projects...');

  const { data: closeoutProjects } = await supabase
    .from('closeout_projects')
    .select(`
      id,
      project_name,
      project_year,
      project_month,
      project_type,
      actual_revenue,
      actual_cost,
      closeout_work_orders (wo_number)
    `)
    .eq('project_type', 'MCC')
    .gt('actual_revenue', 0)
    .order('project_year', { ascending: false })
    .order('project_month', { ascending: false });

  console.log(`Found ${closeoutProjects?.length || 0} MCC projects\n`);

  if (closeoutProjects) {
    for (const proj of closeoutProjects) {
      const projectLabel = `${proj.project_name} ${proj.project_year}-${String(proj.project_month).padStart(2, '0')} MCC`;

      // Check GPM anomalies
      const revenue = proj.actual_revenue || 0;
      const cost = proj.actual_cost || 0;
      const gp = revenue - cost;
      const gpm = revenue > 0 ? (gp / revenue) * 100 : 0;

      if (gpm > 100 || gpm < 0) {
        issues.push({
          project: projectLabel,
          woNumber: 'N/A',
          soNumber: 'N/A',
          issue: gpm > 100 ? 'GPM > 100% (impossible)' : 'Negative GPM (cost > revenue)',
          details: `GPM: ${gpm.toFixed(1)}% | Revenue: $${revenue.toLocaleString()} | Cost: $${cost.toLocaleString()}`,
          severity: 'HIGH',
          excelRevenue: revenue
        });
        continue; // Skip further checks for anomalous projects
      }

      // Get WO numbers
      const woNumbers = (proj.closeout_work_orders || [])
        .map((w: any) => `WO${w.wo_number}`)
        .filter(Boolean);

      if (woNumbers.length === 0) {
        issues.push({
          project: projectLabel,
          woNumber: 'NONE',
          soNumber: 'N/A',
          issue: 'No WO linked',
          details: `Excel shows $${revenue.toLocaleString()} revenue but no WO numbers in closeout`,
          severity: 'MEDIUM',
          excelRevenue: revenue
        });
        continue;
      }

      // Get NetSuite WO data
      const { data: nsWOs } = await supabase
        .from('netsuite_work_orders')
        .select(`
          wo_number,
          created_from_so_id,
          created_from_so_number,
          netsuite_work_order_lines (item_id, item_name)
        `)
        .in('wo_number', woNumbers);

      if (!nsWOs || nsWOs.length === 0) {
        issues.push({
          project: projectLabel,
          woNumber: woNumbers.join(', '),
          soNumber: 'N/A',
          issue: 'WO not in NetSuite',
          details: `Excel has WO(s) ${woNumbers.join(', ')} but not found in NetSuite sync`,
          severity: 'MEDIUM',
          excelRevenue: revenue
        });
        continue;
      }

      // Collect all WO item IDs and SO NetSuite IDs
      const allWoItemIds = new Set<string>();
      const soNetsuiteIds = new Set<string>();
      const soNumbers: string[] = [];

      for (const wo of nsWOs) {
        if (wo.created_from_so_id) {
          soNetsuiteIds.add(wo.created_from_so_id);
          if (wo.created_from_so_number) soNumbers.push(wo.created_from_so_number);
        }
        for (const line of wo.netsuite_work_order_lines || []) {
          if (line.item_id) allWoItemIds.add(line.item_id);
        }
      }

      if (soNetsuiteIds.size === 0) {
        issues.push({
          project: projectLabel,
          woNumber: woNumbers.join(', '),
          soNumber: 'NONE',
          issue: 'WO not linked to SO',
          details: `WO exists but has no linked Sales Order`,
          severity: 'MEDIUM',
          excelRevenue: revenue
        });
        continue;
      }

      // Look up SO internal IDs from NetSuite IDs
      const { data: sos } = await supabase
        .from('netsuite_sales_orders')
        .select('id, netsuite_id')
        .in('netsuite_id', Array.from(soNetsuiteIds));

      const soInternalIds = (sos || []).map(s => s.id);

      if (soInternalIds.length === 0) {
        issues.push({
          project: projectLabel,
          woNumber: woNumbers.join(', '),
          soNumber: soNumbers.join(', '),
          issue: 'SO not found in NetSuite',
          details: `WO references SO(s) not in database`,
          severity: 'MEDIUM',
          excelRevenue: revenue
        });
        continue;
      }

      // Get SO MCC lines (account 4101-4111)
      const { data: soLines } = await supabase
        .from('netsuite_sales_order_lines')
        .select('item_id, item_name, amount, account_number, cost_estimate')
        .in('sales_order_id', soInternalIds)
        .or('account_number.like.410%,account_number.like.411%');

      if (!soLines || soLines.length === 0) {
        issues.push({
          project: projectLabel,
          woNumber: woNumbers.join(', '),
          soNumber: soNumbers.join(', '),
          issue: 'No MCC lines in SO',
          details: `SO has no lines with account 4101-4111 (MCC accounts)`,
          severity: 'HIGH',
          excelRevenue: revenue
        });
        continue;
      }

      // Calculate what dashboard would show vs Excel
      const matchedLines = soLines.filter((l: any) => allWoItemIds.has(l.item_id));
      const unmatchedMCCLines = soLines.filter((l: any) => !allWoItemIds.has(l.item_id) && l.amount < 0);

      // Revenue from matched lines only
      const matchedRevenue = matchedLines
        .filter((l: any) => l.amount < 0)
        .reduce((sum: number, l: any) => sum + Math.abs(l.amount), 0);

      // Add largest credit per account (simulating our fix)
      const matchedAccounts = new Set(matchedLines.map((l: any) => l.account_number));
      const creditsByAccount = new Map<string, number>();
      for (const line of soLines) {
        if (line.amount > 0 && matchedAccounts.has(line.account_number)) {
          const existing = creditsByAccount.get(line.account_number) || 0;
          if (line.amount > existing) {
            creditsByAccount.set(line.account_number, line.amount);
          }
        }
      }
      const totalCredits = Array.from(creditsByAccount.values()).reduce((a, b) => a + b, 0);

      // With our new fix: include all MCC revenue on matched accounts
      const allMCCRevenue = soLines
        .filter((l: any) => l.amount < 0 && matchedAccounts.has(l.account_number))
        .reduce((sum: number, l: any) => sum + Math.abs(l.amount), 0);

      // Dashboard would show (with all fixes applied)
      const dashboardRevenue = allMCCRevenue - totalCredits;
      const excelRevenue = revenue;

      const variance = Math.abs(dashboardRevenue - excelRevenue);
      const variancePct = excelRevenue > 0 ? (variance / excelRevenue) * 100 : 0;

      // Check for issues
      if (unmatchedMCCLines.length > 0 && matchedLines.length > 0) {
        const unmatchedRevenue = unmatchedMCCLines.reduce((sum: number, l: any) => sum + Math.abs(l.amount), 0);

        if (variancePct > 5 && variance > 500) {
          issues.push({
            project: projectLabel,
            woNumber: woNumbers.join(', '),
            soNumber: soNumbers.join(', '),
            issue: 'Revenue variance (WO item mismatch)',
            details: `Excel: $${excelRevenue.toLocaleString()} | Dashboard estimate: $${dashboardRevenue.toLocaleString()} | Variance: ${variancePct.toFixed(1)}% | ${unmatchedMCCLines.length} unmatched MCC lines ($${unmatchedRevenue.toLocaleString()})`,
            severity: variancePct > 20 ? 'HIGH' : 'MEDIUM',
            excelRevenue,
            dashboardRevenue
          });
        }
      } else if (variancePct > 10 && variance > 1000) {
        issues.push({
          project: projectLabel,
          woNumber: woNumbers.join(', '),
          soNumber: soNumbers.join(', '),
          issue: 'Revenue variance',
          details: `Excel: $${excelRevenue.toLocaleString()} | Dashboard estimate: $${dashboardRevenue.toLocaleString()} | Variance: ${variancePct.toFixed(1)}%`,
          severity: variancePct > 25 ? 'HIGH' : 'MEDIUM',
          excelRevenue,
          dashboardRevenue
        });
      }
    }
  }

  // Print results
  console.log('\n' + '='.repeat(100));
  console.log('RECONCILIATION ISSUES FOUND');
  console.log('='.repeat(100) + '\n');

  const highIssues = issues.filter(i => i.severity === 'HIGH');
  const mediumIssues = issues.filter(i => i.severity === 'MEDIUM');
  const lowIssues = issues.filter(i => i.severity === 'LOW');

  console.log(`Found ${issues.length} potential issues:`);
  console.log(`  🔴 HIGH: ${highIssues.length}`);
  console.log(`  🟡 MEDIUM: ${mediumIssues.length}`);
  console.log(`  🟢 LOW: ${lowIssues.length}\n`);

  if (highIssues.length > 0) {
    console.log('\n🔴 HIGH PRIORITY ISSUES:\n');
    for (const issue of highIssues) {
      console.log(`📊 ${issue.project}`);
      console.log(`   WO: ${issue.woNumber} | SO: ${issue.soNumber}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   ${issue.details}`);
      console.log('');
    }
  }

  if (mediumIssues.length > 0) {
    console.log('\n🟡 MEDIUM PRIORITY ISSUES:\n');
    for (const issue of mediumIssues) {
      console.log(`📊 ${issue.project}`);
      console.log(`   WO: ${issue.woNumber} | SO: ${issue.soNumber}`);
      console.log(`   Issue: ${issue.issue}`);
      console.log(`   ${issue.details}`);
      console.log('');
    }
  }

  // Summary table
  console.log('\n' + '='.repeat(100));
  console.log('SUMMARY TABLE');
  console.log('='.repeat(100) + '\n');

  console.log('| Project | Issue | Excel Revenue | Dashboard Est | Variance |');
  console.log('|---------|-------|---------------|---------------|----------|');
  for (const issue of [...highIssues, ...mediumIssues].slice(0, 20)) {
    const excel = issue.excelRevenue ? `$${issue.excelRevenue.toLocaleString()}` : 'N/A';
    const dashboard = issue.dashboardRevenue ? `$${issue.dashboardRevenue.toLocaleString()}` : 'N/A';
    const variance = issue.excelRevenue && issue.dashboardRevenue
      ? `${((Math.abs(issue.dashboardRevenue - issue.excelRevenue) / issue.excelRevenue) * 100).toFixed(1)}%`
      : 'N/A';
    console.log(`| ${issue.project.substring(0, 30).padEnd(30)} | ${issue.issue.substring(0, 20).padEnd(20)} | ${excel.padStart(13)} | ${dashboard.padStart(13)} | ${variance.padStart(8)} |`);
  }

  console.log('\n' + '='.repeat(100));
  console.log('NEXT STEPS');
  console.log('='.repeat(100) + '\n');

  console.log('1. For "Revenue variance" issues:');
  console.log('   - Open dashboard with debug logging');
  console.log('   - Compare WO item_ids with SO item_ids');
  console.log('   - Check if WO is missing line items');
  console.log('');
  console.log('2. For "Negative GPM" issues:');
  console.log('   - Review Excel data - costs exceed revenue');
  console.log('   - This is a data quality issue, not a dashboard bug');
  console.log('');
  console.log('3. For "No WO linked" or "WO not in NetSuite":');
  console.log('   - Verify WO numbers in Excel match NetSuite');
  console.log('   - Run NetSuite sync if data is stale');
  console.log('');
  console.log('See docs/PROFITABILITY_RECONCILIATION_FIX.md for detailed guidance.\n');
}

main().catch(console.error);
