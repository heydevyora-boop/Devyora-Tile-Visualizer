---
name: Atelier Visualizer
colors:
  surface: '#121314'
  surface-dim: '#121314'
  surface-bright: '#38393a'
  surface-container-lowest: '#0d0e0f'
  surface-container-low: '#1b1c1d'
  surface-container: '#1f2021'
  surface-container-high: '#292a2b'
  surface-container-highest: '#343536'
  on-surface: '#e3e2e3'
  on-surface-variant: '#d1c5b8'
  inverse-surface: '#e3e2e3'
  inverse-on-surface: '#303031'
  outline: '#998f83'
  outline-variant: '#4d463c'
  surface-tint: '#e0c298'
  primary: '#e2c399'
  on-primary: '#402d0f'
  primary-container: '#c5a880'
  on-primary-container: '#513d1d'
  inverse-primary: '#725b38'
  secondary: '#e5c193'
  on-secondary: '#422c0a'
  secondary-container: '#5e4421'
  on-secondary-container: '#d6b386'
  tertiary: '#e1c3a0'
  on-tertiary: '#3f2d14'
  tertiary-container: '#c5a887'
  on-tertiary-container: '#513d23'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#fedeb2'
  primary-fixed-dim: '#e0c298'
  on-primary-fixed: '#281800'
  on-primary-fixed-variant: '#584323'
  secondary-fixed: '#ffddb3'
  secondary-fixed-dim: '#e5c193'
  on-secondary-fixed: '#291800'
  on-secondary-fixed-variant: '#5b421f'
  tertiary-fixed: '#fdddb9'
  tertiary-fixed-dim: '#e0c29f'
  on-tertiary-fixed: '#281803'
  on-tertiary-fixed-variant: '#584329'
  background: '#121314'
  on-background: '#e3e2e3'
  surface-variant: '#343536'
typography:
  headline-xl:
    fontFamily: Metrophobic
    fontSize: 40px
    fontWeight: '400'
    lineHeight: 48px
    letterSpacing: 0.04em
  headline-xl-mobile:
    fontFamily: Metrophobic
    fontSize: 30px
    fontWeight: '400'
    lineHeight: 36px
    letterSpacing: 0.03em
  headline-lg:
    fontFamily: Metrophobic
    fontSize: 28px
    fontWeight: '400'
    lineHeight: 34px
    letterSpacing: 0.03em
  headline-lg-mobile:
    fontFamily: Metrophobic
    fontSize: 22px
    fontWeight: '400'
    lineHeight: 28px
    letterSpacing: 0.02em
  headline-sm:
    fontFamily: Metrophobic
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0.02em
  title-md:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.01em
  body-lg:
    fontFamily: Hanken Grotesk
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
    letterSpacing: 0.01em
  body-md:
    fontFamily: Hanken Grotesk
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
    letterSpacing: 0.01em
  body-sm:
    fontFamily: Hanken Grotesk
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-caps:
    fontFamily: Metrophobic
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0.14em
  spec-numeral:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '300'
    lineHeight: 24px
    letterSpacing: 0.02em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1.25rem
  margin-desktop: 3rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies high-end architectural luxury and tactile restraint. Built for material consultants, interior architects, and client advisors navigating physical showrooms, the interface projects quiet authority and precision. It avoids digital gimmickry, aggressive novelty, or decorative noise, placing physical stone, porcelain, terracotta, and sintered surfaces at center stage.

The aesthetic fuses **Architectural Minimalism** with **Subtle Tactility**:
- Rich, light-absorbing charcoals evoke monolithic matte stone surfaces and darkened consultation suites.
- Metallic warm bronze accents echo patinated hardware and architectural spec tags.
- Micro-interactions communicate mechanical precision rather than playful bounce, using measured eases, whisper-thin structural borders, and confident negative space.
- Optimized for single-handed mobile floor consultations: critical triggers sit within natural thumb range, and critical states are verified through subtle, unmistakable changes in surface sheen, borders, and tactile outlines.

