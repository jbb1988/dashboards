import { NextRequest, NextResponse } from 'next/server';
import { getDiversifiedUnitsByClass } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters from query params
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');
    const classNameParam = searchParams.get('className');
    const groupBy = searchParams.get('groupBy') || 'all'; // 'top-level' or 'all'

    const years = yearsParam ? yearsParam.split(',').map(Number).filter(n => !isNaN(n)) : undefined;
    const months = monthsParam ? monthsParam.split(',').map(Number).filter(n => !isNaN(n)) : undefined;

    // Get units data with YoY comparison
    const unitsData = await getDiversifiedUnitsByClass({
      years,
      months,
      className: classNameParam || undefined,
      groupByParent: groupBy === 'top-level',
    });

    // Calculate summary stats
    const totalCurrentUnits = unitsData.byClass.reduce((sum, c) => sum + c.current_units, 0);
    const totalPriorUnits = unitsData.byClass.reduce((sum, c) => sum + c.prior_units, 0);
    const totalCurrentRevenue = unitsData.byClass.reduce((sum, c) => sum + c.current_revenue, 0);
    const totalPriorRevenue = unitsData.byClass.reduce((sum, c) => sum + c.prior_revenue, 0);

    const yoyChangePct = totalPriorUnits > 0
      ? ((totalCurrentUnits - totalPriorUnits) / totalPriorUnits) * 100
      : totalCurrentUnits > 0 ? 100 : 0;

    const revenueYoYChangePct = totalPriorRevenue > 0
      ? ((totalCurrentRevenue - totalPriorRevenue) / totalPriorRevenue) * 100
      : totalCurrentRevenue > 0 ? 100 : 0;

    return NextResponse.json({
      summary: {
        total_units_current: totalCurrentUnits,
        total_units_prior: totalPriorUnits,
        yoy_change_pct: yoyChangePct,
        total_revenue_current: totalCurrentRevenue,
        total_revenue_prior: totalPriorRevenue,
        revenue_yoy_change_pct: revenueYoYChangePct,
        total_classes: unitsData.byClass.length,
      },
      by_class: unitsData.byClass,
      monthly_trends: unitsData.monthlyTrends,
      top_items_by_class: unitsData.topItemsByClass,
      periods: unitsData.periods,
      filters: {
        years,
        months,
        className: classNameParam,
        groupBy,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching units data:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch units data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
