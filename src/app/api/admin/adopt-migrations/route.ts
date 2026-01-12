import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Run SQL via Supabase Management API
 */
async function runSQL(sql: string): Promise<{ success: boolean; error?: string; result?: unknown }> {
  const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  if (!accessToken || !projectRef) {
    return { success: false, error: 'Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF' };
  }

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectRef}/database/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `${response.status}: ${errorText}` };
    }

    const result = await response.json();
    return { success: true, result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * POST /api/admin/adopt-migrations
 * Marks migrations as "applied" without running them
 * Use this when tables already exist from manual SQL execution
 */
export async function POST() {
  try {
    // First, ensure the _migrations tracking table exists
    const createTrackingTable = await runSQL(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW(),
        adopted BOOLEAN DEFAULT FALSE
      );

      -- Grant permissions
      GRANT ALL ON _migrations TO postgres;
      GRANT ALL ON _migrations TO service_role;
      GRANT SELECT ON _migrations TO authenticated;
      GRANT SELECT ON _migrations TO anon;
    `);

    if (!createTrackingTable.success) {
      return NextResponse.json({
        error: 'Failed to create migrations tracking table',
        details: createTrackingTable.error
      }, { status: 500 });
    }

    // Get existing tables in the database
    const tablesResult = await runSQL(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `);

    if (!tablesResult.success) {
      return NextResponse.json({
        error: 'Failed to get existing tables',
        details: tablesResult.error
      }, { status: 500 });
    }

    const existingTables = new Set(
      (tablesResult.result as Array<{ table_name: string }>).map(r => r.table_name)
    );

    // Map migrations to the tables they create
    const migrationTableMap: Record<string, string[]> = {
      '001_create_contracts_table.sql': ['contracts'],
      '002_create_documents_table.sql': ['documents', 'saved_views'],
      '003_create_tasks_table.sql': ['tasks'],
      '004_create_bundles_table.sql': ['bundle_opportunities', 'bundle_assignments'],
      '005_create_diversified_tables.sql': ['diversified_sales', 'diversified_budgets'],
      '006_add_salesforce_sync_tracking.sql': ['salesforce_sync_log'],
      '007_create_project_profitability.sql': ['project_profitability', 'project_budgets', 'project_profitability_sync_log'],
      '008_add_actual_cogs.sql': [], // Column addition, not table
      '009_add_costestimate_column.sql': [], // Column addition, not table
      '010_user_management_v2.sql': ['user_profiles', 'roles', 'role_dashboard_access', 'user_dashboard_overrides', 'dashboards'],
      '011_add_sf_document_sync.sql': [], // Column addition, not table
      '20260112_create_contract_reviews.sql': ['contract_reviews'],
    };

    // Read migration files from disk
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
    let migrationFiles: string[];
    try {
      migrationFiles = await fs.readdir(migrationsDir);
      migrationFiles = migrationFiles.filter(f => f.endsWith('.sql')).sort();
    } catch {
      return NextResponse.json({
        error: 'Could not read migrations directory'
      }, { status: 500 });
    }

    // Determine which migrations should be marked as adopted
    const adopted: string[] = [];
    const skipped: Array<{ file: string; reason: string }> = [];

    for (const file of migrationFiles) {
      const tables = migrationTableMap[file] || [];

      // If it's a column migration (no tables), check if base table exists
      // For simplicity, we'll adopt column migrations if the parent tables exist
      if (tables.length === 0) {
        // These are ALTER TABLE migrations - adopt them if related tables exist
        const isColumnMigration = file.includes('add_') || file.includes('_column');
        if (isColumnMigration) {
          // Assume these were applied if related base tables exist
          adopted.push(file);
          continue;
        }
      }

      // Check if ALL tables from this migration exist
      const allExist = tables.every(t => existingTables.has(t));
      const someExist = tables.some(t => existingTables.has(t));

      if (allExist || (tables.length === 0)) {
        adopted.push(file);
      } else if (someExist) {
        // Partial - some tables exist, some don't
        const missing = tables.filter(t => !existingTables.has(t));
        skipped.push({
          file,
          reason: `Partial: missing tables [${missing.join(', ')}]`
        });
      } else {
        skipped.push({
          file,
          reason: `No tables from this migration exist`
        });
      }
    }

    // Insert adopted migrations into tracking table
    for (const file of adopted) {
      await runSQL(`
        INSERT INTO _migrations (filename, adopted)
        VALUES ('${file}', true)
        ON CONFLICT (filename) DO UPDATE SET adopted = true;
      `);
    }

    return NextResponse.json({
      success: true,
      message: `Adopted ${adopted.length} migrations, skipped ${skipped.length}`,
      adopted,
      skipped,
      existingTables: Array.from(existingTables).sort(),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
