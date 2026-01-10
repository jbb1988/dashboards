# MARS Design System Guide

A comprehensive guide to building A+ quality dashboards in the MARS platform.

## Quick Start

```tsx
import {
  DashboardBackground,
  backgroundPresets,
  KPICard,
  KPIIcons,
  tokens,
  colors,
} from '@/components/mars-ui';
```

Copy `DashboardTemplate.tsx` when creating a new dashboard for a ready-to-use starting point.

---

## Core Principles

### 1. Premium Background Foundation
Every dashboard must have the animated gradient background:

```tsx
<div className="min-h-screen bg-[#0F1722] relative overflow-hidden">
  <DashboardBackground {...backgroundPresets.contracts} />
  <div className="relative z-10">
    {/* Your content */}
  </div>
</div>
```

**Available Presets:**
| Preset | Use Case | Primary Color |
|--------|----------|---------------|
| `contracts` | Contracts dashboards | Cyan/Blue |
| `pm` | Project Management | Red/Orange |
| `finance` | Closeout, MCC | Green/Cyan |
| `admin` | Admin pages | Purple/Blue |
| `guides` | Documentation | Cyan/Purple |

### 2. Four-Layer Luminance Model
```
Layer 1: bg.app      (#0D0E12) - Page background
Layer 2: bg.section  (#16181D) - Section panels
Layer 3: bg.card     (#1E2028) - Cards (float with shadows)
Layer 4: bg.elevated (#262932) - Expanded/focus states
```

### 3. Semantic Colors Only
Never use arbitrary colors. Always use semantic tokens:

```tsx
// Good ✓
color={colors.accent.red}      // Danger, overdue
color={colors.accent.green}    // Success, complete
color={colors.accent.amber}    // Warning, attention

// Bad ✗
color="#ff0000"                // Arbitrary red
```

---

## Component Patterns

### KPI Cards
Always show KPI cards at the top of dashboards (3-6 cards):

```tsx
<div className="grid grid-cols-4 gap-4">
  <KPICard
    title="Total Items"
    value={data.total}
    subtitle="All time"
    icon={KPIIcons.folder}
    color="#38BDF8"
    delay={0.1}           // Stagger animation
    isActive={isActive}   // Optional highlight
    onClick={handleClick} // Optional interaction
    gradient              // Enable gradient background (recommended)
    glowIntensity="subtle" // 'none' | 'subtle' | 'strong'
  />
</div>
```

**Gradient KPI Cards (Mind-Muscle Style):**
Enable the `gradient` prop for premium visual pop:
- Colored gradient background from accent color to dark
- Semantic colored border
- Shadow glow effect
- Specular highlight on top edge (liquid glass effect)
- Enhanced hover glow

**Available Icons:**
`dollar`, `calendar`, `alert`, `trending`, `document`, `clipboard`, `checkCircle`, `clock`, `folder`, `warning`, `users`

### Sticky Table Headers
All data tables must have sticky headers:

```tsx
<div className="rounded-xl bg-[#1E2028] border border-[#2A2D37] overflow-hidden">
  {/* Sticky Header */}
  <div className="grid grid-cols-5 px-5 py-3 text-xs font-semibold text-[#64748B]
                  uppercase tracking-wider border-b border-white/5
                  sticky top-0 z-10 bg-[#151F2E]
                  shadow-[0_1px_0_rgba(255,255,255,0.05)]">
    <div>Column 1</div>
    <div>Column 2</div>
    {/* ... */}
  </div>

  {/* Scrollable Body */}
  <div className="max-h-[500px] overflow-y-auto">
    {items.map((item, i) => (
      <DataRow key={item.id} index={i} />
    ))}
  </div>
</div>
```

### Loading States
Use skeleton components instead of spinners:

```tsx
import { KPICardSkeleton, TableRowSkeleton } from '@/components/mars-ui';

function LoadingState() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[1,2,3,4].map(i => <KPICardSkeleton key={i} />)}
      </div>
      {[1,2,3,4,5].map(i => <TableRowSkeleton key={i} columns={5} />)}
    </div>
  );
}
```

### Empty States
Always provide helpful empty states with gradient icons:

