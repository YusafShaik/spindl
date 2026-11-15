# Spindl Precision Design System — normative specification

## Purpose and scope
Apply a consistent, premium, Linear-inspired **visual language** to Spindl's existing ERP screens. **Do not recreate, restructure, or replace any feature screen.** The feature's current React code and requirements determine all displayed information and behavior. This document determines typography, color, spacing, controls, visual hierarchy, and accessibility.

Linear is inspiration for precision, restrained color, crisp alignment, and interaction quality; Spindl must retain its own identity. No screen prototype or demo is an authority over existing production content.

## 1. Typography — STRICT, REQUIRED

Use **DM Sans** for all application UI, including tables, inputs, labels, menus, navigation, dialogs, and help text. Use **Manrope** for page/section headings and prominent metric values only. Use a monospace face only for technical IDs when there is a real readability benefit.

| Semantic role | Family | Size / line height | Weight | Usage |
|---|---|---|---|---|
| Page title | Manrope | 24px / 32px | 700 | Main heading for an existing page |
| Section title | Manrope | 18px / 26px | 700 | Existing section headings |
| Panel title | DM Sans | 15px / 22px | 600 | Table and form panel headings |
| Body / description | DM Sans | 14px / 22px | 400 | Descriptions, explanatory text |
| Table cells | DM Sans | 14px / 20px | 400–500 | All operational table values |
| Table headers | DM Sans | 12px / 18px | 600 | Column labels; normal or subtle uppercase |
| Input / select values | DM Sans | 14px / 20px | 400–500 | All editable values and placeholders |
| Field labels | DM Sans | 13px / 20px | 600 | Form field names |
| Buttons / tabs | DM Sans | 13px / 20px | 600 | Action text and navigation tabs |
| Sidebar navigation | DM Sans | 13px / 20px | 500–600 | Module navigation |
| Status badges | DM Sans | 12px / 18px | 600 | Status labels and chips |
| Metadata / helper | DM Sans | 12px / 18px | 400–500 | Dates, captions, hints, secondary details |
| KPI / key figure | Manrope | 24px / 32px | 700 | Existing prominent values only |

### Enforcement
- **12px is the absolute minimum for meaningful UI text.** Never use 8, 9, 10, or 11px for any operational label, helper, table value, sidebar item, badge, or metadata.
- Do not shrink fonts to squeeze more columns into a table. Use horizontal scrolling, truncation with accessible disclosure, or responsive column handling that preserves functionality.
- Density modes change row height and padding, **never font sizes**.
- Do not use arbitrary Tailwind font sizes, inline font-size styles, or one-off CSS type scales in feature components. Use the semantic typography roles above.
- Preserve readable contrast; muted text is still readable.
- Use tabular numerals for quantities, monetary values, and dates; right-align numeric columns.
- Use normal sentence case for UI copy; existing labels remain unchanged unless explicitly approved.
- Fonts must fall back gracefully when web fonts are unavailable.

## 2. Color tokens
- Brand: `#7055D8`; brand hover `#5C42C3`; selected tint `#F1EDFC`.
- Canvas: `#F7F8FA`; surfaces `#FFFFFF`; ink `#20212B`; secondary text `#475467`; muted text `#667085`; border `#E4E7EC`.
- Semantic: success `#15803D`, warning `#B45309`, danger `#B42318`, info `#175CD3`.
- Use brand purple for selected states, primary actions, and focus; not as decoration.
- Status text/icon must communicate meaning without relying on color alone.

## 3. Spacing, controls, and density
- Spacing: 4px baseline, preferred 4/8/12/16/20/24/32/40/48px.
- Radius: controls 6–8px; panels 8–10px; dialogs 12px.
- Border: subtle 1px; shadows reserved mainly for floating overlays.
- Control heights: compact 32px, default 40px, large 48px.
- Data rows: default 48px; compact 40px. Keep table text 14px in both.
- Avoid nested card borders and arbitrary gaps; preserve the existing screen's grouping.

## 4. Shared design-system components
Create components incrementally as existing screens need them:
`Button`, `IconButton`, `Input`, `Select`, `Checkbox`, `Switch`, `Textarea`, `StatusBadge`, `Tabs`, `Dialog`, `Drawer`, `Tooltip`, `DropdownMenu`, `PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `FormField`, `EmptyState`, `Skeleton`, `Toast`.

Component APIs must support the real fields and behavior already used in Spindl. Use accessible headless primitives where appropriate, Lucide icons, and Tailwind CSS v4 semantic tokens. Do not invent new UI sections to justify a component.

## 5. Existing screen preservation contract
The current application owns:
- Navigation labels, order, destinations, and permissions.
- Page headings, sections, tables, fields, column order, and business terminology.
- Data fetching, calculations, validation, actions, exports, and workflows.
- Filtering, sorting, pagination, loading, error, and empty behavior.

The design system owns:
- Typography roles, spacing, colors, borders, radii, focus rings, and elevation.
- Visual styling and accessibility of buttons, inputs, menus, tables, dialogs, and status indicators.
- Consistent hover/selected/disabled/loading appearance.

**Do not exchange one set of screen fields or workflows for another.** If improving usability appears to require information-architecture changes, propose them separately and wait for approval.

## 6. Implementation architecture
```
frontend/src/design-system/
  tokens.css
  components/
  patterns/
  index.ts
frontend/src/features/   # existing screen composition and domain behavior
```

Build an isolated component playground before applying shared styles to existing screens. Keep the playground out of the production navigation unless specifically approved. Migrate one existing component/region at a time. Do not rewrite the entire app stylesheet.

## 7. Quality gates
- All existing labels, fields, columns, sections, and actions remain present.
- No meaningful text below 12px; tables, inputs, and body are 14px.
- Type hierarchy matches the semantic scale exactly.
- Keyboard/focus behavior, responsive overflow, and semantic statuses work.
- Existing business behavior and API contracts remain unchanged.
- `npm run typecheck`, `npm run build`, and relevant tests pass.
- Before/after screenshots show the **same existing screen** with improved presentation.
- PR reviewed before merge.
