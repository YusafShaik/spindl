import { Fragment, useMemo, useState } from 'react';
import { Check, ChevronDown, Download, Menu, Plus, Boxes, Building2, FileText, ShoppingCart, UserPlus, Receipt } from 'lucide-react';
import { API, apiFetch } from './lib/api/client.ts';
import { navModuleCode } from './app/navigation.ts';
import { Dashboard } from './features/overview/Dashboard.tsx';
import { NotificationCenter } from './features/notifications/NotificationCenter.tsx';
import { Sidebar } from './components/layout/Sidebar.tsx';
import { AuthPage } from './features/auth/AuthPage.tsx';
import { useAuthActions, type AuthSession } from './features/auth/useAuthActions.ts';
import { CustomerDirectory } from './features/customers/CustomerDirectory.tsx';
import { TransactionRegister } from './features/transactions/TransactionRegister.tsx';
import { GeneralLedgerPanel } from './features/gl/GeneralLedgerPanel.tsx';
import { ProductDirectory } from './features/inventory/ProductDirectory.tsx';
import { InventoryPanel } from './features/inventory/InventoryPanel.tsx';
import { useInventoryActions } from './features/inventory/useInventoryActions.ts';
import { QualityPanel } from './features/quality/QualityPanel.tsx';
import { LeadPanel } from './features/leads/LeadPanel.tsx';
import { InventoryWarehousePanel } from './features/inventory/InventoryWarehousePanel.tsx';
import { InventoryCycleCountPanel } from './features/inventory/InventoryCycleCountPanel.tsx';
import { PurchaseDirectory } from './features/purchases/PurchaseDirectory.tsx';
import { usePurchaseActions } from './features/purchases/usePurchaseActions.ts';
import { SalesDirectory } from './features/sales/SalesDirectory.tsx';
import { useSalesActions } from './features/sales/useSalesActions.ts';
import { InvoiceSettingsPanel } from './features/transactions/InvoiceSettingsPanel.tsx';
import { ImportData } from './features/imports/ImportData.tsx';
import { useImportActions } from './features/imports/useImportActions.ts';
import { CustomerRefundModal, CustomerReturnModal, DispatchModal, InvoiceModal, PaymentModal, QuoteConversionModal } from './features/sales/SalesDialogs.tsx';
import { PurchaseReturnModal, ReceiveModal, SupplierBillModal, SupplierCreditModal, SupplierPaymentModal } from './features/purchases/PurchaseDialogs.tsx';
import { AdjustmentModal, ThresholdModal } from './features/inventory/InventoryDialogs.tsx';
import { RecordModal } from './features/records/RecordModal.tsx';
import { useRecordActions } from './features/records/useRecordActions.ts';
import { AuditExplorer } from './features/audit/AuditExplorer.tsx';
import { PurchaseRequisitionPanel, ReorderSuggestions } from './features/purchases/PurchasingWorkflows.tsx';
import { OperationalReports } from './features/reports/OperationalReports.tsx';
import { ReportBuilder, SavedReportSchedulePanel } from './features/reports/ReportBuilder.tsx';
import { WorkflowStudio } from './features/reports/WorkflowStudio.tsx';
import { InvoiceTemplateDesigner } from './features/transactions/InvoiceTemplateDesigner.tsx';
import { LeadPipelineStudio } from './features/leads/LeadPipelineStudio.tsx';
import { TenantSettingsPanel } from './features/settings/TenantSettingsPanel.tsx';
import { TeamPanel } from './features/team/TeamPanel.tsx';
import { useTeamActions } from './features/team/useTeamActions.ts';
import { ManufacturingPanel } from './features/manufacturing/ManufacturingPanel.tsx';
import { MrpPanel } from './features/mrp/MrpPanel.tsx';
import { EngineeringChangePanel } from './features/engineering/EngineeringChangePanel.tsx';
import { MaintenancePanel } from './features/maintenance/MaintenancePanel.tsx';
import { LogisticsPanel } from './features/logistics/LogisticsPanel.tsx';
import { WorkforcePanel } from './features/workforce/WorkforcePanel.tsx';
import { PosPanel } from './features/pos/PosPanel.tsx';
import { useTenantModules } from './app/useTenantModules.ts';
import { useTenantData } from './app/useTenantData.ts';
import { useTeamData } from './app/useTeamData.ts';
import { useProductionData } from './app/useProductionData.ts';
import { useTransactionFilters } from './app/useTransactionFilters.ts';
import type { AuthMode } from './features/auth/AuthPage';
import type { RecordKind } from './features/records/RecordModal';
import type { AppSession } from './types/session';
import type { CustomerCreditNote, SalesInvoice, SalesOrder, SalesQuote } from './types/sales';
import type { ItemSummary } from './types/inventory';
import type { PurchaseOrder, SupplierBill } from './types/purchasing';
import type { CsvImportPreview, ImportResource } from './types/imports';
import type { FormEvent } from 'react';

