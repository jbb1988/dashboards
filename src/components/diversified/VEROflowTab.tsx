'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

    // Apply calibration status filter
    if (filterCalibration === 'active') {
      filtered = filtered.filter(c => c.has_calibration);
    } else if (filterCalibration === 'opportunity') {
      filtered = filtered.filter(c => !c.has_calibration);
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
          aVal = a.calibration_revenue;
          bVal = b.calibration_revenue;
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
  }, [data, filterCalibration, searchTerm, sortBy, sortOrder]);

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
      const taskData = {
        title: `Follow up with ${customer.customer_name} about calibration services`,
        description: `Customer owns VEROflow equipment but hasn't used calibration services.\n\nEquipment owned:\n${customer.equipment_purchases.map(e => `- ${e.item_description || e.item_name}`).join('\n')}\n\nRecommend annual calibration to maintain accuracy and compliance.`,
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
      ['Customer Name', 'Equipment', 'First Purchase', 'Equipment Revenue', 'Calibration Status', 'Last Calibration', 'Service Revenue'],
      ...filteredAndSortedCustomers.map(c => [
        c.customer_name,
        c.equipment_purchases.map(e => e.item_description || e.item_name).join('; '),
        c.first_equipment_purchase || 'N/A',
        c.equipment_revenue.toFixed(2),
        c.has_calibration ? 'Active' : 'Opportunity',
        c.last_calibration_date || 'Never',
        c.calibration_revenue.toFixed(2),
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

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            VEROflow Customers
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {data.summary.total_customers}
            </div>
            <svg className="w-6 h-6 text-[#38BDF8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
              {data.summary.calibration_adoption_rate.toFixed(1)}%
            </div>
            <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-[11px] text-[#64748B] mt-1">
            {data.summary.customers_with_calibration} of {data.summary.total_customers} customers
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            Equipment Revenue
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {formatCurrency(data.summary.total_equipment_revenue)}
            </div>
            <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#151F2E] border border-white/[0.04]">
          <div className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">
            Service Revenue
          </div>
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold text-white">
              {formatCurrency(data.summary.total_calibration_revenue)}
            </div>
            <svg className="w-6 h-6 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </div>
        </div>
      </div>

      {/* Opportunity Banner */}
      {data.summary.opportunities > 0 && (
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
                <span className="font-semibold">{data.summary.opportunities}</span> customers own VEROflow equipment but haven't used calibration services
              </span>
            </div>
          </div>
        </motion.div>
      )}

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
                  return (
                    <React.Fragment key={customer.customer_id}>
                      <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3">
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
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[13px] font-medium text-white">
                            {customer.customer_name}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-[12px] text-[#94A3B8]">
                            {customer.equipment_purchases.length > 0
                              ? `${customer.equipment_purchases.length} item${customer.equipment_purchases.length !== 1 ? 's' : ''}`
                              : 'None'}
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
                            {formatDate(customer.last_calibration_date)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="text-[13px] font-medium text-white">
                            {formatCurrency(customer.calibration_revenue)}
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
                      {isExpanded && customer.equipment_purchases.length > 0 && (
                        <tr className="bg-white/[0.02] border-b border-white/5">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="pl-6 space-y-2">
                              <div className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
                                Equipment Details
                              </div>
                              {customer.equipment_purchases.map((item, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/5"
                                >
                                  <div className="flex-1">
                                    <div className="text-[12px] font-medium text-white">
                                      {item.item_description || item.item_name}
                                    </div>
                                    <div className="text-[11px] text-[#64748B] mt-0.5">
                                      Purchased: {formatDate(item.date)} • Qty: {item.quantity}
                                    </div>
                                  </div>
                                  <div className="text-[13px] font-medium text-white">
                                    {formatCurrency(item.revenue)}
                                  </div>
                                </div>
                              ))}
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

// Add React import for Fragment
import React from 'react';
