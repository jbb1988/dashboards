// Apply migration 037 using Supabase Management API
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

const PROJECT_REF = envVars.SUPABASE_PROJECT_REF;
const ACCESS_TOKEN = envVars.SUPABASE_ACCESS_TOKEN;

if (!PROJECT_REF || !ACCESS_TOKEN) {
  console.error('❌ Missing SUPABASE_PROJECT_REF or SUPABASE_ACCESS_TOKEN in .env.local');
  process.exit(1);
}

console.log('🔧 Applying migration 037_add_converted_pdf_url.sql via Supabase Management API');
console.log(`   Project: ${PROJECT_REF}`);
console.log('');

// Read the migration SQL
const migrationPath = path.join(__dirname, '../supabase/migrations/037_add_converted_pdf_url.sql');
const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

// Use Supabase Management API to execute SQL
const url = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

console.log('Executing SQL...');
console.log('');

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: migrationSQL
    })
  });

  if (response.ok) {
    const result = await response.json();
    console.log('✅ Migration applied successfully!');
    console.log('');
    console.log('Result:', JSON.stringify(result, null, 2));
  } else {
    const error = await response.text();
    console.error('❌ Error applying migration:');
    console.error(`   Status: ${response.status}`);
    console.error(`   Response: ${error}`);
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}

console.log('');
console.log('The documents table now has a converted_pdf_url column.');
console.log('You can now test the Word document preview feature!');
