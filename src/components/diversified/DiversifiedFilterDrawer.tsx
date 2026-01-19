'use client';

import { motion, AnimatePresence } from 'framer-motion';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DiversifiedFilterState {
  selectedYears: number[];
  selectedMonths: number[];
  selectedClass: string | null;
  viewMode: 'class' | 'customer';
}

interface DiversifiedFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  filters: DiversifiedFilterState;
  onFilterChange: (filters: Partial<DiversifiedFilterState>) => void;
  filterOptions: {
    years: number[];
    months: number[];
    classes: string[];
  };
  activeTab: string;
}

export default function DiversifiedFilterDrawer({
  isOpen,
  onClose,
  filters,
  onFilterChange,
  filterOptions,
  activeTab,
}: DiversifiedFilterDrawerProps) {
  const updateFilter = <K extends keyof DiversifiedFilterState>(key: K, value: DiversifiedFilterState[K]) => {
    onFilterChange({ [key]: value });
  };

  const toggleYear = (year: number) => {
    const newYears = filters.selectedYears.includes(year)
      ? filters.selectedYears.filter(y => y !== year)
      : [...filters.selectedYears, year];
    updateFilter('selectedYears', newYears);
  };

  const toggleMonth = (month: number) => {
    const newMonths = filters.selectedMonths.includes(month)
      ? filters.selectedMonths.filter(m => m !== month)
      : [...filters.selectedMonths, month];
    updateFilter('selectedMonths', newMonths);
  };

  const selectClass = (className: string | null) => {
    console.log('Filter Drawer - Class selected:', className);
    updateFilter('selectedClass', className);
  };

  const clearFilters = () => {
    onFilterChange({
      selectedYears: [],
      selectedMonths: [],
      selectedClass: null,
    });
  };

  const hasActiveFilters =
    filters.selectedYears.length > 0 ||
    filters.selectedMonths.length > 0 ||
    filters.selectedClass !== null;

  const activeFilterCount = [
    filters.selectedYears.length > 0,
    filters.selectedMonths.length > 0,
    filters.selectedClass !== null,
  ].filter(Boolean).length;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 z-50"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#151F2E] border-l border-white/[0.06] shadow-2xl z-50 overflow-y-auto"
          >
            {/* Header */}
            <div className="sticky top-0 bg-[#0F1722] border-b border-white/[0.06] px-6 py-4 z-10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-[16px] font-semibold text-white">Filter Data</h2>
                    <span className="text-[12px] text-[#64748B]">
                      {activeFilterCount > 0 ? `${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active` : 'No filters applied'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/5 text-[#8FA3BF] hover:text-white transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* View Mode - Only on Table tab */}
              {activeTab === 'table' && (
                <div>
                  <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
                    View Mode
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateFilter('viewMode', 'class')}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                        filters.viewMode === 'class'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                      }`}
                    >
                      By Class
                    </button>
                    <button
                      onClick={() => updateFilter('viewMode', 'customer')}
                      className={`flex-1 px-4 py-2.5 rounded-xl text-[12px] font-medium transition-all ${
                        filters.viewMode === 'customer'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                      }`}
                    >
                      By Customer
                    </button>
                  </div>
                </div>
              )}

              {/* Year Filter */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
                  Year
                </label>
                <div className="flex flex-wrap gap-2">
                  {filterOptions.years.map((year) => (
                    <button
                      key={year}
                      onClick={() => toggleYear(year)}
                      className={`px-4 py-2 rounded-xl text-[13px] font-medium transition-all ${
                        filters.selectedYears.includes(year)
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                      }`}
                    >
                      {year}
                    </button>
                  ))}
                </div>
              </div>

              {/* Month Filter */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
                  Month
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <button
                      key={month}
                      onClick={() => toggleMonth(month)}
                      className={`px-3 py-2 rounded-xl text-[12px] font-medium transition-all ${
                        filters.selectedMonths.includes(month)
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-[#0B1220] text-[#8FA3BF] border border-white/[0.04] hover:border-white/[0.08] hover:text-white'
                      }`}
                    >
                      {MONTH_NAMES[month - 1]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Product Class */}
              <div>
                <label className="block text-[12px] font-medium text-[#64748B] mb-3 uppercase tracking-wider">
                  Product Class
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => selectClass(null)}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${
                      filters.selectedClass === null
                        ? 'bg-white/10 border border-white/20'
                        : 'bg-[#0B1220] border border-white/[0.04] hover:border-white/[0.08]'
                    }`}
                  >
                    <span className="text-[13px] text-white">All Classes</span>
                    {filters.selectedClass === null && (
                      <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  {filterOptions.classes.map((className) => (
                    <button
                      key={className}
                      onClick={() => selectClass(className)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between ${
                        filters.selectedClass === className
                          ? 'bg-white/10 border border-white/20'
                          : 'bg-[#0B1220] border border-white/[0.04] hover:border-white/[0.08]'
                      }`}
                    >
                      <span className="text-[13px] text-white">{className}</span>
                      {filters.selectedClass === className && (
                        <svg className="w-4 h-4 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="w-full py-3 rounded-xl text-[13px] font-medium text-red-400 border border-red-500/20 hover:bg-red-500/10 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear All Filters
                </button>
              )}
            </div>

            {/* Apply Button */}
            <div className="sticky bottom-0 bg-[#0F1722] border-t border-white/[0.06] p-4">
              <button
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white text-[14px] font-medium transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
