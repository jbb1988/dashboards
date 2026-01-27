// Single source of truth for all navigation/dashboard configuration
// Both the home page and sidebar consume from this file

export interface DashboardItem {
  name: string;
  href: string;
  description: string;
  badge?: string;
  icon: string; // Icon identifier - components render the actual SVG
  disabled?: boolean;
}

export interface Department {
  name: string;
  icon: string; // Icon identifier
  color: string; // Tailwind gradient classes (legacy)
  gradient: { from: string; to: string }; // Hex colors for inline styles
  dashboards: DashboardItem[];
}

// Badge/data source color mapping
export const badgeColors: Record<string, string> = {
  Salesforce: 'bg-[#38BDF8]',
  Asana: 'bg-[#E16259]',
  Excel: 'bg-[#22C55E]',
  Claude: 'bg-[#D97706]',
  NetSuite: 'bg-[#F97316]',
  Smartsheet: 'bg-[#0073EA]',
};

export function getBadgeColor(badge: string): string {
  return badgeColors[badge] || 'bg-[#64748B]';
}

// All departments with their dashboards - THE SINGLE SOURCE OF TRUTH
export const departments: Department[] = [
  {
    name: 'Contracts',
    icon: 'document',
    color: 'from-[#0189CB] to-[#38BDF8]',
    gradient: { from: '#0189CB', to: '#38BDF8' },
    dashboards: [
      { name: 'Contract Workspace', href: '/contracts/workspace', description: 'Review, redline & approve contracts', badge: 'Claude', icon: 'lightbulb' },
      { name: 'Contracts Pipeline', href: '/contracts-dashboard', description: 'Track contract status and pipeline', badge: 'Salesforce', icon: 'document' },
      { name: 'Playbooks', href: '/playbooks', description: 'Contract playbooks and templates', icon: 'book' },
      { name: 'Clause Library', href: '/clauses', description: 'Standard clause repository', icon: 'archive' },
    ],
  },
  {
    name: 'Project Management',
    icon: 'clipboard',
    color: 'from-[#E16259] to-[#F87171]',
    gradient: { from: '#E16259', to: '#F87171' },
    dashboards: [
      { name: 'Project Tracker', href: '/pm-dashboard', description: 'Monitor milestones and tasks', badge: 'Asana', icon: 'clipboard' },
    ],
  },
  {
    name: 'Finance',
    icon: 'currency',
    color: 'from-[#22C55E] to-[#4ADE80]',
    gradient: { from: '#22C55E', to: '#4ADE80' },
    dashboards: [
      { name: 'Project Profitability', href: '/closeout-dashboard', description: 'Project closeout metrics', badge: 'Excel', icon: 'currency' },
    ],
  },
  {
    name: 'Management',
    icon: 'building',
    color: 'from-[#A855F7] to-[#C084FC]',
    gradient: { from: '#A855F7', to: '#C084FC' },
    dashboards: [
      { name: 'Strategic Initiatives', href: '/management-dashboard', description: '2026 company pillars & objectives', badge: 'Smartsheet', icon: 'building' },
    ],
  },
  {
    name: 'Operations',
    icon: 'cog',
    color: 'from-[#F59E0B] to-[#FBBF24]',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
    dashboards: [
      { name: 'Command Center', href: '/operations', description: 'Order→Cash visibility & inventory status', badge: 'NetSuite', icon: 'chart' },
    ],
  },
  {
    name: 'Sales',
    icon: 'trending',
    color: 'from-[#EC4899] to-[#F472B6]',
    gradient: { from: '#EC4899', to: '#F472B6' },
    dashboards: [
      { name: 'Diversified Products', href: '/diversified-dashboard', description: 'Product class sales by customer', badge: 'NetSuite', icon: 'cube' },
      { name: 'Distributors', href: '/distributors-dashboard', description: 'Distributor network dashboard', badge: 'NetSuite', icon: 'cart' },
    ],
  },
  {
    name: 'Administration',
    icon: 'users',
    color: 'from-[#64748B] to-[#94A3B8]',
    gradient: { from: '#64748B', to: '#94A3B8' },
    dashboards: [
      { name: 'User Management', href: '/admin', description: 'Manage users and permissions', icon: 'users' },
      { name: 'Guides', href: '/guides', description: 'Help documentation and guides', icon: 'book' },
    ],
  },
];

// Flatten all dashboards for easy access
export const allDashboards: DashboardItem[] = departments.flatMap(dept => dept.dashboards);

// Get dashboard by href
export function getDashboardByHref(href: string): DashboardItem | undefined {
  return allDashboards.find(d => d.href === href);
}

// Get department by name
export function getDepartmentByName(name: string): Department | undefined {
  return departments.find(d => d.name === name);
}

// Get department for a dashboard href
export function getDepartmentForDashboard(href: string): Department | undefined {
  return departments.find(dept => dept.dashboards.some(d => d.href === href));
}

// Default pinned routes for sidebar (excluding Home which is always first)
export const DEFAULT_PINNED_ROUTES = [
  '/contracts/workspace',
  '/contracts-dashboard',
  '/pm-dashboard',
  '/operations',
];

// Sidebar navigation groups - derived from departments
// This maps department names to sidebar group names (some may be combined or renamed)
export const sidebarGroupMapping: Record<string, string> = {
  'Contracts': 'Contracts',
  'Sales': 'Sales',
  'Finance': 'Operations', // Finance goes under Operations in sidebar
  'Operations': 'Operations',
  'Management': 'Management',
  'Administration': 'Administration',
};

// Get sidebar groups from departments
export function getSidebarGroups(): { name: string; dashboards: DashboardItem[] }[] {
  const groups: Record<string, DashboardItem[]> = {};

  for (const dept of departments) {
    const groupName = sidebarGroupMapping[dept.name] || dept.name;
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(...dept.dashboards);
  }

  return Object.entries(groups).map(([name, dashboards]) => ({ name, dashboards }));
}

// Data sources shown on home page
export const dataSources = [
  { name: 'Salesforce', color: 'bg-[#38BDF8]' },
  { name: 'Asana', color: 'bg-[#E16259]' },
  { name: 'DocuSign', color: 'bg-[#FFD700]' },
  { name: 'NetSuite', color: 'bg-[#F97316]' },
  { name: 'Smartsheet', color: 'bg-[#0073EA]' },
];
