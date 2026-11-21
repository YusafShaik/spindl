# Platform access, customer customization, and manufacturing roadmap

Date: 19 November 2026. Status: proposed implementation design; application behavior has not been changed.

## 1. Product decision

Spindl controls the capabilities available to each customer. A customer Owner/Admin can activate and configure a subset of those capabilities. Employee roles control actions and record visibility inside that subset. These are independent controls.

Example: Spindl grants Customer A Catalog, Inventory, Production, and Quality. Their Admin enables Catalog, Inventory, and Production, leaving Quality off only if no quality-controlled operational state requires it. That Admin cannot activate POS, MRP, Maintenance, or another ungranted feature by changing roles, API requests, package names, or configuration.

Support a broad manufacturing product through shared foundations and optional industry capability packs. Do not represent the current application as ready for every manufacturing industry. Industry breadth requires domain development, transaction validation, and segment-specific acceptance scenarios beyond entitlement changes.

## 2. Current implementation and gaps

The review examined backend services, migrations through V81, frontend navigation/settings, and existing tests. It did not query live customer grants, run production business scenarios, or certify manufacturing/accounting compliance. `PRD_GAPS.md` is dated 14 November and predates newer manufacturing expansion; use source code rather than its old missing-MRP descriptions.

| Area | Existing behavior | Required change |
|---|---|---|
| Module controls | Twelve module records with `entitled` and `enabled`, dependency checks, and customer toggles | Separate platform authority from customer preferences and split bundled domains |
| Platform access | Billing/support email allowlists | Persisted platform staff roles, separate session context, audited administration |
| Plans | Hardcoded `modulesFor(planCode)`; applying plan overwrites entitlement | Versioned package templates applied through platform-approved access changes |
| Registration | Every module initially entitled/enabled under Trial | Foundation only plus an explicitly platform-assigned package/trial |
| Customer roles | Owner/Admin, Manager, Operator, Viewer, custom grants including wildcards | Capabilities must bound all roles; explicit Owner/Admin guard for capability administration |
| Navigation | Module fetch failure leaves `null`, which shows all navigation | Loading/error/ready state; deny navigation until capabilities resolve |
| Data loading | `useTenantData` fetches every domain in one `Promise.all`; one denied endpoint fails the entire load | Capability-aware domain loaders, independent errors, cancellation and stale-data clearing |
| Dashboard | Required Overview can query finance, inventory, sales and CRM data | Source capability, permission and scope checks per widget/metric |
| Reports | Report builder queries tenant-filtered sources without source access checks | Source-specific access and scope enforcement, including saved results and scheduled runs |
| Internal actions | MRP can create purchase/work orders through internal calls | Target capability and target action checks inside services |
| Testing | Three small existing test files | Dedicated PostgreSQL integration and representative customer-flow tests |

## 3. Authority and authentication

| Actor | Allowed responsibility | Boundary |
|---|---|---|
| `PLATFORM_ADMIN` | Grant/revoke customer capabilities; assign packages; set access validity; manage platform staff roles | Does not become a customer member or gain business-record access |
| `PLATFORM_BILLING` | Review commercial plan/package requests and approved access diffs | Cannot manage platform staff or override a platform restriction |
| `PLATFORM_SUPPORT` | Existing consented, time-limited diagnostics | No impersonation or unrestricted tenant-record browsing |
| Customer Owner/Admin | Activate/deactivate granted options, set allowed configuration, manage customer users/roles | Cannot write grants, extend validity, change package provenance, or assign platform roles |
| Customer custom roles | Business actions within granted, enabled capabilities | Wildcards never bypass capability checks; cannot acquire platform authority |

Platform membership belongs to a separate `platform_memberships` table keyed to existing user identities, not `tenant_memberships` or customer-customizable role codes. Check active platform membership in the database on each privileged action, so removal takes effect without waiting for JWT expiry.

