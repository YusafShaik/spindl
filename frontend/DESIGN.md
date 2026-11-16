# Spindl Design System — Single Source of Truth

> **Status:** Approved visual reference specification. **Target repository path:** `frontend/DESIGN.md`. This file documents appearance; it does not authorize production UI changes by itself.
>
> **Mission:** Align the visual appearance of existing Spindl ERP screens to the approved Inventory HTML reference, using its light surfaces, compact hierarchy, and Spindl purple. **Adopt styling and shared presentational primitives; never recreate screens.**

## 0. Authority, boundaries, and agent operating contract

1. **Existing production feature components are the source of truth for product behavior and content.** Preserve section order, headings, fields, table columns, labels, data bindings, navigation, filters, sorting, exports, permissions, validation, dialogs, actions, workflows, and responsive access to features. No invented KPIs, mock records, substitute layouts, or removed sections.
2. This document is the **only design-specification Markdown file**. Do not generate parallel design documents, extra agent instruction files, or per-screen design specs. Implementation code (Tailwind config, styles, components) is allowed and necessary; “one file” applies to design guidance, not source code.
3. `frontend/design-reference/spindl-inventory-workspace.html` is the **primary authority for visual appearance**: typography hierarchy, geometry, spacing, colors, borders, surfaces, and interaction states. Its 228px sidebar, 56px top bar, 42px desktop content inset, table density, and responsive behavior are reference measurements, not instructions to copy its application content or feature set into production.
4. Existing production components and their data are the **primary authority for functionality and content**. The reference's labels, demo records, metrics, navigation items, columns, actions, workflows, and overlays must not replace or be added to production unless those features/content already exist and are explicitly retained by the production component.
5. The React preview is a secondary implementation reference. It may demonstrate how the HTML is represented in the isolated preview, but does not override the HTML or define new visual decisions.
6. Linear is a quality benchmark only; do not import its brand assets, dark marketing-site styles, or exact UI. Spindl defaults to **light mode**.
7. Changes may extract or reuse **presentational components** (Button, Input, Table styles, etc.) but must retain current handlers, props, state, APIs, DOM semantics, and workflow behavior. If an extraction requires logic changes, defer it and style the existing component instead.
8. **One existing screen per PR, and preferably one region at a time.** No application-wide CSS resets, sweeping find-and-replace, shell/navigation rewrite, or mass migration. Do not change backend or API contracts.
9. Preserve functionality and accessible interaction. Where exact reference typography or dimensions create a readability, contrast, target-size, or zoom issue, apply the production accessibility exception defined below, document it, and do not claim pixel identity for the adjusted element.
10. No automated merges. Each migration requires before/after evidence, successful checks, and human review.

## 1. Design character

**Keywords:** precise, quiet, clear, operational, consistent, confident. Follow the approved reference's compact type, restrained spacing, white content surfaces, subtly differentiated canvas/sidebar, 1px borders, compact controls, and sparse purple emphasis. Keep current production content architecture. Accessibility exceptions are explicit below; do not silently substitute generic defaults or claim visual parity when applying one.

## 2. Design tokens — exact values

### 2.1 Colors (light mode, default)

