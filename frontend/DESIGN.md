# Spindl Design System — Linear Design System Specification

> **Status:** Authoritative visual reference specification. **Target repository path:** `frontend/DESIGN.md`.
> **Source of Visual Truth:** Linear Web Application (curated via Mobbin MCP research: [Linear Dashboard](https://mobbin.com/screens/bbbfd972-0581-4b69-a920-38cc771ec428), [Linear Table / List View](https://mobbin.com/screens/9e6c1c6e-764e-4314-8f7e-83106663422e), [Linear Workspace & Nav](https://mobbin.com/screens/2679ae03-f852-47c3-a880-480c493c1369), [Linear Modal & Dialogs](https://mobbin.com/screens/d4e47b31-9152-40c7-a400-c6725e8de647), [Linear Settings & Forms](https://mobbin.com/screens/a4e7fb71-dd94-4c1d-a5af-f032e03a10a9), [Linear Data Filters](https://mobbin.com/screens/212fda35-366e-4dc0-a1d1-3b679659d6ab)).
>
> **Mission:** Transform the entire visual appearance of Spindl ERP to implement the complete, iconic design system of Linear. Every design technique Linear uses—flat surfaces, borderless or 1px hair-line borders, compact Inter typography, 32px controls, 44px navigation bar, 220px collapsible sidebar, unified table styling, subtle status chips, and refined micro-interactions—is adopted across Spindl UI. **Preserve 100% of existing ERP business functionality, workflows, state, and permissions.**

---

## 0. Authority, boundaries, and agent operating contract

1. **Existing production feature components are the immutable source of truth for business functionality, data, and workflows.**
   Preserve all section order, headings, form inputs, table columns, labels, state machines, data bindings, navigation routes, filters, sorting, CSV import/export, role-based access permissions, validations, dialogs, drawers, and responsive feature access. Never invent mock data, never remove ERP actions, never drop table columns, and never alter backend API contracts.
2. This document is the **single authoritative design specification**.
3. **Linear is the direct design authority**:
   - Palette: Linear warm-canvas `#F8F9FA`, pure white surface `#FFFFFF`, crisp hairline border `#E8E9ED`, secondary text `#6B6F76`, primary text `#1D2024`, and brand purple `#5E46C1`.
   - Surfaces: Flat, non-skeuomorphic panels. Zero heavy drop-shadows on inline panels; elevation shadows are strictly reserved for overlay menus, popovers, and modals.
   - Density: Professional, compact productivity density. Controls are 30–34px high, table headers 38–40px, table rows 48–52px.
4. **Preserve functionality and accessibility**:
   Every text contrast ratio must meet or exceed WCAG AA (>= 4.5:1 for body and labels, >= 3:1 for large text and meaningful icons). Tabular numbers (`tabular-nums`) must be used for all quantities, prices, dates, IDs, and financial summaries.

---

## 1. Design character

**Keywords:** precise, functional, minimal, quiet, typographic, flat, high-density, deliberate.

- **No visual noise:** Eliminated arbitrary card fills, rounded pill buttons, decorative sparkline gradients, and bloated paddings.
- **Whitespace is structure:** Grouping is established through consistent 4px-grid spacing and subtle 1px dividers rather than heavily boxed nested cards.
- **Typography-driven hierarchy:** Clear weight and size distinction using `Inter` with tight tracking (`letter-spacing: -0.3px` on page titles).
- **Linear purple accent:** `#5E46C1` is used intentionally for active navigation items, primary actions, focused controls, and active states—never for arbitrary decorative fills.

---

## 2. Design tokens — exact values

### 2.1 Color system (light mode)

| Token | Hex Value | Role & Mobbin Reference |
|---|---|---|
| `--sp-canvas` | `#F8F9FA` | Global background canvas across app shell and body |
| `--sp-sidebar` | `#F8F9FA` | Sidebar surface (seamless with canvas, separated by 1px border) |
| `--sp-surface` | `#FFFFFF` | Panels, data cards, modals, table backgrounds, form fields |
| `--sp-surface-subtle` | `#FBFBFC` | Table headers, secondary banners, quiet sections |
| `--sp-surface-hover` | `#F0F0F3` | Neutral hover state for buttons, rows, and sidebar items |
| `--sp-text` | `#1D2024` | Primary high-contrast text, titles, values, and strong labels |
| `--sp-text-secondary` | `#6B6F76` | Supporting body copy, table content, form labels |
| `--sp-text-muted` | `#8E929C` | Metadata, breadcrumb parents, shortcut keys, timestamps |
| `--sp-text-disabled` | `#B0B3BA` | Disabled button/input text and placeholders |
| `--sp-border` | `#E8E9ED` | Standard 1px structural borders (sidebar divider, panel borders) |
| `--sp-border-subtle` | `#F0F1F4` | Table row dividers, inner section separators |
| `--sp-border-strong` | `#D0D3D9` | Emphasized borders, hover states on interactive controls |
| `--sp-brand` | `#5E46C1` | Linear signature purple: primary CTA, active navigation, active focus |
| `--sp-brand-hover` | `#4F3AAE` | Primary button hover state |
| `--sp-brand-active` | `#43319A` | Primary button pressed/active state |
| `--sp-brand-soft` | `#EBE8F7` | Active nav background, selected row tint, soft accent badges |
| `--sp-focus` | `#5E46C1` | Focus ring color (crisp 1px border + 2px offset or outline) |
| `--sp-success` | `#1A7A4C` | Positive semantic state, Paid, Active, In stock |
| `--sp-success-soft` | `#EAF7EE` | Positive status badge background |
| `--sp-warning` | `#8B5A17` | Warning semantic state, Low stock, Awaiting approval |
| `--sp-warning-soft` | `#FFF6E8` | Warning status badge background |
| `--sp-danger` | `#C13E3E` | Destructive semantic state, Out of stock, Cancelled, Overdue |
| `--sp-danger-soft` | `#FDE8E8` | Destructive status badge background |
| `--sp-info` | `#2763A5` | Informational state, In transit, Dispatched |
| `--sp-info-soft` | `#EDF5FE` | Informational status badge background |

---

### 2.2 Typography system

**Font Family:** `Inter`, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif.  
All numeric data, prices, dates, SKU codes, and quantities utilize `font-variant-numeric: tabular-nums`.

| Semantic Class / Role | Size | Line Height | Weight | Tracking | Application |
|---|---|---|---|---|---|
| `sp-type-page` | 20px | 28px (1.40) | 600 | -0.35px | Page titles (`Dashboard`, `Stock overview`) |
| `sp-type-section` | 14px | 20px (1.42) | 600 | -0.15px | Panel titles, modal headings, section headers |
| `sp-type-panel` | 13px | 20px (1.53) | 600 | 0 | Sub-panel headers, card group labels |
| `sp-type-body` | 13px | 20px (1.53) | 400 | 0 | Regular description copy, paragraphs, table values |
| `sp-type-body-strong` | 13px | 20px (1.53) | 600 | 0 | Emphasized data points, party names |
| `sp-type-table` | 13px | 20px (1.53) | 400 | 0 | Data table rows (tabular-nums) |
| `sp-type-table-head` | 11.5px | 16px (1.39) | 500 | 0 | Table column headings (clean sentence-case or subtle caps) |
| `sp-type-input` | 13px | 20px (1.53) | 400 | 0 | Text fields, search bar, dropdown values |
| `sp-type-label` | 12px | 16px (1.33) | 500 | 0 | Form labels, filter labels |
| `sp-type-control` | 12.5px | 18px (1.44) | 600 | 0 | Buttons, tabs, segment controls |
| `sp-type-nav` | 13px | 20px (1.53) | 500 | 0 | Sidebar navigation items |
| `sp-type-badge` | 11px | 16px (1.45) | 550 | 0 | Status badges and tags |
| `sp-type-meta` | 11.5px | 16px (1.39) | 400 | 0 | Breadcrumbs, timestamps, helper copy |
| `sp-type-metric` | 22px | 28px (1.27) | 600 | -0.4px | Metric / KPI values (tabular-nums) |

---

### 2.3 Geometry, spacing, and elevation

| Element | Linear Specification |
|---|---|
| **Base Grid** | 4px increment scale (4, 8, 12, 16, 20, 24, 32, 40) |
| **Sidebar Layout** | Width: `220px` desktop; background `#F8F9FA`; border-right `1px solid #E8E9ED` |
| **Topbar Layout** | Height: `44px`; background `#FFFFFF`; border-bottom `1px solid #E8E9ED` |
| **Content Area** | Max width: `1440px`; desktop padding: `24px 32px 32px` |
| **Control Heights** | Buttons, search inputs, dropdown selects: `32px` (compact Linear standard) |
| **Mini-actions / Utility** | Compact inline buttons: `26px–28px` height, 4px radius |
| **Icon Sizes** | Navigation: 15px; buttons: 14px; status dots: 5px; stroke: 1.75 |
| **Corner Radii** | Controls/inputs: `6px`; Panels/cards: `8px`; Modals: `12px`; Status badges: `4px` |
| **Table Header Height**| `38px–40px`; background `#FBFBFC`; bottom border `1px solid #E8E9ED` |
| **Table Row Height** | `48px–52px`; row border `1px solid #F0F1F4`; hover `#FAFAFE` |
| **Panel Shadows** | `none` (flat Linear panels); border `1px solid #E8E9ED` |
| **Overlay Shadows** | Modals/dropdowns: `0 12px 32px rgba(15,23,42,0.10), 0 1px 3px rgba(15,23,42,0.06)` |
| **Transitions** | `120ms ease` for hover and focus states |

---

## 3. Component styling contracts (Linear UI implementation)

### 3.1 Buttons & action controls
- **Primary button:** Solid Linear purple fill (`#5E46C1`), text `#FFFFFF`, height `32px`, padding `0 12px`, radius `6px`, font 12.5px/600, no drop-shadow. Hover: `#4F3AAE`. Active: `#43319A`.
- **Secondary button:** White surface (`#FFFFFF`), border `1px solid #E8E9ED`, text `#1D2024`, height `32px`, padding `0 12px`, radius `6px`. Hover: background `#F5F6F8`, border `#D0D3D9`.
- **Ghost / text button:** Transparent background, text `#6B6F76`, hover background `#F0F0F3`, hover text `#1D2024`.
- **Icon controls:** Square `28px x 28px` or `32px x 32px`, border-radius `6px`, center aligned.

### 3.2 Text fields, selects, search & filters
- **Inputs & selects:** Height `32px`, background `#FFFFFF`, border `1px solid #E8E9ED`, radius `6px`, padding `0 10px`, font 13px Inter.
- **Focus state:** Border color `#5E46C1`, outline none, subtle `0 0 0 1px #5E46C1`.
- **Search box:** Clean rounded field with search icon (`14px`, `#8E929C`), placeholder color `#8E929C`, keyboard shortcut indicator `<kbd>` (`font-size: 10px`, background `#F0F1F4`, color `#6B6F76`).

### 3.3 Data tables & registers
- **Header:** Height `38px–40px`, background `#FBFBFC`, bottom border `1px solid #E8E9ED`, text 11.5px/500 `#6B6F76`. Left-aligned for text, right-aligned for currency/numbers.
- **Rows:** Height `48px–52px`, bottom border `1px solid #F0F1F4`, text 13px `#1D2024`.
- **Hover:** Row highlight `#FAFAFE`. Selected row: `#EBE8F7`.
- **Cell spacing:** Horizontal padding `14px`.

### 3.4 Sidebar & navigation
- **Layout:** `220px` width, background `#F8F9FA`, border-right `1px solid #E8E9ED`.
- **Workspace Switcher:** Compact header card with team mark, workspace name, and chevron.
- **Nav items:** Height `32px`, padding `0 8px`, border-radius `6px`, text 13px `#6B6F76`.
- **Active state:** Background `#EBE8F7`, text `#5E46C1`, font-weight 600.
- **Hover state:** Background `#F0F0F3`, text `#1D2024`.
- **Captions:** Text 10.5px, weight 600, color `#8E929C`, uppercase, padding `12px 8px 4px`.
- **Footer profile:** Sleek compact user bar at bottom with avatar and role label.

### 3.5 Status chips & badges
- **Geometry:** 4px border-radius, padding `2px 7px`, height `20px`.
- **Dot indicator:** 5px circle with `currentColor` or semantic solid fill.
- **Tones:**
  - Success (Active, Paid, In stock): background `#EAF7EE`, text `#1A7A4C`.
  - Warning (Low stock, Awaiting, Pending): background `#FFF6E8`, text `#8B5A17`.
  - Danger (Out of stock, Overdue, Cancelled): background `#FDE8E8`, text `#C13E3E`.
  - Brand (Draft, Progress, Standard): background `#EBE8F7`, text `#5E46C1`.

### 3.6 Panels, metrics & KPI cards
- **Panels:** Pure white `#FFFFFF`, border `1px solid #E8E9ED`, border-radius `8px`, zero box shadow.
- **KPI cards:** Clean padding `16px 18px`, title 12px `#6B6F76`, metric value 22px font-weight 600 `#1D2024`, subtle sparkline graph.

### 3.7 Dialogs & modals
- **Scrim:** `rgba(15, 23, 42, 0.45)` with subtle backdrop blur `2px`.
- **Modal window:** Background `#FFFFFF`, border-radius `12px`, border `1px solid #E8E9ED`, padding `24px`, shadow `0 20px 48px rgba(15,23,42,0.14)`.
- **Title bar:** 16px/600 title, close button 28px square with 6px radius.
- **Actions bar:** Right-aligned secondary and primary buttons, `32px` height.

---

## 4. Implementation rules & zero-regression contract

1. **No business logic alteration:** Retain all state variables, callbacks, API fetch functions, idempotency keys, and component prop definitions.
2. **Accessible contrast:** All text on white or canvas backgrounds meets WCAG AA 4.5:1.
3. **Responsive continuity:** Desktop sidebar (220px fixed) gracefully becomes an off-canvas drawer (<850px) without breaking navigation or layout elements.