Introduce platform-context authentication deliberately: existing `auth_sessions`, login, and JWT validation require `tenant_id`. Use a separate `platform_auth_sessions` store and `session_context=PLATFORM` tokens with a platform audience; retain tenant sessions with `session_context=TENANT`. The validator selects the appropriate session repository and rejects context/audience confusion. Platform-only staff must not need a fake customer workspace. Reuse password validation, throttling and account-active checks; do not accept arbitrary role claims. A platform token is rejected by tenant business routes and tenant API keys remain rejected by platform routes.

Add the exact public platform-login matcher before the generic `/api/**` authorization matcher. All other platform routes require platform context/audience; existing tenant `/api/auth/**` endpoints must reject platform tokens. Provide separate platform logout, session listing and revocation endpoints rather than reusing tenant-session assumptions.

Provision the first platform admin with a one-time audited deployment command targeting a verified existing staff user. Public registration never creates platform membership. Existing billing/support allowlists are imported only as their narrow corresponding roles after operator review, then retired. Protect staff administration against removing the last active platform admin. Customer password reset/profile APIs cannot alter platform membership.

## 4. Effective access model

For ordinary business actions:

```text
ALLOW = authenticated active identity/session
    AND active tenant membership (or explicitly defined service principal)
    AND tenant lifecycle permits this action
    AND valid platform capability grant
    AND customer preference enables the capability
    AND no reactivation-required latch blocks resumed operations
    AND effective parent and prerequisite capabilities
    AND employee action permission and supported record scope
    AND API token scope, when an API token is used
```

Feature access also requires its parent module. Missing grants, unknown capabilities, unmatched routes, and expired grants deny access. Platform roles are not operands that make tenant business access automatically true.

Foundation is a minimum platform-provisioned workspace capability: authentication, profile, basic membership/security administration, audit capture, essential system notices and a source-filtered workspace landing page. Customers cannot disable it; tenant suspension/closure still applies. Audit capture and stock/quality/accounting invariants are never optional paid features.

Keep user action permissions separate from product entitlements. Ordinary create/edit/approve/export remains RBAC; independent commercial features may impose an additional entitlement. Do not turn every button into a separately sold module.

### Ownership of state

| State | Writer | Meaning |
|---|---|---|
| Platform grant | Platform access service | Maximum capability availability and validity |
| Customer preference | Customer settings service, Owner/Admin only | Desired activation within that ceiling |
| Configuration | Customer service validated against capability-specific schema | Workflow thresholds, fields, templates and supported settings |
| Role permission | Customer role service | Who can do what within effective capabilities |

Customer catalog/settings, role editor, API scope picker, report sources and configuration choices list only granted capabilities. A separate marketing catalog may advertise other products, but it is not a configurable capability endpoint. Historical references to a removed capability may be labeled unavailable without exposing its data or controls.

## 5. Data design and package policy

Use a shipped, version-controlled catalog with stable codes, `MODULE|FEATURE|FOUNDATION`, parent, dependencies, configuration schema version, customer-toggle flag, default preference, and availability (`AVAILABLE|PREVIEW|PLANNED`). Only implemented, releasable capabilities can be granted. Validate acyclic dependencies and complete route mappings at build/startup. The platform chooses capabilities; it cannot invent working modules through a text field.

Proposed persistence:

| Table | Main fields |
|---|---|
| `platform_memberships` | user, platform role, active, created/revoked by, timestamps |
| `platform_auth_sessions` | session, user, expiry, revoked timestamp, source hash |
| `tenant_access_revisions` | tenant, monotonic revision/version, updated by/at |
| `tenant_capability_grants` | unique tenant/capability, allowed/denied, valid-from/until, source kind, package version, actor, reason |
| `tenant_capability_preferences` | unique tenant/capability, desired-enabled, activation-required, version, updated by/at |
| `tenant_capability_configurations` | tenant, capability, schema version, configuration JSON, version, draft/published where needed |
| `package_versions` / `package_capabilities` | package code/version, included capabilities and limits |
| `tenant_package_assignments` | tenant, approved package version, effective date, approving actor/request |
| `platform_audit_events` | actor/context, target tenant, action, before/after, reason, access revision, correlation ID, timestamp |

