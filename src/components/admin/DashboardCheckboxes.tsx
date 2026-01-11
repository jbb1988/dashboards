'use client';

import { motion } from 'framer-motion';

export interface DashboardOption {
  id: string;
  name: string;
  category: string | null;
  icon?: string | null;
}

interface DashboardCheckboxesProps {
  dashboards: DashboardOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
  showCategoryHeaders?: boolean;
}

export default function DashboardCheckboxes({
  dashboards,
  selected,
  onChange,
  disabled = false,
  showCategoryHeaders = true,
}: DashboardCheckboxesProps) {
  // Group dashboards by category
  const grouped = dashboards.reduce((acc, dash) => {
    const category = dash.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(dash);
    return acc;
  }, {} as Record<string, DashboardOption[]>);

  const categories = Object.keys(grouped).sort();

  const toggleDashboard = (dashboardId: string) => {
    if (disabled) return;
    if (selected.includes(dashboardId)) {
      onChange(selected.filter(id => id !== dashboardId));
    } else {
      onChange([...selected, dashboardId]);
    }
  };

  const toggleAll = () => {
    if (disabled) return;
    if (selected.length === dashboards.length) {
      onChange([]);
    } else {
      onChange(dashboards.map(d => d.id));
    }
  };

  return (
    <div className="space-y-4">
      {/* Select All */}
      <div className="flex items-center justify-between pb-2 border-b border-white/10">
        <span className="text-[12px] font-medium text-[#64748B]">
          {selected.length} of {dashboards.length} selected
        </span>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled}
          className="text-[12px] text-[#38BDF8] hover:text-[#38BDF8]/80 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {selected.length === dashboards.length ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* Grouped Checkboxes */}
      {categories.map(category => (
        <div key={category}>
          {showCategoryHeaders && (
            <div className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
              {category}
            </div>
          )}
          <div className="space-y-1">
            {grouped[category].map(dashboard => (
              <motion.label
                key={dashboard.id}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#1E293B]/50'
                } ${selected.includes(dashboard.id) ? 'bg-[#38BDF8]/10' : ''}`}
                whileHover={!disabled ? { x: 2 } : {}}
              >
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selected.includes(dashboard.id)}
                    onChange={() => toggleDashboard(dashboard.id)}
                    disabled={disabled}
                    className="sr-only"
                  />
                  <div
                    className={`w-4 h-4 rounded border-2 transition-colors ${
                      selected.includes(dashboard.id)
                        ? 'bg-[#38BDF8] border-[#38BDF8]'
                        : 'border-[#64748B] bg-transparent'
                    }`}
                  >
                    {selected.includes(dashboard.id) && (
                      <svg
                        className="w-3 h-3 text-[#0B1220] absolute top-0.5 left-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={3}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-[13px] text-white">{dashboard.name}</span>
              </motion.label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
