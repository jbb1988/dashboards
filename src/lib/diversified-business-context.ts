/**
 * MARS Diversified Products - Business Context for AI Insights
 *
 * PRIORITY: Focus AI recommendations on HIGH-REVENUE products.
 * Don't waste time on low-dollar commodity items - limited resources!
 *
 * HIGH REVENUE (focus here):
 * - VEROflow testers ($$$)
 * - Fabricated Spools (custom work, good margins)
 * - Z-Plate Strainers (equipment-level pricing)
 * - Calibration Services (recurring revenue)
 *
 * LOW PRIORITY (high transaction, low dollar - don't focus AI on these):
 * - Zinc Caps, Drill Taps, Valve Keys, etc.
 *
 * NOTE: MTS (Meter Testing Solutions) is handled separately.
 */

export const DIVERSIFIED_PRODUCTS = {
  // ============================================================================
  // HIGH REVENUE PRODUCTS - FOCUS AI RECOMMENDATIONS HERE
  // ============================================================================
  highRevenueProducts: {
    'VEROflow-4 Touch': {
      category: 'Meter Testing Equipment',
      revenue: 'HIGH - $$$ per unit',
      description: 'Mobile meter testing system with touchscreen, tests meters up to 8"',
      specs: { flowRange: '0.75-650 GPM', accuracy: '+/- 0.5%', weight: '65 lbs' },
      sellingPoints: [
        'Only NIST traceable field test unit',
        '16-point calibration linearization',
        'Test meters on-site without removal',
        'VEROflow Tester App integration',
      ],
      upsell: ['Annual calibration service', 'Cart & accessory kits', 'ThrustBuster diffuser'],
      targetCustomer: 'Municipal utilities with large meter inventory',
    },
    'VEROflow-1': {
      category: 'Meter Testing Equipment',
      revenue: 'MEDIUM-HIGH',
      description: 'Residential meter tester, portable, 3-50 GPM',
      specs: { flowRange: '3-50 GPM', accuracy: '+/- 1.5%', size: '5/8" x 3/4"' },
      sellingPoints: [
        'Lightweight & portable',
        'Verify meter accuracy within 0.5%',
        'Locate pressure problems',
      ],
      upsell: ['Annual calibration service'],
      targetCustomer: 'Smaller utilities, meter shops',
    },
    'VEROflow Calibration Service': {
      category: 'Recurring Service',
      revenue: 'HIGH - Recurring annual revenue',
      description: 'Annual calibration for VEROflow units - NIST traceable',
      sellingPoints: [
        'Quick turnaround vs competitors',
        'Battery replacement included',
        '16-point calibration linearization (VF-4)',
        'Only NIST traceable field test calibration',
      ],
      targetCustomer: 'All VEROflow owners - annual service',
    },
    'Z-Plate Strainers': {
      category: 'Strainers',
      revenue: 'HIGH - Equipment-level pricing',
      description: 'Protects meters from debris, AWWA C701/C702 compliant',
      sizes: ['Carbon Steel: 1.5"-30"', 'No-Lead Bronze: 1.5"-6"'],
      sellingPoints: [
        'Reduces turbulence, <1 PSI loss',
        'Easy in-line maintenance',
        'Extends meter life and accuracy',
      ],
      crossSell: ['Flanges', 'Gaskets', 'Flange Kits'],
      targetCustomer: 'Utilities protecting meter investments',
    },
    'Fabricated Test Port Spools': {
      category: 'Custom Fabrication',
      revenue: 'HIGH - Custom work, good margins',
      description: 'NSF61 certified spools for meter installations, custom lengths',
      sizes: ['Oval: 1.5"-2"', 'Round: 3"-12"', 'Custom available'],
      sellingPoints: [
        'NSF61 certified for drinking water',
        'Eliminates lay length issues',
        'On-site testing without meter removal',
      ],
      crossSell: ['Flanges', 'Gaskets'],
      targetCustomer: 'Utilities, meter manufacturers, distributors',
    },
  },

  // ============================================================================
  // LOW PRIORITY PRODUCTS - Don't waste AI recommendations on these
  // High transaction, low dollar - they sell themselves or not worth the effort
  // ============================================================================
  lowPriorityProducts: [
    'Zinc Caps',
    'Super Tuff Drill Taps',
    'Adjustable Valve Keys',
    'Gate Valve Boxes',
    'RCM-150 Remote Counter Modules',
    'ThrustBuster Diffuser', // Unless bundled with VEROflow
  ],

  // ============================================================================
  // CROSS-SELL RULES - Focus on high-value add-ons
  // ============================================================================
  crossSellRules: [
    { when: 'VEROflow-4', suggest: ['Calibration Service', 'Cart Kit', 'ThrustBuster', 'Hose Accessories'], reason: 'Complete testing solution' },
    { when: 'VEROflow-1', suggest: ['Calibration Service'], reason: 'Annual service revenue' },
    { when: 'Strainers', suggest: ['Flanges', 'Gaskets', 'Flange Kits'], reason: 'Strainers need flanges to install' },
    { when: 'Spools', suggest: ['Flanges', 'Gaskets'], reason: 'Spools connect with flanges' },
    { when: 'Flanges', suggest: ['Gaskets', 'Flange Kits'], reason: 'Every flange needs gaskets' },
  ],

  // ============================================================================
  // CUSTOMER TYPES - Who buys the high-value stuff
  // ============================================================================
  customerTypes: {
    'Municipal Utility': {
      highValueProducts: ['VEROflow-4', 'Strainers', 'Spools', 'Calibration Service'],
      buyingPattern: 'Budget cycles, capital equipment purchases',
      tips: 'Emphasize NIST traceability, AWWA compliance, ROI on meter accuracy',
    },
    'Private Utility': {
      highValueProducts: ['VEROflow-4', 'VEROflow-1', 'Strainers'],
      buyingPattern: 'Faster decisions than municipal',
      tips: 'Focus on efficiency gains and cost savings',
    },
    'Distributor': {
      highValueProducts: ['Spools', 'Strainers', 'VEROflow units'],
      buyingPattern: 'Stock for resale',
      tips: 'Volume pricing, reliable supply, marketing support',
    },
  },

  // ============================================================================
  // SALES TACTICS - For high-value opportunities
  // ============================================================================
  salesTactics: {
    lostCustomer: {
      reason: 'Usually price on commodity items - but check if they stopped buying VEROflow/Strainers',
      action: 'If they stopped buying high-value items (VEROflow, Strainers, Spools), call immediately. Commodity items not worth chasing.',
    },
    decliningCustomer: {
      reason: 'May have found another supplier for key products',
      action: 'Check what high-value products they stopped buying. Call about those specifically.',
    },
    growAccount: {
      reason: 'Customer only buys commodity items',
      action: 'Pitch VEROflow or Strainers. Convert commodity-only customers to equipment buyers.',
    },
    calibrationUpsell: {
      reason: 'Every VEROflow owner needs annual calibration',
      action: 'Check calibration dates. Proactive outreach before due date.',
    },
  },
};

// Generate focused AI context - prioritizes high-revenue products
export function generateProductContext(): string {
  const highValue = Object.entries(DIVERSIFIED_PRODUCTS.highRevenueProducts)
    .map(([name, info]) => `- ${name}: ${info.description} [${info.revenue}]`)
    .join('\n');

  const crossSell = DIVERSIFIED_PRODUCTS.crossSellRules
    .map(rule => `- ${rule.when} -> add ${rule.suggest.join(', ')}`)
    .join('\n');

  return `
MARS DIVERSIFIED PRODUCTS - Water Infrastructure Supplies

HIGH-REVENUE PRODUCTS (focus here, not on small commodity items):
${highValue}

CROSS-SELL (for high-value products):
${crossSell}

SALES PRIORITIES:
1. VEROflow equipment and calibration services (best margins)
2. Z-Plate Strainers (equipment-level pricing)
3. Fabricated Spools (custom work, good margins)

IMPORTANT:
- Don't recommend chasing low-dollar commodity sales (Zinc Caps, Drill Taps, etc.)
- Focus on VEROflow, Strainers, Spools - these have real margin
- VEROflow owners need annual calibration (recurring revenue)
`;
}
