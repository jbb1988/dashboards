/**
 * Distributor Analysis Utilities
 *
 * Core functions for the Distributors tab:
 * - Location extraction from customer names
 * - Growth opportunity scoring
 * - Category gap detection
 * - Task generation
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface LocationInfo {
  location: string;
  state: string;
  confidence: number;  // 0-100
  rawName: string;
}

export interface GrowthScoreComponents {
  revenueGap: number;      // 0-100
  trendScore: number;      // 0-100
  categoryGap: number;     // 0-100
  marginHealth: number;    // 0-100
}

export interface GrowthScore {
  overall: number;         // 0-100 composite
  components: GrowthScoreComponents;
  tier: 'high' | 'medium' | 'low';
}

export interface CategoryAnalysis {
  categoryName: string;
  topPerformerPenetration: number;  // 0-1 (% of top locations buying)
  locationPurchasing: boolean;
  revenueOpportunity: number;
  priority: 'high' | 'medium' | 'low';
}

export interface DistributorLocation {
  customer_id: string;
  customer_name: string;
  location: string;
  state: string;
  location_confidence: number;
  revenue: number;
  prior_revenue: number;
  cost: number;
  gross_profit: number;
  margin_pct: number;
  yoy_change_pct: number;
  units: number;
  categories: string[];
  category_count: number;
  last_purchase_date: string | null;
  growth_score?: GrowthScore;
  category_gaps?: CategoryAnalysis[];
  is_opportunity: boolean;
}

export interface DistributorMetrics {
  revenue: number;
  margin_pct: number;
  category_penetration: number;
  avg_yoy_change: number;
}

// =============================================================================
// DISTRIBUTOR PATTERNS
// =============================================================================

const DISTRIBUTORS = [
  { name: 'Ferguson', patterns: ['ferguson', 'ferguson enterprises', 'ferguson waterworks'] },
  { name: 'Core & Main', patterns: ['core & main', 'core and main', 'core&main', 'core main'] },
  { name: 'Fortiline', patterns: ['fortiline'] },
  { name: 'Consolidated Pipe', patterns: ['consolidated pipe', 'consolidated supply'] },
];

// Major US cities for location extraction
const MAJOR_CITIES = [
  'New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia',
  'San Antonio', 'San Diego', 'Dallas', 'San Jose', 'Austin', 'Jacksonville',
  'Fort Worth', 'Columbus', 'Charlotte', 'San Francisco', 'Indianapolis',
  'Seattle', 'Denver', 'Washington', 'Boston', 'El Paso', 'Nashville',
  'Detroit', 'Oklahoma City', 'Portland', 'Las Vegas', 'Memphis', 'Louisville',
  'Baltimore', 'Milwaukee', 'Albuquerque', 'Tucson', 'Fresno', 'Sacramento',
  'Kansas City', 'Mesa', 'Atlanta', 'Omaha', 'Colorado Springs', 'Raleigh',
  'Miami', 'Long Beach', 'Virginia Beach', 'Oakland', 'Minneapolis', 'Tampa',
  'Tulsa', 'Arlington', 'New Orleans', 'Wichita', 'Cleveland', 'Bakersfield',
  'Aurora', 'Anaheim', 'Honolulu', 'Santa Ana', 'Riverside', 'Corpus Christi',
  'Lexington', 'Stockton', 'Henderson', 'Saint Paul', 'Cincinnati', 'Pittsburgh',
  'Greensboro', 'Anchorage', 'Plano', 'Lincoln', 'Orlando', 'Irvine', 'Newark',
  'Durham', 'Chula Vista', 'Toledo', 'Fort Wayne', 'St. Petersburg', 'Laredo',
  'Jersey City', 'Chandler', 'Madison', 'Lubbock', 'Scottsdale', 'Reno',
  'Buffalo', 'Gilbert', 'Glendale', 'North Las Vegas', 'Winston-Salem',
  'Chesapeake', 'Norfolk', 'Fremont', 'Garland', 'Irving', 'Hialeah',
  'Richmond', 'Boise', 'Spokane', 'Baton Rouge'
];

// US state abbreviations
const STATE_ABBREVATIONS = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
];

// =============================================================================
// DISTRIBUTOR IDENTIFICATION
// =============================================================================

/**
 * Identify distributor from customer name using pattern matching
 */
