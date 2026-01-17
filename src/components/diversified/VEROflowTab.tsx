'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import React from 'react';

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

interface CalibrationData {
  total_calibrations: number;
  total_revenue: number;
  last_calibration_date: string | null;
  vf1_calibrations: number;
  vf4_calibrations: number;
  both_types_calibrations: number;
  vf1_last_calibration: string | null;
  vf4_last_calibration: string | null;
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

interface VEROflowResponse {
  summary: VEROflowSummary;
  customers: VEROflowCustomer[];
  filters: {
    years?: number[];
    months?: number[];
  };
  lastUpdated: string;
}

interface VEROflowTabProps {
  filters?: {
    years?: number[];
    months?: number[];
  };
}

function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function VEROflowTab({ filters }: VEROflowTabProps) {
  const [data, setData] = useState<VEROflowResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'name' | 'equipment_revenue' | 'calibration_revenue' | 'first_purchase'>('equipment_revenue');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCalibration, setFilterCalibration] = useState<'all' | 'active' | 'opportunity'>('all');
  const [equipmentFilter, setEquipmentFilter] = useState<'all' | 'vf1' | 'vf4'>('all');
  const [creatingTask, setCreatingTask] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (filters?.years && filters.years.length > 0) {
          params.set('years', filters.years.join(','));
        }
        if (filters?.months && filters.months.length > 0) {
          params.set('months', filters.months.join(','));
        }
        const url = `/api/diversified/veroflow${params.toString() ? `?${params.toString()}` : ''}`;
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error('Failed to fetch VEROflow data');
        }
        const result = await response.json();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  const filteredAndSortedCustomers = useMemo(() => {
    if (!data) return [];

    let filtered = data.customers;

    // Apply equipment type filter
    if (equipmentFilter === 'vf1') {
      filtered = filtered.filter(c => c.equipment.vf1_count > 0);
    } else if (equipmentFilter === 'vf4') {
      filtered = filtered.filter(c => c.equipment.vf4_count > 0);
    }

    // Apply calibration status filter
    if (filterCalibration === 'active') {
      filtered = filtered.filter(c => c.has_calibration);
    } else if (filterCalibration === 'opportunity') {
      filtered = filtered.filter(c => {
        if (equipmentFilter === 'vf1') return c.owns_vf1_needs_calibration;
        if (equipmentFilter === 'vf4') return c.owns_vf4_needs_calibration;
        return !c.has_calibration;
      });
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.customer_name.toLowerCase().includes(search)
      );
    }

    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aVal: any, bVal: any;
      switch (sortBy) {
        case 'name':
          aVal = a.customer_name.toLowerCase();
          bVal = b.customer_name.toLowerCase();
          return sortOrder === 'desc'
            ? bVal.localeCompare(aVal)
            : aVal.localeCompare(bVal);
        case 'equipment_revenue':
          aVal = a.equipment_revenue;
          bVal = b.equipment_revenue;
          break;
        case 'calibration_revenue':
          aVal = a.calibration.total_revenue;
          bVal = b.calibration.total_revenue;
          break;
        case 'first_purchase':
          aVal = a.first_equipment_purchase || '';
          bVal = b.first_equipment_purchase || '';
          return sortOrder === 'desc'
            ? bVal.localeCompare(aVal)
            : aVal.localeCompare(bVal);
        default:
          aVal = a.equipment_revenue;
          bVal = b.equipment_revenue;
      }
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return sorted;
  }, [data, equipmentFilter, filterCalibration, searchTerm, sortBy, sortOrder]);

  const handleSort = (column: typeof sortBy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
  };

  const toggleRowExpansion = (customerId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(customerId)) {
      newExpanded.delete(customerId);
    } else {
      newExpanded.add(customerId);
    }
    setExpandedRows(newExpanded);
  };

  const handleRecommendCalibration = async (customer: VEROflowCustomer) => {
    setCreatingTask(customer.customer_id);
    try {
      const equipmentList = [
        ...customer.equipment.vf1_units.map(e => `- ${e.item_description || e.item_name} (VF-1)`),
        ...customer.equipment.vf4_units.map(e => `- ${e.item_description || e.item_name} (VF-4)`),
        ...customer.equipment.unknown_units.map(e => `- ${e.item_description || e.item_name}`),
      ].join('\n');

      const taskData = {
        title: `Follow up with ${customer.customer_name} about calibration services`,
        description: `Customer owns VEROflow equipment but hasn't used calibration services.\n\nEquipment owned:\n${equipmentList}\n\nRecommend annual calibration to maintain accuracy and compliance.`,
        priority: 'medium',
        customer_name: customer.customer_name,
        source: 'veroflow_tracking',
      };

      const response = await fetch('/api/diversified/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      });

      if (!response.ok) {
        throw new Error('Failed to create task in Asana');
      }

      // Show success toast
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100] flex items-center gap-2 animate-slide-in';
      toast.innerHTML = `
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>Task created in Asana!</span>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } catch (err) {
      const toast = document.createElement('div');
      toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-[100] flex items-center gap-2';
      toast.innerHTML = `
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
        <span>Failed to create task</span>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    } finally {
      setCreatingTask(null);
    }
  };

  const handleExportCSV = () => {
    if (!data) return;

    const csv = [
      [
        'Customer Name',
        'VF-1 Units',
        'VF-4 Units',
        'First Purchase',
        'Equipment Revenue',
        'VF-1 Revenue',
        'VF-4 Revenue',
        'Calibration Status',
        'Last Calibration',
        'Service Revenue',
        'VF-1 Calibrations',
        'VF-4 Calibrations',
        'VF-1 Opportunity',
        'VF-4 Opportunity',
      ],
      ...filteredAndSortedCustomers.map(c => [
        c.customer_name,
        c.equipment.vf1_count.toString(),
        c.equipment.vf4_count.toString(),
        c.first_equipment_purchase || 'N/A',
        c.equipment_revenue.toFixed(2),
        c.equipment.vf1_revenue.toFixed(2),
        c.equipment.vf4_revenue.toFixed(2),
        c.has_calibration ? 'Active' : 'Opportunity',
        c.calibration.last_calibration_date || 'Never',
        c.calibration.total_revenue.toFixed(2),
        c.calibration.vf1_calibrations.toString(),
        c.calibration.vf4_calibrations.toString(),
        c.owns_vf1_needs_calibration ? 'Yes' : 'No',
        c.owns_vf4_needs_calibration ? 'Yes' : 'No',
      ]),
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `veroflow-customers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  // Determine which metrics to show based on filter
  const displayMetrics = equipmentFilter === 'vf1'
    ? data.summary.vf1_metrics
    : equipmentFilter === 'vf4'
    ? data.summary.vf4_metrics
    : {
        customers: data.summary.total_customers,
        calibration_adoption_rate: data.summary.calibration_adoption_rate,
        equipment_revenue: data.summary.total_equipment_revenue,
        calibration_revenue: data.summary.total_calibration_revenue,
        opportunities: data.summary.opportunities,
      };

  const filterColor = equipmentFilter === 'vf1' ? 'cyan' : equipmentFilter === 'vf4' ? 'emerald' : 'purple';

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            {equipmentFilter === 'all' ? 'VEROflow Customers' : equipmentFilter === 'vf1' ? 'VF-1 Customers' : 'VF-4 Customers'}
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {displayMetrics.customers}
            </div>
            <svg className={`w-6 h-6 text-${filterColor}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            Calibration Adoption
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {displayMetrics.calibration_adoption_rate.toFixed(1)}%
            </div>
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            {equipmentFilter === 'all' && `${data.summary.customers_with_calibration} of ${data.summary.total_customers} customers`}
            {equipmentFilter === 'vf1' && `${data.summary.vf1_metrics.customers} VF-1 customers`}
            {equipmentFilter === 'vf4' && `${data.summary.vf4_metrics.customers} VF-4 customers`}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            Equipment Revenue
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {formatCurrency(displayMetrics.equipment_revenue)}
            </div>
            <svg className={`w-6 h-6 text-${filterColor}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          {equipmentFilter !== 'all' && (
            <div className="text-[11px] text-[#64748B] mt-1">
              {equipmentFilter === 'vf1' ? data.summary.vf1_metrics.units_sold : data.summary.vf4_metrics.units_sold} units sold
            </div>
          )}
        </div>

        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            Service Revenue
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {formatCurrency(displayMetrics.calibration_revenue || 0)}
            </div>
            <svg className={`w-6 h-6 text-${filterColor}-400`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      </div>

      {/* Opportunity Banner */}
      {displayMetrics.opportunities > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[13px] text-amber-300">
                <span className="font-semibold">{displayMetrics.opportunities}</span> customers own{' '}
                {equipmentFilter === 'vf1' ? 'VF-1' : equipmentFilter === 'vf4' ? 'VF-4' : 'VEROflow'} equipment but haven't used calibration services
              </span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Equipment Type Filters */}
      <div className="flex items-center gap-3 p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
        <span className="text-[11px] text-[#64748B] uppercase tracking-wide font-medium">
          Equipment Type:
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEquipmentFilter('all')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              equipmentFilter === 'all'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
            }`}
          >
            All Equipment
          </button>
          <button
            onClick={() => setEquipmentFilter('vf1')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              equipmentFilter === 'vf1'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
            }`}
          >
            VF-1 Only
          </button>
          <button
            onClick={() => setEquipmentFilter('vf4')}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
              equipmentFilter === 'vf4'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
            }`}
          >
            VF-4 Only
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search customers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-[#64748B] focus:outline-none focus:border-purple-500/50 text-[13px]"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterCalibration('all')}
            className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
              filterCalibration === 'all'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilterCalibration('active')}
            className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
              filterCalibration === 'active'
                ? 'bg-green-500/20 text-green-300 border border-green-500/30'
                : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
            }`}
          >
            Active
          </button>
          <button
            onClick={() => setFilterCalibration('opportunity')}
            className={`px-3 py-2 rounded-lg text-[12px] font-medium transition-all ${
              filterCalibration === 'opportunity'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'bg-white/5 text-[#94A3B8] hover:bg-white/10'
            }`}
          >
            Opportunities
          </button>
        </div>

        <button
          onClick={handleExportCSV}
          className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[#94A3B8] text-[13px] font-medium transition-all flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Customer Table */}
      <div className="bg-[#0F1123] rounded-lg border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="px-4 py-3 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide w-8"></th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Customer
                    {sortBy === 'name' && (
                      <span className="text-purple-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide">
                  Equipment
                </th>
                <th
                  className="px-4 py-3 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('first_purchase')}
                >
                  <div className="flex items-center gap-1">
                    First Purchase
                    {sortBy === 'first_purchase' && (
                      <span className="text-purple-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th
                  className="px-4 py-3 text-right text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('equipment_revenue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Equipment $
                    {sortBy === 'equipment_revenue' && (
                      <span className="text-purple-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide">
                  Calibration
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide">
                  Last Calibration
                </th>
                <th
                  className="px-4 py-3 text-right text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide cursor-pointer hover:text-white transition-colors"
                  onClick={() => handleSort('calibration_revenue')}
                >
                  <div className="flex items-center justify-end gap-1">
                    Service $
                    {sortBy === 'calibration_revenue' && (
                      <span className="text-purple-400">{sortOrder === 'desc' ? '↓' : '↑'}</span>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-[11px] font-medium text-[#94A3B8] uppercase tracking-wide">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-[#64748B] text-[13px]">
                    No customers found
                  </td>
                </tr>
              ) : (
                filteredAndSortedCustomers.map((customer) => {
                  const isExpanded = expandedRows.has(customer.customer_id);
                  const hasEquipmentDetails =
                    customer.equipment.vf1_units.length > 0 ||
                    customer.equipment.vf4_units.length > 0 ||
                    customer.equipment.unknown_units.length > 0;

                  return (
                    <React.Fragment key={customer.customer_id}>
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
                          {hasEquipmentDetails && (
                            <button
                              onClick={() => toggleRowExpansion(customer.customer_id)}
                              className="text-[#64748B] hover:text-white transition-colors"
                            >
                              <svg
                                className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-medium text-white">
                            {customer.customer_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2 text-[12px]">
                            {customer.equipment.vf1_count > 0 && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                                VF-1 ({customer.equipment.vf1_count})
                              </span>
                            )}
                            {customer.equipment.vf4_count > 0 && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                                VF-4 ({customer.equipment.vf4_count})
                              </span>
                            )}
                            {customer.equipment.unknown_units.length > 0 && (
                              <span className="px-2 py-0.5 rounded text-[10px] bg-gray-500/20 text-gray-300">
                                Other ({customer.equipment.unknown_units.length})
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] text-[#94A3B8]">
                            {formatDate(customer.first_equipment_purchase)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-[13px] font-medium text-white">
                            {formatCurrency(customer.equipment_revenue)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-1 rounded-md text-[11px] font-medium border ${
                              customer.has_calibration
                                ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            }`}
                          >
                            {customer.has_calibration ? 'Active' : 'Opportunity'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] text-[#94A3B8]">
                            {formatDate(customer.calibration.last_calibration_date)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-[13px] font-medium text-white">
                            {formatCurrency(customer.calibration.total_revenue)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {!customer.has_calibration && customer.equipment_revenue > 0 && (
                            <button
                              onClick={() => handleRecommendCalibration(customer)}
                              disabled={creatingTask === customer.customer_id}
                              className="px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-md text-[11px] font-medium text-purple-300 transition-all disabled:opacity-50"
                            >
                              {creatingTask === customer.customer_id ? (
                                <span className="flex items-center gap-1">
                                  <div className="w-3 h-3 border-2 border-purple-300 border-t-transparent rounded-full animate-spin" />
                                  Creating...
                                </span>
                              ) : (
                                'Create Task'
                              )}
                            </button>
                          )}
                        </td>
                      </tr>
                      {isExpanded && hasEquipmentDetails && (
                        <tr className="bg-white/[0.02] border-b border-white/5">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="pl-6 space-y-4">
                              {/* VF-1 Equipment Section */}
                              {customer.equipment.vf1_units.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="text-[11px] font-semibold text-cyan-300 uppercase">
                                        VF-1 Units ({customer.equipment.vf1_count})
                                      </div>
                                      {customer.owns_vf1_needs_calibration && (
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                          Calibration Opportunity
                                        </span>
                                      )}
                                    </div>
                                    {customer.calibration.vf1_last_calibration && (
                                      <div className="text-[11px] text-[#64748B]">
                                        Last calibration: {formatDate(customer.calibration.vf1_last_calibration)}
                                      </div>
                                    )}
                                  </div>
                                  {customer.equipment.vf1_units.map((item, idx) => (
                                    <div key={idx} className="py-2 px-3 bg-cyan-500/5 rounded-lg border border-cyan-500/20">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="text-[12px] font-medium text-white">
                                            {item.item_description}
                                          </div>
                                          <div className="text-[11px] text-[#64748B] mt-0.5">
                                            Purchased: {formatDate(item.date)} • Qty: {item.quantity}
                                          </div>
                                        </div>
                                        <div className="text-[13px] font-medium text-white">
                                          {formatCurrency(item.revenue)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* VF-4 Equipment Section */}
                              {customer.equipment.vf4_units.length > 0 && (
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                      <div className="text-[11px] font-semibold text-emerald-300 uppercase">
                                        VF-4 Units ({customer.equipment.vf4_count})
                                      </div>
                                      {customer.owns_vf4_needs_calibration && (
                                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                          Calibration Opportunity
                                        </span>
                                      )}
                                    </div>
                                    {customer.calibration.vf4_last_calibration && (
                                      <div className="text-[11px] text-[#64748B]">
                                        Last calibration: {formatDate(customer.calibration.vf4_last_calibration)}
                                      </div>
                                    )}
                                  </div>
                                  {customer.equipment.vf4_units.map((item, idx) => (
                                    <div key={idx} className="py-2 px-3 bg-emerald-500/5 rounded-lg border border-emerald-500/20">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="text-[12px] font-medium text-white">
                                            {item.item_description}
                                          </div>
                                          <div className="text-[11px] text-[#64748B] mt-0.5">
                                            Purchased: {formatDate(item.date)} • Qty: {item.quantity}
                                          </div>
                                        </div>
                                        <div className="text-[13px] font-medium text-white">
                                          {formatCurrency(item.revenue)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Unknown Equipment Section */}
                              {customer.equipment.unknown_units.length > 0 && (
                                <div className="space-y-2">
                                  <div className="text-[11px] font-semibold text-gray-300 uppercase mb-3">
                                    Other VEROflow Equipment ({customer.equipment.unknown_units.length})
                                  </div>
                                  {customer.equipment.unknown_units.map((item, idx) => (
                                    <div key={idx} className="py-2 px-3 bg-white/[0.02] rounded-lg border border-white/5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                          <div className="text-[12px] font-medium text-white">
                                            {item.item_description}
                                          </div>
                                          <div className="text-[11px] text-[#64748B] mt-0.5">
                                            Purchased: {formatDate(item.date)} • Qty: {item.quantity}
                                          </div>
                                        </div>
                                        <div className="text-[13px] font-medium text-white">
                                          {formatCurrency(item.revenue)}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Calibration Summary */}
                              {customer.has_calibration && (
                                <div className="mt-4 pt-4 border-t border-white/10">
                                  <div className="flex items-center justify-between">
                                    <div className="text-[11px] font-semibold text-[#94A3B8] uppercase">
                                      Calibration History
                                    </div>
                                    <div className="flex items-center gap-4 text-[11px]">
                                      {customer.calibration.vf1_calibrations > 0 && (
                                        <span className="text-cyan-300">
                                          VF-1: {customer.calibration.vf1_calibrations} calibrations
                                        </span>
                                      )}
                                      {customer.calibration.vf4_calibrations > 0 && (
                                        <span className="text-emerald-300">
                                          VF-4: {customer.calibration.vf4_calibrations} calibrations
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between text-[12px] text-[#64748B]">
        <div>
          Showing {filteredAndSortedCustomers.length} of {data.customers.length} customers
        </div>
        <div>
          Last updated: {new Date(data.lastUpdated).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </div>
      </div>
    </div>
  );
}
