'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED_WIDTH } from '@/components/Sidebar';
import { DashboardBackground, backgroundPresets } from '@/components/mars-ui';

interface SmartsheetSheet {
  id: number;
  name: string;
  accessLevel: string;
  permalink: string;
  modifiedAt: string;
}

interface SheetData {
  sheet: {
    id: number;
    name: string;
    permalink: string;
    totalRowCount: number;
    columns: Array<{
      id: number;
      title: string;
      type: string;
      primary?: boolean;
    }>;
  };
  data: Record<string, unknown>[];
  rowCount: number;
}

interface ConnectionStatus {
  success: boolean;
  user?: {
    email: string;
    name?: string;
  };
  error?: string;
}

export default function ManagementDashboard() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sheets, setSheets] = useState<SmartsheetSheet[]>([]);
  const [selectedSheetId, setSelectedSheetId] = useState<number | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const marginLeft = sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH;

  // Test connection and load sheets on mount
  useEffect(() => {
    async function initialize() {
      setLoading(true);
      setError(null);

      try {
        // Test connection first
        const testRes = await fetch('/api/smartsheet?test=true');
        const testData = await testRes.json();
        setConnectionStatus(testData);

        if (!testData.success) {
          setError(testData.error || 'Failed to connect to Smartsheet');
          setLoading(false);
          return;
        }

        // Load sheets
        const sheetsRes = await fetch('/api/smartsheet');
        const sheetsData = await sheetsRes.json();

        if (sheetsData.error) {
          setError(sheetsData.error);
        } else {
          setSheets(sheetsData.sheets || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    }

    initialize();
  }, []);

  // Load sheet data when selection changes
  const loadSheetData = async (sheetId: number) => {
    setLoadingSheet(true);
    setSelectedSheetId(sheetId);
    setSheetData(null);

    try {
      const res = await fetch(`/api/smartsheet?sheetId=${sheetId}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setSheetData(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sheet');
    } finally {
      setLoadingSheet(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] relative overflow-hidden">
      <DashboardBackground {...backgroundPresets.pm} />
      <Sidebar isCollapsed={sidebarCollapsed} onCollapsedChange={setSidebarCollapsed} />

      <main
        className="relative z-10 transition-all duration-200 ease-out min-h-screen"
        style={{ marginLeft }}
      >
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-lg bg-orange-500/20">
                <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Management Dashboard</h1>
                <p className="text-[#64748B] text-sm">Powered by Smartsheet</p>
              </div>
            </div>

            {/* Connection Status */}
            {connectionStatus && (
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-[12px] ${
                connectionStatus.success
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  connectionStatus.success ? 'bg-green-400' : 'bg-red-400'
                }`} />
                {connectionStatus.success
                  ? `Connected as ${connectionStatus.user?.email || 'Unknown'}`
                  : 'Not connected'}
              </div>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                <span className="text-[13px] text-[#64748B]">Connecting to Smartsheet...</span>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-red-400 mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <div className="font-medium">Error</div>
                  <div className="text-[13px] opacity-80">{error}</div>
                </div>
              </div>
            </div>
          )}

          {/* Main Content */}
          {!loading && !error && (
            <div className="grid grid-cols-12 gap-6">
              {/* Sheets List */}
              <div className="col-span-4">
                <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
                  <div className="px-5 py-4 border-b border-white/[0.06]">
                    <h2 className="text-white font-semibold">Available Sheets</h2>
                    <p className="text-[12px] text-[#64748B] mt-1">{sheets.length} sheets found</p>
                  </div>

                  <div className="max-h-[600px] overflow-y-auto">
                    {sheets.length === 0 ? (
                      <div className="p-6 text-center text-[#64748B] text-[13px]">
                        No sheets found
                      </div>
                    ) : (
                      sheets.map((sheet, index) => (
                        <motion.button
                          key={sheet.id}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.03 }}
                          onClick={() => loadSheetData(sheet.id)}
                          className={`w-full px-5 py-3 text-left border-b border-white/[0.04] transition-colors ${
                            selectedSheetId === sheet.id
                              ? 'bg-orange-500/10 border-l-2 border-l-orange-500'
                              : 'hover:bg-white/[0.02]'
                          }`}
                        >
                          <div className="text-white font-medium text-[13px] truncate">
                            {sheet.name}
                          </div>
                          <div className="text-[11px] text-[#64748B] mt-1 flex items-center gap-2">
                            <span className="capitalize">{sheet.accessLevel}</span>
                            <span>•</span>
                            <span>{new Date(sheet.modifiedAt).toLocaleDateString()}</span>
                          </div>
                        </motion.button>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Sheet Data */}
              <div className="col-span-8">
                {loadingSheet && (
                  <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-8 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                      <span className="text-[13px] text-[#64748B]">Loading sheet data...</span>
                    </div>
                  </div>
                )}

                {!loadingSheet && !sheetData && (
                  <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-8 text-center">
                    <svg className="w-12 h-12 mx-auto text-[#64748B] mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-[#64748B] text-[13px]">Select a sheet to view its data</p>
                  </div>
                )}

                {!loadingSheet && sheetData && (
                  <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] overflow-hidden">
                    {/* Sheet Header */}
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                      <div>
                        <h2 className="text-white font-semibold">{sheetData.sheet.name}</h2>
                        <p className="text-[12px] text-[#64748B] mt-1">
                          {sheetData.rowCount} rows • {sheetData.sheet.columns.length} columns
                        </p>
                      </div>
                      <a
                        href={sheetData.sheet.permalink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 text-[12px] font-medium rounded-lg transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Open in Smartsheet
                      </a>
                    </div>

                    {/* Data Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-[#0F1722]">
                            {sheetData.sheet.columns.map(col => (
                              <th
                                key={col.id}
                                className="px-4 py-3 text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider whitespace-nowrap"
                              >
                                {col.title}
                                {col.primary && (
                                  <span className="ml-1 text-orange-400">*</span>
                                )}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sheetData.data.slice(0, 100).map((row, rowIndex) => (
                            <tr
                              key={row._rowId as number || rowIndex}
                              className={`border-b border-white/[0.04] ${
                                rowIndex % 2 === 0 ? 'bg-[#151F2E]' : 'bg-[#131B28]'
                              } hover:bg-[#1E293B]/50 transition-colors`}
                            >
                              {sheetData.sheet.columns.map(col => (
                                <td
                                  key={col.id}
                                  className="px-4 py-3 text-[13px] text-[#94A3B8] whitespace-nowrap max-w-[300px] truncate"
                                >
                                  {row[col.title] !== null && row[col.title] !== undefined
                                    ? String(row[col.title])
                                    : '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {sheetData.data.length > 100 && (
                        <div className="px-4 py-3 bg-[#0F1722] text-center text-[12px] text-[#64748B]">
                          Showing 100 of {sheetData.data.length} rows
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