| Token | Value | Use |
|---|---|---|
| `--sp-canvas` | `#F8F9FB` | Workspace background |
| `--sp-sidebar` | `#F6F7F9` | Existing navigation surface |
| `--sp-surface` | `#FFFFFF` | Panels, inputs, overlays |
| `--sp-surface-subtle` | `#FBFBFC` | Table header, quiet regions |
| `--sp-surface-hover` | `#F8F8FB` | Reference neutral button hover |
| `--sp-text` | `#22242B` | Primary content |
| `--sp-text-secondary` | `#5B606C` | Reference secondary table content; use for important supporting copy |
| `--sp-text-muted` | `#858995` | Historical reference muted text, for nonessential decoration only. For visible UI copy, use accessible `--sp-text-supporting` below instead. |
| `--sp-text-supporting` | `#626775` | Readable descriptions, breadcrumbs, short metadata, placeholders, form labels and other secondary text on light surfaces (intentional legibility adjustment) |
| `--sp-text-disabled` | `#98A0AC` | Disabled-only text |
| `--sp-border` | `#E9EAEE` | Reference standard borders |
| `--sp-border-subtle` | `#F0F1F4` | Reference table row dividers |
| `--sp-border-strong` | `#D7D9E0` | Reference emphasized/hovered control border |
| `--sp-brand` | `#7055D8` | Primary actions, active selection, links |
| `--sp-brand-hover` | `#6046C7` | Hovered primary actions (reference) |
| `--sp-brand-active` | `#533AB5` | Pressed primary actions |
| `--sp-brand-soft` | `#F1EEFE` | Selected navigation and subtle accent background |
| `--sp-focus` | `#B8A8F7` | Focus border color (formerly the reference outline color); apply as a crisp 1px border without a large shadow on text fields |
| `--sp-success` | `#20865B` | Semantic success base; reference badge foreground is `#36865E` |
| `--sp-success-soft` | `#EEF8F1` | Positive state background |
| `--sp-warning` | `#A16A20` | Reference warning base; badge foreground `#A87830` and caution accent `#B78035` |
| `--sp-warning-soft` | `#FFF7E9` | Reference warning badge background |
| `--sp-danger` | `#BD4850` | Reference destructive base; badge foreground `#BC5359` |
| `--sp-danger-soft` | `#FDF0F0` | Reference destructive badge background |
| `--sp-info` | `#2763A5` | Informational state |
| `--sp-info-soft` | `#EDF5FE` | Informational background |

Additional reference-only state colors used by the HTML: sidebar hover `#E9EAF0`, sidebar active `#EAE5FB`, table hover `#FBFAFF`, table selected `#F7F5FF`, and quiet control surface `#F8F8FA`. Use these only for their corresponding scoped state; they are not additional general-purpose surface tokens.

**Legibility correction (approved accessibility exception):** The playground screenshot showed nearly invisible page headings, form labels, panel headings, and checkbox labels. Never apply pale text or opacity to primary headings, labels, control values, selected/unselected choice labels, or actionable text. Set those to `--sp-text` (`#22242B`). Use `--sp-text-supporting` (`#626775`) for readable helper text, placeholders, breadcrumbs, captions, and descriptions. Reserve `--sp-text-muted` (`#858995`) for genuinely nonessential metadata; never use opacity to wash out essential text. All ordinary labels and body text must meet 4.5:1 contrast against their actual surface. These changes intentionally override the reference’s low-contrast presentation.

**Rules:** These are the approved reference colors, consolidated from its CSS values. Brand purple is for active/selected states, primary CTA, links, and focus—not arbitrary card fills. Use semantic colors only for actual statuses. Statuses must include text or icons, not color alone. Validate contrast: normal text >= 4.5:1; large text and meaningful icons >= 3:1. The reference's exact subdued text and status foregrounds may be preserved only for genuinely nonessential content when legible; where essential information fails contrast, use a stronger accessible foreground and record the visual difference. Never weaken essential contrast to match a screenshot.

### 2.2 Typography — reference values and accessibility exceptions

**Production UI font:** `Inter`, with `ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` fallback. The HTML loads DM Sans as a secondary font in its CSS stack, but Inter is the first/primary family and is the required production family. Do not use DM Sans, Manrope, Geist, or another heading font in production. Use system monospace only for technical IDs/code where already meaningful.

The table records exact HTML reference values. If the HTML does not specify a role directly, the value is identified as an interpretation of the rendered CSS. Production follows these values by default; apply only the explicitly listed accessibility adjustments when the text is essential or the target/contrast otherwise fails.