Grant rows are the authoritative materialized access ceiling. Packages are versioned templates used to propose grant diffs, not an independent runtime permission path. A package revision or billing webhook cannot add access by itself. An approved assignment applies an explicit diff atomically; preserve explicit platform denials/overrides and customer-off preferences. The initial release need not maintain competing live package and override evaluators.

A package-generated capability must be distinguishable from a manual grant. Replacing a package removes only superseded package grants, preserves approved exceptions, and never removes a manual denial. An admin must explicitly review a diff that changes those exceptions. Package quotas continue to use existing seat/storage/API metering; capability changes do not reset usage.

Use explicit source kinds `PACKAGE_ALLOW`, `MANUAL_ALLOW`, `MANUAL_DENY`; retain denial tombstones when a package removes a capability. Billing package application may touch only package-origin rows. Only Platform Admin can explicitly change a manual override through the grant endpoint. Bind each approval to the normalized exact diff, catalog version, tenant access revision and target package version. Scheduled application or billing webhook execution refuses stale approvals and requires a new preview/review; it never recomputes a broader diff and treats it as previously approved.

For a newly granted optional capability, create a customer-off preference unless the platform grants it together with an explicitly requested activation during onboarding. Adding code/catalog entries defaults to ungranted. An intentionally broad trial is an explicit, expiring platform assignment, never the automatic registration behavior.

## 6. Proposed module catalog

These are target boundaries, not claims that every domain is already independent or production complete.

| Stable target code | Business module | Existing implementation | Optional features / separation work |
|---|---|---|---|
| `crm` | Customer relationships | Customers, leads, activities, conversion, pipeline | Lead management, pipeline designer, merge; shared party references must work without selling full CRM |
| `catalog` | Product catalog | Items, types, units, prices | Bulk maintenance; dimensional/UOM model needs strengthening |
| `inventory` | Inventory | Stock, reservations, movements, adjustments, warehouses, transfers, counts | Multiwarehouse, cycle counts; preserve stock invariants across all callers |
| `sales` | Sales | Quotes, orders, dispatch | Approval policies; service/nonstock operation needs separate validation |
| `purchasing` | Procurement | Suppliers, requisitions, POs, receipts/returns | Approval policy; shared supplier references separate from full procurement UI |
| `receivables` | Customer billing | Invoices, payments, tax settings, credits/refunds | Extract from Finance with compatible permissions |
| `payables` | Supplier accounting | Supplier bills, payments, credits | Extract from Finance; receipt/PO matching depth needs validation |
| `accounting` | General Ledger | Accounts, journals, trial balance, P&L, balance sheet, limited sync | Period controls, reconciliation and production postings need work |
| `pos` | Point of sale | Registers, shifts, tenders, checkout, variance, refunds | Separate from Sales; preserve tax, stock, customer and billing service dependencies |
| `logistics` | Delivery management | Challans, packaging, tracking, proof of delivery | Separate from Sales; currently sales-order/warehouse linked |
| `production` | Production execution | BOMs/revisions/alternates, routings, centers, work orders, material/output, job cards, scrap/rework/byproducts, operational costs | Keep one coherent production workflow; optional advanced costing/execution features |
| `planning` | Planning / MRP | Runs, shortage recommendations, explosion viewer, weekly projections, PO/WO conversion | Date netting/recursive recommendation engine incomplete; authorize each conversion target |
| `engineering` | Engineering / ECO | ECO, BOM comparison, sign-offs, implementation | Separate from Manufacturing; not a complete PLM system |
| `quality` | Quality control | Inspection requirements, holds, lots, pass/fail, release/reject | Advanced QMS/specifications/CAPA/traceability require development |
| `maintenance` | Asset maintenance | Assets, schedules, meters, maintenance work, downtime, spares | Standalone core; optional Inventory spares and Production center links; fix stock consumption first |
| `workforce` | Shop-floor workforce | Skills/qualifications, shifts, roster, attendance, skill-check API | Optional production qualification enforcement; not full HR/payroll |
| `analytics` | Analytics | Operational/saved reports, filters, grouping, metrics, schedules | Builder/scheduling entitlements; datasets require source access and row scopes |
| `integrations` | Integrations and data | Scoped API tokens, signed/retryable webhooks, imports | API, webhooks and individual import families; imports require destination capability |

