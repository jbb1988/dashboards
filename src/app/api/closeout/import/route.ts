/**
 * API Route: /api/closeout/import
 * Import closeout worksheet data into database tables
 */

import { NextResponse } from 'next/server';
import * as path from 'path';
import * as fs from 'fs';
import { getExcelFromStorage } from '@/lib/supabase';
import { importCloseoutExcelToDatabase } from '@/lib/closeout';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const forceRefresh = url.searchParams.get('forceRefresh') === 'true';

    // Get Excel file buffer
    let fileBuffer: Buffer | null = null;

    // Try Supabase Storage first
    fileBuffer = await getExcelFromStorage('closeout-data.xlsx');

    // Fall back to local filesystem (for development)
    if (!fileBuffer) {
      const localPath = path.join(process.cwd(), 'data', 'closeout-data.xlsx');
      if (fs.existsSync(localPath)) {
        fileBuffer = fs.readFileSync(localPath);
      }
    }

    if (!fileBuffer) {
      return NextResponse.json(
        {
          error: 'Data file not found',
          message: 'Please upload closeout-data.xlsx to Supabase Storage (data-files bucket)',
        },
        { status: 404 }
      );
    }

    // Import data to database
    console.log('Starting closeout data import...');
    const stats = await importCloseoutExcelToDatabase(fileBuffer);

    console.log('Import complete:', stats);

    return NextResponse.json({
      success: true,
      stats: {
        projectsCreated: stats.projectsCreated,
        projectsUpdated: stats.projectsUpdated,
        workOrdersCreated: stats.workOrdersCreated,
        workOrdersUpdated: stats.workOrdersUpdated,
      },
      errors: stats.errors,
      message: `Successfully imported ${stats.projectsCreated} projects and ${stats.workOrdersCreated} work orders`,
    });
  } catch (error) {
    console.error('Error importing closeout data:', error);

    // Log detailed error for debugging
    if (error instanceof Error) {
      console.error('Error stack:', error.stack);
    }

    return NextResponse.json(
      {
        error: 'Import failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : String(error),
      },
      { status: 500 }
    );
  }
}
