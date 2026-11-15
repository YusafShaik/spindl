import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDown, ArrowDownUp, Bell, Boxes, Check, ChevronDown,
  CircleHelp, Command, Download, Filter, LayoutDashboard, Menu, MoreHorizontal,
  Package, Plus, Search, Settings2, SlidersHorizontal, Sparkles, Users,
  Warehouse, Wrench, ShieldCheck, ChartNoAxesColumnIncreasing,
} from 'lucide-react';
import './preview.css';

const rows = [
  { sku: 'MAT-2048', name: 'Recycled kraft mailer · 250 × 350 mm', group: 'Packaging', location: 'Mumbai · A-04', onHand: '1,240', reserved: '180', available: '1,060', status: 'In stock', tone: 'success' },
  { sku: 'CMP-1180', name: 'Aluminium hinge assembly, brushed', group: 'Components', location: 'Pune · B-12', onHand: '482', reserved: '96', available: '386', status: 'In stock', tone: 'success' },
  { sku: 'RAW-0092', name: 'Natural cotton webbing · 25 mm', group: 'Raw material', location: 'Mumbai · C-02', onHand: '74', reserved: '32', available: '42', status: 'Low stock', tone: 'warning' },
  { sku: 'FIN-3305', name: 'Canvas tote · natural / large', group: 'Finished goods', location: 'Bengaluru · FG-01', onHand: '216', reserved: '48', available: '168', status: 'In stock', tone: 'success' },
  { sku: 'MAT-0716', name: 'Water-based adhesive · 5 L', group: 'Packaging', location: 'Pune · D-03', onHand: '0', reserved: '0', available: '0', status: 'Out of stock', tone: 'danger' },
];

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Inventory', icon: Package, active: true },
  { label: 'Purchasing', icon: Boxes },
  { label: 'Production', icon: Wrench },
  { label: 'Quality', icon: ShieldCheck },
];

const businessNavigation = [
  { label: 'Sales & POS', icon: ChartNoAxesColumnIncreasing },
  { label: 'Customers', icon: Users },
  { label: 'Warehouses', icon: Warehouse },
];

