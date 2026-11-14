# Spindl frontend design system

## Principles

- Keep the purple brand and use color consistently to communicate state.
- Put operational content first. Use compact, readable layouts that preserve room for ERP data.
- Establish hierarchy with alignment, type, and spacing before adding containers or shadows.
- Keep actions close to the records and workflows they affect.
- Make every interaction available to keyboard, pointer, and touch users.

## Foundations

The CSS custom properties in `src/styles.css` are the source of truth. The base palette uses a near-white workspace, white content surfaces, dark ink, muted secondary text, subtle dividers, and Spindl purple for selected and primary actions. Semantic colors are reserved for their meaning: green for success, blue for information, amber for warnings, and red for errors or destructive actions.

Use DM Sans for interface text and Manrope for prominent headings and values. Use tabular numerals for amounts, counts, and other values compared across rows. The established type scale is compact: page headings around 24px, section headings 12–16px, body text 12–14px, and metadata no smaller than 11px where space permits. Keep table headers uppercase and subdued, while maintaining readable row text.

Use a 4px spacing base and its 4, 8, 12, 16, 24, and 32px steps. Use 4–6px radii for controls, 8px for panels, and 12px only for dialogs or large touch surfaces. Prefer 1px neutral borders. Reserve shadows for overlays and floating menus.

## Components and behavior

- **Navigation:** Keep workspace identity and account controls visible. The navigation list may scroll independently. Indicate the current destination with purple text, icon, and a lightly tinted background. On narrow screens the sidebar becomes a dismissible drawer.
- **Tables:** Keep rows aligned and separators restrained. Allow horizontal scrolling for wide operational tables, preserve readable minimum widths, and provide a visible empty state. Align numeric data consistently and keep row actions associated with their record.
- **Forms:** Place labels above controls, keep help and validation text adjacent to the field, and preserve native validation semantics. Use a clear purple focus ring and visible disabled/loading states.
- **Buttons:** Purple is the primary action; outlined white is secondary; text actions are tertiary. Destructive actions use red. Hover, active, disabled, and focus states must remain distinguishable.
- **Status:** Use the semantic palette consistently and pair color with text. Never encode state by color alone.
- **Search and filters:** Keep controls near the data they affect. Make clearing active filters explicit and preserve the feature's existing search semantics.
- **Dialogs and menus:** Keep overlays above page content, constrain dialog height to the viewport, and retain keyboard focus visibility.

## Responsive and accessible behavior

The desktop shell uses a fixed navigation rail and a flexible content region. At tablet widths the rail becomes a drawer and content columns collapse. At phone widths, actions wrap, forms become single-column, and tables remain usable through contained horizontal scrolling. Maintain usable controls at browser zoom and avoid fixed content widths that cause page-level horizontal overflow.

Use semantic landmarks, real buttons for actions, labels for inputs, and accessible names for icon-only controls. Preserve a strong `:focus-visible` outline. Respect `prefers-reduced-motion`; transitions should be short and communicate state changes only. Aim for WCAG 2.2 AA contrast and touch targets of at least 40px for primary navigation and frequent actions.

## Implementation notes

Existing ERP views have feature-specific requirements and API behavior. Reuse shared tokens and shell primitives without changing request payloads, calculations, permissions, or workflows. This document guides visual consistency; it does not authorize changes to domain behavior.