export function getDistributor(customerName: string): string | null {
  if (!customerName) return null;

  const lower = customerName.toLowerCase();

  for (const dist of DISTRIBUTORS) {
    for (const pattern of dist.patterns) {
      if (lower.includes(pattern)) {
        return dist.name;
      }
    }
  }

  return null;
}

/**
 * Get all known distributor names
 */
export function getAllDistributors(): string[] {
  return DISTRIBUTORS.map(d => d.name);
}

// =============================================================================
// LOCATION EXTRACTION
// =============================================================================

/**
 * Extract location (city/state) from customer name using multiple strategies
 * Returns location info with confidence score
 */
export function extractLocation(customerName: string, distributorName: string): LocationInfo {
  if (!customerName || !distributorName) {
    return {
      location: 'Unknown',
      state: '',
      confidence: 0,
      rawName: customerName || ''
    };
  }

  // Remove distributor name from customer name to get location part
  const distributorPatterns = DISTRIBUTORS.find(d => d.name === distributorName)?.patterns || [];
  let locationPart = customerName.toLowerCase();

  for (const pattern of distributorPatterns) {
    locationPart = locationPart.replace(pattern, '').trim();
  }

  // Clean up common separators
  locationPart = locationPart.replace(/^[-–—,.\s]+|[-–—,.\s]+$/g, '').trim();

  // Strategy 1: Check for state abbreviation at the end
  const stateMatch = locationPart.match(/\b([A-Z]{2})\b\s*$/i);
  if (stateMatch) {
    const stateAbbr = stateMatch[1].toUpperCase();
    if (STATE_ABBREVATIONS.includes(stateAbbr)) {
      const cityPart = locationPart.replace(stateMatch[0], '').trim();
      const cleanCity = cleanCityName(cityPart);
      if (cleanCity) {
        return {
          location: cleanCity,
          state: stateAbbr,
          confidence: 90,
          rawName: customerName
        };
      }
    }
  }

  // Strategy 2: Check for major city names
  for (const city of MAJOR_CITIES) {
    const cityLower = city.toLowerCase();
    if (locationPart.includes(cityLower)) {
      // Try to extract state if present
      const stateMatch2 = locationPart.match(/\b([A-Z]{2})\b/i);
      const state = (stateMatch2 && STATE_ABBREVATIONS.includes(stateMatch2[1].toUpperCase()))
        ? stateMatch2[1].toUpperCase()
        : '';

      return {
        location: city,
        state: state,
        confidence: state ? 85 : 75,
        rawName: customerName
      };
    }
  }

  // Strategy 3: Extract first word/phrase as potential city
  const words = locationPart.split(/[\s-–—,]+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const potentialCity = cleanCityName(words[0]);
    const potentialState = words.find(w => w.length === 2 && STATE_ABBREVATIONS.includes(w.toUpperCase()));

    if (potentialCity) {
      return {
        location: potentialCity,
        state: potentialState ? potentialState.toUpperCase() : '',
        confidence: potentialState ? 60 : 40,
        rawName: customerName
      };
    }
  }

  // Strategy 4: Fallback - use location part as-is if it looks reasonable
  if (locationPart && locationPart.length >= 3 && locationPart.length <= 50) {
    return {
      location: cleanCityName(locationPart) || 'Unknown',
      state: '',
      confidence: 30,
      rawName: customerName
    };
  }

  // Complete fallback
  return {
    location: 'Unknown',
    state: '',
    confidence: 0,
    rawName: customerName
  };
}

/**
 * Clean and capitalize city name
 */
