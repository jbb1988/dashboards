'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

// Format currency
function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

// Format percent
function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface LineItem {
  itemName: string;
  itemDescription: string;
  quantity: number;
  unitPrice: number;
  lineAmount: number;
  costEstimate: number;
}

interface WorkOrder {
  woNumber: string;
  itemDescription: string;
  budgetRevenue: number;
  budgetCost: number;
  budgetGP: number;
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  variance: number;
  netsuiteEnriched: boolean;
  woStatus?: string;
  woDate?: string;
}

interface SalesOrder {
  soNumber: string;
  soId: string;
  soStatus: string | null;
  soDate: string;
  customerName: string;
  netsuiteEnriched: boolean;
  lineItems: LineItem[]; // SO line items (what was sold - budget)
  workOrders: WorkOrder[]; // Multiple WOs fulfilling this SO
  totalRevenue: number;
  totalCost: number;
  totalGP: number;
}

interface Project {
  project: string;
  projectKey: string;
  type: string;
  projectYear: number;
  actualRevenue: number;
  actualCost: number;
  actualGP: number;
  actualGPM: number;
  budgetGP: number;
  variance: number;
  itemCount: number;
  salesOrders?: SalesOrder[]; // Typically 1 SO per project, but could have multiple
  unenrichedWorkOrders?: WorkOrder[]; // WOs without NetSuite enrichment
  lineItems?: Array<{
    itemNumber: string;
    itemDescription: string;
    budgetRevenue: number;
    budgetCost: number;
    budgetGP: number;
    actualRevenue: number;
    actualCost: number;
    actualGP: number;
    variance: number;
    year: number;
    month: number;
    comments: string;
  }>;
}

interface ProjectsTabProps {
  projects: Project[];
  atRiskProjects: Project[];
  typeBreakdown: any[];
}

