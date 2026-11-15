# Spindl Design System — Single Source of Truth

> **Status:** Proposed specification for approval. **Target repository path:** `frontend/DESIGN.md`. This file is documentation, not an instruction to immediately modify the application.
>
> **Mission:** Make every *existing* Spindl ERP screen visually consistent, legible, refined, and efficient using a light, Linear-inspired design language and Spindl purple. **Adopt styling and shared presentational primitives; never recreate screens.**

## 0. Authority, boundaries, and agent operating contract

1. **Existing production feature components are the source of truth for product behavior and content.** Preserve section order, headings, fields, table columns, labels, data bindings, navigation, filters, sorting, exports, permissions, validation, dialogs, actions, workflows, and responsive access to features. No invented KPIs, mock records, substitute layouts, or removed sections.
2. This document is the **only design-specification Markdown file**. Do not generate parallel design documents, extra agent instruction files, or per-screen design specs. Implementation code (Tailwind config, styles, components) is allowed and necessary; “one file” applies to design guidance, not source code.
3. The approved HTML concept is a **visual-language reference only**: restraint, subtle surfaces, purple accent, crisp alignment, understated interaction. **It is not a screen blueprint.** Do not reproduce its inventory metrics, tabs, table schema, layout, or mock data.
4. Linear is a **quality benchmark**, not a source of production content, brand assets, dark marketing-site styles, or exact UI duplication. Spindl defaults to **light mode**.
5. Changes may extract or reuse **presentational components** (Button, Input, Table styles, etc.) but must retain current handlers, props, state, APIs, DOM semantics, and workflow behavior. If an extraction requires logic changes, defer it and style the existing component instead.
6. **One existing screen per PR, and preferably one region at a time.** No application-wide CSS resets, sweeping find-and-replace, shell/navigation rewrite, or mass migration. Do not change backend or API contracts.
7. If a design rule conflicts with accessibility, existing functional requirements, or a verified regression, **preserve functionality and accessibility; document the exception and request approval**. Never silently remove content to make it fit.
8. No automated merges. Each migration requires before/after evidence, successful checks, and human review.

## 1. Design character

**Keywords:** precise, quiet, clear, operational, consistent, confident. Prioritize information hierarchy and scannability over decoration. White content surfaces, subtly differentiated canvas/sidebar, 1px hairline borders, compact controls, sparse purple emphasis. Avoid oversized dashboard cards, gradients, glow, heavy shadows, giant whitespace, tiny typography, and gratuitous animation. Keep current content architecture.

## 2. Design tokens — exact values

### 2.1 Colors (light mode, default)

| Token | Value | Use |
|---|---|---|
| `--sp-canvas` | `#F8F9FB` | Workspace background |
| `--sp-sidebar` | `#F6F7F9` | Existing navigation surface |
| `--sp-surface` | `#FFFFFF` | Panels, inputs, overlays |
| `--sp-surface-subtle` | `#FBFBFC` | Table header, quiet regions |
| `--sp-surface-hover` | `#F5F5F8` | Neutral hover |
| `--sp-text` | `#22242B` | Primary content |
| `--sp-text-secondary` | `#59606D` | Secondary labels and descriptions |
| `--sp-text-muted` | `#777E8B` | Metadata, hints (must remain readable) |
| `--sp-text-disabled` | `#98A0AC` | Disabled-only text |
| `--sp-border` | `#E6E8ED` | Standard borders |
| `--sp-border-subtle` | `#EFF0F3` | Table row dividers |
| `--sp-border-strong` | `#D6D9E1` | Emphasized border |
| `--sp-brand` | `#7055D8` | Primary actions, active selection, links |
| `--sp-brand-hover` | `#6046C7` | Hovered primary actions |
| `--sp-brand-active` | `#533AB5` | Pressed primary actions |
| `--sp-brand-soft` | `#F1EEFE` | Selected navigation and subtle accent background |
| `--sp-focus` | `#A998ED` | Keyboard focus ring |
| `--sp-success` | `#20865B` | Positive operational state |
| `--sp-success-soft` | `#EEF8F1` | Positive state background |
| `--sp-warning` | `#9A651C` | Warning state |
| `--sp-warning-soft` | `#FFF6E8` | Warning background |
| `--sp-danger` | `#B9434B` | Destructive state |
| `--sp-danger-soft` | `#FDF0F1` | Destructive background |
| `--sp-info` | `#2763A5` | Informational state |
| `--sp-info-soft` | `#EDF5FE` | Informational background |

