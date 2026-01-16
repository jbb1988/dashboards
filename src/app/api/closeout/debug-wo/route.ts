/**
 * API Route: /api/closeout/debug-wo
 * Debug endpoint to investigate Work Order format in NetSuite
 */

import { NextResponse } from 'next/server';
import { executeSuiteQL } from '@/lib/netsuite';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const woNumber = url.searchParams.get('wo') || '4158'; // Default to first failing WO

    console.log(`\n=== DEBUG: Investigating WO ${woNumber} ===\n`);

    // Test 1: Search for this exact number as-is
    console.log('Test 1: Exact match search');
    const exactQuery = `
      SELECT id, tranid, type, status
      FROM Transaction
      WHERE tranid = '${woNumber}'
      LIMIT 5
    `;
    const exactResults = await executeSuiteQL(exactQuery);
    console.log('Exact match results:', exactResults);

    // Test 2: Search with "WO" prefix
    console.log('\nTest 2: With WO prefix');
    const prefixQuery = `
      SELECT id, tranid, type, status
      FROM Transaction
      WHERE tranid = 'WO${woNumber}'
      LIMIT 5
    `;
    const prefixResults = await executeSuiteQL(prefixQuery);
    console.log('WO prefix results:', prefixResults);

    // Test 3: Search with LIKE pattern
    console.log('\nTest 3: LIKE pattern search');
    const likeQuery = `
      SELECT id, tranid, type, status
      FROM Transaction
      WHERE tranid LIKE '%${woNumber}%'
      LIMIT 10
    `;
    const likeResults = await executeSuiteQL(likeQuery);
    console.log('LIKE pattern results:', likeResults);

    // Test 4: Get sample Work Orders to see format
    console.log('\nTest 4: Sample Work Orders');
    const sampleQuery = `
      SELECT id, tranid, type, status
      FROM Transaction
      WHERE type = 'WorkOrd'
      LIMIT 10
    `;
    const sampleResults = await executeSuiteQL(sampleQuery);
    console.log('Sample Work Orders:', sampleResults);

    // Test 5: Check what's in our database
    console.log('\nTest 5: Database WO numbers');
    const supabase = getSupabaseAdmin();
    const { data: dbWOs } = await supabase
      .from('closeout_work_orders')
      .select('wo_number')
      .limit(20);
    console.log('First 20 WO numbers from database:', dbWOs?.map(w => w.wo_number));

    return NextResponse.json({
      woNumber,
      tests: {
        exactMatch: {
          query: exactQuery,
          results: exactResults,
          count: exactResults.length,
        },
        woPrefix: {
          query: prefixQuery,
          results: prefixResults,
          count: prefixResults.length,
        },
        likePattern: {
          query: likeQuery,
          results: likeResults,
          count: likeResults.length,
        },
        sampleWorkOrders: {
          query: sampleQuery,
          results: sampleResults,
          count: sampleResults.length,
        },
        databaseWOs: {
          results: dbWOs?.map(w => w.wo_number),
          count: dbWOs?.length || 0,
        },
      },
    });
  } catch (error) {
    console.error('Debug endpoint error:', error);
    return NextResponse.json(
      {
        error: 'Debug failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