| Role / semantic utility | Font size | Line height | Weight | Letter spacing | Application |
|---|---:|---:|---:|---:|---|
| `sp-type-page` | 25px | 31.25px (1.25) | 680 | -1.15px | Reference page title; HTML heading rule |
| `sp-type-section` | 13px | normal (~19.5px at 1.5) | 700 | -0.2px | Reference section heading (`Items`) |
| `sp-type-panel` | 12px | normal (~18px at 1.5) | 700 | 0 | Reference lower panel headings |
| `sp-type-body` | 13px | 19.5px (1.5) | 400 | 0 | Reference body default; short operational copy |
| `sp-type-body-strong` | 11px | normal (~16.5px at 1.5) | 600–700 | 0 | Reference compact strong labels; role depends on selector |
| `sp-type-table` | 11px | normal (~16.5px at 1.5) | 400; emphasized item/quantity up to 650 | 0 | Reference table cells and item names |
| `sp-type-table-head` | 10px | normal (~15px at 1.5) | 600 | 0 | Reference column headings |
| `sp-type-input` | 11px | normal (~16.5px at 1.5) | 400 | 0 | Reference search value; placeholder same size |
| `sp-type-label` | 11px | normal (~16.5px at 1.5) | 650 | 0 | Reference form labels |
| `sp-type-control` | 11px | normal (~16.5px at 1.5) | 550–600 | 0 | Reference buttons and filter controls |
| `sp-type-nav` | 11px (workspace labels) / 10px (group labels) | normal (~16.5px / 15px at 1.5) | 500 / 650 | 0 | Reference sidebar; nav row is 35px tall |
| `sp-type-badge` | 10px | normal (~15px at 1.5) | 600 | 0 | Reference status chips |
| `sp-type-meta` | 12px breadcrumbs; 11px short descriptions; 10px captions | 18px / normal | 400–600 | 0 | Reference metadata according to context |
| `sp-type-metric` | 24px | 32.4px (1.35) | 650 | -1.1px | Reference metric values, only for metrics already present in production |

Reference selectors sometimes override these role values. Preserve the exact selector-specific values when mapping a concrete component; do not treat one row as a blanket style for all similarly named content. CSS `font-weight: 650` is acceptable with variable Inter; if only static font weights are installed, use the nearest available weight and record it.

**Typography enforcement:**
- The HTML intentionally uses 10–11px for compact labels, table headings/cells, badges, controls, and navigation, and 10px for short captions. These sizes are recorded above rather than silently replaced.
- **Accessibility adjustment:** essential instructions, long-form metadata, input values users must enter/read, and table values requiring sustained scanning should be at least 12px in production. Prefer 12px for nonessential compact labels and badges when 10–11px fails legibility or contrast. Preserve the exact reference size only for short, secondary labels where contrast and usability remain adequate. This adjustment changes the appearance and must be disclosed; do not claim pixel identity for adjusted elements.
- Ordinary paragraphs/descriptions may use the 13px reference body size when legibility is verified. Increase to 14px if text is prolonged, essential, or fails user testing/zoom. Do not force 14px on every table cell when a 12px accessible value remains readable and the 14px value materially breaks density; document the chosen exception for the migrated region.
- Do not use arbitrary Tailwind font-size values. Apply a documented reference role or a stated accessibility adjustment.
- Keep labels in their existing case and wording; do not uppercase existing copy purely for aesthetics. Table headers may be visually uppercase **only if already uppercase** or approved.
- Use `font-variant-numeric: tabular-nums` for quantities, prices, dates, and identifiers with aligned digits. Right-align numerical table columns; left-align names/descriptions.
- Preserve text zoom to 200% without clipped controls or lost functionality. Never fix overflow by shrinking text below its role.
- Avoid blanket `font-size` on `button`, `input`, `table`, `th`, `td`, `small`, `h1` etc. outside a scoped design-system component.

### 2.3 Spacing, geometry, elevation