**Rules:** Brand purple is for active/selected states, primary CTA, links, and focus—not arbitrary card fills. Use semantic colors only for actual statuses. Statuses must include text or icons, not color alone. Validate contrast: normal text >= 4.5:1; large text and meaningful icons >= 3:1. If a token fails on its intended background, adjust the *implementation token* to meet contrast before shipping and record the change here; never lower contrast to match a screenshot.

### 2.2 Typography — mandatory, no agent interpretation

**Single UI font:** `Inter`, with `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` fallback. Use Inter for headings, body, navigation, tables, forms, buttons, and overlays. Do **not** introduce DM Sans, Manrope, Geist, or another heading font. Use system monospace only for technical IDs/code where already meaningful.

| Role / semantic utility | Font size | Line height | Weight | Letter spacing | Application |
|---|---:|---:|---:|---:|---|
| `sp-type-page` | 24px | 32px | 650* | -0.6px | Main page title |
| `sp-type-section` | 18px | 26px | 650* | -0.3px | Existing section headings |
| `sp-type-panel` | 15px | 22px | 600 | -0.1px | Panel/table/form headings |
| `sp-type-body` | 14px | 22px | 400 | 0 | Descriptions, standard content |
| `sp-type-body-strong` | 14px | 22px | 600 | 0 | Emphasized body text |
| `sp-type-table` | 14px | 20px | 400–500 | 0 | Table cell values |
| `sp-type-table-head` | 12px | 18px | 600 | 0.2px | Table column headings |
| `sp-type-input` | 14px | 20px | 400 | 0 | Inputs, selects, placeholders |
| `sp-type-label` | 13px | 20px | 600 | 0 | Form labels |
| `sp-type-control` | 13px | 20px | 600 | 0 | Buttons, tabs, menus |
| `sp-type-nav` | 13px | 20px | 500 | 0 | Sidebar/navigation items |
| `sp-type-badge` | 12px | 18px | 600 | 0 | Status chips |
| `sp-type-meta` | 12px | 18px | 400–500 | 0 | Hints, dates, captions, helper text |
| `sp-type-metric` | 24px | 32px | 650* | -0.6px | **Only** metrics already present in a screen |

*CSS `font-weight: 650` is acceptable with variable Inter; if only static font weights are installed, use 600, consistently.*

**Typography enforcement:**
- **Minimum meaningful text: 12px.** No 9/10/11px text for operational content, badges, navigation, metadata, table headers, pagination, or help text. Do not use arbitrary Tailwind font-size values.
- **14px for data tables, input values, and ordinary body.** Dense layout comes from padding/row rhythm, not tiny type.
- Keep labels in their existing case and wording; do not uppercase existing copy purely for aesthetics. Table headers may be visually uppercase **only if already uppercase** or approved.
- Use `font-variant-numeric: tabular-nums` for quantities, prices, dates, and identifiers with aligned digits. Right-align numerical table columns; left-align names/descriptions.
- Preserve text zoom to 200% without clipped controls or lost functionality. Never fix overflow by shrinking text below its role.
- Avoid blanket `font-size` on `button`, `input`, `table`, `th`, `td`, `small`, `h1` etc. outside a scoped design-system component.

### 2.3 Spacing, geometry, elevation

| Aspect | Specification |
|---|---|
| Base spacing | 4px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48 |
| Icon sizes | 16px standard, 14px compact, 18px prominent; Lucide, 1.75 stroke |
| Standard control height | 36px desktop; 40px for prominent actions |
| Compact control height | 32px **only where existing UI requires it**, with readable type |
| Touch target | >=44x44px where touch interactions are expected; use invisible hit area if needed |
| Table row | 48px default, 44px compact; multiline content may grow |
| Table header | 40px minimum |
| Sidebar item | 36px visual row, preserve touch target where needed |
| Panel padding | 16px or 20px; 24px for spacious existing panels |
| Page gutter | 24px desktop, 16px tablet/mobile; preserve current content constraints |
| Inline element gap | 8px default, 4px tight, 12px grouped |
| Section gap | 24px default, 32px where existing hierarchy warrants |
| Control radius | 6px |
| Panel radius | 8px |
| Dialog / drawer radius | 10px (drawer may have square screen edge) |
| Chip radius | 4px–6px; pill only for badges where established |
| Border | 1px solid semantic border token |
| Shadow | None for ordinary panels; subtle shadow only for menus, dialogs, floating overlays |
| Animation | 120–180ms ease for hover/focus; 180–240ms for drawers; respect reduced motion |

