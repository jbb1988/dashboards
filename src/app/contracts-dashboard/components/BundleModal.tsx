'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Contract {
  id: string;
  name: string;
  opportunityName?: string;
  value: number;
  contractType: string[];
}

interface Bundle {
  id: string;
  name: string;
  account_name: string | null;
  contract_count: number;
}

interface BundleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentContract: Contract;
  allContracts: Contract[];
  mode: 'create' | 'add';
  existingBundleId?: string;
}

export default function BundleModal({
  isOpen,
  onClose,
  onSuccess,
  currentContract,
  allContracts,
  mode,
  existingBundleId,
}: BundleModalProps) {
  const [bundleName, setBundleName] = useState('');
  const [selectedContracts, setSelectedContracts] = useState<Set<string>>(new Set());
  const [primaryContractId, setPrimaryContractId] = useState<string>(currentContract.id);
  const [existingBundles, setExistingBundles] = useState<Bundle[]>([]);
  const [selectedBundleId, setSelectedBundleId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing bundles
  useEffect(() => {
    if (isOpen && mode === 'add') {
      fetch('/api/bundles')
        .then(res => res.json())
        .then(data => {
          setExistingBundles(data.bundles || []);
        })
        .catch(err => console.error('Failed to fetch bundles:', err));
    }
  }, [isOpen, mode]);

  // Filter contracts for selection
  const filteredContracts = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return allContracts.filter(c => {
      if (c.id === currentContract.id) return false; // Exclude current contract
      if (!query) return true;
      return (
        c.name.toLowerCase().includes(query) ||
        c.opportunityName?.toLowerCase().includes(query) ||
        c.contractType.some(t => t.toLowerCase().includes(query))
      );
    });
  }, [allContracts, currentContract.id, searchQuery]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedContracts(new Set([currentContract.id]));
      setPrimaryContractId(currentContract.id);
      setBundleName('');
      setSearchQuery('');
      setSelectedBundleId(existingBundleId || '');
      setError(null);
    }
  }, [isOpen, currentContract.id, existingBundleId]);

  const handleContractToggle = (contractId: string) => {
    const newSelected = new Set(selectedContracts);
    if (newSelected.has(contractId)) {
      newSelected.delete(contractId);
      // If removing the primary, reset to current contract
      if (primaryContractId === contractId) {
        setPrimaryContractId(currentContract.id);
      }
    } else {
      newSelected.add(contractId);
    }
    setSelectedContracts(newSelected);
  };

  const handleCreateBundle = async () => {
    if (!bundleName.trim()) {
      setError('Bundle name is required');
      return;
    }

    if (selectedContracts.size < 2) {
      setError('Select at least one additional contract to bundle');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: bundleName,
          contract_ids: Array.from(selectedContracts),
          primary_contract_id: primaryContractId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        const errorMsg = result.details
          ? `${result.error}: ${result.details}`
          : result.error || 'Failed to create bundle';
        throw new Error(errorMsg);
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bundle');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddToBundle = async () => {
    if (!selectedBundleId) {
      setError('Select a bundle to add to');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/bundles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bundle_id: selectedBundleId,
          add_contracts: [currentContract.id],
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add to bundle');
      }

      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add to bundle');
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toLocaleString()}`;
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={e => e.stopPropagation()}
          className="bg-[#151F2E] border border-white/10 rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">
              {mode === 'create' ? 'Create Contract Bundle' : 'Add to Bundle'}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#64748B] hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 overflow-y-auto max-h-[calc(80vh-140px)]">
            {/* Current Contract */}
            <div className="mb-6">
              <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                Current Contract
              </label>
              <div className="bg-[#0B1220] border border-[#8B5CF6]/30 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-white font-medium">{currentContract.name}</div>
                    {currentContract.opportunityName && (
                      <div className="text-[#64748B] text-sm">{currentContract.opportunityName}</div>
                    )}
                  </div>
                  <div className="text-[#8B5CF6] font-semibold">{formatCurrency(currentContract.value)}</div>
                </div>
              </div>
            </div>

            {mode === 'create' ? (
              <>
                {/* Bundle Name */}
                <div className="mb-6">
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                    Bundle Name
                  </label>
                  <input
                    type="text"
                    value={bundleName}
                    onChange={e => setBundleName(e.target.value)}
                    placeholder="e.g., Cleveland 2025 Renewal"
                    className="w-full bg-[#0B1220] border border-white/10 rounded-lg px-4 py-3 text-white placeholder-[#475569] focus:outline-none focus:border-[#8B5CF6]/50"
                  />
                </div>

                {/* Contract Search */}
                <div className="mb-4">
                  <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                    Add Related Contracts
                  </label>
                  <div className="relative">
                    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#475569]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search contracts..."
                      className="w-full bg-[#0B1220] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white placeholder-[#475569] focus:outline-none focus:border-[#8B5CF6]/50"
                    />
                  </div>
                </div>

                {/* Contract List */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredContracts.map(contract => {
                    const isSelected = selectedContracts.has(contract.id);
                    const isPrimary = primaryContractId === contract.id;

                    return (
                      <div
                        key={contract.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30'
                            : 'bg-[#0B1220] border-white/5 hover:border-white/10'
                        }`}
                        onClick={() => handleContractToggle(contract.id)}
                      >
                        <div
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            isSelected
                              ? 'bg-[#8B5CF6] border-[#8B5CF6]'
                              : 'border-[#475569]'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-white text-sm font-medium truncate">{contract.name}</div>
                          {contract.opportunityName && (
                            <div className="text-[#64748B] text-xs truncate">{contract.opportunityName}</div>
                          )}
                        </div>
                        <div className="text-[#8FA3BF] text-sm font-medium">{formatCurrency(contract.value)}</div>
                        {isSelected && (
                          <button
                            onClick={e => {
                              e.stopPropagation();
                              setPrimaryContractId(contract.id);
                            }}
                            className={`text-[10px] px-2 py-1 rounded transition-all ${
                              isPrimary
                                ? 'bg-[#8B5CF6] text-white'
                                : 'bg-white/10 text-[#64748B] hover:text-white'
                            }`}
                          >
                            {isPrimary ? 'Primary' : 'Set Primary'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {filteredContracts.length === 0 && (
                    <div className="text-center py-8 text-[#475569] text-sm">
                      No matching contracts found
                    </div>
                  )}
                </div>

                {/* Selected Count */}
                <div className="mt-4 text-sm text-[#64748B]">
                  {selectedContracts.size} contract{selectedContracts.size !== 1 ? 's' : ''} selected
                </div>
              </>
            ) : (
              /* Add to Existing Bundle */
              <div className="space-y-4">
                <label className="block text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                  Select Bundle
                </label>
                {existingBundles.length > 0 ? (
                  <div className="space-y-2">
                    {existingBundles.map(bundle => (
                      <div
                        key={bundle.id}
                        onClick={() => setSelectedBundleId(bundle.id)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedBundleId === bundle.id
                            ? 'bg-[#8B5CF6]/10 border-[#8B5CF6]/30'
                            : 'bg-[#0B1220] border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-white font-medium">{bundle.name}</div>
                            <div className="text-[#64748B] text-sm">{bundle.contract_count} contracts</div>
                          </div>
                          {selectedBundleId === bundle.id && (
                            <div className="w-5 h-5 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-[#475569]">
                    <p>No existing bundles found.</p>
                    <button
                      onClick={() => {
                        // Switch to create mode would require parent state change
                        setError('Create a new bundle from the contract menu first');
                      }}
                      className="mt-2 text-[#8B5CF6] hover:underline"
                    >
                      Create a new bundle instead
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-[#64748B] hover:text-white text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={mode === 'create' ? handleCreateBundle : handleAddToBundle}
              disabled={isLoading}
              className="px-6 py-2 bg-[#8B5CF6] text-white font-medium text-sm rounded-lg hover:bg-[#8B5CF6]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving...' : mode === 'create' ? 'Create Bundle' : 'Add to Bundle'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
