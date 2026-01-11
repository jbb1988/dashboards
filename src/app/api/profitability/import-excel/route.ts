import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// Excel data from TB Audit Monthly Reports v4.xlsx - Cost Audit sheet
// Aggregated by Project and Year
const EXCEL_DATA = [
  // 2024 Data
  { customer_name: "Midland", year: 2024, actual_revenue: 1399875.00, actual_cogs: 337619.32, budget_revenue: 1399875.00, budget_cogs: 411963.25 },
  { customer_name: "Newport News", year: 2024, actual_revenue: 554697.00, actual_cogs: 85640.99, budget_revenue: 554697.00, budget_cogs: 148254.39 },
  { customer_name: "Columbus", year: 2024, actual_revenue: 404527.00, actual_cogs: 86487.78, budget_revenue: 404527.00, budget_cogs: 113267.56 },
  { customer_name: "San Gabriel", year: 2024, actual_revenue: 391971.00, actual_cogs: 113689.17, budget_revenue: 391971.00, budget_cogs: 117591.30 },
  { customer_name: "Mesa", year: 2024, actual_revenue: 361165.00, actual_cogs: 108910.47, budget_revenue: 361165.00, budget_cogs: 108349.50 },
  { customer_name: "CUC", year: 2024, actual_revenue: 354585.00, actual_cogs: 69288.92, budget_revenue: 354585.00, budget_cogs: 98525.70 },
  { customer_name: "Badger", year: 2024, actual_revenue: 329348.00, actual_cogs: 69932.86, budget_revenue: 329348.00, budget_cogs: 98804.40 },
  { customer_name: "Allen", year: 2024, actual_revenue: 307582.00, actual_cogs: 73140.36, budget_revenue: 307582.00, budget_cogs: 84378.44 },
  { customer_name: "DC Water", year: 2024, actual_revenue: 306789.39, actual_cogs: 80943.92, budget_revenue: 306789.39, budget_cogs: 92036.82 },
  { customer_name: "Sarasota", year: 2024, actual_revenue: 281540.00, actual_cogs: 70612.51, budget_revenue: 281540.00, budget_cogs: 84462.00 },
  { customer_name: "San Diego", year: 2024, actual_revenue: 281108.33, actual_cogs: 82458.76, budget_revenue: 281108.33, budget_cogs: 84332.50 },
  { customer_name: "SCCRWA", year: 2024, actual_revenue: 179319.00, actual_cogs: 30956.53, budget_revenue: 179319.00, budget_cogs: 53795.70 },
  { customer_name: "Greensboro", year: 2024, actual_revenue: 167534.00, actual_cogs: 36026.26, budget_revenue: 167534.00, budget_cogs: 50260.20 },
  { customer_name: "Cucamonga", year: 2024, actual_revenue: 120000.00, actual_cogs: 34118.99, budget_revenue: 120000.00, budget_cogs: 36000.00 },
  { customer_name: "Middlesex", year: 2024, actual_revenue: 100456.05, actual_cogs: 30360.99, budget_revenue: 100456.05, budget_cogs: 30136.82 },
  { customer_name: "WSSC", year: 2024, actual_revenue: 66389.00, actual_cogs: 16499.48, budget_revenue: 66389.00, budget_cogs: 19916.70 },
  { customer_name: "Milwaukee", year: 2024, actual_revenue: 63364.00, actual_cogs: 5531.10, budget_revenue: 63364.00, budget_cogs: 19009.20 },
  { customer_name: "OCWA", year: 2024, actual_revenue: 58878.00, actual_cogs: 10455.76, budget_revenue: 58878.00, budget_cogs: 17663.40 },
  { customer_name: "San Jose", year: 2024, actual_revenue: 56488.00, actual_cogs: 7127.73, budget_revenue: 56488.00, budget_cogs: 16946.40 },
  { customer_name: "LADWP Central", year: 2024, actual_revenue: 55240.53, actual_cogs: 19087.90, budget_revenue: 55240.53, budget_cogs: 16572.16 },
  { customer_name: "Birmingham", year: 2024, actual_revenue: 52830.00, actual_cogs: 8954.22, budget_revenue: 52830.00, budget_cogs: 15849.00 },
  { customer_name: "Fairfax", year: 2024, actual_revenue: 48396.00, actual_cogs: 10044.45, budget_revenue: 48396.00, budget_cogs: 14518.80 },
  { customer_name: "Phoenix", year: 2024, actual_revenue: 47092.00, actual_cogs: 10685.36, budget_revenue: 47092.00, budget_cogs: 14127.60 },
  { customer_name: "Alameda", year: 2024, actual_revenue: 32584.00, actual_cogs: 4543.06, budget_revenue: 32584.00, budget_cogs: 9775.20 },

  // 2023 Data
  { customer_name: "Birmingham", year: 2023, actual_revenue: 2458907.00, actual_cogs: 534187.23, budget_revenue: 2458907.00, budget_cogs: 737672.10 },
  { customer_name: "CUC", year: 2023, actual_revenue: 761824.00, actual_cogs: 167320.48, budget_revenue: 761824.00, budget_cogs: 228547.20 },
  { customer_name: "Fairfax", year: 2023, actual_revenue: 595889.00, actual_cogs: 169253.12, budget_revenue: 595889.00, budget_cogs: 178766.70 },
  { customer_name: "Spokane", year: 2023, actual_revenue: 550176.00, actual_cogs: 150833.26, budget_revenue: 550176.00, budget_cogs: 165052.80 },
  { customer_name: "San Diego", year: 2023, actual_revenue: 390820.50, actual_cogs: 89854.72, budget_revenue: 390820.50, budget_cogs: 117246.15 },
  { customer_name: "WSSC", year: 2023, actual_revenue: 349987.00, actual_cogs: 98634.92, budget_revenue: 349987.00, budget_cogs: 104996.10 },
  { customer_name: "Badger", year: 2023, actual_revenue: 324862.00, actual_cogs: 64524.66, budget_revenue: 324862.00, budget_cogs: 97458.60 },
  { customer_name: "Milwaukee", year: 2023, actual_revenue: 260476.00, actual_cogs: 37892.84, budget_revenue: 260476.00, budget_cogs: 78142.80 },
  { customer_name: "Detroit", year: 2023, actual_revenue: 233498.00, actual_cogs: 82736.39, budget_revenue: 233498.00, budget_cogs: 70049.40 },
  { customer_name: "Middlesex", year: 2023, actual_revenue: 193124.85, actual_cogs: 53489.26, budget_revenue: 193124.85, budget_cogs: 57937.46 },

  // 2022 Data
  { customer_name: "Allen", year: 2022, actual_revenue: 708514.00, actual_cogs: 234289.28, budget_revenue: 706731.14, budget_cogs: 242766.91 },
  { customer_name: "Birmingham", year: 2022, actual_revenue: 691828.00, actual_cogs: 191782.45, budget_revenue: 691828.00, budget_cogs: 207548.40 },
  { customer_name: "Fairfax", year: 2022, actual_revenue: 656143.00, actual_cogs: 189224.53, budget_revenue: 656143.00, budget_cogs: 196842.90 },
  { customer_name: "Alameda", year: 2022, actual_revenue: 62640.00, actual_cogs: 9309.50, budget_revenue: 62640.00, budget_cogs: 18792.00 },
  { customer_name: "San Diego", year: 2022, actual_revenue: 516382.00, actual_cogs: 134572.89, budget_revenue: 516382.00, budget_cogs: 154914.60 },
  { customer_name: "Spokane", year: 2022, actual_revenue: 479232.00, actual_cogs: 140287.62, budget_revenue: 479232.00, budget_cogs: 143769.60 },
];