Cross-cutting feature codes belong under their owners: `crm.pipeline_designer`, `inventory.multiwarehouse`, `planning.convert_to_purchase`, `planning.convert_to_production`, `analytics.report_builder`, `analytics.scheduling`, `integrations.api`, `integrations.webhooks`. Advanced custom roles, branch administration and custom fields can be granted foundation extensions, while basic security administration stays available. Templates and workflows must be scoped to their business domain rather than unlocked globally by Finance.

Returns, quality release, reversals, reconciliation and other integrity controls cannot be disabled in a way that makes existing transactions impossible or bypasses a required control. An entitlement may limit creating a new process; it must not silently weaken historical obligations.

## 7. Dependencies and safe change behavior

Initial dependencies preserve today's working stock flows: Inventory -> Catalog; stock Sales/Procurement -> Catalog + Inventory; Production -> Catalog + Inventory; ECO -> Production. Keep current Planning -> Production compatibility until its calculation dependencies are explicitly refactored. Its PO conversion additionally requires Procurement/create and its WO conversion Production/create. Logistics initially needs Sales + Inventory. POS initially needs Catalog + Inventory and shared tax/customer/billing services; splitting the UI alone does not make it standalone.

Long-term, dependencies should be conditional integrations: Maintenance core -> Foundation, spare consumption -> Inventory, center link -> Production; Workforce core -> Team; AR/AP/GL source connectors -> relevant source capabilities; Analytics -> each selected dataset. Shared party identity, tax primitives, UOM and stock invariants should be internal services, not accidental grants of whole commercial modules.

Every change has a preview: changed grants/preferences, prerequisite closure, affected screens/jobs/connectors, open business state, retained records and access revision. Customer toggles reject an ungranted prerequisite instead of silently granting it. Customer parent-disable normally blocks until dependent selections are disabled; an explicit bulk change can disable the shown set atomically.

Platform revocation must always be possible, including urgent security revocation. Preserve preferences/configurations and records, but effective access and dependent capabilities stop immediately for subsequent authorized work. Do not silently enable dependents on a later regrant; present an activation preview and require customer confirmation when operational state or saved selections would reactivate suspended processing. Ordinary customer disable validates open WIP, reservations, holds, shifts, schedules and transactions before applying. Never release quarantined stock merely because Quality is switched off. Resolve state or grant a separately authorized, audited completion capability; do not leave a generic bypass.

Implement that distinction explicitly: preserve `desired_enabled`, but set an `activation_required` latch on revoked capabilities and affected dependents. Regrant restores availability while the latch keeps them inactive until an authorized customer activation preview/apply clears it. Jobs/connectors have their own paused state and do not resume merely because availability returns.

Use optimistic access revision/ETag and a per-tenant lock for grant/preference/dependency changes. Business side effects recheck effective access at the transaction boundary using the same lock ordering or revision protocol as revocation. Define the guarantee: work committed before revocation remains valid; new work cannot commit against a revoked revision. Long jobs recheck before publishing a result or dispatching an external event. External events already delivered cannot be recalled.

No implicit historical read/export after revocation. Retain data; any customer offboarding export or completion exception needs an explicit capability and source permission. Report snapshots, download URLs and cached results must not remain an alternate access route.

## 8. APIs and user experience

Suggested contracts (final naming may follow repository conventions):

| Context | API | Behavior |
|---|---|---|
| Platform | `POST /api/platform/auth/login` | Staff authentication; platform-context session |
| Platform | `GET /api/platform/me` | Server-resolved staff permissions |
| Platform | `GET /api/platform/customers` | Searchable tenant summaries; no business records |
| Platform | `GET /api/platform/customers/{id}/access` | Grant/preference/effective matrix and revision |
| Platform | `POST /api/platform/customers/{id}/access/preview` | Validate bulk change and show impact |
| Platform | `PATCH /api/platform/customers/{id}/access` | Versioned bulk grant change, mandatory reason, audit |
| Tenant | `GET /api/tenant/capabilities` | Granted customer options with desired/effective state and dependency reasons |
| Tenant | `GET /api/tenant/access` | Current user's usable capabilities/actions for navigation |
| Tenant | `POST /api/tenant/capability-preferences/preview` | Show activation/deactivation consequences |
| Tenant | `PATCH /api/tenant/capability-preferences` | Owner/Admin only, subset validation, revision |

