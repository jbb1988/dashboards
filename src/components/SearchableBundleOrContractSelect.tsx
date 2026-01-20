'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Contract {
  id: string;
  salesforceId?: string;
  name: string;
  status: string;
  contractType?: string[];
}

interface Bundle {
  id: string;
  name: string;
  accountName?: string;
  contractCount: number;
}

type SelectionType = 'contract' | 'bundle';

interface Selection {
  type: SelectionType;
  id: string;
  name: string;
}

interface SearchableBundleOrContractSelectProps {
  contracts: Contract[];
  bundles: Bundle[];
  value: Selection | null;
  onChange: (selection: Selection | null) => void;
  placeholder?: string;
}

export function SearchableBundleOrContractSelect({
  contracts,
  bundles,
  value,
  onChange,
  placeholder = 'Select contract or bundle...',
}: SearchableBundleOrContractSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<SelectionType>('contract');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Filter items based on search term and active tab
  const filteredContracts = contracts.filter(contract => {
    const searchLower = searchTerm.toLowerCase();
    return contract.name.toLowerCase().includes(searchLower) ||
           contract.contractType?.some(type => type.toLowerCase().includes(searchLower));
  });

  const filteredBundles = bundles.filter(bundle => {
    const searchLower = searchTerm.toLowerCase();
    return bundle.name.toLowerCase().includes(searchLower) ||
           bundle.accountName?.toLowerCase().includes(searchLower);
  });

  const handleSelect = (type: SelectionType, id: string, name: string) => {
    onChange({ type, id, name });
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-[#0B1220] border border-white/[0.08] rounded-lg px-4 py-3 text-left text-sm flex items-center justify-between hover:border-white/[0.12] transition-colors"
      >
        <div className="flex items-center gap-2">
          {value && (
            <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
              value.type === 'bundle'
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}>
              {value.type === 'bundle' ? '📦 Bundle' : '📄 Contract'}
            </span>
          )}
          <span className={value ? 'text-white' : 'text-[#475569]'}>
            {value ? value.name : placeholder}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-[#64748B] transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#0B1220] border border-white/[0.08] rounded-lg shadow-2xl overflow-hidden"
          >
            {/* Tab Navigation */}
            <div className="flex border-b border-white/[0.08]">
              <button
                type="button"
                onClick={() => setActiveTab('contract')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'contract'
                    ? 'text-[#38BDF8] bg-[#38BDF8]/10 border-b-2 border-[#38BDF8]'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                📄 Contracts ({contracts.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('bundle')}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === 'bundle'
                    ? 'text-purple-400 bg-purple-500/10 border-b-2 border-purple-400'
                    : 'text-[#64748B] hover:text-white'
                }`}
              >
                📦 Bundles ({bundles.length})
              </button>
            </div>

            {/* Search Input */}
            <div className="p-2 border-b border-white/[0.08]">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder={`Search ${activeTab === 'bundle' ? 'bundles' : 'contracts'}...`}
                  className="w-full bg-[#111827] border border-white/[0.08] rounded-lg pl-9 pr-10 py-2 text-sm text-white placeholder-[#475569] focus:outline-none focus:border-[#38BDF8]/50"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748B] hover:text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Options List */}
            <div className="max-h-[300px] overflow-y-auto">
              {/* Clear Selection Option */}
              {value && (
                <button
                  type="button"
                  onClick={() => handleSelect(value.type, '', '')}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#64748B] hover:bg-white/[0.04] flex items-center gap-2 border-b border-white/[0.04]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear selection
                </button>
              )}

              {/* Contracts Tab */}
              {activeTab === 'contract' && (
                <>
                  {filteredContracts.length > 0 ? (
                    filteredContracts.map((contract) => {
                      const isSelected = value?.type === 'contract' && value?.id === contract.salesforceId;
                      return (
                        <button
                          key={contract.id}
                          type="button"
                          onClick={() => handleSelect('contract', contract.salesforceId || '', contract.name)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/[0.04] transition-colors ${
                            isSelected ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'text-white'
                          }`}
                        >
                          <div className="font-medium">{contract.name}</div>
                          {contract.contractType?.length ? (
                            <div className="text-xs text-[#64748B] mt-0.5">
                              {contract.contractType.join(', ')}
                            </div>
                          ) : null}
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-[#64748B]">
                      No contracts found
                    </div>
                  )}
                </>
              )}

              {/* Bundles Tab */}
              {activeTab === 'bundle' && (
                <>
                  {filteredBundles.length > 0 ? (
                    filteredBundles.map((bundle) => {
                      const isSelected = value?.type === 'bundle' && value?.id === bundle.id;
                      return (
                        <button
                          key={bundle.id}
                          type="button"
                          onClick={() => handleSelect('bundle', bundle.id, bundle.name)}
                          className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/[0.04] transition-colors ${
                            isSelected ? 'bg-purple-500/10 text-purple-400' : 'text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-purple-400">📦</span>
                            <div className="flex-1">
                              <div className="font-medium">{bundle.name}</div>
                              <div className="text-xs text-[#64748B] mt-0.5">
                                {bundle.contractCount} contract{bundle.contractCount !== 1 ? 's' : ''}
                                {bundle.accountName && ` • ${bundle.accountName}`}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  ) : (
                    <div className="px-4 py-8 text-center text-sm text-[#64748B]">
                      No bundles found
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer with count */}
            <div className="px-4 py-2 border-t border-white/[0.08] text-xs text-[#64748B] text-center">
              {activeTab === 'contract'
                ? `${filteredContracts.length} contract${filteredContracts.length !== 1 ? 's' : ''}`
                : `${filteredBundles.length} bundle${filteredBundles.length !== 1 ? 's' : ''}`
              }
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
