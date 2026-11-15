# Spindl — mandatory frontend agent instructions

## Primary mandate: ADOPT THE DESIGN SYSTEM; DO NOT RECREATE SCREENS

Spindl is an existing functional enterprise ERP. The existing React feature components and business requirements are the **only source of truth** for which screens, sections, fields, labels, actions, tables, columns, filters, navigation items, and workflows exist.

Your job is to improve **presentation and usability** using a coherent, restrained, Linear-inspired design language with Spindl's own purple identity. Linear is a quality reference for visual rigor, NOT a template for layout, screen content, or feature behavior.

**Never use a standalone prototype, example screen, screenshot, or demo as a specification for what production screens must contain.** Do not recreate Inventory or any other module. Do not invent KPI cards, delete columns, replace workflows, move features between screens, or change information architecture merely to match a reference.

## Required reading, in order
1. This file.
2. `frontend/DESIGN_SYSTEM.md` — **normative typography and component rules**.
3. `frontend/DESIGN_MIGRATION.md` — scope restrictions and migration gates.
4. `frontend/src/design-system/tokens.css` — semantic tokens.
5. The *actual* feature JSX, types, hooks, API actions, and related styles before editing.

If these documents conflict, preserve production behavior and the existing screen's content first; follow the strict typography table second; ask for clarification rather than guessing.

## Hard rules for every UI task

1. **Preserve the screen contract:** retain existing headings, fields, columns, data bindings, labels, navigation, filters, buttons, exports, permissions, validation, error handling, and workflows unless the user explicitly requests a functional change.
2. **No redesign by substitution:** do not replace an existing screen with a new mockup, sample data, or a different screen structure.
3. **Typography is non-negotiable:** follow the exact role-based type scale in `frontend/DESIGN_SYSTEM.md`. No arbitrary `text-[...]`, inline font sizes, 8–11px operational text, or shrinking font sizes to fit. Metadata minimum 12px; body and data tables 14px.
4. **Design system before migration:** build shared components in `frontend/src/design-system/`; feature modules compose them. Do not clone primitives in individual features.
5. **No global blast radius:** never replace `frontend/src/styles.css`, apply broad element selectors to existing pages, or change the app shell during an isolated component task. Scope new styles to the design-system playground until reviewed.
6. **No business changes:** preserve backend contracts, authentication, tenant isolation, permissions, state management, data calculations, stock movements, exports, and action handlers.
7. **Small, reversible changes:** one isolated milestone per PR. Do not install tooling, redesign the sidebar, migrate multiple screens, and refactor business logic in the same PR.
8. **Accessible and legible:** keyboard/focus support, semantic statuses, readable contrast, tabular numerals, responsive tables, and meaningful empty/loading/error states.
9. **Stop instead of improvising:** if a proposed visual change requires deleting, moving, or changing a field/action, stop and ask for approval.
10. **Evidence:** run `npm run typecheck` and `npm run build` from `frontend/`; test affected workflows; report what was and was not verified. Never merge automatically.

## Required before/after screen contract for feature migration
Before modifying a feature, record its current:
- Sections and their order.
- Field labels and table column headers.
- Actions, menus, filters, exports, and pagination.
- Data sources, loading/empty/error states, permissions, and responsive behavior.

After modification, compare against that inventory. **Any missing or changed entry is a regression unless explicitly approved.**

## Required PR checklist
- [ ] No screen or workflow recreated, removed, or invented
- [ ] Existing screen contract preserved (before/after inventory included)
- [ ] Exact typography scale applied; no operational text below 12px
- [ ] Shared tokens/components used; no ad hoc style system
- [ ] No unreviewed global CSS or app-shell changes
- [ ] Keyboard, responsive, loading, empty, and error states reviewed
- [ ] Typecheck/build and affected tests executed; results reported
- [ ] Screenshots of the **existing screen before and after**, not a substitute screen
- [ ] PR remains unmerged pending human review