## Colors

The palette draws directly from architectural finish materials: unpolished Belgian bluestone, oiled blackened steel, honed bone travertine, and brushed bronze.

### Canvas & Surface Hierarchy
- **Base Canvas (`#121314`):** Deep, warm off-black that recedes entirely, allowing tile glazes and textures to claim maximum luminescence.
- **Card Surface Default (`#1C1D1F`):** Subtle warm charcoal tier, providing primary separation from the canvas.
- **Card Surface Elevated / Hover (`#25272A`):** Interactive level for focused cards, elevated modals, and contextual sheets.
- **Surface Outline / Muted Stroke (`#333538`):** Whisper-fine hairline division that maintains architectural grid discipline without visually enclosing content.

### Accents & Metallics
- **Primary Accent (`#C5A880`):** Luminous warm bronze; strictly reserved for active selection rings, primary interactive triggers, and key numerical measurements.
- **Secondary Accent (`#B8976C`):** Deep brushed brass; applied to hovered borders, secondary confirmation tags, and subtle metadata indicators.
- **Muted Accent Fill (`rgba(197, 168, 128, 0.08)`): Used behind selected tile thumbnails and active filter pills for tonal continuity.

### Typography Colors
- **Bone / Cream (`#F8F7F4`):** Primary display text, spec titles, and active inputs.
- **Warm Gray (`#A6A4A0`):** Secondary specs, dimensions, material origin notes, and placeholder copy.
- **Subdued Charcoal Gray (`#686664`):** Tertiary layout metadata, unavailable inventory states, and non-interactive grid dividers.

## Typography

Typography balances architectural discipline with clarity in low-lit showroom environments. 

- **Metrophobic** handles headline structures, visual categorization, and technical specification tags. Its geometric, open-aperture forms evoke contemporary drafting blueprints and laser-etched signage. All subheadings and category identifiers use strict uppercase rendering with wide tracking (`0.14em`).
- **Hanken Grotesk** serves body copy, user data inputs, pricing tiers, and material dimensions. Its humanist structural roots ensure prolonged reading comfort and clear numeral decipherability when cross-referencing SKU numbers or millimeter tolerances.
- **Architectural Numerals:** Technical figures, inventory square meterage, and dimensional tags use tabular spacing to ensure alignments across material comparison sheets remain uncompromised.

## Layout & Spacing

The spatial model is calibrated for mobile ergonomics during physical client walks, shifting into a widescreen drafting table layout on tablets and showroom wall mounts.

### Mobile-First Showroom Architecture (Base to 767px)
- Single-column fluid framework with fixed bottom utility docks situated inside thumb-reach zones.
- Outer canvas margins sit at `1.25rem` (`20px`), ensuring visual breathability without sacrificing horizontal tile swatch visibility.
- Vertical layout adheres strictly to an 8px modular baseline (`space-xs` through `space-xl`).

### Tablet & Desktop Canvas (768px and Up)
- At `>= 768px`, the canvas reflows into an asymmetric split workspace: a 60% dynamic render zone paired with a 40% specification inspector panel.
- Outer margins expand to `3rem` (`48px`) to mirror museum gallery wall balance.

### Ergonomic Safe Zones
- Bottom action bars sit `12px` above screen system navigators with interior padding of `16px`, ensuring zero accidental mis-taps when swapping tile finishes while moving through showroom aisles.

## Elevation & Depth

Visual depth avoids soft artificial blurs or floating physical drop shadows. Depth is achieved via **Tonal Layering** and **Hairline Stratification**:

