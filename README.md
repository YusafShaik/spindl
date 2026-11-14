# Spindl local development

## Current backend slice

- Spring Boot connects to PostgreSQL using `SPINDL_DB_URL`, `SPINDL_DB_USERNAME`, and `SPINDL_DB_PASSWORD`. Persistence uses Spring Data JPA repositories, JPQL and transactional services.
- The Boot Flyway starter runs database migrations before Hibernate schema validation.
- Flyway creates the initial tenant, customers, and item catalog tables and inserts the Northstar development records.
- V2 is an idempotent repair migration for local databases that were previously baselined at V1 before the catalog tables existed; it creates missing tables and seed rows without dropping existing data.
- `GET /api/customers`, `POST /api/customers`, `PUT /api/customers/{id}`
- `GET /api/items`, `POST /api/items`, `PUT /api/items/{id}`
- `GET /api/suppliers`, `POST /api/suppliers`
- `GET /api/purchase-orders`, `GET /api/purchase-orders/{id}`, `POST /api/purchase-orders`
- `GET /api/purchase-requisitions`, `POST /api/purchase-requisitions`, and requisition `/approve`, `/reject`, and `/convert` transitions provide an idempotent request-to-approved-draft-PO workflow. Conversion requires a supplier and priced lines matching every approved request line.
- `POST /api/purchase-orders/{id}/approve` moves a draft order to approved.
- `POST /api/purchase-orders/{id}/receive` records accepted/rejected quantities; accepted stock and its ledger movement post atomically. Send an `idempotencyKey` and reuse it to safely retry a receipt.
- `POST /api/purchase-orders/{id}/return` records a partial supplier return against previously accepted receipt quantities. It rejects quantities beyond returnable units or available stock and atomically posts negative inventory movements; retries use the same `idempotencyKey`.
- `GET /api/supplier-bills`, `POST /api/purchase-orders/{id}/bill`, and `POST /api/supplier-bills/{id}/payments` track supplier bills for accepted, non-returned quantities and idempotent partial payments. Dashboard summary includes outstanding supplier payables.
- `GET /api/supplier-credit-notes` and `POST /api/supplier-bills/{id}/credits` issue credits against specific bill lines. A supplier credit posts the physical return, line credit balances, payable reduction, and immutable stock movement together.
- `GET /api/transactions` provides a read-only register of the latest 500 invoices, bills, payments, and credits/refunds, with optional `type`, `from`, and `to` query filters.
- `POST /api/imports/{customers|items}/preview` validates UTF-8 CSV rows without writing. `POST /api/imports/{customers|items}/commit` imports the entire valid file atomically; send a stable `Idempotency-Key` to safely retry. Customer headers: `code,name,email,status`. Item headers: `sku,name,category,openingStock,unit,unitPrice,lowStockThreshold` (threshold is optional).
- `GET /api/quotes`, `POST /api/quotes`, plus `/send`, `/accept`, `/reject`, and `/convert` transitions.
- `GET /api/sales-orders`, `POST /api/sales-orders/{id}/dispatch` posts partial or full shipments idempotently, updates on-hand and reserved balances, and appends immutable ledger movements.
- `GET /api/invoices`, `POST /api/sales-orders/{id}/invoice`, and `POST /api/invoices/{id}/payments` provide invoice-lite for dispatched quantities, partial payment posting, balance tracking, and idempotent retries. Payment rows are append-only.
- `GET /api/customer-credit-notes`, `POST /api/invoices/{id}/credits`, and `POST /api/customer-credit-notes/{id}/refunds` support line-based customer returns and partial credits. Each line is restocked, quarantined for quality inspection, or scrapped; refunded excess is tracked separately. The posting, stock ledger, invoice quantities, credit note, and audit event are transactional and idempotent.
- `GET/PUT /api/invoices/settings` configure tenant tax code/rate and invoice prefix. Invoice issuance snapshots tax at line level and allocates a sequential, tenant-locked invoice number.
- Routed work orders now enforce quantity flow: first-step output is capped by issued material, each following operation is capped by the preceding step, and finished goods cannot be posted until routing is complete or beyond final-operation good/scrap totals.
- `GET /api/invoices/tax-summary` and `/api/invoices/tax-summary/export` provide date-filtered monthly net tax totals (after customer credits) and CSV export.
- `GET /api/reports/receivables` and `/api/reports/payables` provide due-date filtered aging reports; the corresponding `/export` endpoints download formula-safe CSV files and require finance export permission.
- `GET /api/audit-events` provides a tenant-scoped, filterable and paginated audit explorer. Sensitive fields are masked; `/api/audit-events/export` is restricted to workspace owners and admins by default and capped at 10,000 rows.
- `GET /api/notifications` returns the signed-in user's tenant inbox and unread count. Audit events create notifications for other active workspace members; `PATCH /api/notifications/{id}/read` and `/api/notifications/read-all` persist read state.
- `GET/PUT /api/tenant/settings` reads or updates workspace display/legal name, timezone, country, currency, and fiscal-year start month. Suspended and closed tenants are read-only/blocked; past-due tenants remain writable through the configured grace period.
- `GET /api/tenant/settings/plan` returns the versioned plan and seat/storage/API allowances. `POST /api/tenant/settings/plan-preview` reports quota overages, modules that would be blocked, and the proposed effective date. Tenant admins request changes at `/api/tenant/settings/plan-requests`; commercial reviewers listed in `SPINDL_PLATFORM_BILLING_EMAILS` can review them in Settings or use `GET /api/platform/plan-requests` and the per-request `/approve` or `/reject` endpoints. Upgrades apply on approval; approved downgrades apply on their effective date through a scheduled job. Review and application are audited in the affected tenant. Keep the allowlist restricted to controlled platform billing accounts.
- Platform support operators listed in `SPINDL_PLATFORM_SUPPORT_EMAILS` may request a time-limited diagnostics session for a workspace. A workspace owner or admin must approve it in Settings; the requesting operator can then view read-only workspace, plan, and module diagnostics for 5–60 minutes. Requests, decisions, diagnostics views, and revocations are tenant-audited. This path never impersonates a member or exposes customer/business records. Keep this allowlist limited to controlled support accounts.
- `GET /api/tenant/modules` lists tenant module entitlements and dependencies. `PATCH /api/tenant/modules/{code}` toggles an entitled module; required dependencies must be enabled first, disabled modules are hidden in navigation and their APIs are denied, and their data is retained.
- `POST /api/team/invitations/{id}/resend` revokes the prior pending invitation and creates a new seven-day, single-use activation token. Active members and pending invitations count against the versioned plan seat limit.
- `POST /api/team/ownership-transfer` starts an owner-reauthenticated transfer to an active admin; the 24-hour single-use token must be confirmed by that admin with their password at `/api/team/ownership-transfer/confirm`.
- Login failures are limited using persistent, hashed email and source-address buckets. Authentication errors remain generic; successful logins from a previously unseen network are recorded in the tenant audit log.
- `GET /api/custom-fields?resource=customers` lists tenant-defined fields. Owners/admins can `POST /api/custom-fields` to create a draft and publish it with `POST /api/custom-fields/{id}/publish`. Supported types are text, number, date, boolean, select, and reference. `GET/PUT /api/custom-fields/{resource}/{recordId}` reads or replaces typed values; values are tenant-scoped, validated against published definitions, and audited without recording their contents.
- Customer and supplier create APIs accept contact, address, country, tax, and payment-term details. Customer records also support individual/company classification, owner, tags, credit limit, and credit hold; supplier records support lead time, rating, and notes. `PUT /api/suppliers/{id}` updates an existing supplier profile, and `GET /api/customers/{id}/timeline` returns the latest quotes, orders, invoices, payments, and customer returns visible to the caller. `GET /api/customers?email=...` and `GET /api/customers?phone=...` provide tenant- and record-scope-filtered duplicate suggestions. Owners/admins can `POST /api/customers/{sourceId}/merge` with `targetCustomerId`; linked sales history, leads, attachments, and custom fields move transactionally, and the source is archived with an audit trail. A credit hold or configured credit-limit breach prevents quote conversion. Customer/supplier CSV imports and exports include the extended profile columns.
- Catalog items have a persisted `itemType` classification: `RAW`, `WIP`, `FINISHED`, or `SERVICE`. Existing records default to `FINISHED`; item CSV import/export carries the type.
- Workspace owners/admins can `GET/POST /api/tenant/roles`, `PUT /api/tenant/roles/{code}`, and `DELETE /api/tenant/roles/{code}` to list, create/clone, edit, and delete custom roles. CRM leads and inventory cycle counts enforce `OWN`, direct-report `TEAM`, assigned `BRANCH`, and `ALL` scopes on lists, detail reads, and mutations; other resources currently accept `ALL` only. `/api/tenant/branches` lists branches available to the signed-in member; owners/admins can create, update, and deactivate branches. The Team screen assigns active branches and direct managers to each member; new members start on the default branch. Leads and warehouses carry a branch assignment, and default branches/warehouse assignment are backfilled for existing workspaces. Team and branch administration is owner/admin-only.
- `GET /api/inventory/movements` returns the latest 100 tenant stock movements. `POST /api/inventory/adjustments` posts signed count/damage/found/other corrections idempotently, locking stock and protecting reserved quantities.
- `GET/POST /api/inventory/transfers` manages stock transfers through draft, approved, in-transit, received, or cancelled states. `POST /api/inventory/transfers/{id}/approve`, `/dispatch`, `/receive`, and `/cancel` advance the workflow. Requests reserve source availability; dispatch and receipt post separate immutable ledger legs. Approval, dispatch, receipt, and cancellation emit audit events.
- `GET/POST /api/inventory/cycle-counts` starts a warehouse-scoped stock snapshot; line counts move through counting, review, and approved posting. Posting rejects stale snapshots and reductions that would consume reserved, manufacturing-allocated, or quality-held stock, then records immutable ledger movements.
- POS endpoints: managers can `POST /api/pos/registers` for a branch-assigned warehouse; cashiers can `GET /api/pos/registers`, `POST /api/pos/sessions` with an opening float, and post `POST /api/pos/sessions/{id}/checkout` with item quantities, optional customer, idempotency key, and exact tender totals. Workspace tax is applied server-side; finished-goods stock and immutable ledger movements update atomically. Managers close shifts with `POST /api/pos/sessions/{id}/close`; `GET /api/pos/sessions` and `/api/pos/sessions/{id}/sales` provide shift and receipt history. This is online manual tender capture; it does not communicate with a payment processor or provide offline checkout.
- Catalog items store a configurable `lowStockThreshold` (default 10); `PATCH /api/items/{id}/low-stock-threshold` updates it. Dashboard summary includes the count of active items at or below their available-stock threshold.
- Customer directory responses include sales-order counts and outstanding invoice balances. `GET /api/dashboard/summary` returns current-month invoiced totals, open sales orders, inventory valuation, active customer count, outstanding receivables/payables, and overdue receivables/payables from PostgreSQL.
- `GET /api/dashboard/trend?months=6` returns the last 1–24 months of tenant-scoped gross invoiced sales and supplier bills, including months with no transactions. The Overview chart uses these persisted values; they are not net cash-flow or profit figures.
- Tenant-scoped business APIs use the authenticated tenant membership and database-backed role permissions. R0 still needs its tenant-isolation/security verification gate before release sign-off. Own scope also applies to customers; own, direct-report team, and assigned-branch scopes currently apply to CRM leads and inventory cycle counts. Other records remain all-scope only.

## Start

Set the database values in the shell or copy `.env.example` values into your local environment. Do not commit real secrets.

```bash
cd spindl
  ./gradlew bootRun
```

In another terminal:

```bash
cd spindl/frontend
npm install
npm run dev
```

The frontend defaults to `http://localhost:8080/api`; override with `VITE_API_URL` if needed. Flyway applies `src/main/resources/db/migration` on backend startup. Back up a non-disposable database before running schema changes.