**No arbitrary spacing or radius values** without adding an approved token to this document. Do not globally change existing layout widths, sidebar widths, section order, or content grids just to match a concept.

## 3. Component styling contracts

Each contract describes **appearance and interaction only**. Existing component APIs, state, handlers, labels, and validation remain authoritative. Extract shared components only when doing so does not change behavior.

### 3.1 Buttons and icon buttons
- Primary: brand fill, white text, 1px matching border, 6px radius; hover `--sp-brand-hover`; active `--sp-brand-active`; disabled muted and non-interactive.
- Secondary: white surface, standard border, primary text; hover subtle neutral fill and stronger border.
- Tertiary/ghost: transparent; neutral hover fill; preserve existing destructive-action semantics.
- Standard 36px height, 13px/20px semibold label, 8px icon gap, horizontal padding 12px; prominent 40px; compact 32px where appropriate.
- Icon-only buttons: 32–36px visual bounds, accessible name (`aria-label`), tooltip if icon meaning is not obvious; maintain keyboard focus.
- Loading: preserve button width, show progress, prevent duplicate submission; no layout shift.

### 3.2 Text fields, selects, textareas, search
- White background, 1px `--sp-border`, 6px radius, 36px minimum desktop height, 12px horizontal padding, 14px text.
- Placeholder uses muted readable color. Focus border brand and visible 2px focus outline/ring; error border danger plus message text and accessible association.
- Labels 13px semibold; helper/error 12px; label-to-control gap 6px; control-to-helper gap 4px.
- Preserve existing required, disabled, read-only, number formatting, validation, autocomplete, dropdown options, and keyboard handling.
- Search input: same field tokens; search icon 16px; clear action only if already supported or explicitly approved.

### 3.3 Tables and data grids
- **Never alter columns, order, data, sorting, filters, pagination, row actions, or selection behavior** in a styling-only migration.
- Header: subtle surface, 12px/18px semibold, 40px min height, 1px bottom border. Existing header case preserved.
- Body: 14px/20px, 48px row baseline, 12–16px horizontal cell padding; multiline rows expand naturally. Subtle horizontal separators; avoid heavy full grids unless existing UX needs them.
- Row hover: `--sp-surface-hover`; selected: soft purple with visible selection marker; keyboard focus visible. Avoid hover-only access to critical actions.
- Numeric cells right-aligned with tabular figures; descriptive cells left-aligned. Preserve wrapping and tooltip behavior where required.
- Narrow viewports: horizontal scroll with a clearly reachable scrollbar or scroll affordance; **never silently drop columns or actions**. Sticky headers/columns only if already supported or separately approved.
- Empty/loading/error rows must be legible, occupy the existing table region, and retain current retry/actions.
- Pagination: 13px control text, 12px metadata, disabled states clearly differentiated; retain page size and count semantics.

### 3.4 Navigation, breadcrumbs, tabs
- Preserve all existing routes, module names, ordering, badges, counts, role gating, and nesting.
- Sidebar uses `--sp-sidebar`, 13px/20px text, 16px Lucide icons, 36px row rhythm; hover subtle neutral; active soft purple + brand text/icon. **Do not rebuild navigation architecture.**
- Breadcrumbs 12px/18px metadata, current item stronger; preserve hierarchy.
- Tabs 13px/20px semibold, 36–40px height, 2px active underline in brand; keep existing tab labels and panel behavior.

### 3.5 Panels, cards, section headers, metrics
- Panels: white surface, 1px border, 8px radius, 16–20px padding. Avoid stacking multiple framed cards unnecessarily; do not change existing grouping without approval.
- Section heading: 18px/26px; panel heading: 15px/22px; description 14px/22px or 12px/18px for short metadata.
- Existing metric values may use 24px/32px; **never add new metrics** as part of design migration.
- Use whitespace and typography to establish hierarchy; no gradients, dramatic shadows, or decorative charts.