The platform console is separate from customer Settings. Customer list -> access detail -> select shipped modules/features -> preview -> apply. Show platform-granted availability, customer activation and effective state distinctly so support can explain access without impersonation.

Customer Settings shows only supplied modules and their supplied optional features. Controls offer activation/configuration; required foundations are labeled. Dependency/error explanations mention only relevant granted options. The employee role editor cannot assign hidden product capabilities, and wildcard grants still stop at the same ceiling.

Frontend access resolution has explicit `loading`, `ready`, `error` states. Gate routes, sidebar, dialogs, direct links, create actions, search and data loaders. A 403 or access revision change clears stale domain data, cancels in-flight fetches, refreshes capabilities and moves an unavailable screen to the workspace landing page. Do not keep the current all-domain fetch on login.

Server failures use stable codes such as `CAPABILITY_NOT_GRANTED`, `CAPABILITY_DISABLED`, `CAPABILITY_EXPIRED`, `DEPENDENCY_DISABLED`, `ACCESS_REVISION_CONFLICT`, `OPEN_STATE_BLOCKS_DISABLE`. Avoid disclosing another tenant's existence through errors.

## 9. Enforcement beyond route checks

Implement one `EffectiveCapabilityService` / policy resolver used by route authorization and domain services. Retain resource/action RBAC mappings during the first migration; entitlement codes and legacy permission codes need not be renamed in one release. Cross-module actions must authorize the target operation, not just the source screen.

Review these paths explicitly:

- Dashboard summary, trend and alerts: filter metrics by source capability, resource permission and row scope; unavailable data is omitted, not queried then hidden.
- Reports: source discovery, saved definitions, run/export, grouped metrics, scheduled execution and saved history. Schedule runs use an explicit owner/service principal, revalidate current membership, source scopes and entitlements, and pause on revoke. Viewing snapshots also requires current source authorization.
- A stored report snapshot may contain rows allowed under an old broader scope. If current row/field authorization cannot be proven for every included row, rerun under current scope or deny the snapshot; a source-module check alone is insufficient.
- MRP conversion: Procurement/create or Production/create inside the conversion transaction.
- GL sync, workflow execution and event handlers: require authorized connectors and preserve posting invariants. Store explicit tenant/principal context for background work.
- API tokens: granted integration feature + source capability + current issuer role/scope; ungranted scopes cannot be issued or used.
- Imports/custom-field CSV, attachments, document render/export and search: destination/source capability and record authorization.
- Webhooks: creation, delivery/replay and payload fields respect integration/source grants; revocation suppresses future delivery and requires audited recovery.
- Foundational audit capture, quarantine enforcement, reservation integrity, idempotency and ledger consistency remain internal invariants even when their management UI is unavailable.

## 10. Manufacturing capability and gap roadmap

### Shared industry foundations

Existing Production is substantive: BOM lifecycle, alternates, routings, execution, materials, outputs, job cards and operational costs. Existing expansion modules have services and persistence; that alone does not demonstrate complete industry readiness.

