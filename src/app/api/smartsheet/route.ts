import { NextRequest, NextResponse } from 'next/server';
import {
  listSheets,
  getSheet,
  sheetToObjects,
  testConnection,
} from '@/lib/smartsheet';

export const dynamic = 'force-dynamic';

/**
 * GET /api/smartsheet - List sheets or get specific sheet data
 *
 * Query params:
 * - sheetId: Get a specific sheet with all data
 * - test: Test the connection
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetId = searchParams.get('sheetId');
    const test = searchParams.get('test');

    // Test connection
    if (test === 'true') {
      const result = await testConnection();
      return NextResponse.json(result);
    }

    // Get specific sheet
    if (sheetId) {
      const sheet = await getSheet(sheetId, { includeAll: true });
      const data = sheetToObjects(sheet);

      return NextResponse.json({
        sheet: {
          id: sheet.id,
          name: sheet.name,
          permalink: sheet.permalink,
          totalRowCount: sheet.totalRowCount,
          columns: sheet.columns?.map(col => ({
            id: col.id,
            title: col.title,
            type: col.type,
            primary: col.primary,
          })),
        },
        data,
        rowCount: data.length,
      });
    }

    // List all sheets
    const sheets = await listSheets();
    return NextResponse.json({
      sheets: sheets.map(s => ({
        id: s.id,
        name: s.name,
        accessLevel: s.accessLevel,
        permalink: s.permalink,
        modifiedAt: s.modifiedAt,
      })),
      count: sheets.length,
    });
  } catch (error) {
    console.error('Smartsheet API error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch from Smartsheet',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
