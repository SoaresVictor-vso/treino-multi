---
name: High-Performance Kinetic
colors:
  surface: '#131314'
  surface-dim: '#131314'
  surface-bright: '#39393a'
  surface-container-lowest: '#0e0e0f'
  surface-container-low: '#1b1b1c'
  surface-container: '#1f1f20'
  surface-container-high: '#2a2a2b'
  surface-container-highest: '#353436'
  on-surface: '#e5e2e3'
  on-surface-variant: '#c4c9ac'
  inverse-surface: '#e5e2e3'
  inverse-on-surface: '#303031'
  outline: '#8e9379'
  outline-variant: '#444933'
  surface-tint: '#abd600'
  primary: '#ffffff'
  on-primary: '#283500'
  primary-container: '#c3f400'
  on-primary-container: '#556d00'
  inverse-primary: '#506600'
  secondary: '#c7c6ca'
  on-secondary: '#303034'
  secondary-container: '#49494d'
  on-secondary-container: '#b9b8bc'
  tertiary: '#ffffff'
  on-tertiary: '#303031'
  tertiary-container: '#e4e2e3'
  on-tertiary-container: '#656465'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c3f400'
  primary-fixed-dim: '#abd600'
  on-primary-fixed: '#161e00'
  on-primary-fixed-variant: '#3c4d00'
  secondary-fixed: '#e4e1e6'
  secondary-fixed-dim: '#c7c6ca'
  on-secondary-fixed: '#1b1b1f'
  on-secondary-fixed-variant: '#46464a'
  tertiary-fixed: '#e4e2e3'
  tertiary-fixed-dim: '#c8c6c7'
  on-tertiary-fixed: '#1b1b1c'
  on-tertiary-fixed-variant: '#474648'
  background: '#131314'
  on-background: '#e5e2e3'
  surface-variant: '#353436'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '800'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-display:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  max-width: 1440px
---

## Brand & Style

The design system is engineered for elite fitness management, emphasizing precision, energy, and data density. It caters to high-performance athletes and facility managers who require immediate access to biometric data and scheduling tools.

The aesthetic follows a **High-Contrast / Bold** modern movement, utilizing a dark-mode-first approach to reduce eye strain in gym environments while allowing key performance metrics to "pop" with high-luminance accents. The visual language is industrial yet refined, conveying a sense of technological sophistication and athletic urgency.

## Colors

The palette is anchored by **Deep Charcoal (#1A1A1B)** to provide a deep, immersive foundation. **Electric Lime (#CCFF00)** serves as the high-visibility primary color, reserved strictly for calls to action, active states, and critical performance highlights.

**Slate Grays** are utilized to create a hierarchical surface system:
- **Surface (Base):** #1A1A1B
- **Surface (Elevated):** #252526 (Cards and Sections)
- **Surface (Interactive):** #3E3E42 (Inputs and Secondary Buttons)

Functional colors for status include a muted crimson for "At Capacity" and a deep cyan for "In Progress," ensuring they do not compete with the Electric Lime primary brand color.

## Typography

This design system uses **Inter** for all primary interface elements to ensure maximum legibility and a modern, neutral tone. Headlines utilize heavy weights (700-800) and tight letter spacing to create an impactful, editorial feel.

**JetBrains Mono** is introduced as a secondary typeface for data-heavy contexts, labels, and status badges. This adds a "technical" layer to the UI, emphasizing the precision of the fitness metrics and workout logs. All labels should be rendered in uppercase with slight tracking to maintain clarity at small sizes.

## Layout & Spacing

The system employs a **Fluid Grid** with a strict 4px base unit. 

- **Desktop (1280px+):** 12-column grid, 24px gutters, 32px side margins.
- **Tablet (768px - 1279px):** 8-column grid, 16px gutters, 24px side margins.
- **Mobile (Up to 767px):** 4-column grid, 12px gutters, 16px side margins.

Data tables and logging dashboards should utilize "compact" spacing (8px internal padding) to maximize information density, while marketing or landing pages should double the spacing units to create a more rhythmic, breathable flow.

## Elevation & Depth

To maintain a "sleek" and modern appearance, this design system avoids traditional drop shadows. Depth is achieved through **Tonal Layering** and **Low-Contrast Outlines**:

- **Level 0 (Background):** #1A1A1B.
- **Level 1 (Cards/Sidebar):** #252526 with a 1px solid border of #3E3E42.
- **Level 2 (Modals/Popovers):** #2C2C2E with a subtle 8% white inner-glow on the top edge to simulate overhead lighting.

Interactive elements use a "glow" effect rather than a shadow; when a primary button is hovered, it emits a soft #CCFF00 outer glow with 20% opacity.

## Shapes

The shape language is **Soft (0.25rem)**. This slight rounding provides a professional, engineered feel without the "friendliness" of fully rounded corners. 

- **Standard Elements:** 4px (Buttons, Inputs, Small Cards).
- **Large Containers:** 8px (Main Dashboard Cards, Modal Wrappers).
- **Data Tags/Badges:** 2px (Near-sharp corners to maintain a technical look).

## Components

### Buttons
- **Primary:** Background #CCFF00, Text #1A1A1B, Weight 700. High-contrast and unavoidable.
- **Secondary:** Background transparent, 1px Border #3E3E42, Text #FFFFFF.
- **Ghost:** Text #CCFF00, no background. Used for tertiary actions like "Cancel" or "View All."

### Exercise Cards
Interactive cards for logging must feature a "Header-Action" layout. The exercise name (Inter Bold) sits on the left, with the "Quick Log" button (Icon only) on the right. Sub-text uses JetBrains Mono for set/rep counts.

### Data Tables
Tables are borderless between rows, using only a subtle horizontal separator (#252526). Header cells use `label-caps` typography. Status badges (e.g., "Peak Performance," "Rest Day") use a filled background with 15% opacity of the status color and 100% opacity text.

### Inputs
Fields use #252526 as a background with a bottom-only border of #3E3E42. On focus, the bottom border transitions to #CCFF00.

### Progress Indicators
Linear bars use a #252526 track with a #CCFF00 fill. For circular biometric charts, use a stroke width of 8px to maintain a bold, readable presence.