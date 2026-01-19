#!/usr/bin/env node

/**
 * Run Database Migration
 * Adds account fields to netsuite_sales_order_lines table
 */

import { createClient } from '@supabase/supabase-js';
import pkg from 'pg';
const { Client } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load environment variables
dotenv.config({ path: join(projectRoot, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✓' : '✗');
  process.exit(1);
}

console.log('🚀 Starting migration...\n');

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Migration SQL
const migrationSQL = `
-- Add account fields to sales order lines for product type derivation
ALTER TABLE netsuite_sales_order_lines
  ADD COLUMN IF NOT EXISTS account_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS account_number VARCHAR(20),
  ADD COLUMN IF NOT EXISTS account_name VARCHAR(255);

-- Index for fast product type queries
CREATE INDEX IF NOT EXISTS idx_ns_sol_account ON netsuite_sales_order_lines(account_number);
`;

function constructDatabaseUrls() {
  // Try to get DATABASE_URL directly
  const directUrl = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  if (directUrl) {
    return [directUrl];
  }

  // Try to construct from individual components
  const projectRef = process.env.SUPABASE_PROJECT_REF;
  const dbPassword = process.env.SUPABASE_DB_PASSWORD;

  if (!projectRef || !dbPassword) {
    return [];
  }

  // Extract region from Supabase URL if possible
  const urlMatch = supabaseUrl?.match(/https:\/\/[^.]+\.supabase\.co/);

  // Try multiple connection formats
  const urls = [
    // Direct connection (port 5432)
    `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:5432/postgres`,
    // Pooler connection (port 6543)
    `postgresql://postgres.${projectRef}:${dbPassword}@aws-0-us-west-1.pooler.supabase.com:6543/postgres`,
    // Direct to db without pooler
    `postgresql://postgres:${dbPassword}@db.${projectRef}.supabase.co:5432/postgres`,
  ];

  return urls;
}

async function tryConnection(dbUrl) {
  const client = new Client({
    connectionString: dbUrl,
    ssl: {
      rejectUnauthorized: false
    },
    connectionTimeoutMillis: 10000,
  });

  try {
    await client.connect();
    await client.query(migrationSQL);
    await client.end();
    return true;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

async function runMigration() {
  try {
    // First check if columns already exist
    console.log('1️⃣  Checking if migration already applied...');
    const { data: testData, error: testError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('account_number')
      .limit(1);

    if (!testError) {
      console.log('✅ Migration already applied - account_number column exists');
      console.log('   Skipping migration.\n');
      return true;
    }

    console.log('2️⃣  Executing migration SQL via direct database connection...');

    // Get potential database URLs
    const dbUrls = constructDatabaseUrls();

    if (dbUrls.length === 0) {
      console.error('\n❌ Could not construct DATABASE_URL');
      console.error('   Please add SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD to .env.local');
      return false;
    }

    // Try each URL
    let lastError;
    for (let i = 0; i < dbUrls.length; i++) {
      const dbUrl = dbUrls[i];
      const urlSafe = dbUrl.replace(/:[^:@]+@/, ':***@'); // Hide password in logs

      try {
        console.log(`   Attempting connection ${i + 1}/${dbUrls.length}...`);
        await tryConnection(dbUrl);
        console.log('   ✓ Connected and migration executed successfully');
        break;
      } catch (error) {
        lastError = error;
        console.log(`   ✗ Connection ${i + 1} failed: ${error.message}`);

        if (i === dbUrls.length - 1) {
          throw lastError;
        }
      }
    }

    console.log('\n3️⃣  Verifying migration...');
    const { data: verifyData, error: verifyError } = await supabase
      .from('netsuite_sales_order_lines')
      .select('account_number')
      .limit(1);

    if (verifyError) {
      console.error('❌ Verification failed:', verifyError.message);
      return false;
    }

    console.log('✅ Migration completed successfully!\n');
    return true;

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    if (error.code === 'ENOTFOUND' || error.message.includes('getaddrinfo')) {
      console.error('\n💡 Tip: Check your network connection and DATABASE_URL');
    }
    if (error.code === '28P01') {
      console.error('\n💡 Tip: Check your database password is correct');
    }
    if (error.message.includes('Tenant or user not found')) {
      console.error('\n💡 Tip: The connection string format may be incorrect');
      console.error('   Try getting the direct connection string from Supabase Dashboard');
      console.error('   Settings → Database → Connection String');
    }
    return false;
  }
}

// Run migration
runMigration().then(success => {
  if (success) {
    console.log('📋 Next steps:');
    console.log('   1. Resync 2025 data: POST /api/netsuite/truly-clean-2025?year=2025');
    console.log('   2. Resync 2026 data: POST /api/netsuite/truly-clean-2025?year=2026');
    console.log('   3. Test dashboard: Navigate to profitability dashboard\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Migration failed. Please run SQL manually in Supabase Dashboard.\n');
    console.log('SQL to run:');
    console.log(migrationSQL);
    console.log('\nOr get the connection string from Supabase Dashboard and add to .env.local:');
    console.log('DATABASE_URL="<connection string from dashboard>"');
    process.exit(1);
  }
});
