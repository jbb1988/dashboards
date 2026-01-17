'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, Package, FileText, Wrench, Box, Check, Clock, AlertCircle } from 'lucide-react';

interface SOLineItem {
  lineId: string;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  rate: number;
  amount: number;
  costEstimate: number;
  grossProfit: number;
  grossMarginPct: number;
  isClosed: boolean;
}

interface WOLineItem {
  lineId: string;
  itemId: string;
  itemName: string | null;
  itemDescription: string | null;
  itemType: string | null;
  quantity: number;
  quantityCompleted: number;
  unitCost: number;
  lineCost: number;
  isClosed: boolean;
}

interface WorkOrder {
  woNumber: string;
  netsuiteId: string;
  woDate: string | null;
  status: string | null;
  customerName: string | null;
  lineItems: WOLineItem[];
  totals: {
    itemCount: number;
    totalQuantity: number;
    totalCost: number;
  };
}

interface SalesOrder {
  soNumber: string;
  netsuiteId: string;
  soDate: string | null;
  status: string | null;
  customerName: string | null;
  totalAmount: number;
  lineItems: SOLineItem[];
  workOrders: WorkOrder[];
  totals: {
    lineItemCount: number;
    workOrderCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
    woManufacturingCost: number;
  };
}

interface ProjectHierarchyProps {
  salesOrders: SalesOrder[];
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(2)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function getStatusBadge(status: string | null) {
  const statusMap: Record<string, { label: string; color: string; icon: any }> = {
    'A': { label: 'Pending', color: 'text-[#F59E0B] bg-[#F59E0B]/10', icon: Clock },
    'B': { label: 'Fulfilled', color: 'text-[#22C55E] bg-[#22C55E]/10', icon: Check },
    'C': { label: 'Closed', color: 'text-gray-400 bg-gray-400/10', icon: Check },
    'D': { label: 'Built', color: 'text-[#22C55E] bg-[#22C55E]/10', icon: Check },
    'G': { label: 'Pending Bill', color: 'text-[#3B82F6] bg-[#3B82F6]/10', icon: FileText },
    'H': { label: 'Closed', color: 'text-gray-400 bg-gray-400/10', icon: Check },
  };

  const config = statusMap[status || ''] || { label: status || 'Unknown', color: 'text-gray-400 bg-gray-400/10', icon: AlertCircle };
  const Icon = config.icon;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  );
}