| Priority | Code-backed finding | Required work |
|---|---|---|
| P0 tenant isolation | GL journal account and parent-account references use global ID lookups without checking tenant ownership | Tenant-scoped lookups, matching-tenant database constraints and crafted-ID integration tests before Accounting rollout |
| P0 stock correctness | Warehouse sales/transfer `reserve()` excludes quality holds but omits manufacturing reservations from availability | One availability invariant across sales, transfers, production and maintenance; locked concurrent-reservation tests |
| P0 correctness | Maintenance can save consumed parts/completion while skipping missing/insufficient stock; decimal quantities are truncated | Atomic validated/idempotent inventory consumption; consistent warehouse/item aggregates; fail or explicit authorized exception |
| P0 access/integrity | MRP conversions bypass target route checks; PO conversion lacks locked recommendation/deterministic idempotency; Quality holds may be created regardless of whether Quality management is enabled | Target service authorization, database-backed conversion uniqueness and safe disable/revoke policy |
| P1 planning | MRP aggregates open demand without using horizon for dated netting; fixed manufactured lead time; first supplier; estimate `unitPrice * 0.40` | Demand dates, time buckets, pegging, recursive planned-demand explosion, approved sourcing, realistic item lead times/lot sizing/cost basis |
| P1 quantities | BOM/material/output quantities are largely integers; unit is a string | Decimal quantities, typed units, conversion precision/rounding, transactional migration across stock/sales/purchasing/production |
| P1 traceability | Quality lots represent inspections/holds, not component-to-finished-output inventory genealogy | Inventory lot/serial identity across receipt, transfer, issue, production, dispatch and return; recall trace |
| P1 workforce | Skill/expiry verification exists but job assignment/start does not invoke it | Configurable mandatory qualification checks at execution; safe expiry/override policy |
| P1 accounting | Operational production costs exist; account names do not establish manufacturing GL postings | Valuation policy; material -> WIP, labor/overhead absorption, FG receipt, scrap/variance, reversals and reconciliation |
| P1 commercial posting | GL sync reads invoice/bill sources without document-state eligibility/source-grant checks, uses today's date/fixed mappings; POS sync is not implemented despite a result counter | Authorized source connectors, original posting rules, configurable account mappings, unique posting references and reversal/reconciliation scenarios |
| P1 engineering | ECO implements new BOM revision through its own path | Verify routing preservation and shared BOM cycle/alternate/effectivity/approval invariants |
| P2 capacity | Queues/routing estimates exist; finite calendars/reservations not established | Resource calendars, maintenance/shift availability, finite scheduling and feasible rescheduling |
| P2 quality | Pass/fail quantities exist; full QMS not found | Specifications/tolerances, sampling, in-process checks, NCR/CAPA, calibration and supplier corrective actions |

### Industry capability packs

Packs are package templates combining modules and genuine industry features, not separate copies of the ERP. Customers may receive multiple packs. Industry rules use typed configuration/extensions, not arbitrary customer-authored code.

| Manufacturing family | Shared base | Essential additional capabilities | Current readiness |
|---|---|---|---|
| Discrete / assembly | Catalog, Inventory, Production, Quality | Serial/lot genealogy, revision-controlled instructions, stronger capacity/cost reconciliation | Closest fit; important gaps remain |
| Repetitive / high-volume | Discrete base + Planning | Line/takt/rate planning, repetitive schedules, replenishment/Kanban, scrap/yield feedback, OEE/data capture | Specialized depth not established |
| Make-to-order / job shop / engineer-to-order | Sales, Engineering, Production, Planning | Customer/job/project pegging, job estimating and actual cost, milestones, subcontract operations, drawings/revision delivery | Core workflows reusable; vertical features need development |
| Process / batch: food, chemicals, materials | Decimal/UOM inventory, Quality, batch Production | Formulations, batch scaling, yield/loss, co-products, potency/concentration as needed, expiry/FEFO, allergen/hazard metadata, batch genealogy | Requires material quantity and execution model expansion |
| Regulated pharma / medical / aerospace | Relevant production pack + advanced Quality/traceability | Controlled records/instructions, change control, training, calibration, validated approvals/e-signature where applicable, retention/recall and sector-specific evidence | Not established; requires dedicated validation and jurisdiction/customer-specific requirements |

This matrix is an engineering scope proposal, not a compliance certification or a claim that a generic pack satisfies every industry. Full payroll, universal process recipes, MES/IoT and multi-country regulatory compliance are separate initiatives.

## 11. Implementation sequence and review gates

### Phase A — inventory and policy contract

Create a route/job/dataset/feature inventory and dependency graph; stabilize module/feature codes and shared-service boundaries. Reconcile current tenant access from persisted records and capture a migration fixture set. Write the decision matrix and disable/revocation behavior before runtime changes. This document provides the design; implementation begins with this inventory and the first vertical slice.