export default function ProjectsTab({ projects, atRiskProjects, typeBreakdown }: ProjectsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'revenue' | 'gpm' | 'variance'>('revenue');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [showAtRiskOnly, setShowAtRiskOnly] = useState(false);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [expandedSO, setExpandedSO] = useState<string | null>(null);
  const [expandedWO, setExpandedWO] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  // Filter and sort projects
  const filteredProjects = useMemo(() => {
    let filtered = [...projects];

    if (showAtRiskOnly) {
      filtered = filtered.filter(p => p.actualGPM < 0.5 || p.variance < -10000);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(p =>
        p.project.toLowerCase().includes(query) ||
        p.type.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'revenue':
          comparison = b.actualRevenue - a.actualRevenue;
          break;
        case 'gpm':
          comparison = b.actualGPM - a.actualGPM;
          break;
        case 'variance':
          comparison = b.variance - a.variance;
          break;
      }
      return sortDirection === 'asc' ? -comparison : comparison;
    });
  }, [projects, showAtRiskOnly, searchQuery, sortField, sortDirection]);

  // Get selected project details
  const selectedProjectData = useMemo(() => {
    if (!selectedProject) return null;
    return projects.find(p => p.projectKey === selectedProject);
  }, [selectedProject, projects]);

  // Dynamic type breakdown for selected project
  const displayTypeBreakdown = useMemo(() => {
    if (selectedProjectData && selectedProjectData.lineItems && selectedProjectData.lineItems.length > 0) {
      // Group line items by type and calculate metrics
      const typeMap: Record<string, { type: string; revenue: number; count: number; gpm: number }> = {};
      const lineItems = selectedProjectData.lineItems; // Store in local variable for type safety

      lineItems.forEach(item => {
        const itemType = selectedProjectData.type || 'Unknown';
        if (!typeMap[itemType]) {
          typeMap[itemType] = { type: itemType, revenue: 0, count: 0, gpm: 0 };
        }
        typeMap[itemType].revenue += item.actualRevenue;
        typeMap[itemType].count++;
      });

      // Calculate GPM for each type
      Object.values(typeMap).forEach(t => {
        const typeItems = lineItems.filter(item =>
          (selectedProjectData.type || 'Unknown') === t.type
        );
        const totalCost = typeItems.reduce((sum, item) => sum + item.actualCost, 0);
        t.gpm = t.revenue > 0 ? (t.revenue - totalCost) / t.revenue : 0;
      });

      return Object.values(typeMap).sort((a, b) => b.revenue - a.revenue);
    }
    return typeBreakdown;
  }, [selectedProjectData, typeBreakdown]);

  return (
    <div className="grid grid-cols-4 gap-6">
      {/* Main Content */}
      <div className="col-span-3">
        {/* Filters */}
        <div className="flex items-center gap-4 mb-4">
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-4 py-2 bg-[#111827] border border-white/[0.08] rounded-lg text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E]/20"
          />
          <button
            onClick={() => setShowAtRiskOnly(!showAtRiskOnly)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              showAtRiskOnly
                ? 'bg-[#EF4444] text-white'
                : 'bg-[#111827] border border-white/[0.08] text-gray-300 hover:bg-white/[0.04]'
            }`}
          >
            {showAtRiskOnly ? 'Show All' : 'At Risk Only'}
          </button>
        </div>

        {/* Projects Table */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04]">
          {/* Header */}
          <div className="grid grid-cols-7 gap-4 p-4 border-b border-white/[0.04] text-xs text-gray-400 uppercase">
            <div className="col-span-2">Project</div>
            <div className="text-right cursor-pointer hover:text-white" onClick={() => setSortField('revenue')}>
              Revenue {sortField === 'revenue' && (sortDirection === 'desc' ? '↓' : '↑')}
            </div>
            <div className="text-right">Cost</div>
            <div className="text-right">GP</div>
            <div className="text-right cursor-pointer hover:text-white" onClick={() => setSortField('gpm')}>
              GPM% {sortField === 'gpm' && (sortDirection === 'desc' ? '↓' : '↑')}
            </div>
            <div className="text-right cursor-pointer hover:text-white" onClick={() => setSortField('variance')}>
              Variance {sortField === 'variance' && (sortDirection === 'desc' ? '↓' : '↑')}
            </div>
          </div>

          {/* Rows */}
          <div>
            {filteredProjects.map((project) => (
              <ProjectRow
                key={project.projectKey}
                project={project}
                expanded={expandedProject === project.projectKey}
                onToggle={() => {
                  setExpandedProject(expandedProject === project.projectKey ? null : project.projectKey);
                  setSelectedProject(project.projectKey);
                }}
                expandedSO={expandedSO}
                onSOToggle={setExpandedSO}
                expandedWO={expandedWO}
                onWOToggle={setExpandedWO}
              />
            ))}
          </div>
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No projects found
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="space-y-6">
        {/* At Risk Projects */}
        {atRiskProjects.length > 0 && (
          <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
              <h3 className="text-xs font-semibold text-white uppercase tracking-wider">At Risk</h3>
            </div>
            <div className="space-y-2">
              {atRiskProjects.slice(0, 5).map((p) => (
                <div key={p.projectKey} className="text-xs">
                  <div className="text-white truncate">{p.project}</div>
                  <div className="text-[#EF4444] text-[10px]">GPM: {formatPercent(p.actualGPM * 100)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Type Breakdown */}
        <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white uppercase tracking-wider">By Type</h3>
            {selectedProject && (
              <button
                onClick={() => {
                  setSelectedProject(null);
                  setExpandedProject(null);
                }}
                className="text-[9px] text-gray-400 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
          {selectedProjectData && (
            <div className="mb-3 pb-3 border-b border-white/[0.08]">
              <div className="text-[10px] text-gray-400 mb-1">Selected Project</div>
              <div className="text-xs text-white font-medium truncate">{selectedProjectData.project}</div>
              <div className="text-[9px] text-[#22C55E] mt-1">
                {formatCurrency(selectedProjectData.actualRevenue)} • {formatPercent(selectedProjectData.actualGPM * 100)}
              </div>
            </div>
          )}
          {displayTypeBreakdown.slice(0, 5).map((type) => (
            <div key={type.type} className="mb-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-300">{type.type}</span>
                <span className="text-[#22C55E]">{formatCurrency(type.revenue)}</span>
              </div>
              <div className="h-1 bg-white/[0.08] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#22C55E]"
                  style={{ width: `${Math.min((type.gpm || 0) * 100, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Project Row Component
function ProjectRow({
  project,
  expanded,
  onToggle,
  expandedSO,
  onSOToggle,
  expandedWO,
  onWOToggle
}: {
  project: Project;
  expanded: boolean;
  onToggle: () => void;
  expandedSO: string | null;
  onSOToggle: (so: string | null) => void;
  expandedWO: string | null;
  onWOToggle: (wo: string | null) => void;
}) {
  const isAtRisk = project.actualGPM < 0.5 || project.variance < -10000;
  const hasSalesOrders = project.salesOrders && project.salesOrders.length > 0;
  const hasUnenrichedWOs = project.unenrichedWorkOrders && project.unenrichedWorkOrders.length > 0;
  const hasData = hasSalesOrders || hasUnenrichedWOs;

  return (
    <div className={`border-b border-white/[0.04] ${isAtRisk ? 'border-l-2 border-l-[#EF4444]' : ''}`}>
      {/* Main Row */}
      <div
        className="grid grid-cols-7 gap-4 p-4 cursor-pointer hover:bg-white/[0.02] transition-colors"
        onClick={onToggle}
      >
        <div className="col-span-2 flex items-center gap-2">
          {hasData && (expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />)}
          <div>
            <div className="text-sm font-medium text-white">{project.project}</div>
            <div className="text-xs text-gray-400">{project.type} • {project.projectYear}</div>
          </div>
        </div>
        <div className="text-right text-sm text-white">{formatCurrency(project.actualRevenue)}</div>
        <div className="text-right text-sm text-gray-300">{formatCurrency(project.actualCost)}</div>
        <div className="text-right text-sm text-[#22C55E] font-medium">{formatCurrency(project.actualGP)}</div>
        <div className="text-right">
          <span
            className="text-sm font-semibold px-2 py-1 rounded"
            style={{
              backgroundColor: project.actualGPM >= 0.6 ? '#22C55E20' : project.actualGPM >= 0.5 ? '#F59E0B20' : '#EF444420',
              color: project.actualGPM >= 0.6 ? '#22C55E' : project.actualGPM >= 0.5 ? '#F59E0B' : '#EF4444'
            }}
          >
            {formatPercent(project.actualGPM * 100)}
          </span>
        </div>
        <div className={`text-right text-sm font-medium ${project.variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
          {project.variance >= 0 ? '+' : ''}{formatCurrency(project.variance)}
        </div>
      </div>

      {/* Expanded Sales Orders */}
      <AnimatePresence>
        {expanded && hasData && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#0B1220] px-4 pb-4 overflow-hidden"
          >
            <div className="pt-3 space-y-3">
              {/* Sales Orders */}
              {hasSalesOrders && (
                <>
                  <div className="text-xs text-gray-400 uppercase">
                    Sales Orders ({project.salesOrders!.length})
                  </div>
                  {project.salesOrders!.map((so) => (
                    <SalesOrderRow
                      key={so.soNumber}
                      salesOrder={so}
                      expanded={expandedSO === so.soNumber}
                      onToggle={() => onSOToggle(expandedSO === so.soNumber ? null : so.soNumber)}
                      expandedWO={expandedWO}
                      onWOToggle={onWOToggle}
                    />
                  ))}
                </>
              )}

              {/* Unenriched Work Orders */}
              {hasUnenrichedWOs && (
                <>
                  <div className="text-xs text-gray-400 uppercase mt-4">
                    Work Orders - Not Enriched ({project.unenrichedWorkOrders!.length})
                  </div>
                  <div className="space-y-2">
                    {project.unenrichedWorkOrders!.map((wo) => (
                      <div key={wo.woNumber} className="border border-white/[0.05] rounded-lg p-3 bg-[#151F2E]">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-white">{wo.woNumber}</span>
                            <span className="text-[9px] px-2 py-0.5 rounded bg-gray-500/20 text-gray-400">No NetSuite Data</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-gray-400">Revenue: </span>
                              <span className="text-white">{formatCurrency(wo.actualRevenue)}</span>
                            </div>
                            <div>
                              <span className="text-gray-400">GP: </span>
                              <span className={wo.actualGP >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
                                {formatCurrency(wo.actualGP)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Sales Order Row Component
function SalesOrderRow({
  salesOrder,
  expanded,
  onToggle,
  expandedWO,
  onWOToggle
}: {
  salesOrder: SalesOrder;
  expanded: boolean;
  onToggle: () => void;
  expandedWO: string | null;
  onWOToggle: (wo: string | null) => void;
}) {
  const soGPM = salesOrder.totalRevenue > 0 ? (salesOrder.totalGP / salesOrder.totalRevenue) * 100 : 0;
  const hasLineItems = salesOrder.lineItems && salesOrder.lineItems.length > 0;
  const hasWorkOrders = salesOrder.workOrders && salesOrder.workOrders.length > 0;

  return (
    <div className="border border-[#22C55E]/20 rounded-lg bg-[#151F2E]">
      {/* SO Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/[0.02]"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          {expanded ? <ChevronDown className="w-3 h-3 text-[#22C55E]" /> : <ChevronRight className="w-3 h-3 text-[#22C55E]" />}
          <span className="text-xs font-mono text-white font-semibold">SO: {salesOrder.soNumber}</span>
          <span className="text-[9px] px-2 py-0.5 rounded bg-[#22C55E]/20 text-[#22C55E]">
            {salesOrder.soStatus || 'Unknown'}
          </span>
          <span className="text-[10px] text-gray-400">{salesOrder.customerName}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-400">Revenue: </span>
            <span className="text-white font-medium">{formatCurrency(salesOrder.totalRevenue)}</span>
          </div>
          <div>
            <span className="text-gray-400">GP: </span>
            <span className={salesOrder.totalGP >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
              {formatCurrency(salesOrder.totalGP)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">GPM: </span>
            <span className="text-white">{formatPercent(soGPM)}</span>
          </div>
        </div>
      </div>

      {/* Expanded: SO Line Items + Work Orders */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-[#22C55E]/20"
          >
            {/* SO Line Items */}
            {hasLineItems && (
              <div className="p-3 bg-[#0B1220]">
                <div className="text-[10px] text-gray-400 uppercase mb-2">
                  Sales Order Line Items ({salesOrder.lineItems.length}) - What Was Sold
                </div>
                <table className="w-full text-[11px]">
                  <thead className="text-gray-400 border-b border-white/[0.05]">
                    <tr>
                      <th className="text-left p-1">Item</th>
                      <th className="text-left p-1">Description</th>
                      <th className="text-right p-1">Qty</th>
                      <th className="text-right p-1">Price</th>
                      <th className="text-right p-1">Amount</th>
                      <th className="text-right p-1">Cost Est.</th>
                      <th className="text-right p-1">GP</th>
                      <th className="text-right p-1">GPM%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {salesOrder.lineItems.map((item, idx) => {
                      const lineGP = item.lineAmount - item.costEstimate;
                      const lineGPM = item.lineAmount > 0 ? (lineGP / item.lineAmount) * 100 : 0;
                      return (
                        <tr key={idx} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                          <td className="p-1 font-mono text-white">{item.itemName}</td>
                          <td className="p-1 text-gray-300 max-w-xs truncate" title={item.itemDescription}>
                            {item.itemDescription}
                          </td>
                          <td className="p-1 text-right text-gray-300">{item.quantity}</td>
                          <td className="p-1 text-right text-gray-300">{formatCurrency(item.unitPrice)}</td>
                          <td className="p-1 text-right text-white font-medium">{formatCurrency(item.lineAmount)}</td>
                          <td className="p-1 text-right text-gray-300">{formatCurrency(item.costEstimate)}</td>
                          <td className={`p-1 text-right font-medium ${lineGP >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}`}>
                            {formatCurrency(lineGP)}
                          </td>
                          <td className="p-1 text-right text-white">{formatPercent(lineGPM)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Work Orders fulfilling this SO */}
            {hasWorkOrders && (
              <div className="p-3">
                <div className="text-[10px] text-gray-400 uppercase mb-2">
                  Work Orders ({salesOrder.workOrders.length}) - Fulfilling This SO
                </div>
                <div className="space-y-2">
                  {salesOrder.workOrders.map((wo) => (
                    <WorkOrderRow
                      key={wo.woNumber}
                      workOrder={wo}
                      expanded={expandedWO === wo.woNumber}
                      onToggle={() => onWOToggle(expandedWO === wo.woNumber ? null : wo.woNumber)}
                    />
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Work Order Row Component (nested under SO)
function WorkOrderRow({
  workOrder,
  expanded,
  onToggle
}: {
  workOrder: WorkOrder;
  expanded: boolean;
  onToggle: () => void;
}) {
  const gpm = workOrder.actualRevenue > 0 ? (workOrder.actualGP / workOrder.actualRevenue) * 100 : 0;

  return (
    <div className="border border-white/[0.05] rounded-lg bg-[#0B1220]">
      {/* WO Header */}
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-white">{workOrder.woNumber}</span>
          {workOrder.woStatus && (
            <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
              {workOrder.woStatus}
            </span>
          )}
          <span className="text-[10px] text-gray-400">{workOrder.itemDescription}</span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-gray-400">Budget GP: </span>
            <span className="text-gray-300">{formatCurrency(workOrder.budgetGP)}</span>
          </div>
          <div>
            <span className="text-gray-400">Actual GP: </span>
            <span className={workOrder.actualGP >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
              {formatCurrency(workOrder.actualGP)}
            </span>
          </div>
          <div>
            <span className="text-gray-400">Variance: </span>
            <span className={workOrder.variance >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'}>
              {workOrder.variance >= 0 ? '+' : ''}{formatCurrency(workOrder.variance)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
