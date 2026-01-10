import { NextResponse } from 'next/server';
import { upsertDiversifiedBudgets } from '@/lib/supabase';

// 2025 Monthly Budget by Class (same for all 12 months)
const BUDGET_2025 = [
  { class_name: 'Meter Testing', budget_revenue: 9541.00 },
  { class_name: 'RCM', budget_revenue: 27129.00 },
  { class_name: 'Calibrations', budget_revenue: 9541.00 },
  { class_name: 'Drill Taps', budget_revenue: 7844.00 },
  { class_name: 'Resale Other', budget_revenue: 13435.00 },
  { class_name: 'Zinc Caps', budget_revenue: 13986.00 },
  { class_name: 'Valve Keys', budget_revenue: 32251.00 },
  { class_name: 'VEROflow', budget_revenue: 22968.00 },
  { class_name: 'Strainers', budget_revenue: 34821.00 },
  { class_name: 'Spools', budget_revenue: 109780.00 },
];

// Total monthly budget: $281,296.00

export async function POST() {
  try {
    const budgetRecords = [];

    // Generate records for all 12 months of 2025
    for (let month = 1; month <= 12; month++) {
      for (const classData of BUDGET_2025) {
        budgetRecords.push({
          year: 2025,
          month,
          class_name: classData.class_name,
          class_category: 'Diversified Products',
          budget_revenue: classData.budget_revenue,
          budget_units: 0, // Not provided in source data
          budget_cost: 0,  // Not provided in source data
          budget_gross_profit: 0, // Not provided in source data
        });
      }
    }

    const result = await upsertDiversifiedBudgets(budgetRecords);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to seed budgets', message: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Seeded ${result.count} budget records for 2025 (${BUDGET_2025.length} classes × 12 months)`,
      totalMonthlyBudget: BUDGET_2025.reduce((sum, c) => sum + c.budget_revenue, 0),
      totalAnnualBudget: BUDGET_2025.reduce((sum, c) => sum + c.budget_revenue, 0) * 12,
      classes: BUDGET_2025.map(c => c.class_name),
    });
  } catch (error) {
    console.error('Error seeding budgets:', error);
    return NextResponse.json(
      {
        error: 'Failed to seed budgets',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