Exit: every existing API route, internal conversion, job, data source and screen has an owner capability; no new grants implied by catalog membership.

### Phase B — platform authority using the current twelve modules

Add platform staff/session administration, authoritative grants/preferences/audit and central resolver. Stop automatic broad Trial registration. Add platform customer access preview/apply and customer subset controls. Make plan changes propose/apply reviewed diffs. Fix dashboard/report source checks and capability-aware frontend loading in this release; these are boundary requirements, not later polish. Address the confirmed GL tenant-reference issue and reservation/maintenance stock correctness in focused corrective changes before affected flows are released more widely.

Exit: platform can grant Customer A only Catalog/Inventory, and that customer's Owner/custom wildcard/API token cannot access Sales, Manufacturing or platform APIs. Customer A's allowed screens load normally with denied modules absent. Customer can turn supplied options off/on without changing grant ownership.

### Phase C — extract existing business domains

Separate POS, Logistics, Planning, Engineering, Maintenance, Workforce, Analytics and Integrations incrementally. Preserve legacy RBAC/resource aliases while introducing finer capability gates. Fix Maintenance stock integrity before exposing its split as a production offering. Add service-level cross-module checks and safe operational-state handling.

Exit: module combinations work end to end; disabling Quality preserves holds; MRP cannot create orders in a denied target module; scheduled work respects current access.

### Phase D — finance and feature refinement

Split Finance into Receivables, Payables and GL with explicit source connectors; remove the blanket requirement that Finance includes both Sales and Procurement only once actual standalone flows are validated. Add advanced feature entitlements and schema-validated customer configuration. Pricing/package names remain commercial decisions; no prices are invented in this plan.

Exit: supported AR/AP/GL combinations reconcile; templates/workflows/report data respect domain grants; role/API compatibility is tested.

### Phase E — manufacturing foundations and industry expansion

First correct MRP, qualifications, quantity/UOM, traceability and costing foundations. Then deliver industry packs with their own representative acceptance flows. Decimal/UOM and genealogy precede serious process/batch or regulated claims. Run cross-industry pilots rather than enabling unimplemented pack labels.

Exit: each released pack has domain acceptance evidence, documented limits and customer configuration schemas. Universal manufacturing coverage is the long-term product direction, not the exit criterion for the first access-control release.

## 12. Migration, rollout and verification

- Add new migrations after the current V81 only after checking the branch at implementation time; do not edit applied migrations.
- Backfill current grants from actual persisted `entitled`, preferences from actual `enabled`, and preserve source/plan metadata. Do not infer entitlement from plan name or default-enable rows.
- For extracted domains, derive grants AND preferences from the old parent's persisted state; mark provenance as a legacy migration. Current hidden/disabled access must remain hidden/disabled. New capabilities with no old equivalent default denied/off.
- For newly restricted cross-domain reporting/dashboard data, intentional security tightening may reduce visibility. List these differences in reconciliation instead of treating every old allow as behavior to preserve.
- During compatibility, dual-write legacy fields and new records transactionally; run a non-authorizing shadow comparison and investigate mismatches. Before splitting codes, ensure old binaries cannot broaden access through old plan/init paths.
- Cut over in controlled cohorts with database snapshots, reconciliation and rollback rehearsal. A rollback may restore application routing but must not re-enable the old blanket grants or bypass newly revoked access. Forward-fix schema where dropping data would lose grants/audit.
- New optional code deployments do not alter any customer's grants. Package updates require an explicit approved diff.

Required tests (meaningful integration coverage, not just UI visibility):

