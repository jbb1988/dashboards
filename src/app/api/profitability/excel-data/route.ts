import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// This endpoint returns profitability data from the Excel import (project_budgets table)
// which is the source of truth for both Revenue and COGS in the TB/MCC business

interface ProjectBudgetRecord {
  id: string;
  customer_name: string;
  year: number;
  budget_revenue: number;
  budget_cogs: number;
  budget_gp: number;
  actual_revenue: number;
  actual_cogs: number;
  actual_gp: number;
  budget_gpm?: number;
  actual_gpm?: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const yearsParam = searchParams.get('years');
    const view = searchParams.get('view') || 'dashboard';

    // Parse years filter
    const years = yearsParam
      ? yearsParam.split(',').map(y => parseInt(y.trim())).filter(y => !isNaN(y))
      : undefined;

    const admin = getSupabaseAdmin();

    // Get all data from project_budgets
    let query = admin
      .from('project_budgets')
      .select('*')
      .order('year', { ascending: false })
      .order('actual_revenue', { ascending: false });

    if (years && years.length > 0) {
      query = query.in('year', years);
    }

    const { data: budgetData, error } = await query;

    if (error) {
      console.error('Error fetching budget data:', error);
      return NextResponse.json(
        { error: 'Failed to fetch data', message: error.message },
        { status: 500 }
      );
    }

    const records = (budgetData || []) as ProjectBudgetRecord[];

    // Get available years for filters
    const { data: yearsData } = await admin
      .from('project_budgets')
      .select('year')
      .order('year', { ascending: false });

    const availableYears = [...new Set((yearsData || []).map(d => d.year))];

    // Get unique customers
    const customers = [...new Set(records.map(r => r.customer_name))].sort();

    if (view === 'dashboard') {
      // Aggregate by customer across selected years
      const byCustomer = new Map<string, {
        customer_name: string;
        total_revenue: number;
        total_cogs: number;
        gross_profit: number;
        budget_revenue: number;
        budget_cogs: number;
        budget_gp: number;
        years: number[];
      }>();

      for (const r of records) {
        const key = r.customer_name;
        if (!byCustomer.has(key)) {
          byCustomer.set(key, {
            customer_name: r.customer_name,
            total_revenue: 0,
            total_cogs: 0,
            gross_profit: 0,
            budget_revenue: 0,
            budget_cogs: 0,
            budget_gp: 0,
            years: [],
          });
        }
        const agg = byCustomer.get(key)!;
        agg.total_revenue += r.actual_revenue || 0;
        agg.total_cogs += r.actual_cogs || 0;
        agg.gross_profit += r.actual_gp || (r.actual_revenue - r.actual_cogs) || 0;
        agg.budget_revenue += r.budget_revenue || 0;
        agg.budget_cogs += r.budget_cogs || 0;
        agg.budget_gp += r.budget_gp || 0;
        if (!agg.years.includes(r.year)) {
          agg.years.push(r.year);
        }
      }

      const projects = Array.from(byCustomer.values())
        .map(p => ({
          customer_name: p.customer_name,
          project_type: 'TB/MCC', // All data is Test Bench/MCC
          total_revenue: p.total_revenue,
          total_cogs: p.total_cogs,
          gross_profit: p.gross_profit,
          gross_profit_pct: p.total_revenue > 0 ? (p.gross_profit / p.total_revenue) * 100 : 0,
          transaction_count: p.years.length, // Number of years with data
          budget_revenue: p.budget_revenue,
          budget_cogs: p.budget_cogs,
          budget_gp: p.budget_gp,
          revenue_variance: p.total_revenue - p.budget_revenue,
          gp_variance: p.gross_profit - p.budget_gp,
          is_at_risk: p.total_revenue > 0 && ((p.gross_profit / p.total_revenue) * 100) < 50,
        }))
        .sort((a, b) => b.total_revenue - a.total_revenue);

      // Calculate summary
      const summary = {
        totalRevenue: projects.reduce((sum, p) => sum + p.total_revenue, 0),
        totalCogs: projects.reduce((sum, p) => sum + p.total_cogs, 0),
        grossProfit: projects.reduce((sum, p) => sum + p.gross_profit, 0),
        grossProfitPct: 0,
        projectCount: projects.length,
        atRiskCount: projects.filter(p => p.is_at_risk).length,
      };
      summary.grossProfitPct = summary.totalRevenue > 0
        ? (summary.grossProfit / summary.totalRevenue) * 100
        : 0;

      // Calculate budget variance
      const budgetVariance = {
        budgetRevenue: projects.reduce((sum, p) => sum + p.budget_revenue, 0),
        budgetCogs: projects.reduce((sum, p) => sum + p.budget_cogs, 0),
        budgetGp: projects.reduce((sum, p) => sum + p.budget_gp, 0),
        revenueVariance: summary.totalRevenue - projects.reduce((sum, p) => sum + p.budget_revenue, 0),
        cogsVariance: summary.totalCogs - projects.reduce((sum, p) => sum + p.budget_cogs, 0),
        gpVariance: summary.grossProfit - projects.reduce((sum, p) => sum + p.budget_gp, 0),
      };

      // Monthly trend (aggregate by year since Excel data is annual)
      const monthly = availableYears.map(year => {
        const yearData = records.filter(r => r.year === year);
        const revenue = yearData.reduce((sum, r) => sum + (r.actual_revenue || 0), 0);
        const cogs = yearData.reduce((sum, r) => sum + (r.actual_cogs || 0), 0);
        const gp = revenue - cogs;
        return {
          year,
          month: 6, // Mid-year placeholder since data is annual
          monthName: year.toString(),
          revenue,
          cogs,
          grossProfit: gp,
          grossProfitPct: revenue > 0 ? (gp / revenue) * 100 : 0,
        };
      }).sort((a, b) => a.year - b.year);

      // Type breakdown (all TB/MCC in this data)
      const types = [{
        project_type: 'TB/MCC',
        total_revenue: summary.totalRevenue,
        total_cogs: summary.totalCogs,
        gross_profit: summary.grossProfit,
        gross_profit_pct: summary.grossProfitPct,
        project_count: projects.length,
      }];

      return NextResponse.json({
        summary,
        budgetVariance,
        projects,
        monthly,
        types,
        filterOptions: {
          years: availableYears,
          projectTypes: ['TB/MCC'],
          customers,
        },
        lastUpdated: new Date().toISOString(),
        source: 'excel_import',
      });
    }

    // Default: return raw records
    return NextResponse.json({
      records,
      count: records.length,
      filterOptions: {
        years: availableYears,
        customers,
      },
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in excel-data API:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch data',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
