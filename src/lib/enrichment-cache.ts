/**
 * Shared in-memory cache for NetSuite enrichment data
 */

const CACHE_KEY_PREFIX = 'wo_enriched_';
let enrichedCache: Record<string, any> = {};

export function getEnrichedWorkOrder(woNumber: string) {
  const cacheKey = `${CACHE_KEY_PREFIX}${woNumber}`;
  return enrichedCache[cacheKey] || null;
}

export function setEnrichedWorkOrder(woNumber: string, data: any) {
  const cacheKey = `${CACHE_KEY_PREFIX}${woNumber}`;
  enrichedCache[cacheKey] = data;
}

export function clearEnrichmentCache() {
  enrichedCache = {};
}

export function getEnrichmentStats() {
  return {
    totalCached: Object.keys(enrichedCache).length,
    woNumbers: Object.keys(enrichedCache).map(k => k.replace(CACHE_KEY_PREFIX, '')),
  };
}