1. Platform Admin grants/revokes access; Billing/Support cannot exceed their responsibilities; last-admin protection and staff removal invalidate privilege.
2. Customer Owner/Admin cannot call platform APIs, self-grant, extend expiry, assign platform roles or override restrictions via custom wildcard roles.
3. Platform-only sessions work; tenant and platform session contexts cannot be exchanged; API keys cannot access platform administration.
4. Missing/expired grants, customer-off state, denied parent, disabled dependency, unknown capabilities and unmatched APIs deny by default.
5. Cross-tenant IDs, attachments, imports, token scopes, direct links and forged JSON remain bounded by the active tenant and access ceiling.
6. Dashboard, report datasets, CSV exports, grouped metrics, scheduled jobs and existing saved snapshots do not reveal denied domains or unauthorized record scopes.
7. Package upgrades/downgrades preserve manual denials and customer-off preferences; adding a catalog entry grants nobody access.
8. Concurrent grant/preference changes return a revision conflict; revoke-versus-side-effect tests prove the defined transaction ordering.
9. Customer disable checks open holds/WIP/reservations and never silently frees stock; regrant does not silently restart paused external processing.
10. Capability fetch failure shows an error/retry; an Inventory-only customer does not get an offline app because Sales returns 403; stale data is cleared after revoke.
11. PostgreSQL migrations against fresh and representative existing tenants preserve access and data; rollback does not restore revoked grants.
12. Representative business flows: inventory-only; CRM + reporting; stock commerce; Production without MRP; MRP without purchase-conversion permission; Maintenance with/without spares integration; Quality holds after disable/revoke.
13. Transaction correctness: cross-tenant GL account IDs rejected; simultaneous MRP conversions create one target order; sales/transfer reservations cannot consume manufacturing-reserved stock; maintenance completion rolls back on invalid consumption; GL sync excludes ineligible documents and reconciles dates/reversals.

## 13. Evidence and research

Repository evidence (relative to this repository root):

- Access/plan/identity: `src/main/java/si/spindl/identity/{TenantModuleEntitlementService,TenantModuleEntitlementEntity,TenantPermissionAuthorizationManager,TenantRoleService,SubscriptionQuotaService,TenantPlanChangeRequestService,AuthService,AuthSessionEntity,TenantApiTokenService}.java`.
- Session/token boundary: `src/main/java/si/spindl/config/{SecurityConfig,TenantApiTokenFilter}.java`; tenant context: `src/main/java/si/spindl/tenant/DevelopmentTenant.java`.
- Hidden data paths: `src/main/java/si/spindl/dashboard/DashboardController.java`; `src/main/java/si/spindl/reports/{ReportBuilderService,SavedReportScheduleService}.java`.
- Manufacturing and ERP integrity: `src/main/java/si/spindl/manufacturing/{WorkOrderService,BomService,ManufacturingDtos}.java`; `mrp/MrpService.java`, `quality/{QualityService,QualityLotEntity}.java`, `maintenance/MaintenanceService.java`, `workforce/WorkforceService.java`, `engineering/EngineeringService.java`, `gl/GeneralLedgerService.java`, `catalog/WarehouseStockEntity.java` under the same package root.
- Frontend: `frontend/src/app/{navigation,useTenantModules,useTenantData}.ts`, `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/features/settings/{TenantSettingsPanel,TenantRolesPanel}.tsx`.

Primary-source benchmarks inform the proposed design, rather than proving Spindl functionality:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html): least privilege, default denial, authorization on every request, and authorization tests.
- [Stripe Entitlements](https://docs.stripe.com/billing/entitlements): product-feature access can be granted/revoked independently of customer UI preferences; adopting Stripe is not required.
- [Microsoft finite capacity planning](https://learn.microsoft.com/en-us/dynamics365/supply-chain/master-planning/planning-optimization/finite-capacity) and [operations resources](https://learn.microsoft.com/en-us/dynamics365/supply-chain/production-control/operations-resources): benchmarks for capacity-aware manufacturing scheduling.
- [Odoo manufacturing lot/serial workflow](https://www.odoo.com/documentation/master/applications/inventory_and_mrp/manufacturing/workflows/manufacture_lots_serials.html): benchmark for production traceability beyond inspection holds.
- [Odoo master production schedule](https://www.odoo.com/documentation/master/applications/inventory_and_mrp/manufacturing/workflows/use_mps.html): benchmark for forecast-driven production planning.

Prepared from independent access/research, ERP business/module, manufacturing-industry, and ERP integration reviews, synthesized against the source tree. No production access settings were changed.
