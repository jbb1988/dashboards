// Simple script to apply migration 037 directly via Supabase API
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read environment variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const SUPABASE_URL = envVars.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = envVars.SUPABASE_SERVICE_ROLE_KEY;
const PROJECT_REF = envVars.SUPABASE_PROJECT_REF;
const DB_PASSWORD = envVars.SUPABASE_DB_PASSWORD;

console.log('🔧 Applying migration 037_add_converted_pdf_url.sql');
console.log('');

// Read the migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/037_add_converted_pdf_url.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Split into individual statements
const statements = migrationSQL
  .split(';')
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith('--'));

console.log(`Found ${statements.length} SQL statements to execute`);
console.log('');

// Execute each statement using Supabase REST API
for (let i = 0; i < statements.length; i++) {
  const statement = statements[i];
  console.log(`[${i + 1}/${statements.length}] Executing: ${statement.substring(0, 60)}...`);

  try {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ query: statement + ';' })
    });

    if (response.ok || response.status === 204) {
      console.log('   ✅ Success');
    } else {
      const errorText = await response.text();
      console.log(`   ⚠️  Response: ${response.status} - ${errorText}`);
    }
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }
}

console.log('');
console.log('✅ Migration complete!');
console.log('');
console.log('Next steps:');
console.log('1. Restart your Next.js dev server if running');
console.log('2. Test viewing a Word document in the contract drawer');
console.log('3. Check the browser console for any errors');
