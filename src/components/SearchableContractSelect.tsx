'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Contract {
  id: string;
  salesforceId?: string;
  name: string;
  opportunityName?: string;
  status: string;
  contractType?: string[];
}

interface SearchableContractSelectProps {
  contracts: Contract[];
  value: string;
  onChange: (salesforceId: string) => void;
  placeholder?: string;
}

export function SearchableContractSelect({
  contracts,
  value,
  onChange,
  placeholder = 'Link to contract...',
}: SearchableContractSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
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

  // Filter contracts based on search term
  const filteredContracts = contracts.filter(contract => {
    const searchLower = searchTerm.toLowerCase();
    const nameMatch = contract.name.toLowerCase().includes(searchLower);
    const oppMatch = contract.opportunityName?.toLowerCase().includes(searchLower);
    const typeMatch = contract.contractType?.some(type =>
      type.toLowerCase().includes(searchLower)
    );
    return nameMatch || oppMatch || typeMatch;
  });

  // Get selected contract
  const selectedContract = contracts.find(c => c.salesforceId === value);

  const handleSelect = (salesforceId: string) => {
    onChange(salesforceId);
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
        <span className={selectedContract ? 'text-white' : 'text-[#475569]'}>
          {selectedContract
            ? `${selectedContract.opportunityName || selectedContract.name}${selectedContract.contractType?.length ? ` • ${selectedContract.contractType.join(', ')}` : ''}`
            : placeholder}
        </span>
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
                  placeholder="Search contracts..."
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
                  onClick={() => handleSelect('')}
                  className="w-full px-4 py-2.5 text-left text-sm text-[#64748B] hover:bg-white/[0.04] flex items-center gap-2 border-b border-white/[0.04]"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear selection
                </button>
              )}

              {/* Filtered Contracts */}
              {filteredContracts.length > 0 ? (
                filteredContracts.map((contract) => {
                  const isSelected = contract.salesforceId === value;
                  return (
                    <button
                      key={contract.id}
                      type="button"
                      onClick={() => handleSelect(contract.salesforceId || '')}
                      className={`w-full px-4 py-2.5 text-left text-sm hover:bg-white/[0.04] transition-colors ${
                        isSelected ? 'bg-[#38BDF8]/10 text-[#38BDF8]' : 'text-white'
                      }`}
                    >
                      <div className="font-medium">{contract.opportunityName || contract.name}</div>
                      <div className="text-xs text-[#64748B] mt-0.5">
                        {contract.name}
                        {contract.contractType?.length ? ` • ${contract.contractType.join(', ')}` : ''}
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="px-4 py-8 text-center text-sm text-[#64748B]">
                  No contracts found
                  {searchTerm && (
                    <div className="mt-1 text-xs">
                      Try a different search term
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer with count */}
            {filteredContracts.length > 0 && (
              <div className="px-4 py-2 border-t border-white/[0.08] text-xs text-[#64748B] text-center">
                {filteredContracts.length === contracts.length
                  ? `${contracts.length} contract${contracts.length !== 1 ? 's' : ''}`
                  : `${filteredContracts.length} of ${contracts.length} contracts`}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