- **Ground Level (Canvas `#121314`):** Background layer containing the active 3D/viewport scene.
- **Surface Level (Cards & Shelves `#1C1D1F`):** Separated by a single 1px solid stroke in `#333538`. No shadow applied.
- **Contextual Level (Drawers, Swatch Trays `#25272A`):** Used for elevated bottom sheets and popovers. Accompanied by an ultra-diffused, ambient shadow: `0 16px 40px -8px rgba(0, 0, 0, 0.65)`, keeping the sheet crisp against the visualizer plane.
- **Highlight Edge (Active Selection):** An intentional `1px` inner or outer ring in `#C5A880` coupled with a localized ambient glow: `0 0 16px rgba(197, 168, 128, 0.18)`.

## Shapes

The design system adopts a **Soft Architectural (`1`)** shape vocabulary. 

- Subtly softened geometries (`0.25rem` / `4px` base) mirror precision-rectified tile edges and laser-cut stone slabs.
- Buttons, input modules, and material swatch cards utilize `4px` corner radii.
- Interactive filter chips and floating status pills leverage `rounded-lg` (`0.5rem` / `8px`) to distinguish operational touchpoints from physical surface materials.
- Rounded circular geometries are strictly reserved for physical material swatch samplers, grout tone pickers, and directional panning pucks.

## Components

### Buttons & Primary Triggers
- **Primary CTA:** Minimum height `52px` to guarantee confident single-handed thumb operation. Styled with solid warm bronze (`#C5A880`), dark background text (`#121314`), `font-weight: 600`, tracking `0.04em`, and `4px` corner radius.
- **Secondary Action:** Minimum height `52px`. Surface background of `#1C1D1F`, border `1px solid #333538`, text color `#F8F7F4`. On press, border transitions instantly to `#C5A880`.
- **Tertiary / Text Action:** Transparent background, `44px` minimum tap clearance, uppercase `label-caps` in `#C5A880` with continuous bottom hairline stroke.

### Swatch Cards & Tile Selectors
- Vertical container with `#1C1D1F` body and `1px solid #333538` border.
- Material previews maintain a 1:1 square ratio with true-to-scale texture rendering.
- **Selected State:** Enclosed by an active `2px` solid `#C5A880` outline, recessed slightly with a `2px` internal padding, accompanied by a subtle `#C5A880` corner indicator mark.
- Micro-labels beneath cards display tile collection name in `Metrophobic` uppercase alongside slip-resistance and thickness metrics in `body-sm`.

### Chips & Filter Pills
- Enclosed modules with height `36px`, `8px` corner radius, `#1C1D1F` surface, and `#333538` borders.
- Active filter state transitions to surface `rgba(197, 168, 128, 0.12)` with border `#C5A880` and bone text `#F8F7F4`.

### Lists & Specification Rows
- Edge-to-edge layout segmented by horizontal `1px solid #333538` dividers.
- Left side contains specification parameter in `label-caps` (`#A6A4A0`); right side contains exact measurement or finish detail in `spec-numeral` (`#F8F7F4`).
- Interactive list items feature a trailing warm bronze micro-chevron.

### Input Fields & Search Controls
- Minimum height `52px` with `#1C1D1F` fill, `4px` radius, and `1px solid #333538` outline.
- Text rendered in `#F8F7F4`. Placeholder text set in `#686664`.
- **Focused State:** Border transitions cleanly to `#C5A880`; zero artificial glow or expand rings.

### Checkboxes & Segmented Selectors
- Geometric squares (`20x20px`) with `2px` radius and `#333538` stroke.
- Checked state fills with `#C5A880` featuring an inverted off-black check mark.
- Layout toggle (e.g., Grid, Herringbone, Chevron, Staggered) utilizes a segmented control dock with `#1C1D1F` frame and sliding `#25272A` selection tray with `#C5A880` active indicator.

### Bottom Consultation Dock (Specialty Component)
- Persistent floating console anchored at screen base: height `68px`, width `calc(100% - 2.5rem)`, max width `480px`.
- Houses quick camera reset, surface toggle (Floor / Wall / Island), and the primary "Generate Spec Sheet" button.
- Finished in `#1C1D1F` with a top perimeter hairline in `#333538` and ambient lift for separation against active rendering viewports.