```tsx
<div className="text-center py-20 bg-[#1E2028] rounded-xl border border-[#2A2D37]">
  {/* Gradient Icon Container */}
  <div
    className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-white/10"
    style={{
      background: 'linear-gradient(135deg, rgba(91,141,239,0.2), rgba(91,141,239,0.05))',
      boxShadow: '0 0 40px rgba(91,141,239,0.15)',
    }}
  >
    <IconComponent className="w-10 h-10 text-[#5B8DEF]" />
  </div>

  <h3 className="text-xl font-semibold text-[#F0F2F5] mb-2">No items found</h3>
  <p className="text-[#7C8291] text-sm mb-6">Description of what to do</p>

  {/* CTA Button */}
  <button className="px-4 py-2 rounded-lg bg-[#5B8DEF] text-white text-sm font-medium">
    Add Item
  </button>
</div>
```

---

## Animation Patterns

### Entrance Animations
Use staggered delays for list items:

```tsx
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ delay: index * 0.03 }}  // 30ms stagger
>
```

### Hover Effects
Cards should lift and glow on hover:

```tsx
<motion.div
  whileHover={{
    y: -4,
    boxShadow: '0 12px 32px rgba(0,0,0,0.4), 0 0 20px rgba(56,189,248,0.15)'
  }}
  transition={{ duration: 0.15 }}
>
```

### Button Interactions
All buttons need hover/tap feedback:

```tsx
<motion.button
  whileHover={{ scale: 1.05 }}
  whileTap={{ scale: 0.95 }}
  transition={{ duration: 0.1 }}
>
```

### Overdue/Urgent Indicators
Use pulse animation for attention:

```tsx
<div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-green-500'}`} />
```

---

## Color Reference

### Accent Colors
| Name | Hex | Use Case |
|------|-----|----------|
| Blue | `#5B8DEF` | Primary actions, info |
| Cyan | `#38BDF8` | Analytics, stages |
| Green | `#30A46C` | Success, complete |
| Amber | `#D4A72C` | Warning, attention |
| Red | `#E5484D` | Danger, overdue |
| Purple | `#8B5CF6` | Analysis, special |
| Orange | `#F97316` | Revenue, costs |

### Text Colors
| Token | Hex | Use |
|-------|-----|-----|
| `text.primary` | `#F0F2F5` | Main content |
| `text.secondary` | `#A8AEBB` | Supporting text |
| `text.muted` | `#7C8291` | De-emphasized |
| `text.accent` | `#5B8DEF` | Links, actions |

### Border Colors
| Token | Hex | Use |
|-------|-----|-----|
| `border.subtle` | `#2A2D37` | Barely visible |
| `border.default` | `#363A47` | Standard borders |
| `border.strong` | `#464B5A` | Emphasized |
| `border.focus` | `#5B8DEF` | Focus rings |

---

## Checklist for New Dashboards

Before shipping, verify:

- [ ] **Background**: DashboardBackground with appropriate preset
- [ ] **KPI Cards**: 3-6 cards at the top with icons and colors
- [ ] **Loading State**: Skeleton components (not spinners)
- [ ] **Empty State**: Gradient icon + helpful copy + CTA
- [ ] **Table Headers**: Sticky with shadow separator
- [ ] **Row Hover**: Background change + accent color text
- [ ] **Overdue Items**: Pulse animation on indicators
- [ ] **Buttons**: Hover scale + tap scale effects
- [ ] **Cards**: Hover lift with glow shadow
- [ ] **Animations**: Staggered entrance (0.03s delay)
- [ ] **Colors**: Only semantic accent colors used
- [ ] **Icons**: Proper SVG icons (no emoji or text symbols)

---

## File Structure

```
src/components/mars-ui/
├── index.ts              # All exports
├── tokens.ts             # Design tokens & colors
├── Card.tsx              # Card components
├── KPICard.tsx           # KPI card + icons
├── Badge.tsx             # Badges & status dots
├── ProgressBar.tsx       # Progress indicators
├── ExpandableRow.tsx     # Expandable sections
├── DashboardBackground.tsx  # Animated backgrounds
├── Skeleton.tsx          # Loading skeletons
├── DashboardTemplate.tsx # Starter template
└── DESIGN_GUIDE.md       # This file
```

---

## Import Cheatsheet

```tsx
// Everything you need for a dashboard
import {
  // Background
  DashboardBackground,
  backgroundPresets,

  // KPI
  KPICard,
  KPIIcons,
  AnimatedCounter,

  // Cards
  Card,
  CardHeader,
  CardContent,

  // Status
  Badge,
  StatusDot,

  // Progress
  ProgressBar,
  DistributionBar,

  // Loading
  Skeleton,
  KPICardSkeleton,
  TableRowSkeleton,
  CardSkeleton,
  DashboardSkeleton,

  // Tokens
  tokens,
  colors,
  shadows,

} from '@/components/mars-ui';
```
