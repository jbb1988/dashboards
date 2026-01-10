import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/netsuite';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const result = await testConnection();

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      config: {
        accountId: process.env.NETSUITE_ACCOUNT_ID ? 'configured' : 'missing',
        consumerKey: process.env.NETSUITE_CONSUMER_KEY ? 'configured' : 'missing',
        consumerSecret: process.env.NETSUITE_CONSUMER_SECRET ? 'configured' : 'missing',
        tokenId: process.env.NETSUITE_TOKEN_ID ? 'configured' : 'missing',
        tokenSecret: process.env.NETSUITE_TOKEN_SECRET ? 'configured' : 'missing',
      },
    });

  } catch (error) {
    console.error('Error testing NetSuite connection:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}
