# Spindl frontend modernization — agent-ready implementation plan

## Current baseline (v2, 2026-11-15)
React + TypeScript + Vite. App composition: `src/App.tsx`. Existing features: `src/features/`. Global styling: `src/styles.css`. Existing Inventory directory: `src/features/inventory/ProductDirectory.tsx`; inventory hooks: `src/features/inventory/useInventoryActions.ts`. No Tailwind or frontend test scripts were present in the inspected `package.json`. Existing CSS includes many 8–11px operational labels; these need to become legible.

## Execution sequence

### M0 — Foundations (this branch)
- Establish canonical agent instructions, design spec and token file.
- Preserve the approved HTML Inventory prototype as the visual reference; do not treat its sample data as production data.
- Do not change existing business behavior.

### M1 — Tooling + component library
- Install Tailwind CSS v4 and Vite integration with a lockfile update.
- Import `src/design-system/tokens.css` through the global style entry, without breaking existing CSS. Map Tailwind tokens via `@theme inline`.
- Build canonical `Button`, `Input`, `StatusBadge`, `PageHeader`, `Tabs`, `FilterBar`, `DataTable`, `Drawer`, `EmptyState`.
- Add Storybook or a dedicated `/design-system` development-only route to display components with all states.
- Add unit tests and visual regression snapshots.

### M2 — Inventory pilot
- Keep `ProductDirectory` props and `useInventoryActions` behavior intact.
- Replace table, toolbar, heading and actions with shared components.
- Add item inspector; it must display real ItemSummary fields and call existing actions.
- Preserve stock adjustment, threshold changes, movement history, search, export, pagination, and custom fields.
- Validate keyboard, mobile overflow and permissions.
- Capture before/after screenshots and obtain visual sign-off.

### M3 — ERP module migration
- Purchasing, Sales, Customers, Transactions, Manufacturing, Quality, CRM, Reports, Settings, Team, POS.
- Reuse the same shell, record inspector, data grid, filters, dialogs and field primitives.
- Remove legacy feature CSS only when no longer referenced.

### M4 — Quality gate and cleanup
- Storybook coverage for shared components.
- Vitest + Testing Library, Playwright smoke tests, axe accessibility checks.
- Enforce design-system imports and avoid hardcoded values in feature code.
- Validate desktop, tablet, phone, keyboard and reduced-motion modes.

## Commands
```bash
cd frontend
npm install
npm run typecheck
npm run build
```
These commands are required for implementation PRs; they have **not** been executed as part of this documentation-only foundation.

## Agent task prompt
> Read AGENTS.md, frontend/DESIGN_SYSTEM.md and frontend/DESIGN_MIGRATION.md. Implement the next unchecked milestone on a feature branch. Match the approved Spindl Inventory Workspace reference: Linear-like precision in Spindl's purple/light palette. Preserve all existing backend interactions and business logic. Reuse the design-system components. Provide before/after screenshots, test results, and any remaining gaps.

## Avoid
- No wholesale App rewrite.
- No replacement of real data with fixtures.
- No new custom CSS for each feature.
- No tiny 8–10px labels or dense unreadable tables.
- No new design direction without explicit approval.
