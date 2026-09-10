---
name: Apex Finance
colors:
  surface: '#111317'
  surface-dim: '#111317'
  surface-bright: '#37393e'
  surface-container-lowest: '#0c0e12'
  surface-container-low: '#1a1c20'
  surface-container: '#1e2024'
  surface-container-high: '#282a2e'
  surface-container-highest: '#333539'
  on-surface: '#e2e2e8'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#e2e2e8'
  inverse-on-surface: '#2f3035'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4ae176'
  on-secondary: '#003915'
  secondary-container: '#00b954'
  on-secondary-container: '#004119'
  tertiary: '#ffb95f'
  on-tertiary: '#472a00'
  tertiary-container: '#ca8100'
  on-tertiary-container: '#3e2400'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6bff8f'
  secondary-fixed-dim: '#4ae176'
  on-secondary-fixed: '#002109'
  on-secondary-fixed-variant: '#005321'
  tertiary-fixed: '#ffddb8'
  tertiary-fixed-dim: '#ffb95f'
  on-tertiary-fixed: '#2a1700'
  on-tertiary-fixed-variant: '#653e00'
  background: '#111317'
  on-background: '#e2e2e8'
  surface-variant: '#333539'
typography:
  headline-xl:
    fontFamily: Hanken Grotesk
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  numeric-data:
    fontFamily: JetBrains Mono
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1200px
  gutter: 24px
---

## Brand & Style
The design system is engineered for a premium, high-trust financial environment. It centers on a "Professional Dark" aesthetic—combining the depth of an executive dashboard with the approachability of a lifestyle app. The target audience seeks clarity and control over their finances, requiring a UI that feels reliable, precise, and sophisticated.

The visual style is a blend of **Minimalism** and **Modern Corporate**. It utilizes heavy breathing room (whitespace), high-legibility typography, and subtle depth through tonal layering rather than aggressive shadows. The emotional response is one of "calm authority," turning the potentially stressful task of budgeting into an organized, satisfying experience.

## Colors
This design system is strictly dark-themed. The palette is built on a "Deep Neutral" foundation to minimize eye strain and maximize the pop of functional colors.

- **Primary (Blue):** Used for primary actions, selection states, and informational callouts. It signifies stability.
- **Success (Green):** Reserved for positive financial indicators, income, and "on-budget" statuses.
- **Warning (Amber):** Used for approaching limits or pending actions. Avoid red for standard "spent" data to keep the mood calm; use Amber instead to signal attention without panic.
- **Surface Strategy:** Use `background_base` for the main app canvas. `background_surface` is used for primary cards, and `background_elevated` for modals or floating elements.
- **Data Visualization:** The chart palette uses sophisticated, distinct hues that avoid the "stoplight" (red/green) metaphor unless specifically indicating gain or loss.

## Typography
The system uses a tri-font strategy to balance character with utility:
- **Hanken Grotesk** for headlines provides a sharp, contemporary "fintech" feel.
- **Inter** handles the bulk of the interface for its legendary legibility in dark modes.
- **JetBrains Mono** is used sparingly for numeric data, transaction lists, and currency displays to emphasize precision and mimic financial ledgers.

**Scaling:** Large headlines must downscale for mobile screens to prevent awkward wrapping. Maintain high contrast for body text (#E2E8F0) and lower contrast for secondary labels (#94A3B8).

## Layout & Spacing
The design system utilizes a **Fixed-Fluid Hybrid** model. On desktop, content is contained within a 1200px max-width grid to maintain focus. On mobile, the layout transitions to a fluid, single-column view with 16px side margins.

**Rhythm:**
- **Vertical Spacing:** Use 40px (xl) between major sections and 16px (md) between related cards.
- **Navigation:**
    - **Desktop:** A fixed 72px top bar with semi-transparent backdrop blur.
    - **Mobile:** A fixed 64px bottom navigation bar with haptic-ready icons.
- **Safe Areas:** Ensure all bottom sheets and bars account for device-specific home indicators (iPhone notch/bar).

## Elevation & Depth
Depth is conveyed through **Tonal Layering** rather than heavy shadows. In a dark theme, shadows often look muddy; instead, we use lighter fills for elements that are "closer" to the user.

- **Level 0 (Base):** #0F1115 (Background).
- **Level 1 (Cards):** #16181D with a subtle 1px border (#262930).
- **Level 2 (Modals/Popovers):** #1E2128 with a very soft, diffused shadow (Black @ 40% opacity, 20px blur).
- **Interactions:** When a user interacts with a card, it should not lift; instead, its border should transition to the Primary Blue or a subtle glow effect should be applied to the border.

## Shapes
The system uses a **Rounded** language to soften the "seriousness" of financial data. 

- **Primary Containers:** Cards and major sections use 16px (1rem) corner radii.
- **Inputs & Buttons:** Smaller interactive components use 8px (0.5rem) to maintain structural integrity.
- **Chips/Status Tags:** Fully pill-shaped to distinguish them from interactive buttons.
- **Progress Bars:** Should use rounded caps for a modern, fluid appearance.

## Components

### Buttons
- **Primary:** Solid Primary Blue with white text. High-contrast, 8px radius.
- **Secondary:** Transparent with a 1px border of #262930. 
- **Ghost:** No background/border, used for "Cancel" or "Back" actions.

### Cards
Cards are the primary data vehicle. They must include a 16px internal padding and a subtle 1px border. Use high-contrast headers within cards to separate labels from values.

### Input Fields
Inputs should have a dark background (#1E2128), 8px radius, and a 1px border that turns Blue on focus. Use placeholder text in #4B5563.

### List Items
Transactions should be displayed in clean rows with 12px vertical spacing. Use the `numeric-data` font for currency. Icons for categories should be contained in a 40x40px rounded-square with a 10% opacity tint of the category's assigned color.

### Feedback & States
- **Loading Skeletons:** Use a shimmer gradient moving from #16181D to #1E2128.
- **Empty States:** Use centered, desaturated iconography with a clear "Primary Action" button to guide the user (e.g., "Add your first budget").
- **Bottom Sheets:** For mobile, all creation tasks (Add Transaction) should slide up as a bottom sheet rather than a centered modal.