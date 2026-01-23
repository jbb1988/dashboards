'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';

interface Obligation {
  id: string;
  title: string;
  description: string | null;
  contract_name: string;
  obligation_type: string;
  due_date: string | null;
  status: 'pending' | 'upcoming' | 'due' | 'overdue' | 'completed' | 'waived' | 'deferred';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface ObligationCalendarProps {
  obligations: Obligation[];
  onSelectObligation: (obligation: Obligation) => void;
  onSelectDate: (date: Date) => void;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const priorityColors = {
  low: 'bg-green-500',
  medium: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-500',
};

const statusColors = {
  pending: 'bg-blue-500',
  upcoming: 'bg-yellow-500',
  due: 'bg-orange-500',
  overdue: 'bg-red-500',
  completed: 'bg-green-500',
  waived: 'bg-gray-500',
  deferred: 'bg-purple-500',
};

export default function ObligationCalendar({
  obligations,
  onSelectObligation,
  onSelectDate,
}: ObligationCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  // Get obligations grouped by date
  const obligationsByDate = useMemo(() => {
    const map = new Map<string, Obligation[]>();
    obligations.forEach(o => {
      if (o.due_date) {
        const dateKey = o.due_date.split('T')[0];
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(o);
      }
    });
    return map;
  }, [obligations]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: Date[] = [];
    const currentDay = new Date(startDate);

    // Always show 6 weeks
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }

    return days;
  }, [currentDate]);

  function navigateMonth(direction: number) {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  }

  function isToday(date: Date) {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }

  function isCurrentMonth(date: Date) {
    return date.getMonth() === currentDate.getMonth();
  }

  function formatDateKey(date: Date) {
    return date.toISOString().split('T')[0];
  }

  return (
    <div className="bg-[#151F2E] border border-white/10 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigateMonth(-1)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold text-white">
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </h2>
          <button
            onClick={() => navigateMonth(1)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[#8FA3BF]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1.5 text-xs bg-white/5 text-[#8FA3BF] rounded-lg hover:bg-white/10 transition-colors"
          >
            Today
          </button>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'month' ? 'bg-teal-500 text-white' : 'bg-white/5 text-[#8FA3BF]'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1.5 text-xs transition-colors ${
                viewMode === 'week' ? 'bg-teal-500 text-white' : 'bg-white/5 text-[#8FA3BF]'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 border-b border-white/10">
        {DAYS.map(day => (
          <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-[#64748B] uppercase tracking-wider">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7">
        {calendarDays.map((date, index) => {
          const dateKey = formatDateKey(date);
          const dayObligations = obligationsByDate.get(dateKey) || [];
          const isCurrentMonthDay = isCurrentMonth(date);
          const isTodayDate = isToday(date);

          return (
            <motion.div
              key={index}
              onClick={() => onSelectDate(date)}
              className={`
                min-h-[100px] p-2 border-b border-r border-white/5 cursor-pointer transition-colors
                ${isCurrentMonthDay ? 'bg-transparent' : 'bg-white/[0.02]'}
                hover:bg-white/5
              `}
              whileHover={{ scale: 1.02 }}
            >
              {/* Date Number */}
              <div className="flex justify-between items-start mb-1">
                <span
                  className={`
                    w-7 h-7 flex items-center justify-center rounded-full text-sm
                    ${isTodayDate ? 'bg-teal-500 text-white font-bold' : isCurrentMonthDay ? 'text-white' : 'text-[#64748B]'}
                  `}
                >
                  {date.getDate()}
                </span>
                {dayObligations.length > 0 && (
                  <span className="text-xs text-[#64748B]">
                    {dayObligations.length}
                  </span>
                )}
              </div>

              {/* Obligations */}
              <div className="space-y-1">
                {dayObligations.slice(0, 3).map(obligation => (
                  <motion.div
                    key={obligation.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectObligation(obligation);
                    }}
                    className={`
                      px-2 py-1 rounded text-xs truncate cursor-pointer
                      ${statusColors[obligation.status]} bg-opacity-20
                      hover:bg-opacity-30 transition-colors
                    `}
                    whileHover={{ scale: 1.02 }}
                  >
                    <div className="flex items-center gap-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${priorityColors[obligation.priority]}`} />
                      <span className="truncate text-white/90">{obligation.title}</span>
                    </div>
                  </motion.div>
                ))}
                {dayObligations.length > 3 && (
                  <div className="text-xs text-[#64748B] px-2">
                    +{dayObligations.length - 3} more
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#64748B]">Status:</span>
          {Object.entries(statusColors).slice(0, 4).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-[#8FA3BF] capitalize">{status}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-[#64748B]">Priority:</span>
          {Object.entries(priorityColors).map(([priority, color]) => (
            <div key={priority} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-[#8FA3BF] capitalize">{priority}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
