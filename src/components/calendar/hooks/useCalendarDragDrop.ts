'use client';

import { useState, useCallback } from 'react';
import {
  DragStartEvent,
  DragEndEvent,
  UniqueIdentifier,
} from '@dnd-kit/core';
import { CalendarEvent } from '../types';

interface UseCalendarDragDropOptions {
  onEventMove: (eventId: string, newDate: string) => Promise<void>;
  onOptimisticUpdate?: (eventId: string, newDate: string, rollback: boolean) => void;
}

interface UseCalendarDragDropReturn {
  activeEvent: CalendarEvent | null;
  activeId: UniqueIdentifier | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  handleDragCancel: () => void;
  isDragging: boolean;
}

export function useCalendarDragDrop({
  onEventMove,
  onOptimisticUpdate,
}: UseCalendarDragDropOptions): UseCalendarDragDropReturn {
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
  const [originalDate, setOriginalDate] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event;
    const eventData = active.data.current?.event as CalendarEvent | undefined;

    if (eventData) {
      setActiveEvent(eventData);
      setActiveId(active.id);
      setOriginalDate(eventData.startOn || eventData.dueOn || null);
    }
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;

    // Reset state
    setActiveEvent(null);
    setActiveId(null);

    // Check if dropped on a valid target
    if (!over || active.id === over.id) {
      setOriginalDate(null);
      return;
    }

    const eventId = active.id as string;
    const newDate = over.id as string;

    // Validate the drop target is a date (format: YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newDate)) {
      setOriginalDate(null);
      return;
    }

    // Optimistic update
    if (onOptimisticUpdate) {
      onOptimisticUpdate(eventId, newDate, false);
    }

    try {
      // Call the API to persist the change
      await onEventMove(eventId, newDate);
    } catch (error) {
      console.error('Failed to move event:', error);

      // Rollback on failure
      if (onOptimisticUpdate && originalDate) {
        onOptimisticUpdate(eventId, originalDate, true);
      }
    }

    setOriginalDate(null);
  }, [onEventMove, onOptimisticUpdate, originalDate]);

  const handleDragCancel = useCallback(() => {
    setActiveEvent(null);
    setActiveId(null);
    setOriginalDate(null);
  }, []);

  return {
    activeEvent,
    activeId,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
    isDragging: activeId !== null,
  };
}
