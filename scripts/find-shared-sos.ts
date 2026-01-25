/**
 * Find SOs shared across multiple engagements and check rev rec date coverage
 *
 * Run with: npx tsx scripts/find-shared-sos.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Find SOs that are linked to multiple engagements
  const { data: engagements } = await supabase
    .from('engagements')
    .select('id, customer_name, name, start_date, so_numbers')
    .not('so_numbers', 'is', null)
    .order('so_numbers');

  // Group by SO number to find shared SOs
  const soToEngagements: Record<string, any[]> = {};
  for (const eng of engagements || []) {
    const soNums = eng.so_numbers?.split(',').map((s: string) => s.trim()) || [];
    for (const so of soNums) {
      if (!soToEngagements[so]) soToEngagements[so] = [];
      soToEngagements[so].push({ id: eng.id, name: eng.name, customer: eng.customer_name, start: eng.start_date });
    }
  }

  // Find SOs shared by multiple engagements
  const sharedSOs = Object.entries(soToEngagements)
    .filter(([_, engs]) => engs.length > 1)
    .sort((a, b) => b[1].length - a[1].length);

  console.log(`\nFound ${sharedSOs.length} SOs shared across multiple engagements:\n`);

  let issueCount = 0;
  for (const [soNum, engs] of sharedSOs.slice(0, 20)) {
    // Check if SO lines have rev rec dates
    const { data: so } = await supabase
      .from('netsuite_sales_orders')
      .select('id')
      .eq('so_number', soNum)
      .single();

    let revRecStatus = 'N/A';
    let hasIssue = false;
    if (so) {
      const { data: lines } = await supabase
        .from('netsuite_sales_order_lines')
        .select('revrecstartdate')
        .eq('sales_order_id', so.id)
        .like('account_number', '410%');

      const withDates = (lines || []).filter(l => l.revrecstartdate).length;
      const total = lines?.length || 0;
      revRecStatus = `${withDates}/${total} have dates`;
      if (total > 0 && withDates === 0) {
        hasIssue = true;
        issueCount++;
      }
    }

    const marker = hasIssue ? '⚠️ ' : '  ';
    console.log(`${marker}${soNum} (${revRecStatus}):`);
    for (const eng of engs) {
      console.log(`     ${eng.customer} | ${eng.name} | ${eng.start}`);
    }
    console.log('');
  }

  console.log('='.repeat(60));
  console.log(`\n⚠️  ${issueCount} shared SOs have MCC lines with NO rev rec dates`);
  console.log('   These may show incorrect revenue in the profitability dashboard.');
  console.log('   Fix: Populate revrecstartdate/revrecenddate in NetSuite.\n');
}

main().catch(console.error);