export async function POST() {
  try {
    const admin = getSupabaseAdmin();

    // Transform data to include computed GP
    const records = EXCEL_DATA.map(d => ({
      customer_name: d.customer_name,
      year: d.year,
      budget_revenue: d.budget_revenue,
      budget_cogs: d.budget_cogs,
      budget_gp: d.budget_revenue - d.budget_cogs,
      actual_revenue: d.actual_revenue,
      actual_cogs: d.actual_cogs,
      actual_gp: d.actual_revenue - d.actual_cogs,
      updated_at: new Date().toISOString(),
    }));

    // Upsert data
    const { error } = await admin
      .from('project_budgets')
      .upsert(records, {
        onConflict: 'year,customer_name',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Error importing Excel data:', error);
      return NextResponse.json({
        success: false,
        error: error.message,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Imported ${records.length} budget/actual records from Excel`,
      records: records.length,
      years: [...new Set(records.map(r => r.year))],
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST to this endpoint to import Excel cost audit data',
    dataSource: 'TB Audit Monthly Reports v4.xlsx - Cost Audit sheet',
    recordCount: EXCEL_DATA.length,
    years: [...new Set(EXCEL_DATA.map(d => d.year))],
    sampleData: EXCEL_DATA.slice(0, 5),
  });
}
