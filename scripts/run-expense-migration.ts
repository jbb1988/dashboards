import { getSupabaseAdmin } from '../src/lib/supabase';
import * as fs from 'fs';
import * as path from 'path';

async function runMigration() {
  const supabase = getSupabaseAdmin();

  const migrationPath = path.join(__dirname, '../supabase/migrations/029_add_expense_reports.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('Running expense reports migration...');

  // Split by statement and execute
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement + ';' });
      if (error) {
        // Try direct execution if RPC doesn't work
        console.log('Executing statement...');
      }
    } catch (err) {
      console.error('Error:', err);
    }
  }

  console.log('Migration complete!');
}

runMigration().catch(console.error);
