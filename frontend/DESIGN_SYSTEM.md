# Spindl Precision Design System — v1

**Status:** approved art direction; implementation in progress. **Reference:** Linear-inspired Spindl Inventory Workspace concept. This document is the source of truth for future agents and contributors.

## Product identity
Spindl is a calm, precise, premium enterprise ERP. The design is not a copy of Linear: borrow its rigor in alignment, information density, typography and interaction. Keep Spindl purple and ERP-specific controls.

### Foundations
- Brand: `#7055D8`; brand hover `#5C42C3`; selected tint `#F1EDFC`.
- Canvas: `#F7F8FA`; surfaces: `#FFFFFF`; ink: `#20212B`; secondary: `#475467`; muted: `#667085`; divider: `#E4E7EC`.
- Success `#15803D`; warning `#B45309`; danger `#B42318`; info `#175CD3`. Never rely on color alone.
- UI typography: DM Sans; headings and KPI figures: Manrope; IDs and technical references may use a monospace face.
- Display 30/38 800; page title 24/32 700; section 20/28 700; card 16/24 700; body 14/22 400–500; label 13/20 600; metadata 12/18 500. Never shrink essential ERP text to fit.
- Spacing: 4px baseline, preferred steps 4/8/12/16/20/24/32/40/48.
- Radius: controls 6–8px, panels 8–10px, dialogs 12px. Borders 1px. Avoid excessive shadows; use elevation mainly for overlays.
- Controls: 32px compact, 40px default, 48px large. Minimum touch targets should remain usable.
- Data rows: 44–52px default; 38–44px compact. Density changes padding, not font size.

### Layout architecture
1. Workspace shell: 240–256px sidebar, 56–64px topbar, content with a flexible max width.
2. Page header: breadcrumb, title, description if useful, one dominant action, secondary contextual actions.
3. Toolbar: tabs, search, filter chips, column controls, export, bulk actions.
4. Main content: data table or workflow canvas. Avoid card-on-card nesting.
5. Record detail: contextual right-side inspector with actions, summary, relationships and audit history.

### Shared components (canonical)
`Button`, `IconButton`, `Input`, `NumberInput`, `Select`, `SegmentedControl`, `Checkbox`, `Switch`, `Textarea`, `DateField`, `Badge`, `StatusBadge`, `Tooltip`, `DropdownMenu`, `Tabs`, `Dialog`, `Drawer`, `Toast`, `Skeleton`, `EmptyState`, `PageHeader`, `FilterBar`, `DataTable`, `Pagination`, `Metric`, `RecordInspector`, `CommandPalette`, `FormField`, `Money`, `Quantity`, `EntityLink`, `AuditTimeline`.

Components must document variants, props, focus behavior, error/loading/empty states, responsive behavior and usage. Use Radix for complex accessible primitives, TanStack Table for grids, React Hook Form + Zod for form validation, Lucide icons, Recharts for charts.

### Page templates
- Directory: inventory, customers, suppliers, sales and purchases.
- Record detail: purchase order, product, invoice, customer, manufacturing order.
- Dashboard: operational KPIs, trends, exceptions and actions.
- Workflow: approvals, manufacturing, quality inspection and POS.
- Settings: section navigation, grouped controls, explicit save feedback.

### Non-negotiable UX quality
- Real content and actions first; no decorative placeholder cards in production.
- Labels, values and status must be legible at 100% zoom.
- Align amounts and quantities to the right with tabular numerals.
- Every icon-only control has an accessible label and visible focus.
- Every async action exposes loading and failure states.
- Tables must remain operable at tablet widths; horizontal scroll is contained.
- Use consistent wording, dates, currency and quantity formats across modules.
- Preserve authorization and tenant isolation in UI action visibility.

### Technology
React + TypeScript + Vite + Tailwind CSS v4 with semantic CSS tokens. Components are Spindl-owned and use accessible headless primitives where appropriate. Storybook is the long-term interactive documentation surface; Vitest, Testing Library, Playwright and axe provide quality gates.

### Architecture
```
frontend/src/design-system/
  tokens.css           # semantic CSS variables and Tailwind v4 mapping
  components/          # reusable UI components (not business logic)
  patterns/            # filter bars, record inspectors, data tables
  templates/           # page layouts
  index.ts             # public exports
frontend/src/features/ # domain-specific composition and hooks
```

### Review checklist
[ ] Visually matches approved Inventory reference
[ ] Uses shared components and tokens
[ ] Readable typography and consistent density
[ ] Loading, empty, error, disabled and focus states
[ ] Keyboard, screen reader and responsive behavior
[ ] No API/permissions/calculation regressions
[ ] Typecheck, build and relevant tests pass
