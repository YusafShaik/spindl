# Spindl UI adoption plan — preserve existing screens

## Mission
Implement the Spindl Precision Design System on the **existing** ERP UI. This is a styling/component adoption project, **not** a screen recreation, product redesign, or information-architecture project.

**Existing feature JSX, props, hooks, labels, sections, data, and workflows are authoritative.** No reference mockup may replace them. Follow `AGENTS.md` and the strict typography table in `frontend/DESIGN_SYSTEM.md`.

## Current codebase landmarks
- React + TypeScript + Vite: `frontend/`
- App composition and navigation: `frontend/src/App.tsx`
- Existing shared stylesheet: `frontend/src/styles.css`
- Existing feature implementations: `frontend/src/features/`
- Existing API clients and types: `frontend/src/lib/`, `frontend/src/types/`
- Semantic design tokens: `frontend/src/design-system/tokens.css`

Inspect the latest code before acting; these paths describe the baseline, not a license to rewrite them.

## Milestone A — inventory current UI patterns (NO visual changes)
1. Identify existing buttons, inputs, tables, status indicators, filters, dialogs, and layout patterns.
2. Record current typography sizes and inconsistent styles.
3. Produce a mapping from existing CSS/components to proposed semantic design-system components.
4. Record business and UI contracts for any feature that will later be migrated.
5. Do not edit production screens.

**Deliverable:** audited component map and a prioritized migration plan. No app redesign.

## Milestone B — isolated design-system playground (NO production UI changes)
1. Integrate Tailwind CSS v4 in a way that does not reset or override existing application styles. Carefully isolate Tailwind preflight; verify no regression in existing pages.
2. Implement shared tokens and semantic typography utilities from `DESIGN_SYSTEM.md` **exactly**.
3. Build a small, reusable set of components based on actual Spindl UI needs.
4. Expose an isolated development-only playground entry point; do not add new production navigation.
5. Demonstrate component variants and states using sample data only in the playground.
6. Verify the current app still looks and behaves the same.

**Deliverable:** playground + components + typecheck/build/test results. Stop for visual review.

## Milestone C — migrate one existing UI region per PR
1. Choose a single existing region (e.g., a table toolbar or a form section); do not redesign an entire module.
2. Record the region's existing headings, fields, labels, controls, action handlers, data sources, and behavior.
3. Replace only its presentation with shared design-system components.
4. Preserve every field and action; keep existing data and API integration unchanged.
5. Test the region, including keyboard and responsive behavior.
6. Capture before/after screenshots of the same region and check typography against the strict role table.
7. Stop for review. Do not automatically migrate the next region.

**Deliverable:** one small, reversible PR with a before/after screen contract.

## Milestone D — extend adoption gradually
After successful review, apply the same components to other existing regions across all ERP modules. Maintain a migration ledger showing migrated regions and remaining legacy styles. Remove old CSS only after proving no other screen depends on it.

## Forbidden shortcuts
- Recreating Inventory or any other screen from a demo/mockup.
- Replacing real business sections with visually attractive invented sections.
- Removing, hiding, renaming, or moving existing fields/actions to fit a layout.
- Refactoring backend, API, permissions, calculations, or workflow handlers as part of UI migration.
- Replacing the global stylesheet wholesale or allowing Tailwind preflight to change unrelated screens.
- Shrinking table fonts below 14px or meaningful text below 12px.
- Changing multiple modules in one PR.
- Automatically merging a UI PR.

## Validation
From `frontend/`:
```bash
npm install
npm run typecheck
npm run build
```
Also run relevant automated tests and manually verify affected workflows. Do not claim validation without execution.

## Agent task prompt — Milestone B only
> Read AGENTS.md, frontend/DESIGN_SYSTEM.md, and frontend/DESIGN_MIGRATION.md. Implement **only Milestone B**: an isolated design-system playground and shared primitives. Strictly follow the semantic typography table (14px body/table/input, 12px minimum meaningful text). Existing screens and workflows are authoritative and must remain unchanged. Do not recreate any screen, alter App.tsx, rewrite styles.css, or add production navigation. Prevent Tailwind resets from affecting existing UI. Run typecheck/build, document tests and screenshot evidence, and open an unmerged PR for review. Stop after Milestone B.
