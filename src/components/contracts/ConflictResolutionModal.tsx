'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConflictInfo {
  contractId: string;
  contractName: string;
  salesforceId: string;
  localValues: {
    awardDate: string | null;
    contractDate: string | null;
    deliverDate: string | null;
    installDate: string | null;
    cashDate: string | null;
  };
  salesforceValues: {
    awardDate: string | null;
    contractDate: string | null;
    deliverDate: string | null;
    installDate: string | null;
    cashDate: string | null;
  };
  pendingFields: Record<string, any>;
}

interface ConflictResolution {
  contractId: string;
  action: 'use_salesforce' | 'keep_local';
}

interface ConflictResolutionModalProps {
  isOpen: boolean;
  conflicts: ConflictInfo[];
  onResolve: (resolutions: ConflictResolution[]) => void;
  onCancel: () => void;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Not set';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function DateFieldRow({
  label,
  localValue,
  salesforceValue
}: {
  label: string;
  localValue: string | null;
  salesforceValue: string | null;
}) {
  const isDifferent = localValue !== salesforceValue;

  return (
    <div className={`flex justify-between py-2 ${isDifferent ? 'bg-yellow-500/5' : ''}`}>
      <div className="text-sm text-gray-400 w-32">{label}</div>
      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className={`text-sm ${isDifferent ? 'text-yellow-400 font-medium' : 'text-gray-300'}`}>
          {formatDate(localValue)}
        </div>
        <div className={`text-sm ${isDifferent ? 'text-cyan-400 font-medium' : 'text-gray-300'}`}>
          {formatDate(salesforceValue)}
        </div>
      </div>
    </div>
  );
}

export default function ConflictResolutionModal({
  isOpen,
  conflicts,
  onResolve,
  onCancel,
}: ConflictResolutionModalProps) {
  const [resolutions, setResolutions] = useState<Record<string, 'use_salesforce' | 'keep_local'>>({});

  const handleResolutionChange = (contractId: string, action: 'use_salesforce' | 'keep_local') => {
    setResolutions(prev => ({
      ...prev,
      [contractId]: action,
    }));
  };

  const handleBulkAction = (action: 'use_salesforce' | 'keep_local') => {
    const bulkResolutions: Record<string, 'use_salesforce' | 'keep_local'> = {};
    conflicts.forEach(conflict => {
      bulkResolutions[conflict.contractId] = action;
    });
    setResolutions(bulkResolutions);
  };

  const handleSubmit = () => {
    const resolutionArray: ConflictResolution[] = conflicts.map(conflict => ({
      contractId: conflict.contractId,
      action: resolutions[conflict.contractId] || 'use_salesforce', // Default to Salesforce if not selected
    }));
    onResolve(resolutionArray);
  };

  const allResolved = conflicts.every(conflict => resolutions[conflict.contractId]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onCancel}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-4xl max-h-[90vh] bg-[#0F172A] border border-white/10 rounded-xl shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <svg className="w-7 h-7 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    Sync Conflicts Detected
                  </h2>
                  <p className="text-sm text-gray-400 mt-2">
                    {conflicts.length} contract{conflicts.length > 1 ? 's have' : ' has'} conflicting changes between your local edits and Salesforce. Choose which version to keep for each.
                  </p>
                </div>
                <button
                  onClick={onCancel}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Bulk Actions */}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => handleBulkAction('use_salesforce')}
                  className="px-4 py-2 bg-cyan-500/10 text-cyan-400 rounded-lg hover:bg-cyan-500/20 transition-colors text-sm font-medium"
                >
                  Accept All from Salesforce
                </button>
                <button
                  onClick={() => handleBulkAction('keep_local')}
                  className="px-4 py-2 bg-yellow-500/10 text-yellow-400 rounded-lg hover:bg-yellow-500/20 transition-colors text-sm font-medium"
                >
                  Keep All Local Changes
                </button>
              </div>
            </div>

            {/* Conflicts List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {conflicts.map((conflict, index) => (
                <div key={conflict.contractId} className="bg-white/5 rounded-lg p-5 border border-white/10">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{conflict.contractName}</h3>
                      <p className="text-xs text-gray-500 mt-1">Contract {index + 1} of {conflicts.length}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleResolutionChange(conflict.contractId, 'keep_local')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          resolutions[conflict.contractId] === 'keep_local'
                            ? 'bg-yellow-500 text-black'
                            : 'bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20'
                        }`}
                      >
                        Keep Local
                      </button>
                      <button
                        onClick={() => handleResolutionChange(conflict.contractId, 'use_salesforce')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          resolutions[conflict.contractId] === 'use_salesforce'
                            ? 'bg-cyan-500 text-black'
                            : 'bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20'
                        }`}
                      >
                        Use Salesforce
                      </button>
                    </div>
                  </div>

                  {/* Date comparison table */}
                  <div className="space-y-1">
                    <div className="flex justify-between pb-2 border-b border-white/10 mb-2">
                      <div className="text-sm font-medium text-gray-400 w-32">Date Field</div>
                      <div className="flex-1 grid grid-cols-2 gap-4">
                        <div className="text-sm font-medium text-yellow-400">Your Local Value</div>
                        <div className="text-sm font-medium text-cyan-400">Salesforce Value</div>
                      </div>
                    </div>

                    <DateFieldRow
                      label="Award Date"
                      localValue={conflict.localValues.awardDate}
                      salesforceValue={conflict.salesforceValues.awardDate}
                    />
                    <DateFieldRow
                      label="Contract Date"
                      localValue={conflict.localValues.contractDate}
                      salesforceValue={conflict.salesforceValues.contractDate}
                    />
                    <DateFieldRow
                      label="Delivery Date"
                      localValue={conflict.localValues.deliverDate}
                      salesforceValue={conflict.salesforceValues.deliverDate}
                    />
                    <DateFieldRow
                      label="Install Date"
                      localValue={conflict.localValues.installDate}
                      salesforceValue={conflict.salesforceValues.installDate}
                    />
                    <DateFieldRow
                      label="Cash Date"
                      localValue={conflict.localValues.cashDate}
                      salesforceValue={conflict.salesforceValues.cashDate}
                    />
                  </div>

                  {/* Status indicator */}
                  {!resolutions[conflict.contractId] && (
                    <div className="mt-3 text-sm text-gray-400 flex items-center gap-2">
                      <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Please choose which version to keep
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-white/10 bg-[#0A0F1E]">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-400">
                  {allResolved
                    ? `All ${conflicts.length} conflicts resolved`
                    : `${Object.keys(resolutions).length} of ${conflicts.length} conflicts resolved`
                  }
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={onCancel}
                    className="px-6 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!allResolved}
                    className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                      allResolved
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white hover:from-cyan-600 hover:to-blue-600'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    Apply Resolutions & Sync
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
