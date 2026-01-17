import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EquipmentPurchase {
  item_name: string;
  item_description: string;
  quantity: number;
  revenue: number;
  date: string;
}

interface VEROflowCustomer {
  customer_id: string;
  customer_name: string;
  equipment_purchases: EquipmentPurchase[];
  equipment_revenue: number;
  first_equipment_purchase: string | null;
  has_calibration: boolean;
  calibration_revenue: number;
  last_calibration_date: string | null;
  calibration_count: number;
}

interface VEROflowSummary {
  total_customers: number;
  customers_with_calibration: number;
  calibration_adoption_rate: number;
  total_equipment_revenue: number;
  total_calibration_revenue: number;
  opportunities: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters from query params
    const yearsParam = searchParams.get('years');
    const monthsParam = searchParams.get('months');

    const years = yearsParam ? yearsParam.split(',').map(Number) : undefined;
    const months = monthsParam ? monthsParam.split(',').map(Number) : undefined;

    // Build query for VEROflow-related sales (VEROflow products or calibration services)
    let query = supabase
      .from('diversified_sales')
      .select('*')
      .or('class_name.ilike.%veroflow%,class_name.ilike.%calibration%');

    // Apply year filter
    if (years && years.length > 0) {
      query = query.in('year', years);
    }

    // Apply month filter
    if (months && months.length > 0) {
      query = query.in('month', months);
    }

    const { data: veroflowSales, error } = await query.order('transaction_date', { ascending: false });

    if (error) {
      console.error('Error fetching VEROflow sales:', error);
      return NextResponse.json(
        { error: 'Failed to fetch VEROflow data', message: error.message },
        { status: 500 }
      );
    }

    // Aggregate by customer
    const customerMap = new Map<string, VEROflowCustomer>();

    for (const sale of veroflowSales || []) {
      // Determine if this is equipment or calibration
      const className = (sale.class_name || '').toLowerCase();
      const isEquipment = className.includes('veroflow') && !className.includes('calibration');
      const isCalibration = className.includes('calibration');

      if (!customerMap.has(sale.customer_id)) {
        customerMap.set(sale.customer_id, {
          customer_id: sale.customer_id,
          customer_name: sale.customer_name,
          equipment_purchases: [],
          equipment_revenue: 0,
          first_equipment_purchase: null,
          has_calibration: false,
          calibration_revenue: 0,
          last_calibration_date: null,
          calibration_count: 0,
        });
      }

      const customer = customerMap.get(sale.customer_id)!;

      if (isEquipment) {
        customer.equipment_purchases.push({
          item_name: sale.item_name || 'Unknown',
          item_description: sale.item_description || sale.item_name || 'Unknown Item',
          quantity: sale.quantity || 0,
          revenue: sale.revenue || 0,
          date: sale.transaction_date || '',
        });
        customer.equipment_revenue += sale.revenue || 0;

        const saleDate = sale.transaction_date || '';
        if (!customer.first_equipment_purchase || saleDate < customer.first_equipment_purchase) {
          customer.first_equipment_purchase = saleDate;
        }
      }

      if (isCalibration) {
        customer.has_calibration = true;
        customer.calibration_revenue += sale.revenue || 0;
        customer.calibration_count += 1;

        const saleDate = sale.transaction_date || '';
        if (!customer.last_calibration_date || saleDate > customer.last_calibration_date) {
          customer.last_calibration_date = saleDate;
        }
      }
    }

    // Convert to array and calculate metrics
    const customers = Array.from(customerMap.values());
    const totalCustomers = customers.length;
    const customersWithCalibration = customers.filter(c => c.has_calibration).length;
    const calibrationAdoptionRate = totalCustomers > 0 ? (customersWithCalibration / totalCustomers) * 100 : 0;
    const totalEquipmentRevenue = customers.reduce((sum, c) => sum + c.equipment_revenue, 0);
    const totalCalibrationRevenue = customers.reduce((sum, c) => sum + c.calibration_revenue, 0);
    const opportunities = customers.filter(c => c.equipment_revenue > 0 && !c.has_calibration).length;

    // Sort customers by equipment revenue (descending)
    const sortedCustomers = customers.sort((a, b) => b.equipment_revenue - a.equipment_revenue);

    const summary: VEROflowSummary = {
      total_customers: totalCustomers,
      customers_with_calibration: customersWithCalibration,
      calibration_adoption_rate: calibrationAdoptionRate,
      total_equipment_revenue: totalEquipmentRevenue,
      total_calibration_revenue: totalCalibrationRevenue,
      opportunities,
    };

    return NextResponse.json({
      summary,
      customers: sortedCustomers,
      filters: {
        years,
        months,
      },
      lastUpdated: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Error in VEROflow API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch VEROflow data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