export default function ProjectHierarchy({ salesOrders }: ProjectHierarchyProps) {
  const [expandedSOs, setExpandedSOs] = useState<Set<string>>(new Set());
  const [expandedWOs, setExpandedWOs] = useState<Set<string>>(new Set());
  const [showSOLines, setShowSOLines] = useState<Set<string>>(new Set());

  const toggleSO = (soNumber: string) => {
    setExpandedSOs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soNumber)) {
        newSet.delete(soNumber);
      } else {
        newSet.add(soNumber);
      }
      return newSet;
    });
  };

  const toggleWO = (woNumber: string) => {
    setExpandedWOs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(woNumber)) {
        newSet.delete(woNumber);
      } else {
        newSet.add(woNumber);
      }
      return newSet;
    });
  };

  const toggleSOLines = (soNumber: string) => {
    setShowSOLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(soNumber)) {
        newSet.delete(soNumber);
      } else {
        newSet.add(soNumber);
      }
      return newSet;
    });
  };

  if (salesOrders.length === 0) {
    return (
      <div className="bg-[#111827] rounded-xl border border-white/[0.04] p-8 text-center">
        <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
        <p className="text-gray-400">No sales orders found for this project</p>
      </div>
    );
  }

  return (
    <div className="bg-[#111827] rounded-xl border border-white/[0.04] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/[0.04] bg-white/[0.02]">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Project Hierarchy
          </h3>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{salesOrders.length} Sales Orders</span>
            <span>{salesOrders.reduce((sum, so) => sum + so.workOrders.length, 0)} Work Orders</span>
          </div>
        </div>
      </div>

      {/* Sales Orders */}
      <div className="divide-y divide-white/[0.04]">
        {salesOrders.map((so) => (
          <div key={so.soNumber}>
            {/* SO Header */}
            <div
              className="px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
              onClick={() => toggleSO(so.soNumber)}
            >
              <div className="flex items-center gap-3">
                {expandedSOs.has(so.soNumber) ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
                <Package className="w-4 h-4 text-[#3B82F6]" />
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-white">{so.soNumber}</span>
                    {getStatusBadge(so.status)}
                    <span className="text-xs text-gray-400">{so.soDate}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {so.customerName}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">{formatCurrency(so.totals.revenue)}</div>
                  <div className="text-xs text-gray-400">
                    {so.totals.lineItemCount} items | {so.totals.workOrderCount} WOs
                  </div>
                </div>
                <div className="text-right w-24">
                  <div className={`text-sm font-medium ${so.totals.grossMarginPct >= 50 ? 'text-[#22C55E]' : so.totals.grossMarginPct >= 30 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                    {formatPercent(so.totals.grossMarginPct)} GPM
                  </div>
                  <div className="text-xs text-gray-400">
                    GP: {formatCurrency(so.totals.grossProfit)}
                  </div>
                </div>
              </div>
            </div>

            {/* SO Expanded Content */}
            <AnimatePresence>
              {expandedSOs.has(so.soNumber) && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="pl-11 pr-4 pb-3">
                    {/* SO Line Items Toggle */}
                    {so.lineItems.length > 0 && (
                      <div className="mb-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleSOLines(so.soNumber); }}
                          className="flex items-center gap-2 text-xs text-[#3B82F6] hover:text-[#60A5FA] transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          {showSOLines.has(so.soNumber) ? 'Hide' : 'Show'} {so.lineItems.length} SO Line Items
                          {showSOLines.has(so.soNumber) ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>

                        {/* SO Line Items Table */}
                        <AnimatePresence>
                          {showSOLines.has(so.soNumber) && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="mt-2 bg-[#0D1117] rounded-lg border border-white/[0.04] overflow-hidden"
                            >
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="border-b border-white/[0.04] text-gray-400">
                                    <th className="text-left px-3 py-2">Item</th>
                                    <th className="text-right px-3 py-2">Qty</th>
                                    <th className="text-right px-3 py-2">Rate</th>
                                    <th className="text-right px-3 py-2">Amount</th>
                                    <th className="text-right px-3 py-2">Cost Est.</th>
                                    <th className="text-right px-3 py-2">GP%</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-white/[0.04]">
                                  {so.lineItems.map((line, idx) => (
                                    <tr key={`${so.soNumber}-line-${idx}`} className="text-gray-300">
                                      <td className="px-3 py-2">
                                        <div className="flex items-center gap-2">
                                          <Box className="w-3 h-3 text-gray-500" />
                                          <span className="text-white">{line.itemName || line.itemId}</span>
                                          {line.itemType && (
                                            <span className="text-[10px] text-gray-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                              {line.itemType}
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="text-right px-3 py-2">{line.quantity}</td>
                                      <td className="text-right px-3 py-2">{formatCurrency(line.rate)}</td>
                                      <td className="text-right px-3 py-2 text-white">{formatCurrency(line.amount)}</td>
                                      <td className="text-right px-3 py-2">{formatCurrency(line.costEstimate)}</td>
                                      <td className={`text-right px-3 py-2 ${line.grossMarginPct >= 50 ? 'text-[#22C55E]' : line.grossMarginPct >= 30 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                                        {formatPercent(line.grossMarginPct)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Work Orders */}
                    {so.workOrders.length > 0 ? (
                      <div className="space-y-2">
                        <div className="text-xs text-gray-400 uppercase tracking-wider mb-2">Work Orders</div>
                        {so.workOrders.map((wo) => (
                          <div key={wo.woNumber} className="bg-[#0D1117] rounded-lg border border-white/[0.04]">
                            {/* WO Header */}
                            <div
                              className="px-3 py-2 cursor-pointer hover:bg-white/[0.02] transition-colors"
                              onClick={() => toggleWO(wo.woNumber)}
                            >
                              <div className="flex items-center gap-2">
                                {expandedWOs.has(wo.woNumber) ? (
                                  <ChevronDown className="w-3 h-3 text-gray-400" />
                                ) : (
                                  <ChevronRight className="w-3 h-3 text-gray-400" />
                                )}
                                <Wrench className="w-3 h-3 text-[#F59E0B]" />
                                <span className="text-xs font-medium text-white">{wo.woNumber}</span>
                                {getStatusBadge(wo.status)}
                                <span className="text-[10px] text-gray-400">{wo.woDate}</span>
                                <div className="flex-1" />
                                <span className="text-xs text-gray-400">{wo.totals.itemCount} items</span>
                                <span className="text-xs text-white font-medium">{formatCurrency(wo.totals.totalCost)}</span>
                              </div>
                            </div>

                            {/* WO Line Items */}
                            <AnimatePresence>
                              {expandedWOs.has(wo.woNumber) && wo.lineItems.length > 0 && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-white/[0.04] overflow-hidden"
                                >
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-white/[0.04] text-gray-400">
                                        <th className="text-left px-3 py-2">Component</th>
                                        <th className="text-right px-3 py-2">Qty</th>
                                        <th className="text-right px-3 py-2">Completed</th>
                                        <th className="text-right px-3 py-2">Unit Cost</th>
                                        <th className="text-right px-3 py-2">Line Cost</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/[0.04]">
                                      {wo.lineItems.map((line, idx) => (
                                        <tr key={`${wo.woNumber}-line-${idx}`} className="text-gray-300">
                                          <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                              <Box className="w-3 h-3 text-gray-500" />
                                              <span className="text-white">{line.itemName || line.itemId}</span>
                                              {line.itemType && (
                                                <span className="text-[10px] text-gray-500 bg-white/[0.04] px-1.5 py-0.5 rounded">
                                                  {line.itemType}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="text-right px-3 py-2">{line.quantity}</td>
                                          <td className="text-right px-3 py-2">
                                            <span className={line.quantityCompleted >= line.quantity ? 'text-[#22C55E]' : 'text-[#F59E0B]'}>
                                              {line.quantityCompleted}
                                            </span>
                                          </td>
                                          <td className="text-right px-3 py-2">{formatCurrency(line.unitCost)}</td>
                                          <td className="text-right px-3 py-2 text-white">{formatCurrency(line.lineCost)}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400 italic">No work orders linked to this sales order</div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}