### 3.6 Badges, alerts, status
- Badge: 12px/18px semibold, 4–6px radius, 4px vertical and 8px horizontal padding; semantic tint plus semantic text.
- Preserve existing status wording, severity mapping, and lifecycle. Never map an unknown status to success by default.
- Alerts: 14px body, 12px supplementary text, subtle semantic background and border, icon + readable text. Destructive confirmations retain current safeguards.

### 3.7 Dialogs, drawers, dropdowns, tooltips, toasts
- Overlay scrim: restrained dark translucent layer; overlay surfaces white with 1px border and subtle shadow.
- Dialog: 10px radius, 20–24px padding, existing width constraints, clear title/actions, Escape and focus restoration. Drawer: retain existing side, width, behavior, and scroll structure.
- Menus: 13px text, 32–36px item visual height, 6px radius, visible hover/focus; preserve nesting and keyboard interactions.
- Tooltips: 12px/18px, concise, keyboard-accessible; not sole source of essential information.
- Toasts: 13–14px text, semantic icon and accessible live region; preserve existing notification behavior.

### 3.8 Checkboxes, radios, switches, date controls
- 16px checkbox/radio visual, brand selected/focus state, minimum accessible hit target; preserve native or existing accessible semantics.
- Switches and date pickers must preserve current logic, min/max constraints, localization, and disabled/validation states. Do not swap libraries solely for appearance.

### 3.9 States every shared primitive must support
Default, hover, active/pressed, focus-visible, selected (where relevant), disabled, read-only (where relevant), loading, validation error, success/warning (where relevant), empty (containers), and high-contrast/zoom behavior. Hover must not be the only indicator of state.

## 4. Tailwind CSS v4 — safe implementation rules

1. Use Tailwind CSS **v4** with the Vite integration compatible with the repository's current dependencies. Inspect existing Vite/PostCSS setup first; do not install duplicate plugins or replace config blindly.
2. **Do not globally import Tailwind Preflight** into the existing app during initial adoption. It resets base element styles and can break untouched screens. Prefer an isolated Tailwind entry for the component playground; if the eventual production integration needs a reset, explicitly scope and verify it in a separate reviewed PR.
3. Define semantic CSS custom properties (`--sp-*`) and expose them to Tailwind v4 using `@theme inline` in a **single small implementation stylesheet** when approved. This is implementation code, **not another design specification**. Use CSS variables as the runtime source of truth and this document as the specification.
4. Use consistent semantic utilities (`text-sp-text`, `bg-sp-surface`, `border-sp-border`, etc.) and semantic type classes (`sp-type-table`, `sp-type-control`, etc.). Exact utility mapping must be implemented once and reused.
5. Do not use arbitrary hex utilities, one-off `text-[11px]`, inline style overrides, global `!important`, or repeated feature-specific class recipes. Exceptions must be recorded in this document and reviewed.
6. Existing global CSS remains in place until each dependency is audited and migrated. No blanket deletion, no replacement of `styles.css`, no `*`, `body`, `button`, `table`, or `input` rules that leak into untouched pages.
7. Shared primitives belong in an appropriate existing shared-component location or `frontend/src/design-system/components/` if no suitable library exists. **Do not build a second parallel component library** when a reusable component already exists; adopt styling in place when possible.
8. Tailwind class composition must preserve passed `className`, refs, native attributes, accessibility, and event handlers. Avoid wrappers that break table structure or forms.
9. If Tailwind integration affects untouched screens, **revert the integration and isolate it**. Do not compensate with broad global CSS patches.

### Example token implementation pattern (illustrative, not a second specification)

```css
/* Scoped/adopted only after approval; never blindly replace app styles. */
:root {
  --sp-brand: #7055d8;
  --sp-text: #22242b;
  --sp-surface: #ffffff;
  --sp-border: #e6e8ed;
}
@theme inline {
  --color-sp-brand: var(--sp-brand);
  --color-sp-text: var(--sp-text);
  --color-sp-surface: var(--sp-surface);
  --color-sp-border: var(--sp-border);
}
```

## 5. Migration protocol — strictly one screen at a time

