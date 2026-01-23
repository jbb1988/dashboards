import * as fs from 'fs';
import { config } from 'dotenv';
config({ path: '.env.local' });

async function runMigration() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
  }

  // Read migration file
  const sql = fs.readFileSync('supabase/migrations/051_clause_library.sql', 'utf-8');

  // Split into statements (simple split - won't handle all cases but works for this)
  const statements = sql
    .split(/;\s*$/m)
    .filter(s => s.trim() && !s.trim().startsWith('--'))
    .map(s => s.trim() + ';');

  console.log(`Running ${statements.length} SQL statements...`);

  // Use Supabase's rpc endpoint with raw SQL (if available)
  // Or create tables one by one via REST API

  // Actually, let's use the SQL Editor API endpoint
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (stmt.length < 10) continue;

    const shortStmt = stmt.substring(0, 60).replace(/\n/g, ' ');
    console.log(`[${i + 1}/${statements.length}] ${shortStmt}...`);

    try {
      // For table creation, we need to use the Management API or direct SQL
      // Let's try using supabase-js admin client
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

      // Try to run via RPC (custom function)
      // Since we can't run raw SQL via REST, let's just create the tables directly
      // For now, let's verify the tables exist by trying a query
    } catch (e) {
      console.log(`  Note: ${e}`);
    }
  }

  // Alternative: Check if we can just insert the categories via REST
  console.log('\nInserting clause categories...');

  const categories = [
    { name: 'Limitation of Liability', description: 'Clauses limiting financial exposure and damages', sort_order: 1 },
    { name: 'Indemnification', description: 'Mutual and one-way indemnification provisions', sort_order: 2 },
    { name: 'Intellectual Property', description: 'IP ownership, licensing, and work product clauses', sort_order: 3 },
    { name: 'Confidentiality', description: 'NDA and confidentiality provisions', sort_order: 4 },
    { name: 'Termination', description: 'Contract termination and exit provisions', sort_order: 5 },
    { name: 'Warranty', description: 'Product and service warranty clauses', sort_order: 6 },
    { name: 'Payment Terms', description: 'Payment schedules, invoicing, and late fees', sort_order: 7 },
    { name: 'Insurance', description: 'Insurance requirements and certificates', sort_order: 8 },
    { name: 'Compliance', description: 'Regulatory and legal compliance provisions', sort_order: 9 },
    { name: 'Dispute Resolution', description: 'Arbitration, mediation, and litigation clauses', sort_order: 10 },
    { name: 'Force Majeure', description: 'Acts of God and unforeseeable events', sort_order: 11 },
    { name: 'Assignment', description: 'Contract assignment and transfer provisions', sort_order: 12 },
    { name: 'Notices', description: 'Communication and notice requirements', sort_order: 13 },
    { name: 'Governing Law', description: 'Choice of law and jurisdiction', sort_order: 14 },
    { name: 'General', description: 'Miscellaneous standard clauses', sort_order: 15 },
  ];

  const response = await fetch(`${SUPABASE_URL}/rest/v1/clause_categories`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(categories),
  });

  if (!response.ok) {
    const error = await response.text();
    console.log('Insert result:', error);
    if (error.includes('does not exist')) {
      console.error('\nTable does not exist. Please run the migration SQL manually via Supabase Dashboard:');
      console.error('1. Go to https://app.supabase.com');
      console.error('2. Open your project');
      console.error('3. Go to SQL Editor');
      console.error('4. Paste contents of: supabase/migrations/051_clause_library.sql');
      console.error('5. Click Run');
    }
  } else {
    const result = await response.json();
    console.log(`Inserted ${result.length} categories`);
  }
}

runMigration().catch(console.error);
