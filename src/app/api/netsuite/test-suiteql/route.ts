import { NextResponse } from 'next/server';
import { testSuiteQLAccess } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await testSuiteQLAccess();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
