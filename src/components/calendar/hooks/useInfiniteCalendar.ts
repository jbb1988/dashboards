'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { CalendarEvent, CalendarMonth, CalendarDay, CalendarWeek, formatDateKey, isSameDay } from '../types';

interface UseInfiniteCalendarOptions {
  events: CalendarEvent[];
  initialMonthsToLoad?: number;
}

interface UseInfiniteCalendarReturn {
  loadedMonths: CalendarMonth[];
  topSentinelRef: React.RefObject<HTMLDivElement>;
  bottomSentinelRef: React.RefObject<HTMLDivElement>;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  scrollToToday: () => void;
  loadingDirection: 'past' | 'future' | null;
  todayRef: React.RefObject<HTMLDivElement>;
}

// Generate month data with weeks and days
function generateMonthData(year: number, month: number, events: CalendarEvent[]): CalendarMonth {
  // Handle month overflow/underflow
  const normalizedDate = new Date(year, month, 1);
  const normalizedYear = normalizedDate.getFullYear();
  const normalizedMonth = normalizedDate.getMonth();

  const firstDay = new Date(normalizedYear, normalizedMonth, 1);
  const lastDay = new Date(normalizedYear, normalizedMonth + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const weeks: CalendarWeek[] = [];
  let currentWeek: (CalendarDay | null)[] = [];

  // Add empty slots for days before the 1st
  for (let i = 0; i < startDayOfWeek; i++) {
    currentWeek.push(null);
  }

  // Add all days of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(normalizedYear, normalizedMonth, day);
    date.setHours(0, 0, 0, 0);
    const dateKey = formatDateKey(date);

    // Find events for this day
    const dayEvents = events.filter(event => {
      const eventStart = event.startOn ? new Date(event.startOn) : null;
      const eventEnd = event.dueOn ? new Date(event.dueOn) : null;

      // If event has both start and end, check if day falls within range
      if (eventStart && eventEnd) {
        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(0, 0, 0, 0);
        return date >= eventStart && date <= eventEnd;
      }

      // If only start date, show on that day
      if (eventStart) {
        eventStart.setHours(0, 0, 0, 0);
        return isSameDay(date, eventStart);
      }

      // If only due date, show on that day
      if (eventEnd) {
        eventEnd.setHours(0, 0, 0, 0);
        return isSameDay(date, eventEnd);
      }

      return false;
    });

    const calendarDay: CalendarDay = {
      date,
      dateKey,
      isToday: isSameDay(date, today),
      isPast: date < today,
      isCurrentMonth: true,
      events: dayEvents,
    };

    currentWeek.push(calendarDay);

    if (currentWeek.length === 7) {
      weeks.push({ days: currentWeek });
      currentWeek = [];
    }
  }

  // Pad last week with nulls
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push({ days: currentWeek });
  }

  return {
    year: normalizedYear,
    month: normalizedMonth,
    weeks,
  };
}

export function useInfiniteCalendar({
  events,
  initialMonthsToLoad = 3,
}: UseInfiniteCalendarOptions): UseInfiniteCalendarReturn {
  const [loadedMonths, setLoadedMonths] = useState<CalendarMonth[]>([]);
  const [loadingDirection, setLoadingDirection] = useState<'past' | 'future' | null>(null);

  const topSentinelRef = useRef<HTMLDivElement>(null);
  const bottomSentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const todayRef = useRef<HTMLDivElement>(null);

  const isLoadingRef = useRef(false);
  const initialScrollDone = useRef(false);

  // Initialize with months around current date
  useEffect(() => {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Load previous month, current month, and next month
    const initialMonths: CalendarMonth[] = [];
    for (let i = -1; i <= 1; i++) {
      initialMonths.push(generateMonthData(currentYear, currentMonth + i, events));
    }

    setLoadedMonths(initialMonths);
  }, [events]);

  // Load more months in a direction
  const loadMoreMonths = useCallback((direction: 'past' | 'future') => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setLoadingDirection(direction);

    // Small delay to show loading state
    setTimeout(() => {
      setLoadedMonths(prev => {
        if (prev.length === 0) return prev;

        const monthsToAdd = 2; // Load 2 months at a time
        const newMonths: CalendarMonth[] = [];

        if (direction === 'past') {
          const firstMonth = prev[0];
          for (let i = monthsToAdd; i >= 1; i--) {
            newMonths.push(
              generateMonthData(firstMonth.year, firstMonth.month - i, events)
            );
          }
          return [...newMonths, ...prev];
        } else {
          const lastMonth = prev[prev.length - 1];
          for (let i = 1; i <= monthsToAdd; i++) {
            newMonths.push(
              generateMonthData(lastMonth.year, lastMonth.month + i, events)
            );
          }
          return [...prev, ...newMonths];
        }
      });

      setLoadingDirection(null);
      isLoadingRef.current = false;
    }, 150);
  }, [events]);

  // Set up intersection observers
  useEffect(() => {
    const topSentinel = topSentinelRef.current;
    const bottomSentinel = bottomSentinelRef.current;
    const container = scrollContainerRef.current;

    if (!topSentinel || !bottomSentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !isLoadingRef.current) {
            if (entry.target === topSentinel) {
              // Store scroll position before loading
              const scrollHeight = container.scrollHeight;
              const scrollTop = container.scrollTop;

              loadMoreMonths('past');

              // After DOM updates, restore scroll position
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const newScrollHeight = container.scrollHeight;
                  const heightDiff = newScrollHeight - scrollHeight;
                  container.scrollTop = scrollTop + heightDiff;
                });
              });
            } else if (entry.target === bottomSentinel) {
              loadMoreMonths('future');
            }
          }
        });
      },
      {
        root: container,
        rootMargin: '200px 0px',
        threshold: 0,
      }
    );

    observer.observe(topSentinel);
    observer.observe(bottomSentinel);

    return () => {
      observer.disconnect();
    };
  }, [loadMoreMonths]);

  // Scroll to today on initial load
  useEffect(() => {
    if (loadedMonths.length > 0 && !initialScrollDone.current && scrollContainerRef.current) {
      initialScrollDone.current = true;
      // Small delay to ensure DOM is ready
      setTimeout(() => {
        scrollToToday();
      }, 100);
    }
  }, [loadedMonths]);

  // Scroll to today function
  const scrollToToday = useCallback(() => {
    const container = scrollContainerRef.current;
    const todayElement = document.getElementById('calendar-today');

    if (container && todayElement) {
      const containerRect = container.getBoundingClientRect();
      const todayRect = todayElement.getBoundingClientRect();
      const scrollOffset = todayRect.top - containerRect.top - 120; // 120px from top

      container.scrollTo({
        top: container.scrollTop + scrollOffset,
        behavior: 'smooth',
      });
    }
  }, []);

  return {
    loadedMonths,
    topSentinelRef,
    bottomSentinelRef,
    scrollContainerRef,
    scrollToToday,
    loadingDirection,
    todayRef,
  };
}