const selectableRecordKinds: RecordKind[] = ['Customer', 'Product', 'Supplier', 'Purchase order', 'Quotation'];
function isRecordKind(value: string): value is RecordKind { return selectableRecordKinds.some((kind) => kind === value); }
function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }


function App() {
  const [session, setSession] = useState<AuthSession | null>(() => { try { const value: unknown = JSON.parse(localStorage.getItem('spindl.session') || 'null'); return value !== null && typeof value === 'object' ? value as AuthSession : null; } catch { return null; } });
  const { enabledModules, setEnabledModules } = useTenantModules(session);
  const tenantData = useTenantData(session);
  const { items, setItems, customers, setCustomers, suppliers, setSuppliers, purchaseOrders, setPurchaseOrders, purchaseRequisitions, setPurchaseRequisitions, supplierBills, setSupplierBills, supplierCredits, setSupplierCredits, customerCredits, setCustomerCredits, transactions, setTransactions, quotes, setQuotes, salesOrders, setSalesOrders, invoices, setInvoices, movements, setMovements, trend, metrics, setMetrics, apiOnline, setApiOnline } = tenantData;
  const [authMode, setAuthMode] = useState<AuthMode>(() => { const params = new URLSearchParams(window.location.search); return params.has('reset') ? 'reset' : params.has('invite') ? 'accept' : 'register'; });
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [section, setSection] = useState('Overview');
  const [query, setQuery] = useState('');
  const [importResource, setImportResource] = useState<ImportResource>('CUSTOMERS');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<CsvImportPreview | null>(null);
  const [importKey, setImportKey] = useState('');
  const [conversionQuote, setConversionQuote] = useState<SalesQuote | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newKind, setNewKind] = useState<RecordKind | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingKey, setReceivingKey] = useState('');
  const [returningOrder, setReturningOrder] = useState<PurchaseOrder | null>(null);
  const [returnKey, setReturnKey] = useState('');
  const [billingOrder, setBillingOrder] = useState<PurchaseOrder | null>(null);
  const [billKey, setBillKey] = useState('');
  const [payingBill, setPayingBill] = useState<SupplierBill | null>(null);
  const [billPaymentKey, setBillPaymentKey] = useState('');
  const [creditingBill, setCreditingBill] = useState<SupplierBill | null>(null);
  const [creditKey, setCreditKey] = useState('');
  const [dispatchingOrder, setDispatchingOrder] = useState<SalesOrder | null>(null);
  const [dispatchKey, setDispatchKey] = useState('');
  const [invoicingOrder, setInvoicingOrder] = useState<SalesOrder | null>(null);
  const [invoiceKey, setInvoiceKey] = useState('');
  const [payingInvoice, setPayingInvoice] = useState<SalesInvoice | null>(null);
  const [paymentKey, setPaymentKey] = useState('');
  const [creditingInvoice, setCreditingInvoice] = useState<SalesInvoice | null>(null);
  const [customerCreditKey, setCustomerCreditKey] = useState('');
  const [refundingCredit, setRefundingCredit] = useState<CustomerCreditNote | null>(null);
  const [refundKey, setRefundKey] = useState('');
  const [adjustingItem, setAdjustingItem] = useState<ItemSummary | null>(null);
  const [adjustmentKey, setAdjustmentKey] = useState('');
  const [thresholdItem, setThresholdItem] = useState<ItemSummary | null>(null);
  const [saving, setSaving] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState('');
  const { teamMembers, setTeamMembers, teamRoles, teamInvitations, teamLoading, refreshTeam } = useTeamData(section, session, notify);
  const { latestInvite, ownershipLink, inviteMember, updateMember, updateMemberScope, ownershipRequest, resendInvitation, ownershipConfirm } = useTeamActions({ setTeamMembers, setSession, refreshTeam, setSaving, notify });
  const { boms, workOrders, workCenters, productionLoading, reloadProduction } = useProductionData(section, session, notify);
  const { transactionType, setTransactionType, transactionFrom, setTransactionFrom, transactionTo, setTransactionTo } = useTransactionFilters(section, setTransactions, notify);
  const { approveOrder, openReceipt, openReturn, openBill, openBillPayment, openSupplierCredit, submitReceipt, submitReturn, submitBill, submitBillPayment, submitSupplierCredit } = usePurchaseActions({ receivingOrder, setReceivingOrder, receivingKey, setReceivingKey, returningOrder, setReturningOrder, returnKey, setReturnKey, billingOrder, setBillingOrder, billKey, setBillKey, payingBill, setPayingBill, billPaymentKey, setBillPaymentKey, creditingBill, setCreditingBill, creditKey, setCreditKey, setSaving, setPurchaseOrders, setItems, setMovements, setSupplierBills, setSupplierCredits, setMetrics, notify });
  const { quoteAction, submitQuoteConversion, openDispatch, openInvoice, openPayment, openCustomerCredit, openRefund, submitInvoice, submitPayment, submitCustomerCredit, submitRefund, submitDispatch } = useSalesActions({ conversionQuote, setConversionQuote, dispatchingOrder, setDispatchingOrder, dispatchKey, setDispatchKey, invoicingOrder, setInvoicingOrder, invoiceKey, setInvoiceKey, payingInvoice, setPayingInvoice, paymentKey, setPaymentKey, creditingInvoice, setCreditingInvoice, customerCreditKey, setCustomerCreditKey, refundingCredit, setRefundingCredit, refundKey, setRefundKey, setSaving, setItems, setCustomers, setCustomerCredits, setTransactions, setQuotes, setSalesOrders, setInvoices, setMovements, setMetrics, notify });
  const { openAdjustment, saveThreshold, submitAdjustment } = useInventoryActions({ adjustingItem, setAdjustingItem, adjustmentKey, setAdjustmentKey, thresholdItem, setThresholdItem, setItems, setMovements, setMetrics, setSaving, notify });
  const { previewImport, exportMasterData, commitImport } = useImportActions({ resource: importResource, file: importFile, setFile: setImportFile, preview: importPreview, setPreview: setImportPreview, idempotencyKey: importKey, setIdempotencyKey: setImportKey, setItems, setCustomers, setMovements, setMetrics, setSaving, notify });
  const { submitNew } = useRecordActions({ kind: newKind, setKind: setNewKind, setSection, setCustomers, setSuppliers, setPurchaseOrders, setQuotes, setItems, setSaving, setApiOnline, setMetrics, notify });

  const { submitAuth, signOut } = useAuthActions({ authMode, setAuthMode, setAuthError, setAuthMessage, setAuthBusy, setSession, setApiOnline });

  const productionRequest = async (path: string, method='GET', payload?: unknown): Promise<unknown> => {
    const response = await apiFetch(`${API}${path}`, { method, ...(payload ? { headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) } : {}) });
    const body = await response.json().catch(()=>({})); if (!response.ok) throw new Error(body.detail || body.message || 'Manufacturing action failed');
    await reloadProduction(); return body;
  };


  const filteredItems = useMemo(() => items.filter(item => `${item.name} ${item.sku} ${item.barcode||''} ${item.category} ${item.itemType||''}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const filteredCustomers = useMemo(() => customers.filter(customer => `${customer.code} ${customer.name} ${customer.email} ${customer.phone||''} ${customer.contactName||''} ${customer.tags||''} ${customer.city||''}`.toLowerCase().includes(query.toLowerCase())), [customers, query]);
  const filteredPurchaseOrders = useMemo(() => purchaseOrders.filter(order => `${order.orderNumber} ${order.supplierName} ${order.status}`.toLowerCase().includes(query.toLowerCase())), [purchaseOrders, query]);
  function notify(text: string): void { setToast(text); window.setTimeout(() => setToast(''), 2800); }
  const createSample = (kind: string): void => {
    setShowNew(false);
    if (!isRecordKind(kind)) { notify(`${kind} creation is planned for the next backend increment`); return; }
    setNewKind(kind);
  };
  if (!session) return <AuthPage mode={authMode} busy={authBusy} error={authError} message={authMessage} onModeChange={setAuthMode} onErrorChange={setAuthError} onMessageChange={setAuthMessage} onSubmit={submitAuth} />;

  return <div className="app-shell">
    <Sidebar
      session={session}
      enabledModules={enabledModules}
      section={section}
      mobileOpen={mobileNav}
      onNavigate={(label) => { setSection(label); setMobileNav(false); if (label !== 'Settings') setQuery(''); }}
      onSearch={() => document.querySelector<HTMLInputElement>('.search-input')?.focus()}
      onSignOut={signOut}
      onMobileOpenChange={setMobileNav}
    />
    <main className="main-area">
      <header className="topbar">
        <button className="mobile-menu" onClick={() => setMobileNav(!mobileNav)}>
          <Menu size={18} />
        </button>
        <div className="breadcrumbs">
          <span>Workspace</span>
          <span className="crumb-slash">/</span>
          <b>{section}</b>
        </div>
        <div className="top-actions">
          <div className="api-indicator">
            <i className={apiOnline ? 'online' : ''} />
            <span>{apiOnline ? 'Connected' : 'Offline'}</span>
          </div>
          <NotificationCenter notify={notify} />
          <span className="top-divider" />
          <button className="top-avatar" title={session?.name || 'User'}>
            {session?.name ? session.name.split(/\s+/).map((n) => n[0]).slice(0, 2).join('').toUpperCase() : 'U'}
          </button>
        </div>
      </header>
      <div className="content-wrap">
        {!['Reports', 'Audit log', 'Settings', 'POS', 'Warehouses', 'Production', 'Planning (MRP)', 'Engineering (ECO)', 'Maintenance', 'Workforce', 'Logistics', 'Products', 'Inventory', 'Sales', 'Purchases', 'Quality', 'Customers', 'Team', 'Leads', 'Transactions', 'Accounting (GL)'].includes(section) && (
          <div className="page-heading">
            <div className="page-title-wrap">
              <h1>{section === 'Overview' ? 'Overview' : section}</h1>
            </div>
            <div className="heading-actions">
              {['Customers', 'Products', 'Imports'].includes(section) && (
                <button
                  className="button button-secondary"
                  disabled={saving}
                  onClick={() =>
                    ['Customers', 'Products', 'Imports'].includes(section)
                      ? exportMasterData(section === 'Customers' ? 'CUSTOMERS' : section === 'Products' ? 'ITEMS' : importResource)
                      : notify('Export is not available for this view yet')
                  }
                >
                  <Download size={14} />
                  <span>{saving ? 'Exporting…' : 'Export CSV'}</span>
                </button>
              )}
              <div className="new-wrap">
                <button
                  className="button button-primary"
                  onClick={() =>
                    section === 'Leads'
                      ? document.querySelector<HTMLInputElement>('.lead-create-form input[name="name"]')?.focus()
                      : setShowNew(!showNew)
                  }
                >
                  <Plus size={14} />
                  <span>
                    New{' '}
                    {section === 'Leads'
                      ? 'lead'
                      : section === 'Customers'
                      ? 'customer'
                      : section === 'Products' || section === 'Inventory'
                      ? 'item'
                      : section === 'Purchases'
                      ? 'purchase'
                      : section === 'Sales'
                      ? 'quote'
                      : 'transaction'}
                  </span>
                  <ChevronDown size={13} />
                </button>
                {showNew && (
                  <div className="new-menu">
                    <button onClick={() => { createSample('Customer'); setShowNew(false); }}>
                      <UserPlus size={13} className="menu-icon" />
                      <span>New customer</span>
                    </button>
                    <button onClick={() => { createSample('Product'); setShowNew(false); }}>
                      <Boxes size={13} className="menu-icon" />
                      <span>New product</span>
                    </button>
                    <button onClick={() => { createSample('Supplier'); setShowNew(false); }}>
                      <Building2 size={13} className="menu-icon" />
                      <span>New supplier</span>
                    </button>
                    <button onClick={() => { createSample('Purchase order'); setShowNew(false); }}>
                      <Receipt size={13} className="menu-icon" />
                      <span>New purchase order</span>
                    </button>
                    <button onClick={() => { createSample('Quotation'); setShowNew(false); }}>
                      <FileText size={13} className="menu-icon" />
                      <span>New quotation</span>
                    </button>
                    <button onClick={() => { createSample('Sales order'); setShowNew(false); }}>
                      <ShoppingCart size={13} className="menu-icon" />
                      <span>New sales order</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {section === 'POS' ? <PosPanel items={items} customers={customers} role={session?.role} userId={session?.userId} notify={notify} />
        : section === 'Production' ? <ManufacturingPanel items={items} boms={boms} workOrders={workOrders} workCenters={workCenters} loading={productionLoading} request={productionRequest} notify={notify} role={session?.role} />
        : section === 'Planning (MRP)' ? <MrpPanel items={items} role={session?.role} notify={notify} />
        : section === 'Engineering (ECO)' ? <EngineeringChangePanel items={items} role={session?.role} notify={notify} />
        : section === 'Maintenance' ? <MaintenancePanel items={items} role={session?.role} notify={notify} />
        : section === 'Logistics' ? <LogisticsPanel items={items} customers={customers} role={session?.role} notify={notify} />
        : section === 'Workforce' ? <WorkforcePanel role={session?.role} notify={notify} />
        : section === 'Leads' ? <LeadPanel items={items} notify={notify} onConverted={async()=>{const [customerData,quoteData]=await Promise.all([apiFetch(`${API}/customers`).then(r=>r.json()),apiFetch(`${API}/quotes`).then(r=>r.json())]);setCustomers(customerData);setQuotes(quoteData);}} />
        : section === 'Quality' ? <QualityPanel role={session?.role} notify={notify} onRefresh={async()=>{const [itemData,movementData,summary]=await Promise.all([apiFetch(`${API}/items`).then(r=>r.json()),apiFetch(`${API}/inventory/movements`).then(r=>r.json()),apiFetch(`${API}/dashboard/summary`).then(r=>r.json())]);setItems(itemData);setMovements(movementData);setMetrics(summary);}} />
        : section === 'Team' ? <TeamPanel members={teamMembers} invitations={teamInvitations} roles={teamRoles} latestInvite={latestInvite} loading={teamLoading} saving={saving} session={session} ownershipLink={ownershipLink} onInvite={inviteMember} onRole={(id,role)=>updateMember(id,'role',role)} onActive={(id,active)=>updateMember(id,'active',active)} onScope={updateMemberScope} onOwnershipRequest={ownershipRequest} onOwnershipConfirm={ownershipConfirm} onResend={resendInvitation} onCopy={(message='Invitation link copied')=>notify(message)} />
        : section === 'Customers' ? <CustomerDirectory title="Customers" subtitle="Manage the people and businesses you work with." query={query} setQuery={setQuery} data={filteredCustomers} customers={customers} role={session?.role} notify={notify} onMerged={async()=>{const rows=await apiFetch(`${API}/customers`).then(response=>response.json());setCustomers(rows);notify("Customer records merged and history moved");}} onNewCustomer={() => createSample('Customer')} onRefresh={async()=>{const rows=await apiFetch(`${API}/customers`).then(response=>response.json());setCustomers(rows);}} />
        : section === 'Purchases' ? <PurchaseDirectory
          orders={filteredPurchaseOrders}
          bills={supplierBills}
          credits={supplierCredits}
          payables={metrics.accountsPayable}
          suppliers={suppliers}
          query={query}
          setQuery={setQuery}
          onApprove={approveOrder}
          onReceive={openReceipt}
          onReturn={openReturn}
          onBill={openBill}
          onPayment={openBillPayment}
          onCredit={openSupplierCredit}
          onNewSupplier={() => createSample('Supplier')}
          onNewOrder={() => createSample('Purchase order')}
          requisitionSection={<PurchaseRequisitionPanel requisitions={purchaseRequisitions} suppliers={suppliers} items={items} role={session?.role} notify={notify} onRequisitions={setPurchaseRequisitions} onCreatedOrder={order => setPurchaseOrders(list => [order, ...list])} />}
          reorderSection={<ReorderSuggestions suppliers={suppliers} notify={notify} onCreated={order => setPurchaseOrders(list => [order, ...list])} />}
          requisitions={purchaseRequisitions}
        />
        : section === 'Sales' ? <SalesDirectory
          quotes={quotes}
          orders={salesOrders}
          invoices={invoices}
          customerCredits={customerCredits}
          query={query}
          setQuery={setQuery}
          onQuoteAction={quoteAction}
          onDispatch={openDispatch}
          onInvoice={openInvoice}
          onPayment={openPayment}
          onCredit={openCustomerCredit}
          onRefund={openRefund}
          onNewQuote={() => createSample('Quotation')}
          onNewOrder={() => createSample('Sales order')}
        />
        : (section === 'Transactions' || section === 'Accounting (GL)') ? (
          <GeneralLedgerPanel
            role={session?.role}
            notify={notify}
            legacyData={transactions}
            legacyType={transactionType}
            setLegacyType={setTransactionType}
            legacyFrom={transactionFrom}
            setLegacyFrom={setTransactionFrom}
            legacyTo={transactionTo}
            setLegacyTo={setTransactionTo}
            invoiceSettings={<InvoiceSettingsPanel role={session?.role} notify={notify} />}
          />
        )
        : section === 'Reports' ? <OperationalReports notify={notify} role={session?.role} />
        : section === 'Settings' ? <TenantSettingsPanel role={session?.role} notify={notify} onModulesChange={codes=>{setEnabledModules(codes);if(!codes.includes(navModuleCode(section)))setSection('Overview');}} onSaved={name=>{const updated={...session,tenantName:name};setSession(updated);localStorage.setItem('spindl.session',JSON.stringify(updated));}}/>
        : section === 'Audit log' ? <AuditExplorer notify={notify} role={session?.role}/>
        : section === 'Imports' ? <ImportData resource={importResource} setResource={value=>{setImportResource(value);setImportPreview(null);setImportKey('');}} file={importFile} onFile={file=>{setImportFile(file);setImportPreview(null);setImportKey(crypto.randomUUID());}} preview={importPreview} saving={saving} onPreview={previewImport} onImport={commitImport} onExport={exportMasterData} />
        : section === 'Warehouses' ? <InventoryWarehousePanel items={items} role={session?.role} notify={notify} onPosted={async()=>{const [itemData,movementData,summary]=await Promise.all([apiFetch(`${API}/items`).then(r=>r.json()),apiFetch(`${API}/inventory/movements`).then(r=>r.json()),apiFetch(`${API}/dashboard/summary`).then(r=>r.json())]);setItems(itemData);setMovements(movementData);setMetrics(summary);}}/>
        : section === 'Products' ? <ProductDirectory title="Product catalog" subtitle="Your items, materials, and finished goods." query={query} setQuery={setQuery} data={filteredItems} allItems={items} movements={movements} notify={notify} onAdjust={openAdjustment} onThreshold={setThresholdItem} onNewItem={() => createSample('Product')} onRefresh={async()=>{const [itemData,summary]=await Promise.all([apiFetch(`${API}/items`).then(r=>r.json()),apiFetch(`${API}/dashboard/summary`).then(r=>r.json())]);setItems(itemData);setMetrics(summary);}} role={session?.role} />
        : section === 'Inventory' ? <InventoryPanel data={filteredItems} allItems={items} movements={movements} query={query} setQuery={setQuery} notify={notify} role={session?.role} onAdjust={openAdjustment} onThreshold={setThresholdItem} onRefresh={async()=>{const [itemData,movementData,summary]=await Promise.all([apiFetch(`${API}/items`).then(r=>r.json()),apiFetch(`${API}/inventory/movements`).then(r=>r.json()),apiFetch(`${API}/dashboard/summary`).then(r=>r.json())]);setItems(itemData);setMovements(movementData);setMetrics(summary);}} />
        : <Dashboard
          metrics={metrics}
          trend={trend}
          items={items}
          transactions={transactions}
          query={query}
          onQueryChange={setQuery}
          onOpenInventory={() => { setSection('Inventory'); setQuery(''); }}
          onSearchInventory={(sku) => { setSection('Inventory'); setQuery(sku); }}
          onOpenTransactions={() => setSection('Transactions')}
          onNavigate={(sec) => { setSection(sec as any); setQuery(''); }}
        />}
        <footer className="page-footer"><span>© 2026 Spindl ERP</span><span><i></i> All systems operational</span><span>Made for businesses that make things <span className="footer-star">✳</span></span></footer>
      </div>
    </main>
    {toast && <div className="toast"><Check size={16}/>{toast}</div>}
    {newKind && <RecordModal kind={newKind} suppliers={suppliers} customers={customers} items={items} saving={saving} onClose={() => setNewKind(null)} onSubmit={submitNew} />}
    {conversionQuote && <QuoteConversionModal quote={conversionQuote} saving={saving} onClose={()=>!saving&&setConversionQuote(null)} onSubmit={submitQuoteConversion}/>}
    {receivingOrder && <ReceiveModal order={receivingOrder} saving={saving} onClose={() => !saving && setReceivingOrder(null)} onSubmit={submitReceipt} />}
    {returningOrder && <PurchaseReturnModal order={returningOrder} saving={saving} onClose={() => !saving && setReturningOrder(null)} onSubmit={submitReturn} />}
    {billingOrder && <SupplierBillModal order={billingOrder} saving={saving} onClose={()=>!saving&&setBillingOrder(null)} onSubmit={submitBill}/>}
    {payingBill && <SupplierPaymentModal bill={payingBill} saving={saving} onClose={()=>!saving&&setPayingBill(null)} onSubmit={submitBillPayment}/>}
    {creditingBill && <SupplierCreditModal bill={creditingBill} saving={saving} onClose={()=>!saving&&setCreditingBill(null)} onSubmit={submitSupplierCredit}/>}
    {dispatchingOrder && <DispatchModal order={dispatchingOrder} saving={saving} onClose={() => !saving && setDispatchingOrder(null)} onSubmit={submitDispatch} />}
    {invoicingOrder && <InvoiceModal order={invoicingOrder} saving={saving} onClose={() => !saving && setInvoicingOrder(null)} onSubmit={submitInvoice} />}
    {payingInvoice && <PaymentModal invoice={payingInvoice} saving={saving} onClose={() => !saving && setPayingInvoice(null)} onSubmit={submitPayment} />}
    {creditingInvoice && <CustomerReturnModal invoice={creditingInvoice} saving={saving} onClose={()=>!saving&&setCreditingInvoice(null)} onSubmit={submitCustomerCredit}/>}
    {refundingCredit && <CustomerRefundModal credit={refundingCredit} saving={saving} onClose={()=>!saving&&setRefundingCredit(null)} onSubmit={submitRefund}/>}
    {adjustingItem && <AdjustmentModal item={adjustingItem} saving={saving} onClose={() => !saving && setAdjustingItem(null)} onSubmit={submitAdjustment} />}
    {thresholdItem && <ThresholdModal item={thresholdItem} saving={saving} onClose={() => !saving && setThresholdItem(null)} onSubmit={saveThreshold} />}
  </div>;
}

export default App;
