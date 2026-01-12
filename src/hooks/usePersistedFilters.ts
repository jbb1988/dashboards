'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * A hook that persists filter state to localStorage.
 * Automatically loads saved filters on mount and saves whenever filters change.
 *
 * @param storageKey - Unique key for localStorage (e.g., 'documents-filters', 'contracts-filters')
 * @param defaultFilters - Default filter values to use if nothing is saved
 * @returns [filters, setFilters, clearFilters] - Current filters, setter function, and clear function
 */
export function usePersistedFilters<T extends object>(
  storageKey: string,
  defaultFilters: T
): [T, (filters: T | ((prev: T) => T)) => void, () => void] {
  // Initialize state - will be updated from localStorage in useEffect
  const [filters, setFiltersState] = useState<T>(defaultFilters);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load saved filters from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to handle any new filter properties added over time
        setFiltersState({ ...defaultFilters, ...parsed });
      }
    } catch (error) {
      console.warn(`Failed to load filters from localStorage (${storageKey}):`, error);
    }
    setIsInitialized(true);
  }, [storageKey]); // Only run on mount, defaultFilters is stable

  // Save filters to localStorage whenever they change (after initialization)
  useEffect(() => {
    if (!isInitialized) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    } catch (error) {
      console.warn(`Failed to save filters to localStorage (${storageKey}):`, error);
    }
  }, [filters, storageKey, isInitialized]);

  // Setter that matches useState signature
  const setFilters = useCallback((newFilters: T | ((prev: T) => T)) => {
    setFiltersState(newFilters);
  }, []);

  // Clear filters and reset to defaults
  const clearFilters = useCallback(() => {
    setFiltersState(defaultFilters);
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.warn(`Failed to clear filters from localStorage (${storageKey}):`, error);
    }
  }, [storageKey, defaultFilters]);

  return [filters, setFilters, clearFilters];
}

/**
 * Storage keys for different dashboards - use these to ensure consistency
 */
export const FILTER_STORAGE_KEYS = {
  DOCUMENTS: 'mars-documents-filters',
  CONTRACTS_PIPELINE: 'mars-contracts-pipeline-filters',
  STRATEGIC_INITIATIVES: 'mars-strategic-initiatives-filters',
  DIVERSIFIED: 'mars-diversified-filters',
  PROFITABILITY: 'mars-profitability-filters',
} as const;

export default usePersistedFilters;
