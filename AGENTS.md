# Spindl frontend agent instructions

## Design mandate
Spindl is a professional, data-intensive ERP. The approved reference is the Linear-inspired Inventory Workspace prototype (2026-11-15). Treat it as the quality benchmark: restrained composition, clear hierarchy, dense but legible tables, subtle separators, purple used sparingly, fast contextual workflows. Do not create generic SaaS dashboard cards, decorative gradients, giant headings, tiny labels, or arbitrary visual variants.

## Required reading before frontend changes
1. `frontend/DESIGN_SYSTEM.md` — tokens, component rules, templates and acceptance criteria.
2. `frontend/DESIGN_MIGRATION.md` — migration order and business-logic boundaries.
3. `frontend/src/design-system/tokens.css` — approved semantic token definitions.
4. Relevant existing feature component and hooks.

## Engineering rules
- Use React + TypeScript + Tailwind CSS v4 for new/reworked UI. Keep reusable primitives in `frontend/src/design-system/`; domain logic remains in `frontend/src/features/`.
- Never duplicate a shared Button, Input, Badge, Table, Drawer, or PageHeader inside a feature.
- Never hardcode brand colors, radii, typography, or shadows in feature components. Use semantic tokens.
- Body and table text: generally 14px; metadata 12px minimum. No 8–10px operational text.
- Numeric cells use tabular numerals and right alignment. Preserve semantic status text in addition to color.
- Keyboard navigation, focus visibility, reduced motion, loading, empty, error, and disabled states are required.
- Avoid modifying backend API contracts, tenant isolation, authorization, business calculations, exports, or existing action handlers when performing visual migration.
- Never replace real API data with mock data in production modules. Sample data belongs only in the component playground.
- Prefer small, independently reviewable PRs; never rewrite the entire application in one untested patch.
- Run `npm run typecheck` and `npm run build` in `frontend/` after code changes. Add automated component tests as the library matures. State explicitly when checks were not run.

## Definition of done
A feature uses shared components, passes keyboard and responsive checks, preserves workflows, has meaningful loading/empty/error states, and visually matches the approved Inventory Workspace. Include screenshots of before/after and a checklist in each UI PR.
