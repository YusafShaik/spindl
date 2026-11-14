# Frontend architecture audit (migration status)

## Current inventory

- Bootstrap: `src/main.tsx` mounts `App` under React Strict Mode.
- The shell and module composition live in `src/App.tsx` (215 lines). Feature extraction has moved auth/session, team administration actions, overview, notification center, customer directory, product/inventory catalog, warehouse transfers, cycle counts, quality inspections, leads and pipeline studio, purchase/sales registers and dialogs, purchase requisition/reorder workflows, invoice/tax settings, invoice template designer, import/export, audit log, reports, workflow studio, plan usage/review, tenant settings/roles/support/branches/integrations, manufacturing, POS, attachments, record dialogs, and shared UI into feature modules. Business actions now live with purchasing, sales, inventory, import/export, record creation, auth, and team feature hooks.
- `src/styles.css` contains the global shell and component styling plus feature-specific styles (115 compressed lines).
- API access is mostly through `apiFetch`, with direct `fetch` reserved for public auth flows. Bearer-token attachment and 401 session clearing are centralized. Several sensitive workflows use idempotency keys; POS also persists a pending checkout locally to prevent duplicate charges.
- The API client now lives in `src/lib/api/client.ts`. Shared navigation, tenant module loading, tenant startup data, team and production loading, transaction filters, and formatters are in typed modules under `src/app/` and `src/lib/utils/`; domain contracts live in `src/types/`.
- Navigation is local state (not URL routing); module availability is fetched from `/tenant/modules` and role filtering is applied to Audit log.
- Session and access token are stored in local storage. `App` composes feature data hooks, action hooks, module panels, and modal state; feature panels and hooks own domain behavior.
- Runtime dependencies are React, Vite, Lucide React, and Recharts. TypeScript and React type packages are now pinned as development dependencies; lint and test scripts are still not configured.

## Baseline verification

- `npm run build` passes on the current checkout.
- Current build warnings: the minified JavaScript chunk is about 946 kB, exceeding the 500 kB advisory threshold, and Lucide's `use client` directives are reported by the bundler.
- `npm run typecheck` now passes for the strict TypeScript scope (`.ts`, `.tsx`, and declarations).
- Strictly typed modules include bootstrap and the entire application shell, API client, navigation and tenant module loading, tenant startup data loading, team and production data hooks, transaction filtering, formatters, shared transaction table, auth page, sidebar, overview dashboard/KPI, notifications, customer directory/custom-field editor, product/inventory catalog, warehouse transfers, cycle counts, quality inspections, leads and lead pipeline studio, team administration, manufacturing, POS checkout/register/refund workflows, sales/purchase registers and dialogs, purchase requisition/reorder workflows, invoice/tax settings and template designer, import/export, audit log, operational reports, saved report builder/scheduling, workflow studio, plan usage/review, tenant settings composition, tenant role administration, tenant and platform support access, tenant branches and integrations, attachments, and record dialogs, with domain contracts based on backend DTOs where mapped. There are no remaining `.js` or `.jsx` source files under `src/`; TypeScript's strict scope covers all source modules.
- No frontend tests or lint commands are configured, so workflow, accessibility, and style enforcement coverage is unverified.

## Critical workflow preservation map

| Workflow | Existing evidence | Verification status |
| --- | --- | --- |
| Registration, login, invitation acceptance, password reset | Public auth endpoints and local session storage in `features/auth/useAuthActions.ts` | Build/typecheck only; interaction unverified |
| Session expiry and logout | 401 event, token/session removal, logout endpoint in auth action hook | Build/typecheck only; interaction unverified |
| Role and module navigation | Role filter and `/tenant/modules` entitlement filter | Build/typecheck only; interaction unverified |
| POS checkout and refunds | Idempotency key, persisted pending intent, manager checks | Build/typecheck only; interaction unverified |
| Sales, invoicing, payments, credits, refunds | Sales action hook and dialogs | Build/typecheck only; interaction unverified |
| Inventory, warehouse movements, quality inspections | Inventory action hook, warehouse/cycle count and quality panels | Build/typecheck only; API workflow unverified |
| Purchasing and receiving | Purchase action hook, requisition and reorder workflows | Build/typecheck only; interaction unverified |
| Production | BOM, routing, work orders, and work centers in the typed manufacturing feature | Build/typecheck only; interaction unverified |
| Leads pipeline | Typed lead and activity DTOs; create, stage, activity, convert flows | Build/typecheck only; API workflow unverified |
| Customers, imports, reports, settings, audit, team | Existing feature panels and API calls | Build/typecheck only; interaction unverified |

## Constraints and risks

- The separately named authoritative UI/UX specification was not in the supplied bundle; the available Spindl design direction informed the design tokens and first shared UI improvements.
- The active branch is the user-created `v2` migration branch.
- TypeScript strict checking now covers the entire frontend source tree. `App.tsx` is a composition module, although its modal state and feature wiring remain centralized and could be further grouped in a typed modal controller.
- A pre-existing branch-loading defect was corrected during team extraction: `TeamPanel` referred to an undeclared `setSelectedBranchId`, causing its branch request to fail into the empty-list handler. The transaction register still calls `TransactionTable` without the `query` prop, so it intentionally displays all transactions while the dashboard provides text filtering.
- No backend changes were made. Existing API contracts and operation semantics should be captured before feature extraction.

## Suggested extraction order

1. Add contract and critical-workflow tests; the current repository has no test runner or test suite.
2. Complete browser-based desktop, tablet, mobile, keyboard, and accessibility checks.
3. Review bundle splitting and remaining DTO runtime validation.

## Reusable components and dependency decisions

- Reused/introduced: typed `Status`, `Sidebar`, `KpiCard`, `TransactionTable`, `CustomFieldEditor`, and a typed catalog/movement-history view. Existing panels continue using their established markup until they are extracted.
- Added TypeScript and React declaration packages only. These establish strict checking without changing runtime behavior. Radix, TanStack, React Hook Form, Zod, and a test runner were not added because network access and package cache availability did not permit a responsible dependency evaluation/installation in this pass.
- No API caching, retries, global state package, router, or authentication replacement was introduced.
