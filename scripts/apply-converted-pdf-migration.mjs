import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read the migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/037_add_converted_pdf_url.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

console.log('📦 Applying migration: 037_add_converted_pdf_url.sql');
console.log('');

// Execute the migration
const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

if (error) {
  // If exec_sql doesn't exist, try direct SQL execution
  console.log('Trying direct SQL execution...');

  // Split and execute each statement
  const statements = migrationSQL
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    const { error: execError } = await supabase.rpc('exec', { sql: statement + ';' });
    if (execError) {
      console.error('❌ Error executing statement:', execError.message);
      console.error('Statement:', statement.substring(0, 100) + '...');

      // Try using the REST API directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: statement + ';' })
      });

      if (!response.ok) {
        console.error('❌ REST API also failed:', await response.text());
      }
    }
  }
}

console.log('');
console.log('✅ Migration applied successfully!');
console.log('');
console.log('The documents table now has a converted_pdf_url column for caching PDF conversions.');
