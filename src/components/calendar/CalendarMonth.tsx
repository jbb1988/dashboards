'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarMonth as CalendarMonthType, CalendarEvent, CalendarDay, SpanningEvent, formatDateKey, isSameDay } from './types';
import { CalendarDayCell } from './CalendarDayCell';
import { CalendarSpanningEvent } from './CalendarSpanningEvent';

interface CalendarMonthProps {
  month: CalendarMonthType;
  onEventClick: (event: CalendarEvent) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Check if an event is multi-day
function isMultiDayEvent(event: CalendarEvent): boolean {
  if (!event.startOn || !event.dueOn) return false;
  const start = new Date(event.startOn);
  const end = new Date(event.dueOn);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return start.getTime() !== end.getTime();
}

// Calculate spanning events for a week
function calculateSpanningEvents(
  week: { days: (CalendarDay | null)[] },
  allEvents: CalendarEvent[]
): SpanningEvent[] {
  const spanningEvents: SpanningEvent[] = [];
  const seenEventIds = new Set<string>();

  // Get the date range for this week
  const weekDays: Date[] = [];
  week.days.forEach((day, idx) => {
    if (day) {
      weekDays[idx] = day.date;
    }
  });

  // Find first and last actual days in the week
  let firstDayIdx = weekDays.findIndex(d => d !== undefined);
  let lastDayIdx = weekDays.length - 1;
  while (lastDayIdx >= 0 && !weekDays[lastDayIdx]) lastDayIdx--;

  if (firstDayIdx === -1) return [];

  const weekStart = weekDays[firstDayIdx];
  const weekEnd = weekDays[lastDayIdx] || weekDays[firstDayIdx];

  // Find multi-day events that overlap this week
  allEvents.forEach(event => {
    if (!isMultiDayEvent(event)) return;
    if (seenEventIds.has(event.gid)) return;

    const eventStart = new Date(event.startOn!);
    const eventEnd = new Date(event.dueOn!);
    eventStart.setHours(0, 0, 0, 0);
    eventEnd.setHours(0, 0, 0, 0);

    // Check if event overlaps this week
    const weekStartTime = weekStart.getTime();
    const weekEndTime = weekEnd.getTime();
    const eventStartTime = eventStart.getTime();
    const eventEndTime = eventEnd.getTime();

    // Event overlaps if it starts before week ends AND ends after week starts
    if (eventStartTime <= weekEndTime && eventEndTime >= weekStartTime) {
      seenEventIds.add(event.gid);

      // Calculate start column (0-6)
      let startCol = 0;
      if (eventStartTime > weekStartTime) {
        // Event starts within this week - find the column
        for (let i = 0; i < 7; i++) {
          if (weekDays[i] && weekDays[i].getTime() === eventStartTime) {
            startCol = i;
            break;
          }
        }
      } else {
        // Event started before this week - starts at first day of week
        startCol = firstDayIdx;
      }

      // Calculate end column (0-6)
      let endCol = 6;
      if (eventEndTime < weekEndTime) {
        // Event ends within this week - find the column
        for (let i = 0; i < 7; i++) {
          if (weekDays[i] && weekDays[i].getTime() === eventEndTime) {
            endCol = i;
            break;
          }
        }
      } else {
        // Event ends after this week - extends to last day
        endCol = lastDayIdx;
      }

      spanningEvents.push({
        event,
        startCol,
        endCol,
        isStart: eventStartTime >= weekStartTime && eventStartTime <= weekEndTime,
        isEnd: eventEndTime >= weekStartTime && eventEndTime <= weekEndTime,
        row: 0, // Will be calculated below
      });
    }
  });

  // Sort by start column, then by duration (longer first)
  spanningEvents.sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return (b.endCol - b.startCol) - (a.endCol - a.startCol);
  });

  // Assign rows to avoid overlaps
  const columnOccupancy: number[][] = Array(7).fill(null).map(() => []);

  spanningEvents.forEach(spanning => {
    // Find the first row where all columns in this span are free
    let row = 0;
    let foundRow = false;

    while (!foundRow) {
      let rowIsFree = true;
      for (let col = spanning.startCol; col <= spanning.endCol; col++) {
        if (columnOccupancy[col].includes(row)) {
          rowIsFree = false;
          break;
        }
      }

      if (rowIsFree) {
        foundRow = true;
        spanning.row = row;
        // Mark these columns as occupied for this row
        for (let col = spanning.startCol; col <= spanning.endCol; col++) {
          columnOccupancy[col].push(row);
        }
      } else {
        row++;
      }

      // Safety limit
      if (row > 10) {
        spanning.row = row;
        break;
      }
    }
  });

  return spanningEvents;
}