| Aspect | Specification |
|---|---|
| Base spacing | 4px grid: 4, 8, 12, 16, 20, 24, 32, 40, 48; reference-specific measured exceptions are documented below |
| Reference shell | 228px desktop sidebar; 56px top bar; 100vh shell with 650px minimum height |
| Reference content | max-width 1530px; desktop padding 34px top, 42px horizontal, 60px bottom |
| Reference responsive layout | At 1120px: 29px top, 26px horizontal; metrics become 2 columns. At 780px: sidebar becomes 228px off-canvas, top bar padding 0 17px, content padding 24px 17px 40px, heading stacks and lower panels become one column. At 520px: metrics remain 2 columns, compact metric labels/values and tabs, search fills row. |
| Icon sizes | 16px standard, 14px compact, 18px prominent; Lucide, 1.75 stroke |
| Reference primary/secondary action | 34px height; 12px horizontal padding; 6px radius; 11px/600 label; 14px icon; 8px icon gap |
| Reference search/filter control | 33px height; 10px horizontal padding; 6px radius; 11px text; icons 13px |
| Reference utility controls | Icon buttons 30px; pagination controls 27px; these are compact, secondary targets |
| Accessibility-adjusted control | Preserve reference height where practical; use a 36px minimum when the control requires a larger text size or target, and a 44px target where touch interaction requires it. Disclose geometry changes. |
| Touch target | >=44x44px where touch interactions are expected; use invisible hit area if needed |
| Reference table row | 60px body cell height; multiline content may grow |
| Reference table header | 40px height |
| Reference table cell padding | 15px horizontal; first/selection column 42px wide with 17px left and 5px right padding |
| Reference sidebar item | 35px height; 11px horizontal inset, 11px icon/text gap, 6px radius |
| Reference panel padding | Metrics 18px 20px 17px; lower panels 19px 20px; compact panels remain role-specific |
| Reference page gutter | 42px desktop horizontal / 34px top; 26px horizontal at 1120px; 17px horizontal / 24px top at mobile <=780px |
| Inline element gap | 8px default, 4px tight, 12px grouped |
| Section gap | 24px default, 32px where existing hierarchy warrants |
| Control radius | 6px (reference buttons/search/filters) |
| Panel radius | 8px (reference metrics, table, lower panels) |
| Dialog / drawer radius | 10px (drawer may have square screen edge) |
| Chip radius | 4px–6px; pill only for badges where established |
| Border | 1px solid semantic border token |
| Shadow | None for ordinary panels; subtle shadow only for menus, dialogs, floating overlays |
| Animation | 120–180ms ease for hover/focus; 180–240ms for drawers; respect reduced motion |

Use measured reference exceptions above where reproducing a component. Do not globally change existing layout widths, sidebar widths, section order, or content grids; adopt reference geometry only in an explicitly approved production region and retain production content.

## 3. Component styling contracts

Each contract describes **appearance and interaction only**. Existing component APIs, state, handlers, labels, and validation remain authoritative. Extract shared components only when doing so does not change behavior.

### 3.1 Buttons and icon buttons
- Primary: brand fill, white text, 1px matching border, 6px radius; hover `--sp-brand-hover`; active `--sp-brand-active`; disabled muted and non-interactive.
- Secondary: white surface, standard border, primary text; hover subtle neutral fill and stronger border.
- Tertiary/ghost: transparent; neutral hover fill; preserve existing destructive-action semantics.
- Reference actions: 34px height, 11px semibold label, 8px icon gap, 12px horizontal padding; primary/secondary icon size 14px. At <=520px horizontal padding becomes 9px. Apply the accessibility-adjusted control guidance in §2.2 where a 34px target is insufficient.
- Icon-only buttons: 32–36px visual bounds, accessible name (`aria-label`), tooltip if icon meaning is not obvious; maintain keyboard focus.
- Loading: preserve button width, show progress, prevent duplicate submission; no layout shift.

### 3.2 Text fields, selects, textareas, search
- Reference inputs/selects: white background, 1px reference border, 6px radius, 33px search/filter height, 10px horizontal padding, 11px control text. The create-item form uses 36px height, 10px padding, and 11px text.
- Placeholder uses `--sp-text-supporting` for legibility; labels and field values use `--sp-text`. The HTML originally used a 3px `#B8A8F7` outline with 2px offset. **Approved minimal-focus exception:** inputs, selects, textareas, search fields, and date fields use a clean 1px `#B8A8F7` border on focus, with **no box-shadow, outer glow, or thick offset outline**. To ensure keyboard focus remains discernible, add a restrained 2px *inset* focus indicator where the border alone is not sufficiently distinguishable, or use a 2px solid border without changing control geometry (`box-sizing: border-box`). For keyboard-focused buttons, icon controls, checkboxes, radios, switches, and links, retain a clearly visible 2px focus-visible outline (no shadow) so focus is not communicated by a faint border alone. Error styling must use danger border plus message text and accessible association.
- Reference form labels are 11px semibold. Increase to 12px minimum when essential/readability requires it; 13px is acceptable as an explicit accessibility adjustment. Reference label-to-control gap is 6px.
- Preserve existing required, disabled, read-only, number formatting, validation, autocomplete, dropdown options, and keyboard handling.
- Search input: same field tokens; search icon 16px; clear action only if already supported or explicitly approved.