### Phase 0 — read-only audit (no changes)
- Inspect repository scripts, dependencies, global CSS, current shared components, routing, and the selected screen's actual JSX/hooks/types.
- Record the screen contract: **every section, heading, field, column, action, filter, validation, permission, data source, loading/empty/error state, and responsive behavior**. Capture a baseline screenshot at desktop and narrow viewport.
- Identify existing components to restyle in place and candidates for safe presentational extraction. Report risks. **Stop for approval.**

### Phase 1 — isolated foundation (no production visual changes)
- Set up Tailwind v4 without global reset leakage; implement semantic tokens, strict Inter type roles, and a minimal set of shared primitives actually used by the selected screen.
- Make an **isolated development-only component preview** (separate entry point if necessary), not a new production route or another screen recreation. Use representative component states, not a substitute page.
- Verify untouched app screens remain visually and functionally unchanged. Open a small PR and **stop for review**.

### Phase 2 — first approved screen, one region per PR
- Choose a real existing screen **only after explicit user approval**. Preserve its structure and all functionality. Restyle one existing region (e.g., toolbar, table, form) using shared primitives; no redesign of content.
- Compare the region's before/after contract. Check exact typography, alignment, borders, focus/hover, empty/loading/error, responsive overflow, and keyboard use.
- Run checks and show side-by-side screenshots. **Stop after that region.** Never automatically continue to the next region or screen.

### Phase 3 — gradual adoption
- After approval, repeat the same region-by-region procedure for the rest of the approved screen, then subsequent screens. Remove legacy CSS only when no remaining component depends on it.
- Prefer improving existing shared primitives once rather than editing every feature with different ad hoc styles.

## 6. Verification and merge gates

**Mandatory for each PR:**
- `git diff` reviewed to confirm only intended files/region changed.
- Run actual repository-supported frontend typecheck, lint, build, and relevant tests. **Discover script names in `package.json`; do not assume `npm run typecheck` exists.** Report executed commands, results, and any missing scripts.
- Check at least one untouched screen to detect CSS/preflight regressions.
- Verify all existing fields, columns, controls, and actions still appear and behave identically.
- Verify keyboard navigation, focus restoration, accessible labels, readable status contrast, 200% zoom, and responsive scrolling.
- Capture before/after screenshots of the **same actual screen/region** at comparable viewport widths. No invented replacement screen.
- Record any design-token exceptions, accessibility adjustments, and remaining work in the PR description (not a new Markdown file).
- **No auto-merge.** Stop for user review.

**Immediate stop conditions:** A field/column/action disappears; navigation changes; data/API behavior changes; existing screens visually regress; Tailwind reset leaks; table text drops below 14px; meaningful text drops below 12px; a new screen or KPI is invented; an unapproved dependency migration becomes necessary. Revert the offending UI change and ask before continuing.

## 7. Reusable Codex task instructions

### First task (after this document is approved and committed)

> Read `frontend/DESIGN.md` completely. Do **Phase 0 only**, a read-only audit of existing shared UI patterns, Tailwind integration risks, and the single screen I nominate. Do not modify files. Identify the existing component contracts and propose a minimal first PR. Respect the Inter typography table, light Spindl palette, and the prohibition on screen recreation. Stop and ask for my approval.

### Foundation task (only after Phase 0 approval)

> Read `frontend/DESIGN.md`. Implement **Phase 1 only**: isolated Tailwind v4 tokens and shared presentational primitives with a development-only component preview. Do not change production routes, feature screens, navigation, business logic, or global CSS behavior. Prevent Tailwind Preflight from affecting untouched screens. Run supported checks and submit an unmerged PR. Stop.

### Screen-region task (only after explicit screen and region approval)

> Read `frontend/DESIGN.md`. Restyle only **[approved screen] → [approved region]** using existing data, fields, columns, handlers, permissions, and workflows. Follow every typography and component token exactly. No screen recreation, feature additions, layout substitution, global CSS rewrite, or unrelated refactoring. Show same-region before/after screenshots, test behavior, and open an unmerged PR. Stop.

## 8. Change control

Any proposed deviation in typography, tokens, component geometry, screen layout, or functionality requires explicit user approval. Update **this same file** if a design standard changes; do not create a second design document. A production feature change is a separate task from a design-system migration.