export function CalendarMonth({ month, onEventClick }: CalendarMonthProps) {
  const monthName = `${MONTH_NAMES[month.month]} ${month.year}`;

  // Check if this month contains today
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === month.year && today.getMonth() === month.month;

  // Collect all events from all days
  const allEvents = useMemo(() => {
    const events: CalendarEvent[] = [];
    const seenIds = new Set<string>();
    month.weeks.forEach(week => {
      week.days.forEach(day => {
        if (day) {
          day.events.forEach(event => {
            if (!seenIds.has(event.gid)) {
              seenIds.add(event.gid);
              events.push(event);
            }
          });
        }
      });
    });
    return events;
  }, [month]);

  // Calculate spanning events for each week
  const weeksWithSpanning = useMemo(() => {
    return month.weeks.map(week => ({
      ...week,
      spanningEvents: calculateSpanningEvents(week, allEvents),
    }));
  }, [month.weeks, allEvents]);

  // Count unique events
  const eventCount = allEvents.length;

  // Calculate max spanning rows for height
  const getSpanningHeight = (spanningEvents: SpanningEvent[]) => {
    if (spanningEvents.length === 0) return 0;
    const maxRow = Math.max(...spanningEvents.map(s => s.row));
    return (maxRow + 1) * 28 + 8; // 28px per row + padding
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      {/* Month Header */}
      <div className={`
        sticky top-0 z-10 px-5 py-4
        bg-[#1E293B] border-b-2
        flex items-center justify-between
        ${isCurrentMonth ? 'border-[#E16259]' : 'border-[#334155]'}
      `}>
        <div className="flex items-center gap-3">
          <span className={`
            text-[18px] font-bold tracking-tight
            ${isCurrentMonth ? 'text-[#E16259]' : 'text-white'}
          `}>
            {monthName}
          </span>
          {isCurrentMonth && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-[#E16259] text-white font-semibold uppercase tracking-wider">
              Current Month
            </span>
          )}
        </div>

        <span className="text-[12px] text-[#64748B] bg-[#334155]/50 px-3 py-1 rounded">
          {eventCount} events
        </span>
      </div>

      {/* Weeks */}
      <div>
        {weeksWithSpanning.map((week, weekIdx) => {
          const spanningHeight = getSpanningHeight(week.spanningEvents);

          return (
            <div key={weekIdx} className="border-b border-[#1E293B]">
              {/* Spanning events row */}
              {week.spanningEvents.length > 0 && (
                <div
                  className="relative bg-[#0F172A] border-b border-[#1E293B]/50"
                  style={{ height: `${spanningHeight}px` }}
                >
                  {week.spanningEvents.map((spanning) => (
                    <CalendarSpanningEvent
                      key={`${spanning.event.gid}-${weekIdx}`}
                      spanning={spanning}
                      onClick={onEventClick}
                    />
                  ))}
                </div>
              )}

              {/* Day cells */}
              <div className="grid grid-cols-7">
                {week.days.map((day, dayIdx) => (
                  <CalendarDayCell
                    key={day?.dateKey ?? `empty-${month.year}-${month.month}-${weekIdx}-${dayIdx}`}
                    day={day}
                    onEventClick={onEventClick}
                    hideMultiDayEvents={true}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
