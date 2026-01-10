import { NextResponse } from 'next/server';
import { getDiversifiedBudgets } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const budgets = await getDiversifiedBudgets();

    return NextResponse.json({
      success: true,
      budgets,
      count: budgets.length,
    });
  } catch (error) {
    console.error('Error fetching budgets:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch budgets',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
