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
 * POST /api/admin/run-migrations
 * Runs any migrations that haven't been applied yet
 * Tracks applied migrations in a _migrations table
 */
export async function POST() {
  try {
    // First, ensure the _migrations tracking table exists
    const createTrackingTable = await runSQL(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
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

    // Get list of already-applied migrations
    const appliedResult = await runSQL('SELECT filename FROM _migrations ORDER BY filename;');
    if (!appliedResult.success) {
      return NextResponse.json({
        error: 'Failed to get applied migrations',
        details: appliedResult.error
      }, { status: 500 });
    }

    const appliedMigrations = new Set(
      (appliedResult.result as Array<{ filename: string }>).map(r => r.filename)
    );

    // Read migration files from disk
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

    let migrationFiles: string[];
    try {
      migrationFiles = await fs.readdir(migrationsDir);
      migrationFiles = migrationFiles
        .filter(f => f.endsWith('.sql'))
        .sort(); // Sort to apply in order
    } catch {
      return NextResponse.json({
        error: 'Could not read migrations directory',
        path: migrationsDir
      }, { status: 500 });
    }

    // Find pending migrations
    const pendingMigrations = migrationFiles.filter(f => !appliedMigrations.has(f));

    if (pendingMigrations.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All migrations are already applied',
        applied: Array.from(appliedMigrations),
        pending: []
      });
    }

    // Apply each pending migration
    const results: Array<{ file: string; success: boolean; error?: string }> = [];

    for (const migrationFile of pendingMigrations) {
      const filePath = path.join(migrationsDir, migrationFile);

      try {
        const sql = await fs.readFile(filePath, 'utf-8');

        // Run the migration
        const migrationResult = await runSQL(sql);

        if (migrationResult.success) {
          // Record that this migration was applied
          await runSQL(`
            INSERT INTO _migrations (filename) VALUES ('${migrationFile}')
            ON CONFLICT (filename) DO NOTHING;
          `);

          results.push({ file: migrationFile, success: true });
        } else {
          results.push({
            file: migrationFile,
            success: false,
            error: migrationResult.error
          });
          // Stop on first failure to maintain consistency
          break;
        }
      } catch (err) {
        results.push({
          file: migrationFile,
          success: false,
          error: err instanceof Error ? err.message : 'Failed to read file'
        });
        break;
      }
    }

    const succeeded = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    return NextResponse.json({
      success: failed.length === 0,
      message: failed.length === 0
        ? `Applied ${succeeded.length} migration(s)`
        : `Applied ${succeeded.length} migration(s), ${failed.length} failed`,
      applied: succeeded.map(r => r.file),
      failed: failed,
      alreadyApplied: Array.from(appliedMigrations),
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * GET /api/admin/run-migrations
 * Shows status of migrations without running them
 */
export async function GET() {
  try {
    // Check if tracking table exists and get applied migrations
    const appliedResult = await runSQL(`
      SELECT filename, applied_at
      FROM _migrations
      ORDER BY filename;
    `);

    let appliedMigrations: Array<{ filename: string; applied_at: string }> = [];
    if (appliedResult.success && Array.isArray(appliedResult.result)) {
      appliedMigrations = appliedResult.result as Array<{ filename: string; applied_at: string }>;
    }

    const appliedSet = new Set(appliedMigrations.map(r => r.filename));

    // Read migration files from disk
    const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

    let migrationFiles: string[];
    try {
      migrationFiles = await fs.readdir(migrationsDir);
      migrationFiles = migrationFiles
        .filter(f => f.endsWith('.sql'))
        .sort();
    } catch {
      return NextResponse.json({
        error: 'Could not read migrations directory',
        path: migrationsDir
      }, { status: 500 });
    }

    const pending = migrationFiles.filter(f => !appliedSet.has(f));

    return NextResponse.json({
      totalMigrations: migrationFiles.length,
      applied: appliedMigrations.length,
      pending: pending.length,
      pendingFiles: pending,
      appliedFiles: appliedMigrations,
      instructions: pending.length > 0
        ? 'POST to this endpoint to run pending migrations'
        : 'All migrations are applied'
    });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