### 3.3 Tables and data grids
- **Never alter columns, order, data, sorting, filters, pagination, row actions, or selection behavior** in a styling-only migration.
- Reference header: `--sp-surface-subtle`, 10px semibold text, 40px height, 15px horizontal padding, 1px bottom border. Preserve production header case.
- Reference body: 11px text, 60px row height, 15px horizontal cell padding; multiline rows expand naturally. Compact secondary text in item cells is 10px. Accessibility-adjust if values require prolonged scanning, essential interpretation, or otherwise fail legibility, as described in §2.2.
- Row hover: reference tint `#FBFAFF`; selected: `#F7F5FF`; retain visible keyboard focus and selection. Avoid hover-only access to critical actions.
- Numeric columns right-aligned with tabular figures; descriptive cells left-aligned. Reference table minimum width is 800px and uses horizontal scrolling. Preserve all production columns/actions and keep scrolling reachable on narrow viewports.
- Narrow viewports: horizontal scroll with a clearly reachable scrollbar or scroll affordance; **never silently drop columns or actions**. Sticky headers/columns only if already supported or separately approved.
- Empty/loading/error rows must be legible, occupy the existing table region, and retain current retry/actions.
- Reference pagination controls are 27px and 10px; footer is 51px high with 10px metadata. Increase text/target sizes where essential or touch interaction requires it; retain existing page size and count semantics.

### 3.4 Navigation, breadcrumbs, tabs
- Preserve all existing routes, module names, ordering, badges, counts, role gating, and nesting.
- Reference sidebar is 228px wide on desktop, uses `--sp-sidebar`, 35px rows, 15px Lucide icons, 11px item text, and 10px group labels. Hover is neutral `#E9EAF0` with dark text; active is `#EAE5FB` with `#6045C3` text. Reference mobile behavior is a 228px off-canvas sidebar below 780px. Retain accessible target sizes and apply a production size adjustment if necessary. Preserve production routes, items, ordering, badges, role gating, and nesting; **do not rebuild navigation architecture.**
- Breadcrumbs: reference 12px text with 9px gaps; current item is darker/600. Preserve hierarchy.
- Tabs: reference 39px height, 11px text, 23px gap (15px at <=520px), 2px active underline. Preserve existing tab labels and panel behavior; increase text if the tab is essential and fails readability.

### 3.5 Panels, cards, section headers, metrics
- Panels: white surface, 1px reference border, 8px radius. Use reference region-specific padding in §2.3. Avoid stacking multiple framed cards unnecessarily; do not change existing grouping without approval.
- Reference section heading is 13px/700; lower panel heading is 12px/700. Compact descriptions are 11px; short captions are 10px. Apply the typography accessibility guidance in §2.2 when these are essential, and record the visual adjustment.
- Existing metric values may use 24px/32px; **never add new metrics** as part of design migration.
- Use whitespace and typography to establish hierarchy; no gradients, dramatic shadows, or decorative charts.

### 3.6 Badges, alerts, status
- Reference badge: 10px semibold, 5px radius, 4px vertical and 7px horizontal padding, 5px semantic dot plus text. Use the reference semantic tints and foregrounds in §2.1, but adjust foreground contrast when required. Raise badge text to 12px when 10px is not legible; never rely on color alone.
- Preserve existing status wording, severity mapping, and lifecycle. Never map an unknown status to success by default.
- Alerts: 14px body, 12px supplementary text, subtle semantic background and border, icon + readable text. Destructive confirmations retain current safeguards.