function cleanCityName(city: string): string {
  if (!city) return '';

  // Remove special characters but keep spaces and hyphens
  const cleaned = city.replace(/[^a-zA-Z\s-]/g, '').trim();

  if (!cleaned || cleaned.length < 2) return '';

  // Capitalize first letter of each word
  return cleaned
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format location display based on confidence
 */
export function formatLocationDisplay(locationInfo: LocationInfo): string {
  const { location, state, confidence } = locationInfo;

  if (confidence === 0 || location === 'Unknown') {
    return '[Location Unknown]';
  }

  const cityState = state ? `${location}, ${state}` : location;

  if (confidence < 50) {
    return `~${cityState}`;  // Low confidence - show with ~
  } else if (confidence < 80) {
    return `~${cityState}`;  // Medium confidence - show with ~
  } else {
    return cityState;  // High confidence - show directly
  }
}

// =============================================================================
// GROWTH SCORING (Phase 2 - Placeholder for MVP)
// =============================================================================

/**
 * Calculate growth opportunity score for a location
 * Full implementation in Phase 2
 */
export function calculateGrowthScore(
  location: DistributorLocation,
  distributorAvg: DistributorMetrics
): GrowthScore {
  // MVP: Simple scoring based on revenue gap and YoY trend
  const revenueGap = location.revenue < distributorAvg.revenue * 0.75
    ? Math.min(100, 100 * (1 - location.revenue / (distributorAvg.revenue * 0.75)))
    : 0;

  const trendScore = location.yoy_change_pct < 0
    ? Math.min(100, Math.abs(location.yoy_change_pct) * 2)
    : Math.max(0, 50 - location.yoy_change_pct);

  const categoryGap = 0;  // Placeholder
  const marginHealth = 0;  // Placeholder

  const overall = revenueGap * 0.4 + trendScore * 0.3 + categoryGap * 0.2 + marginHealth * 0.1;

  const tier: 'high' | 'medium' | 'low' = overall >= 60 ? 'high' : overall >= 35 ? 'medium' : 'low';

  return {
    overall: Math.round(overall),
    components: {
      revenueGap: Math.round(revenueGap),
      trendScore: Math.round(trendScore),
      categoryGap: Math.round(categoryGap),
      marginHealth: Math.round(marginHealth)
    },
    tier
  };
}

// =============================================================================
// CATEGORY GAP DETECTION (Phase 2 - Placeholder for MVP)
// =============================================================================

/**
 * Detect product category gaps for a location
 * Full implementation in Phase 2
 */
export function detectCategoryGaps(
  location: DistributorLocation,
  distributorLocations: DistributorLocation[]
): CategoryAnalysis[] {
  // MVP: Return empty array - implement in Phase 2
  return [];
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Format currency values for display
 */
export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  }
  if (Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${Math.round(value).toLocaleString()}`;
}

/**
 * Format percentage values for display
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/**
 * Calculate distributor-level metrics from locations
 */
export function calculateDistributorMetrics(locations: DistributorLocation[]): DistributorMetrics {
  if (locations.length === 0) {
    return {
      revenue: 0,
      margin_pct: 0,
      category_penetration: 0,
      avg_yoy_change: 0
    };
  }

  const totalRevenue = locations.reduce((sum, loc) => sum + loc.revenue, 0);
  const totalGrossProfit = locations.reduce((sum, loc) => sum + loc.gross_profit, 0);
  const avgMargin = totalRevenue > 0 ? (totalGrossProfit / totalRevenue) * 100 : 0;

  const avgCategories = locations.reduce((sum, loc) => sum + loc.category_count, 0) / locations.length;

  const weightedYoY = locations.reduce((sum, loc) => sum + (loc.yoy_change_pct * loc.revenue), 0) / totalRevenue;

  return {
    revenue: totalRevenue / locations.length,  // Average revenue per location
    margin_pct: avgMargin,
    category_penetration: avgCategories,
    avg_yoy_change: weightedYoY || 0
  };
}

/**
 * Determine if location is a growth opportunity
 * Based on bottom 25% revenue + growth score threshold
 */
export function isGrowthOpportunity(
  location: DistributorLocation,
  distributorLocations: DistributorLocation[]
): boolean {
  if (distributorLocations.length === 0) return false;

  // Calculate 25th percentile revenue
  const sortedByRevenue = [...distributorLocations].sort((a, b) => a.revenue - b.revenue);
  const percentile25Index = Math.floor(sortedByRevenue.length * 0.25);
  const percentile25Revenue = sortedByRevenue[percentile25Index]?.revenue || 0;

  // Primary: Bottom 25% by revenue
  const isBottom25 = location.revenue <= percentile25Revenue;

  // Secondary: Significant YoY decline
  const hasDecline = location.yoy_change_pct <= -15;

  // Tertiary: Growth score threshold (if calculated)
  const hasHighScore = (location.growth_score?.overall || 0) >= 35;

  return isBottom25 || hasDecline || hasHighScore;
}