function Preview() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="preview-frame min-h-screen bg-sp-canvas font-sans text-sp-text">
      <aside className={`preview-sidebar${mobileNavOpen ? ' is-open' : ''}`}>
        <a className="preview-brand" href="#preview" aria-label="Spindl illustrative preview home">
          <span className="preview-brand-mark"><i /><i /><i /><i /></span>
          <span>spindl</span><span className="preview-brand-workspace">WORKSPACE</span>
          <ChevronDown size={14} className="text-sp-text-muted" />
        </a>

        <button className="preview-workspace" type="button">
          <span className="preview-workspace-avatar">N</span>
          <span className="preview-workspace-copy"><strong>Northstar Goods</strong><small>Operations workspace</small></span>
          <ChevronDown size={14} />
        </button>

        <button className="preview-quick-search" type="button">
          <Search size={15} /><span>Search anything</span><kbd><Command size={10} /> K</kbd>
        </button>

        <nav className="preview-navigation" aria-label="Illustrative preview navigation">
          <div className="preview-nav-caption">WORKSPACE</div>
          {navigation.map(({ label, icon: Icon, active }) => <a key={label} href={`#${label.toLowerCase()}`} className={`preview-nav-item${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}><Icon size={16} strokeWidth={1.8} /><span>{label}</span>{label === 'Inventory' && <span className="preview-nav-count">24</span>}</a>)}
          <div className="preview-nav-caption preview-nav-caption-spaced">BUSINESS</div>
          {businessNavigation.map(({ label, icon: Icon }) => <a key={label} href={`#${label.toLowerCase()}`} className="preview-nav-item"><Icon size={16} strokeWidth={1.8} /><span>{label}</span></a>)}
          <div className="preview-nav-caption preview-nav-caption-spaced">ADMINISTRATION</div>
          <a href="#team" className="preview-nav-item"><Users size={16} strokeWidth={1.8} /><span>Team</span></a>
        </nav>

        <div className="preview-sidebar-bottom">
          <a href="#settings" className="preview-nav-item"><Settings2 size={16} strokeWidth={1.8} /><span>Settings</span></a>
          <a href="#help" className="preview-help"><CircleHelp size={16} /><span>Help center</span><span className="preview-help-key">?</span></a>
          <button className="preview-profile" type="button"><span className="preview-profile-avatar">AS</span><span className="preview-workspace-copy"><strong>Arjun Sharma</strong><small>Workspace admin</small></span><MoreHorizontal size={17} /></button>
        </div>
      </aside>
      {mobileNavOpen && <button className="preview-mobile-overlay" type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}

      <div className="preview-main">
        <header className="preview-topbar">
          <div className="preview-breadcrumb"><button className="preview-mobile-toggle" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={17} /></button><span>Workspace</span><span className="preview-slash">/</span><strong>Inventory</strong><span className="preview-slash">/</span><span>Illustrative items</span></div>
          <div className="preview-topbar-actions"><span className="preview-shortcut-hint">Inventory overview</span><button className="preview-icon-button" aria-label="Notifications" type="button"><Bell size={17} /><i /></button><span className="preview-topbar-divider" /><span className="preview-user-dot">AS</span></div>
        </header>

        <main className="preview-content">
          <div className="preview-kicker"><Sparkles size={14} /> SAMPLE WORKSPACE / INVENTORY</div>
          <div className="preview-page-heading">
            <div><h1 className="sp-type-page">Inventory</h1><p className="sp-type-body text-sp-text-secondary">A sample workspace composition for reviewing Spindl’s visual language.</p></div>
            <div className="preview-heading-actions"><button className="preview-button preview-button-secondary" type="button"><Download size={15} /> Export</button><button className="preview-button preview-button-primary" type="button"><Plus size={16} /> New item</button></div>
          </div>

          <section className="preview-section" aria-labelledby="inventory-list-title">
            <div className="preview-section-heading"><div><h2 id="inventory-list-title" className="sp-type-section">Items</h2><p className="sp-type-body text-sp-text-secondary">A sample view of stock records and availability.</p></div><button className="preview-text-action" type="button">View activity <ArrowDown size={14} className="preview-next-arrow" /></button></div>
            <div className="preview-tabs" role="tablist" aria-label="Illustrative preview sections">
              <button className="preview-tab is-active" type="button" role="tab" aria-selected="true">Records <span>24</span></button>
              <button className="preview-tab" type="button" role="tab" aria-selected="false">Controls <span>6</span></button>
              <button className="preview-tab" type="button" role="tab" aria-selected="false">States <span>4</span></button>
            </div>
            <div className="preview-panel">
              <div className="preview-toolbar">
                <label className="preview-search"><Search size={16} /><span className="sr-only">Search illustrative items</span><input placeholder="Search items…" /></label>
                <div className="preview-filter-actions"><button className="preview-button preview-button-filter" type="button"><Filter size={15} /> Filters</button><label className="preview-select-wrap"><span className="sr-only">Sample location</span><select className="preview-button preview-button-filter preview-select" defaultValue="all"><option value="all">All locations</option><option value="north">North facility</option><option value="south">South facility</option></select><ChevronDown size={14} /></label><button className="preview-button preview-button-filter preview-columns-button" type="button"><SlidersHorizontal size={15} /> Columns</button><button className="preview-button preview-button-filter preview-sort-button" type="button"><ArrowDownUp size={15} /><span>Sort</span></button></div>
              </div>
              <div className="preview-table-scroll" tabIndex={0} aria-label="Scrollable illustrative inventory table">
                <table className="preview-table">
                  <thead><tr><th scope="col">Item</th><th scope="col">Group</th><th scope="col">Location</th><th scope="col" className="is-numeric">On hand</th><th scope="col" className="is-numeric">Reserved</th><th scope="col" className="is-numeric">Available</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Row actions</span></th></tr></thead>
                  <tbody>{rows.map((row) => <tr key={row.sku}><td><div className="preview-item-cell"><span className="preview-item-icon"><Package size={15} /></span><span className="preview-item-copy"><strong>{row.name}</strong><small>{row.sku}</small></span></div></td><td className="preview-secondary-cell">{row.group}</td><td className="preview-secondary-cell">{row.location}</td><td className="is-numeric">{row.onHand}</td><td className="is-numeric preview-secondary-cell">{row.reserved}</td><td className="is-numeric preview-available-cell">{row.available}</td><td><span className={`preview-status is-${row.tone}`}><i />{row.status}</span></td><td><button className="preview-row-menu" aria-label={`More actions for ${row.sku}`} type="button"><MoreHorizontal size={17} /></button></td></tr>)}</tbody>
                </table>
              </div>
              <footer className="preview-table-footer"><span>Showing <strong>1–5</strong> of <strong>24</strong> illustrative items</span><div><button className="preview-page-button" type="button" disabled><ArrowDown size={13} className="preview-rotate" /> Previous</button><button className="preview-page-button" type="button">Next <ArrowDown size={13} className="preview-next-arrow" /></button></div></footer>
            </div>
          </section>

          <section className="preview-form-panel" aria-labelledby="sample-form-title">
            <div className="preview-form-intro"><div className="preview-form-icon"><Activity size={17} /></div><div><h2 id="sample-form-title" className="sp-type-panel">Form states</h2><p className="sp-type-meta text-sp-text-muted">Static examples for input, focus, and validation styling.</p></div></div>
            <div className="preview-form-grid">
              <label className="preview-field"><span className="sp-type-label">Item name</span><input className="preview-input" value="Recycled kraft mailer" readOnly /><small className="sp-type-meta text-sp-text-muted">Standard field · 36px control height</small></label>
              <label className="preview-field"><span className="sp-type-label">SKU <em>Required</em></span><input className="preview-input is-focused" value="MAT-2048" readOnly /><small className="sp-type-meta text-sp-text-muted">Focused state · visible brand focus</small></label>
              <label className="preview-field preview-field-error"><span className="sp-type-label">Reorder point <em>Required</em></span><input className="preview-input is-invalid" value="-4" readOnly aria-invalid="true" aria-describedby="preview-validation" /><small id="preview-validation" className="preview-validation-message"><span><Check size={12} /></span> Enter a quantity of 0 or more.</small></label>
            </div>
            <div className="preview-form-footer"><span className="sp-type-meta text-sp-text-muted">Samples are visual only; no data is saved.</span><button className="preview-button preview-button-secondary" type="button"><SlidersHorizontal size={15} /> Form settings</button></div>
          </section>

          <p className="preview-disclaimer"><span className="preview-disclaimer-dot" /> All names, counts, locations, and quantities above are illustrative sample data.</p>
        </main>
      </div>
    </div>
  );
}

const root = document.getElementById('design-preview-root');
if (!root) throw new Error('Missing design preview root');

createRoot(root).render(<StrictMode><Preview /></StrictMode>);
