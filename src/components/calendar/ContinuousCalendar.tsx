'use client';

import { useCallback, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  pointerWithin,
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarProps, CalendarEvent } from './types';
import { useInfiniteCalendar } from './hooks/useInfiniteCalendar';
import { useCalendarDragDrop } from './hooks/useCalendarDragDrop';
import { CalendarMonth } from './CalendarMonth';
import { CalendarEventCardOverlay } from './CalendarEventCard';
import { CalendarLoadingIndicator, CalendarSkeleton } from './CalendarSkeleton';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function ContinuousCalendar({
  events,
  onEventClick,
  onEventMove,
  loading = false,
}: CalendarProps) {
  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Infinite scroll hook
  const {
    loadedMonths,
    topSentinelRef,
    bottomSentinelRef,
    scrollContainerRef,
    scrollToToday,
    loadingDirection,
  } = useInfiniteCalendar({ events });

  // Drag and drop hook
  const {
    activeEvent,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    isDragging,
  } = useCalendarDragDrop({
    onEventMove,
  });

  // Count total events
  const totalEvents = useMemo(() => events.length, [events]);

  if (loading) {
    return (
      <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[#151F2E] border border-white/[0.06] shadow-[0_8px_24px_rgba(0,0,0,0.35)] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-[#0F1722] border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-[14px] font-semibold text-[#EAF2FF]">Calendar</h3>
          <span className="text-[11px] text-[#64748B]">
            {totalEvents} events
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Today button */}
          <button
            onClick={scrollToToday}
            className="text-[11px] px-3 py-1.5 rounded-lg bg-[#E16259]/10 text-[#E16259] hover:bg-[#E16259]/20 transition-colors flex items-center gap-1.5 border border-[#E16259]/20"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Today
          </button>

          {/* Drag hint */}
          <div className="text-[10px] text-[#475569] hidden sm:flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
            Drag to reschedule
          </div>
        </div>
      </div>

      {/* Weekday Header - Sticky */}
      <div className="grid grid-cols-7 border-b border-white/[0.06] sticky top-0 z-20 bg-[#0F1722]">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`
              px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-wider
              ${idx === 0 || idx === 6 ? 'text-[#475569]' : 'text-[#64748B]'}
            `}
          >
            {day}
          </div>
        ))}
      </div>

      {/* DnD Context wrapping the scrollable area */}
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Scrollable Calendar Body */}
        <div
          ref={scrollContainerRef}
          className={`
            h-[600px] min-h-[400px] max-h-[calc(100vh-280px)] overflow-y-scroll overflow-x-hidden
            scroll-smooth relative
            ${isDragging ? 'cursor-grabbing' : ''}
          `}
        >
          {/* Top sentinel for loading past months */}
          <div ref={topSentinelRef} className="h-1">
            <AnimatePresence>
              {loadingDirection === 'past' && (
                <CalendarLoadingIndicator direction="past" />
              )}
            </AnimatePresence>
          </div>

          {/* Months */}
          {loadedMonths.map((month) => (
            <CalendarMonth
              key={`${month.year}-${month.month}`}
              month={month}
              onEventClick={onEventClick}
            />
          ))}

          {/* Bottom sentinel for loading future months */}
          <div ref={bottomSentinelRef} className="h-1">
            <AnimatePresence>
              {loadingDirection === 'future' && (
                <CalendarLoadingIndicator direction="future" />
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Drag Overlay - Shows the dragged event */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeEvent && (
            <CalendarEventCardOverlay event={activeEvent} />
          )}
        </DragOverlay>
      </DndContext>

      {/* Scroll hint at bottom */}
      <div className="px-4 py-2 bg-[#0B1220]/50 border-t border-white/[0.04] text-center">
        <span className="text-[9px] text-[#475569]">
          Scroll to see more months
        </span>
      </div>
    </div>
  );
}
