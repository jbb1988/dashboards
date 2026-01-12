'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { CalendarMonth as CalendarMonthType, CalendarEvent, CalendarDay, isSameDay } from './types';
import { CalendarDayCell } from './CalendarDayCell';

interface CalendarMonthProps {
  month: CalendarMonthType;
  onEventClick: (event: CalendarEvent) => void;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Status colors matching Asana
const STATUS_COLORS = {
  confirmed: '#7FBA7A',
  placeholder: '#F1BD6C',
  default: '#64748B',
};

interface SpanningEvent {
  event: CalendarEvent;
  startCol: number;
  spanCols: number;
  row: number;
}

// Calculate spanning events for a week
function getSpanningEvents(
  weekDays: (CalendarDay | null)[],
  allEvents: CalendarEvent[]
): SpanningEvent[] {
  const spanningEvents: { event: CalendarEvent; startCol: number; spanCols: number }[] = [];
  const processedEventIds = new Set<string>();

  // Find events that span multiple days within this week
  weekDays.forEach((day, dayIdx) => {
    if (!day) return;

    day.events.forEach(event => {
      if (processedEventIds.has(event.gid)) return;

      const eventStart = event.startOn ? new Date(event.startOn) : null;
      const eventEnd = event.dueOn ? new Date(event.dueOn) : null;

      // Check if it's a multi-day event
      if (eventStart && eventEnd) {
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(0, 0, 0, 0);

        const duration = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        if (duration > 1) {
          processedEventIds.add(event.gid);

          // Find start column in this week
          let startCol = dayIdx;
          const weekStart = weekDays[0]?.date;
          if (weekStart && eventStart < weekStart) {
            startCol = 0;
          }

          // Find end column in this week
          let endCol = 6;
          for (let i = dayIdx; i < 7; i++) {
            const d = weekDays[i]?.date;
            if (d && isSameDay(d, eventEnd)) {
              endCol = i;
              break;
            }
            if (d && d > eventEnd) {
              endCol = i - 1;
              break;
            }
          }

          const spanCols = Math.max(1, endCol - startCol + 1);
          spanningEvents.push({ event, startCol, spanCols });
        }
      }
    });
  });

  // Assign rows to avoid overlaps
  const result: SpanningEvent[] = [];
  const occupied: number[][] = []; // occupied[row] = array of occupied columns

  spanningEvents.forEach(({ event, startCol, spanCols }) => {
    let row = 0;
    while (true) {
      if (!occupied[row]) occupied[row] = [];

      let hasSpace = true;
      for (let col = startCol; col < startCol + spanCols; col++) {
        if (occupied[row].includes(col)) {
          hasSpace = false;
          break;
        }
      }

      if (hasSpace) {
        for (let col = startCol; col < startCol + spanCols; col++) {
          occupied[row].push(col);
        }
        result.push({ event, startCol, spanCols, row });
        break;
      }
      row++;
      if (row > 5) break; // Safety limit
    }
  });

  return result;
}

// Get single-day events (excluding multi-day)
function getSingleDayEvents(day: CalendarDay): CalendarEvent[] {
  return day.events.filter(event => {
    const eventStart = event.startOn ? new Date(event.startOn) : null;
    const eventEnd = event.dueOn ? new Date(event.dueOn) : null;

    if (eventStart && eventEnd) {
      eventStart.setHours(0, 0, 0, 0);
      eventEnd.setHours(0, 0, 0, 0);
      const duration = Math.ceil((eventEnd.getTime() - eventStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      return duration <= 1;
    }
    return true;
  });
}

// Spanning event bar component
function SpanningEventBar({
  event,
  startCol,
  spanCols,
  row,
  onClick
}: SpanningEvent & { onClick: () => void }) {
  const statusColor = event.status === 'confirmed'
    ? STATUS_COLORS.confirmed
    : event.status === 'placeholder'
      ? STATUS_COLORS.placeholder
      : STATUS_COLORS.default;

  return (
    <motion.div
      initial={{ opacity: 0, scaleX: 0.8 }}
      animate={{ opacity: 1, scaleX: 1 }}
      className="absolute h-[22px] rounded cursor-pointer transition-all duration-100 flex items-center px-2 overflow-hidden group hover:brightness-110 hover:z-20"
      style={{
        left: `calc(${(startCol / 7) * 100}% + 4px)`,
        width: `calc(${(spanCols / 7) * 100}% - 8px)`,
        top: `${32 + row * 26}px`,
        backgroundColor: statusColor,
      }}
      onClick={onClick}
      whileHover={{ scale: 1.02, y: -1 }}
    >
      <span className="text-[10px] font-medium truncate" style={{ color: '#1E293B' }}>
        {event.name}
      </span>
      {spanCols >= 2 && event.assignee && (
        <span className="text-[9px] ml-auto truncate opacity-70 hidden group-hover:block" style={{ color: '#1E293B' }}>
          {event.assignee.name.split(' ')[0]}
        </span>
      )}
    </motion.div>
  );
}

export function CalendarMonth({ month, onEventClick }: CalendarMonthProps) {
  const monthName = `${MONTH_NAMES[month.month]} ${month.year}`;

  // Check if this month contains today
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === month.year && today.getMonth() === month.month;

  // Collect all events in the month for spanning calculation
  const allMonthEvents = useMemo(() => {
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

  // Count unique events
  const eventCount = allMonthEvents.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="border-b border-white/[0.04]"
    >
      {/* Month Header - Sticky */}
      <div className={`
        sticky top-[41px] z-10 px-4 py-2.5
        bg-[#0F1722]/95 backdrop-blur-sm
        border-b border-white/[0.06]
        flex items-center justify-between
      `}>
        <div className="flex items-center gap-2">
          <span className={`
            text-[13px] font-semibold
            ${isCurrentMonth ? 'text-[#E16259]' : 'text-[#EAF2FF]'}
          `}>
            {monthName}
          </span>
          {isCurrentMonth && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#E16259]/20 text-[#E16259] font-medium">
              Current
            </span>
          )}
        </div>

        {/* Month event count - subtle in header */}
        <span className="text-[10px] text-[#475569]">
          {eventCount} events
        </span>
      </div>

      {/* Weeks */}
      <div>
        {month.weeks.map((week, weekIdx) => {
          const spanningEvents = getSpanningEvents(week.days, allMonthEvents);
          const maxSpanningRows = spanningEvents.length > 0
            ? Math.max(...spanningEvents.map(e => e.row)) + 1
            : 0;

          return (
            <div
              key={weekIdx}
              className="relative border-b border-white/[0.02] overflow-hidden"
            >
              {/* Spanning events layer - positioned relative to the week container */}
              {spanningEvents.length > 0 && (
                <div
                  className="absolute top-0 left-0 right-0 z-10 pointer-events-none overflow-hidden"
                  style={{ height: `${32 + maxSpanningRows * 26}px` }}
                >
                  {spanningEvents.map(se => (
                    <div key={se.event.gid} className="pointer-events-auto">
                      <SpanningEventBar
                        {...se}
                        onClick={() => onEventClick(se.event)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Day cells grid */}
              <div
                className="grid grid-cols-7"
                style={{ paddingTop: maxSpanningRows > 0 ? `${maxSpanningRows * 26}px` : '0' }}
              >
                {week.days.map((day, dayIdx) => (
                  <CalendarDayCell
                    key={day?.dateKey ?? `empty-${month.year}-${month.month}-${weekIdx}-${dayIdx}`}
                    day={day}
                    onEventClick={onEventClick}
                    singleDayEventsOnly={true}
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
