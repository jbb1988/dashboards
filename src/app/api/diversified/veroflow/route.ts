import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type VEROflowType = 'VF-1' | 'VF-4' | 'unknown';

interface EquipmentPurchase {
  item_name: string;
  item_description: string;
  quantity: number;
  revenue: number;
  date: string;
  equipment_type: VEROflowType;
}

interface EquipmentByType {
  vf1_units: EquipmentPurchase[];
  vf4_units: EquipmentPurchase[];
  unknown_units: EquipmentPurchase[];
  vf1_count: number;
  vf4_count: number;
  vf1_revenue: number;
  vf4_revenue: number;
}

interface CalibrationService {
  item_name: string;
  item_description: string;
  quantity: number;
  revenue: number;
  date: string;
}

interface CalibrationData {
  total_calibrations: number;
  total_revenue: number;
  last_calibration_date: string | null;
  vf1_calibrations: number;
  vf4_calibrations: number;
  both_types_calibrations: number;
  vf1_last_calibration: string | null;
  vf4_last_calibration: string | null;
  calibration_services: CalibrationService[];
}

interface VEROflowCustomer {
  customer_id: string;
  customer_name: string;
  equipment: EquipmentByType;
  equipment_revenue: number;
  first_equipment_purchase: string | null;
  calibration: CalibrationData;
  has_calibration: boolean;
  owns_vf1_needs_calibration: boolean;
  owns_vf4_needs_calibration: boolean;
}

interface VEROflowSummary {
  total_customers: number;
  customers_with_calibration: number;
  calibration_adoption_rate: number;
  total_equipment_revenue: number;
  total_calibration_revenue: number;
  opportunities: number;
  vf1_metrics: {
    customers: number;
    units_sold: number;
    equipment_revenue: number;
    calibrations: number;
    calibration_revenue: number;
    calibration_adoption_rate: number;
    opportunities: number;
  };
  vf4_metrics: {
    customers: number;
    units_sold: number;
    equipment_revenue: number;
    calibrations: number;
    calibration_revenue: number;
    calibration_adoption_rate: number;
    opportunities: number;
  };
  both_types_customers: number;
}

// Equipment type detection function
function detectEquipmentType(itemDescription: string): VEROflowType {
  const desc = itemDescription.toLowerCase();

  // VF-4 patterns (check first - more specific)
  if (desc.includes('vf-4') || desc.includes('vf4') ||
      desc.includes('veroflow-4') || desc.includes('veroflow 4') ||
      desc.includes('touch')) {
    return 'VF-4';
  }

  // VF-1 patterns
  if (desc.includes('vf-1') || desc.includes('vf1') ||
      desc.includes('veroflow-1') || desc.includes('veroflow 1')) {
    return 'VF-1';
  }

  return 'unknown';
}