### 3.7 Dialogs, drawers, dropdowns, tooltips, toasts
- Overlay scrim: reference drawer `#16151C38`; modal `#18151D6B`; overlay surfaces white with a subtle border and shadow.
- Reference dialog: 10px radius, 26px padding, width `min(460px, 100%)`; existing production constraints and accessible focus/Escape behavior remain authoritative. Reference drawer is right-aligned, up to 460px wide, with 60px top bar and 28px content inset. Preserve an existing drawer's side, width, behavior, and scroll structure.
- Reference menus/command rows use 11–12px text and 12px vertical padding; preserve existing nesting and keyboard interactions. Apply the 12px minimum for essential text.
- Tooltips and toast text must remain readable, keyboard-accessible, and never be the sole source of essential information. The reference toast uses 11px; raise to 12px if needed for readability. Preserve live-region and notification behavior.

### 3.8 Checkboxes, radios, switches, date controls
- 16px checkbox/radio visual, brand selected/focus state, minimum accessible hit target; preserve native or existing accessible semantics.
- Switches and date pickers must preserve current logic, min/max constraints, localization, and disabled/validation states. Do not swap libraries solely for appearance.

### 3.9 States every shared primitive must support
Default, hover, active/pressed, focus-visible, selected (where relevant), disabled, read-only (where relevant), loading, validation error, success/warning (where relevant), empty (containers), and high-contrast/zoom behavior. Hover must not be the only indicator of state.

### 3.10 Readability and minimal-focus acceptance checks

- On the light canvas and white panels, page titles, section/panel headings, field labels, checkbox/radio labels, input values, table values, and button labels must be visibly dark (`#22242B`) and never have reduced opacity unless genuinely disabled.
- Descriptions, breadcrumbs, metadata needed for understanding, and placeholders use `#626775` or a darker color; validate normal-text contrast at least 4.5:1.
- Focusing a text input, search, select, textarea, or date field changes its border to `#B8A8F7` without an external glow or oversized shadow. Keyboard focus on non-field controls remains obvious.
- Verify default, hover, focus, invalid, disabled, and selected states at desktop and narrow viewport widths; preserve all existing behavior. These are deliberate readability/focus exceptions to the original HTML reference, not a claim of pixel identity.

## 4. Tailwind CSS v4 — safe implementation rules

1. Use Tailwind CSS **v4** with the Vite integration compatible with the repository's current dependencies. Inspect existing Vite/PostCSS setup first; do not install duplicate plugins or replace config blindly.
2. **Do not globally import Tailwind Preflight** into the existing app during initial adoption. It resets base element styles and can break untouched screens. Prefer an isolated Tailwind entry for the component playground; if the eventual production integration needs a reset, explicitly scope and verify it in a separate reviewed PR.
3. Define semantic CSS custom properties (`--sp-*`) and expose them to Tailwind v4 using `@theme inline` in a **single small implementation stylesheet** when approved. This is implementation code, **not another design specification**. Use CSS variables as the runtime source of truth and this document as the specification.
4. Use consistent semantic utilities (`text-sp-text`, `bg-sp-surface`, `border-sp-border`, etc.) and semantic type classes (`sp-type-table`, `sp-type-control`, etc.). Exact utility mapping must be implemented once and reused.
5. Do not use arbitrary hex utilities, undocumented one-off font sizes, inline style overrides, global `!important`, or repeated feature-specific class recipes. Apply only the exact reference sizes or documented accessibility adjustments in §2.2.
6. Existing global CSS remains in place until each dependency is audited and migrated. No blanket deletion, no replacement of `styles.css`, no `*`, `body`, `button`, `table`, or `input` rules that leak into untouched pages.
7. Shared primitives belong in an appropriate existing shared-component location or `frontend/src/design-system/components/` if no suitable library exists. **Do not build a second parallel component library** when a reusable component already exists; adopt styling in place when possible.
8. Tailwind class composition must preserve passed `className`, refs, native attributes, accessibility, and event handlers. Avoid wrappers that break table structure or forms.
9. If Tailwind integration affects untouched screens, **revert the integration and isolate it**. Do not compensate with broad global CSS patches.