'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';

interface EnhancedSOLineItem {
  lineNumber: number;
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
  accountNumber: string | null;
  accountName: string | null;
  productType: string;
}

interface ProductTypeGroupProps {
  productType: string;
  productTypeName: string;
  lineItems: EnhancedSOLineItem[];
  totals: {
    lineItemCount: number;
    revenue: number;
    costEstimate: number;
    grossProfit: number;
    grossMarginPct: number;
  };
}

function formatCurrency(value: number): string {
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (absValue >= 1000000) return `${sign}$${(absValue / 1000000).toFixed(1)}M`;
  if (absValue >= 1000) return `${sign}$${(absValue / 1000).toFixed(0)}K`;
  return `${sign}$${absValue.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// Product type color mapping
const PRODUCT_TYPE_COLORS: Record<string, string> = {
  'TBEN': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'TBEU': 'bg-blue-400/20 text-blue-300 border-blue-400/30',
  'TBIN': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'TBIU': 'bg-purple-400/20 text-purple-300 border-purple-400/30',
  'M3IN': 'bg-green-500/20 text-green-400 border-green-500/30',
  'M3IU': 'bg-green-400/20 text-green-300 border-green-400/30',
  'M3 Software': 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  'TB Service': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'MCC': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'TB Components': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  'PM': 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  'Other': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'Unknown': 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function ProductTypeGroup({
  productType,
  productTypeName,
  lineItems,
  totals,
}: ProductTypeGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const badgeColor = PRODUCT_TYPE_COLORS[productType] || PRODUCT_TYPE_COLORS['Other'];

  return (
    <div className="border-l-2 border-white/[0.08] pl-4 mb-4">
      {/* Product Type Header */}
      <div
        className="flex items-center justify-between p-3 bg-white/[0.02] rounded-lg hover:bg-white/[0.04] cursor-pointer transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <button className="text-gray-400 hover:text-white transition-colors">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-gray-400" />
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${badgeColor}`}>
              {productType}
            </span>
            <span className="text-sm text-gray-300">{productTypeName}</span>
          </div>

          <span className="text-xs text-gray-500">
            ({totals.lineItemCount} {totals.lineItemCount === 1 ? 'item' : 'items'})
          </span>
        </div>

        {/* Product Type Totals */}
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-gray-400 mr-2">Revenue:</span>
            <span className="text-white font-medium">{formatCurrency(totals.revenue)}</span>
          </div>
          <div>
            <span className="text-gray-400 mr-2">Cost:</span>
            <span className="text-gray-300">{formatCurrency(totals.costEstimate)}</span>
          </div>
          <div>
            <span className="text-gray-400 mr-2">GP:</span>
            <span className={totals.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'}>
              {formatCurrency(totals.grossProfit)}
            </span>
          </div>
          <div>
            <span className="text-gray-400 mr-2">GPM:</span>
            <span className={totals.grossMarginPct >= 50 ? 'text-green-400' : totals.grossMarginPct >= 30 ? 'text-yellow-400' : 'text-red-400'}>
              {formatPercent(totals.grossMarginPct)}
            </span>
          </div>
        </div>
      </div>

      {/* Expandable Line Items Table */}
      {isExpanded && (
        <div className="mt-3 ml-7">
          <div className="bg-[#0A0F1E] rounded-lg border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02] border-b border-white/[0.06]">
                <tr>
                  <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">#</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Item</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Description</th>
                  <th className="text-left py-2 px-3 text-xs text-gray-400 font-medium">Account</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Qty</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Rate</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Amount</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">Cost Est.</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">GP</th>
                  <th className="text-right py-2 px-3 text-xs text-gray-400 font-medium">GPM%</th>
                </tr>
              </thead>
              <tbody>
                {lineItems.map((line, idx) => (
                  <tr
                    key={line.lineNumber}
                    className={`
                      border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors
                      ${line.isClosed ? 'opacity-60' : ''}
                    `}
                  >
                    <td className="py-2 px-3 text-gray-400 text-xs">{line.lineNumber}</td>
                    <td className="py-2 px-3">
                      <div className="text-gray-300 font-mono text-xs">{line.itemName || line.itemId}</div>
                      {line.itemType && (
                        <div className="text-[10px] text-gray-500 mt-0.5">{line.itemType}</div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-gray-400 text-xs max-w-xs truncate">
                      {line.itemDescription || '-'}
                    </td>
                    <td className="py-2 px-3">
                      <div className="text-gray-400 font-mono text-xs">{line.accountNumber || '-'}</div>
                      {line.accountName && (
                        <div className="text-[10px] text-gray-500 mt-0.5 max-w-xs truncate">
                          {line.accountName}
                        </div>
                      )}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300 text-xs">
                      {line.quantity.toFixed(0)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-300 text-xs">
                      {formatCurrency(line.rate)}
                    </td>
                    <td className="py-2 px-3 text-right text-white text-xs font-medium">
                      {formatCurrency(line.amount)}
                    </td>
                    <td className="py-2 px-3 text-right text-gray-400 text-xs">
                      {formatCurrency(line.costEstimate)}
                    </td>
                    <td className={`py-2 px-3 text-right text-xs font-medium ${
                      line.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {formatCurrency(line.grossProfit)}
                    </td>
                    <td className={`py-2 px-3 text-right text-xs ${
                      line.grossMarginPct >= 50 ? 'text-green-400' :
                      line.grossMarginPct >= 30 ? 'text-yellow-400' :
                      'text-red-400'
                    }`}>
                      {formatPercent(line.grossMarginPct)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-white/[0.04] border-t-2 border-white/[0.10]">
                <tr className="font-semibold">
                  <td colSpan={6} className="py-2 px-3 text-xs text-gray-400">
                    {productType} Subtotal ({totals.lineItemCount} items)
                  </td>
                  <td className="py-2 px-3 text-right text-white text-sm">
                    {formatCurrency(totals.revenue)}
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300 text-sm">
                    {formatCurrency(totals.costEstimate)}
                  </td>
                  <td className={`py-2 px-3 text-right text-sm ${
                    totals.grossProfit >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formatCurrency(totals.grossProfit)}
                  </td>
                  <td className={`py-2 px-3 text-right text-sm ${
                    totals.grossMarginPct >= 50 ? 'text-green-400' :
                    totals.grossMarginPct >= 30 ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {formatPercent(totals.grossMarginPct)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
