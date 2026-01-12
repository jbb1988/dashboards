'use client';

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
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
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const hasScrolledToToday = useRef(false);

  // Escape key handler for fullscreen
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Lock body scroll when fullscreen
  useEffect(() => {
    if (isFullscreen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isFullscreen]);

  // Sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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

  // Auto-scroll to today when calendar loads
  useEffect(() => {
    if (loadedMonths.length > 0 && !hasScrolledToToday.current) {
      // Give DOM time to render
      const timer = setTimeout(() => {
        scrollToToday();
        hasScrolledToToday.current = true;
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loadedMonths, scrollToToday]);

  // Reset scroll flag when component unmounts
  useEffect(() => {
    return () => {
      hasScrolledToToday.current = false;
    };
  }, []);

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
      <div className="rounded-xl bg-[#1E293B] border border-[#334155] shadow-xl overflow-hidden">
        <CalendarSkeleton />
      </div>
    );
  }

  return (
    <>
      {/* Fullscreen backdrop */}
      {isFullscreen && (
        <div
          className="fixed inset-0 bg-black/70 z-[9998]"
          onClick={() => setIsFullscreen(false)}
        />
      )}

      <div className={`
        rounded-xl bg-[#1E293B] border border-[#334155] shadow-xl overflow-hidden
        ${isFullscreen ? 'fixed inset-4 z-[9999] flex flex-col' : ''}
      `}>

      {/* Header */}
      <div className="px-5 py-4 bg-[#1E293B] border-b border-[#334155] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <h3 className="text-[16px] font-semibold text-white">Calendar</h3>
          <span className="text-[12px] text-[#94A3B8] bg-[#334155] px-2 py-0.5 rounded">
            {totalEvents} events
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Today button */}
          <button
            onClick={scrollToToday}
            className="text-[12px] px-4 py-2 rounded-lg bg-[#E16259] text-white hover:bg-[#c9554d] transition-colors flex items-center gap-2 font-medium shadow-lg"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Today
          </button>

          {/* Drag hint */}
          <div className="text-[11px] text-[#64748B] hidden sm:flex items-center gap-1.5 bg-[#334155]/50 px-3 py-1.5 rounded">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" />
            </svg>
            Drag to reschedule
          </div>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 rounded-lg bg-[#334155] text-[#94A3B8] hover:bg-[#475569] hover:text-white transition-colors"
            title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-[#334155] sticky top-0 z-20 bg-[#1E293B] shrink-0">
        {WEEKDAYS.map((day, idx) => (
          <div
            key={day}
            className={`
              px-3 py-3 text-center text-[11px] font-bold uppercase tracking-wider
              border-r border-[#334155]/50 last:border-r-0
              ${idx === 0 || idx === 6 ? 'text-[#64748B] bg-[#1a2332]' : 'text-[#94A3B8]'}
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
            overflow-y-auto overflow-x-hidden relative bg-[#0F172A]
            ${isDragging ? 'cursor-grabbing' : ''}
            ${isFullscreen ? 'flex-1' : 'h-[600px]'}
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

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}>
          {activeEvent && (
            <CalendarEventCardOverlay event={activeEvent} />
          )}
        </DragOverlay>
      </DndContext>

      {/* Footer */}
      <div className="px-4 py-2 bg-[#1E293B] border-t border-[#334155] text-center shrink-0">
        <span className="text-[10px] text-[#64748B]">
          Scroll to see more months
        </span>
      </div>
    </div>
    </>
  );
}