// Calibration apportionment logic
function apportionCalibrations(
  vf1Count: number,
  vf4Count: number,
  totalCalibrations: number,
  calibrationRevenue: number,
  calibrationDates: string[],
  calibrationServices: CalibrationService[]
): CalibrationData {
  const totalUnits = vf1Count + vf4Count;
  const lastCalibration = calibrationDates.length > 0
    ? calibrationDates.reduce((latest, current) => current > latest ? current : latest)
    : null;

  // Only VF-1 units
  if (vf4Count === 0 && vf1Count > 0) {
    return {
      total_calibrations: totalCalibrations,
      total_revenue: calibrationRevenue,
      last_calibration_date: lastCalibration,
      vf1_calibrations: totalCalibrations,
      vf4_calibrations: 0,
      both_types_calibrations: 0,
      vf1_last_calibration: lastCalibration,
      vf4_last_calibration: null,
      calibration_services: calibrationServices,
    };
  }

  // Only VF-4 units
  if (vf1Count === 0 && vf4Count > 0) {
    return {
      total_calibrations: totalCalibrations,
      total_revenue: calibrationRevenue,
      last_calibration_date: lastCalibration,
      vf1_calibrations: 0,
      vf4_calibrations: totalCalibrations,
      both_types_calibrations: 0,
      vf1_last_calibration: null,
      vf4_last_calibration: lastCalibration,
      calibration_services: calibrationServices,
    };
  }

  // Both types: split proportionally
  if (vf1Count > 0 && vf4Count > 0) {
    const vf1Ratio = vf1Count / totalUnits;
    const vf4Ratio = vf4Count / totalUnits;

    return {
      total_calibrations: totalCalibrations,
      total_revenue: calibrationRevenue,
      last_calibration_date: lastCalibration,
      vf1_calibrations: Math.round(totalCalibrations * vf1Ratio),
      vf4_calibrations: Math.round(totalCalibrations * vf4Ratio),
      both_types_calibrations: totalCalibrations,
      vf1_last_calibration: lastCalibration,
      vf4_last_calibration: lastCalibration,
      calibration_services: calibrationServices,
    };
  }

  // No equipment but has calibrations (purchased before data history)
  return {
    total_calibrations: totalCalibrations,
    total_revenue: calibrationRevenue,
    last_calibration_date: lastCalibration,
    vf1_calibrations: 0,
    vf4_calibrations: 0,
    both_types_calibrations: 0,
    vf1_last_calibration: null,
    vf4_last_calibration: null,
    calibration_services: calibrationServices,
  };
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

    // First pass: aggregate equipment and calibrations
    for (const sale of veroflowSales || []) {
      // Determine if this is equipment or calibration
      const className = (sale.class_name || '').toLowerCase();
      const isEquipment = className.includes('veroflow') && !className.includes('calibration');
      const isCalibration = className.includes('calibration');

      if (!customerMap.has(sale.customer_id)) {
        customerMap.set(sale.customer_id, {
          customer_id: sale.customer_id,
          customer_name: sale.customer_name,
          equipment: {
            vf1_units: [],
            vf4_units: [],
            unknown_units: [],
            vf1_count: 0,
            vf4_count: 0,
            vf1_revenue: 0,
            vf4_revenue: 0,
          },
          equipment_revenue: 0,
          first_equipment_purchase: null,
          calibration: {
            total_calibrations: 0,
            total_revenue: 0,
            last_calibration_date: null,
            vf1_calibrations: 0,
            vf4_calibrations: 0,
            both_types_calibrations: 0,
            vf1_last_calibration: null,
            vf4_last_calibration: null,
            calibration_services: [],
          },
          has_calibration: false,
          owns_vf1_needs_calibration: false,
          owns_vf4_needs_calibration: false,
        });
      }

      const customer = customerMap.get(sale.customer_id)!;

      if (isEquipment) {
        const equipmentType = detectEquipmentType(sale.item_description || sale.item_name || '');
        const purchase: EquipmentPurchase = {
          item_name: sale.item_name || 'Unknown',
          item_description: sale.item_description || sale.item_name || 'Unknown Item',
          quantity: sale.quantity || 0,
          revenue: sale.revenue || 0,
          date: sale.transaction_date || '',
          equipment_type: equipmentType,
        };

        // Add to appropriate array based on type
        if (equipmentType === 'VF-1') {
          customer.equipment.vf1_units.push(purchase);
          customer.equipment.vf1_count += purchase.quantity;
          customer.equipment.vf1_revenue += purchase.revenue;
        } else if (equipmentType === 'VF-4') {
          customer.equipment.vf4_units.push(purchase);
          customer.equipment.vf4_count += purchase.quantity;
          customer.equipment.vf4_revenue += purchase.revenue;
        } else {
          customer.equipment.unknown_units.push(purchase);
        }

        customer.equipment_revenue += sale.revenue || 0;

        const saleDate = sale.transaction_date || '';
        if (!customer.first_equipment_purchase || saleDate < customer.first_equipment_purchase) {
          customer.first_equipment_purchase = saleDate;
        }
      }
    }

    // Second pass: apportion calibrations based on equipment owned
    const calibrationDatesMap = new Map<string, string[]>();
    const calibrationRevenueMap = new Map<string, number>();
    const calibrationCountMap = new Map<string, number>();
    const calibrationServicesMap = new Map<string, CalibrationService[]>();

    for (const sale of veroflowSales || []) {
      const className = (sale.class_name || '').toLowerCase();
      const isCalibration = className.includes('calibration');

      if (isCalibration) {
        if (!calibrationDatesMap.has(sale.customer_id)) {
          calibrationDatesMap.set(sale.customer_id, []);
          calibrationRevenueMap.set(sale.customer_id, 0);
          calibrationCountMap.set(sale.customer_id, 0);
          calibrationServicesMap.set(sale.customer_id, []);
        }

        calibrationDatesMap.get(sale.customer_id)!.push(sale.transaction_date || '');
        calibrationRevenueMap.set(
          sale.customer_id,
          (calibrationRevenueMap.get(sale.customer_id) || 0) + (sale.revenue || 0)
        );
        calibrationCountMap.set(
          sale.customer_id,
          (calibrationCountMap.get(sale.customer_id) || 0) + 1
        );
        calibrationServicesMap.get(sale.customer_id)!.push({
          item_name: sale.item_name || 'Unknown Service',
          item_description: sale.item_description || sale.item_name || 'Calibration Service',
          quantity: sale.quantity || 0,
          revenue: sale.revenue || 0,
          date: sale.transaction_date || '',
        });
      }
    }

    // Apply apportionment to each customer
    for (const [customerId, customer] of customerMap.entries()) {
      const calibrationDates = calibrationDatesMap.get(customerId) || [];
      const calibrationRevenue = calibrationRevenueMap.get(customerId) || 0;
      const calibrationCount = calibrationCountMap.get(customerId) || 0;
      const calibrationServices = calibrationServicesMap.get(customerId) || [];

      if (calibrationCount > 0) {
        customer.has_calibration = true;
        customer.calibration = apportionCalibrations(
          customer.equipment.vf1_count,
          customer.equipment.vf4_count,
          calibrationCount,
          calibrationRevenue,
          calibrationDates,
          calibrationServices
        );
      }

      // Set opportunity flags
      customer.owns_vf1_needs_calibration = customer.equipment.vf1_count > 0 && !customer.has_calibration;
      customer.owns_vf4_needs_calibration = customer.equipment.vf4_count > 0 && !customer.has_calibration;
    }

    // Convert to array and calculate summary metrics
    const customers = Array.from(customerMap.values());
    const totalCustomers = customers.length;
    const customersWithCalibration = customers.filter(c => c.has_calibration).length;
    const calibrationAdoptionRate = totalCustomers > 0 ? (customersWithCalibration / totalCustomers) * 100 : 0;
    const totalEquipmentRevenue = customers.reduce((sum, c) => sum + c.equipment_revenue, 0);
    const totalCalibrationRevenue = customers.reduce((sum, c) => sum + c.calibration.total_revenue, 0);
    const opportunities = customers.filter(c => c.equipment_revenue > 0 && !c.has_calibration).length;

    // Calculate VF-1 specific metrics
    const vf1Customers = customers.filter(c => c.equipment.vf1_count > 0);
    const vf1CustomersWithCalibration = vf1Customers.filter(c => c.has_calibration);
    const vf1Metrics = {
      customers: vf1Customers.length,
      units_sold: vf1Customers.reduce((sum, c) => sum + c.equipment.vf1_count, 0),
      equipment_revenue: vf1Customers.reduce((sum, c) => sum + c.equipment.vf1_revenue, 0),
      calibrations: vf1Customers.reduce((sum, c) => sum + c.calibration.vf1_calibrations, 0),
      calibration_revenue: vf1CustomersWithCalibration.reduce((sum, c) => {
        const totalUnits = c.equipment.vf1_count + c.equipment.vf4_count;
        if (totalUnits === 0) return sum;
        const vf1Ratio = c.equipment.vf1_count / totalUnits;
        return sum + (c.calibration.total_revenue * vf1Ratio);
      }, 0),
      calibration_adoption_rate: vf1Customers.length > 0
        ? (vf1CustomersWithCalibration.length / vf1Customers.length) * 100
        : 0,
      opportunities: vf1Customers.filter(c => c.owns_vf1_needs_calibration).length,
    };

    // Calculate VF-4 specific metrics
    const vf4Customers = customers.filter(c => c.equipment.vf4_count > 0);
    const vf4CustomersWithCalibration = vf4Customers.filter(c => c.has_calibration);
    const vf4Metrics = {
      customers: vf4Customers.length,
      units_sold: vf4Customers.reduce((sum, c) => sum + c.equipment.vf4_count, 0),
      equipment_revenue: vf4Customers.reduce((sum, c) => sum + c.equipment.vf4_revenue, 0),
      calibrations: vf4Customers.reduce((sum, c) => sum + c.calibration.vf4_calibrations, 0),
      calibration_revenue: vf4CustomersWithCalibration.reduce((sum, c) => {
        const totalUnits = c.equipment.vf1_count + c.equipment.vf4_count;
        if (totalUnits === 0) return sum;
        const vf4Ratio = c.equipment.vf4_count / totalUnits;
        return sum + (c.calibration.total_revenue * vf4Ratio);
      }, 0),
      calibration_adoption_rate: vf4Customers.length > 0
        ? (vf4CustomersWithCalibration.length / vf4Customers.length) * 100
        : 0,
      opportunities: vf4Customers.filter(c => c.owns_vf4_needs_calibration).length,
    };

    // Count customers with both types
    const bothTypesCustomers = customers.filter(
      c => c.equipment.vf1_count > 0 && c.equipment.vf4_count > 0
    ).length;

    // Sort customers by equipment revenue (descending)
    const sortedCustomers = customers.sort((a, b) => b.equipment_revenue - a.equipment_revenue);

    const summary: VEROflowSummary = {
      total_customers: totalCustomers,
      customers_with_calibration: customersWithCalibration,
      calibration_adoption_rate: calibrationAdoptionRate,
      total_equipment_revenue: totalEquipmentRevenue,
      total_calibration_revenue: totalCalibrationRevenue,
      opportunities,
      vf1_metrics: vf1Metrics,
      vf4_metrics: vf4Metrics,
      both_types_customers: bothTypesCustomers,
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
