'use client';

import { useState, useRef, useEffect } from 'react';

interface FilterOption {
  key: string;
  label: string;
  color?: string;
}

interface FilterBarProps {
  pillars: FilterOption[];
  statuses: FilterOption[];
  timeframes: FilterOption[];
  owners: string[];
  siLevels: FilterOption[];
  selectedPillar: string | null;
  selectedStatus: string | null;
  selectedTimeframe: string | null;
  selectedOwner: string | null;
  selectedSiLevel: string | null;
  searchQuery: string;
  onPillarChange: (value: string | null) => void;
  onStatusChange: (value: string | null) => void;
  onTimeframeChange: (value: string | null) => void;
  onOwnerChange: (value: string | null) => void;
  onSiLevelChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onClearAll: () => void;
}

interface DropdownProps {
  label: string;
  options: FilterOption[];
  selected: string | null;
  onChange: (value: string | null) => void;
  showColor?: boolean;
}

function Dropdown({ label, options, selected, onChange, showColor = false }: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.key === selected);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
          selected
            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#1E293B]/80 border border-white/[0.06]'
        }`}
      >
        {showColor && selectedOption?.color && (
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: selectedOption.color }}
          />
        )}
        <span>{selected ? selectedOption?.label || selected : label}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-48 bg-[#1E293B] rounded-lg border border-white/[0.08] shadow-xl z-50 overflow-hidden">
          <button
            onClick={() => {
              onChange(null);
              setIsOpen(false);
            }}
            className={`w-full px-3 py-2 text-left text-[13px] hover:bg-white/[0.05] ${
              !selected ? 'text-orange-400' : 'text-[#94A3B8]'
            }`}
          >
            All {label}
          </button>
          {options.map(option => (
            <button
              key={option.key}
              onClick={() => {
                onChange(option.key);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-[13px] hover:bg-white/[0.05] flex items-center gap-2 ${
                selected === option.key ? 'text-orange-400 bg-orange-500/10' : 'text-[#94A3B8]'
              }`}
            >
              {showColor && option.color && (
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: option.color }}
                />
              )}
              <span className="truncate">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FilterBar({
  pillars,
  statuses,
  timeframes,
  owners,
  siLevels,
  selectedPillar,
  selectedStatus,
  selectedTimeframe,
  selectedOwner,
  selectedSiLevel,
  searchQuery,
  onPillarChange,
  onStatusChange,
  onTimeframeChange,
  onOwnerChange,
  onSiLevelChange,
  onSearchChange,
  onClearAll,
}: FilterBarProps) {
  const hasFilters = selectedPillar || selectedStatus || selectedTimeframe || selectedOwner || selectedSiLevel || searchQuery;

  const ownerOptions: FilterOption[] = owners.map(o => ({ key: o, label: o }));

  return (
    <div className="bg-[#151F2E] rounded-xl border border-white/[0.04] p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search initiatives..."
            className="w-full pl-10 pr-4 py-2 bg-[#0F1722] rounded-lg text-[13px] text-white placeholder-[#64748B] border border-white/[0.06] focus:border-orange-500/50 focus:outline-none transition-colors"
          />
        </div>

        {/* Filters */}
        <Dropdown
          label="Pillar"
          options={pillars}
          selected={selectedPillar}
          onChange={onPillarChange}
          showColor
        />

        <Dropdown
          label="Status"
          options={statuses}
          selected={selectedStatus}
          onChange={onStatusChange}
          showColor
        />

        <Dropdown
          label="Timeframe"
          options={timeframes}
          selected={selectedTimeframe}
          onChange={onTimeframeChange}
        />

        <Dropdown
          label="Owner"
          options={ownerOptions}
          selected={selectedOwner}
          onChange={onOwnerChange}
        />

        <Dropdown
          label="Level"
          options={siLevels}
          selected={selectedSiLevel}
          onChange={onSiLevelChange}
        />

        {/* Clear all */}
        {hasFilters && (
          <button
            onClick={onClearAll}
            className="px-3 py-2 text-[13px] text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>
    </div>
  );
}
