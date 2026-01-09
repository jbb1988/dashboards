'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BundleContract {
  id: string;
  name: string;
  is_primary: boolean;
}

interface BundleInfo {
  id: string;
  name: string;
  contracts: BundleContract[];
}

interface BundleBannerProps {
  bundle: BundleInfo;
  currentContractId: string;
  onManageBundle?: () => void;
}

export default function BundleBanner({
  bundle,
  currentContractId,
  onManageBundle,
}: BundleBannerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const otherContracts = bundle.contracts.filter(c => c.id !== currentContractId);
  const currentContract = bundle.contracts.find(c => c.id === currentContractId);
  const isPrimary = currentContract?.is_primary;

  return (
    <div className="mb-4 bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg overflow-hidden">
      {/* Banner Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-[#8B5CF6]/5 transition-colors"
      >
        {/* Bundle Icon */}
        <div className="w-8 h-8 rounded-lg bg-[#8B5CF6]/20 flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-[#8B5CF6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>

        {/* Bundle Info */}
        <div className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[#8B5CF6] font-medium text-sm truncate">
              {bundle.name}
            </span>
            {isPrimary && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF6] text-white font-medium">
                Primary
              </span>
            )}
          </div>
          <div className="text-[#8FA3BF] text-xs mt-0.5">
            Shares documents with: {otherContracts.map(c => c.name.split(' ')[0]).join(', ')}
          </div>
        </div>

        {/* Expand Icon */}
        <motion.svg
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-4 h-4 text-[#8B5CF6] flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-[#8B5CF6]/20 pt-3">
              <div className="text-xs font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                Bundled Contracts
              </div>
              <div className="space-y-2">
                {bundle.contracts.map((contract) => (
                  <div
                    key={contract.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                      contract.id === currentContractId
                        ? 'bg-[#8B5CF6]/20 border border-[#8B5CF6]/30'
                        : 'bg-[#0B1220]'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${
                        contract.id === currentContractId ? 'bg-[#8B5CF6]' : 'bg-[#475569]'
                      }`}
                    />
                    <span
                      className={`text-sm flex-1 ${
                        contract.id === currentContractId ? 'text-white font-medium' : 'text-[#8FA3BF]'
                      }`}
                    >
                      {contract.name}
                    </span>
                    {contract.is_primary && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#8B5CF6]/20 text-[#8B5CF6] font-medium">
                        Primary
                      </span>
                    )}
                    {contract.id === currentContractId && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-[#8FA3BF]">
                        Current
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Manage Button */}
              {onManageBundle && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onManageBundle();
                  }}
                  className="mt-3 w-full px-3 py-2 text-sm font-medium text-[#8B5CF6] bg-[#8B5CF6]/10 border border-[#8B5CF6]/30 rounded-lg hover:bg-[#8B5CF6]/20 transition-colors"
                >
                  Manage Bundle
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
