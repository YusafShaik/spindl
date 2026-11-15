import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowDown, ArrowUp, Bell, Boxes, ChartNoAxesColumnIncreasing, CheckCircle2,
  ChevronDown, CircleHelp, ClipboardList, CreditCard, Download, Factory, Filter,
  LayoutDashboard, Menu, MoreHorizontal, Package, Plus, Search, Settings,
  ShieldCheck, ShoppingCart, TriangleAlert, Users, Warehouse,
} from 'lucide-react';
import './preview.css';

const items = [
  { name: 'Aluminium Sheet 2mm', sku: 'ALU-102', category: 'Raw materials', warehouse: 'Main warehouse', on: '480', available: '450', unit: 'pcs', status: 'In stock', tone: 'good' },
  { name: 'Steel Fasteners M8', sku: 'STL-048', category: 'Components', warehouse: 'Main warehouse', on: '18', available: '12', unit: 'pcs', status: 'Low stock', tone: 'low' },
  { name: 'Copper Wire 1.5mm', sku: 'COP-215', category: 'Raw materials', warehouse: 'East depot', on: '1,250', available: '1,050', unit: 'm', status: 'In stock', tone: 'good' },
  { name: 'Packaging Inserts', sku: 'PKG-220', category: 'Packaging', warehouse: 'Main warehouse', on: '0', available: '0', unit: 'pcs', status: 'Out of stock', tone: 'out' },
  { name: 'Hydraulic Fittings', sku: 'HYD-083', category: 'Components', warehouse: 'West warehouse', on: '320', available: '290', unit: 'pcs', status: 'In stock', tone: 'good' },
  { name: 'Polymer Resin A4', sku: 'POL-411', category: 'Raw materials', warehouse: 'East depot', on: '95', available: '40', unit: 'kg', status: 'Low stock', tone: 'low' },
];

function Preview() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="min-h-screen bg-sp-canvas font-sans text-sp-text">
      <div className="shell">
        <aside className={`sidebar${mobileNavOpen ? ' open' : ''}`}>
          <div className="brand"><span className="brand-mark">s</span>spindl<span className="brand-workspace">WORKSPACE</span></div>
          <div className="workspace"><div className="ws-icon">AC</div><div className="ws-text"><b>Acme Manufacturing</b><small>Business workspace</small></div><ChevronDown size={16} /></div>
          <div className="sidebar-scroll">
            <div className="nav-group">Workspace</div>
            <div className="nav-item"><LayoutDashboard />Overview</div>
            <div className="nav-item active"><Package />Inventory<span className="count">2,846</span></div>
            <div className="nav-item"><ShoppingCart />Purchasing</div>
            <div className="nav-item"><Factory />Manufacturing</div>
            <div className="nav-item"><ShieldCheck />Quality</div>
            <div className="nav-group nav-group-spaced">Business</div>
            <div className="nav-item"><CreditCard />Sales &amp; POS</div>
            <div className="nav-item"><Users />Customers</div>
            <div className="nav-item"><CreditCard />Finance</div>
            <div className="nav-item"><ChartNoAxesColumnIncreasing />Reports</div>
            <div className="nav-group nav-group-spaced">Administration</div>
            <div className="nav-item"><Users />Team</div>
            <div className="nav-item"><Settings />Settings</div>
          </div>
          <div className="sidebar-bottom">
            <div className="nav-item" id="help"><CircleHelp />Help &amp; support</div>
            <div className="user"><div className="userpic">YS</div><div><b>Workspace Admin</b><small>Administrator</small></div><ChevronDown size={15} className="user-chevron" /></div>
          </div>
        </aside>
        <button className={`mobile-overlay${mobileNavOpen ? ' show' : ''}`} aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />

        <main className="work">
          <header className="top">
            <div className="breadcrumbs"><button className="iconbtn mobile-toggle" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={17} /></button><span>Workspace</span><span>/</span><b>Inventory</b><span>/</span><span>All items</span></div>
            <div className="top-right"><button className="iconbtn help" aria-label="Quick search"><Search /></button><span className="key">⌘ K</span><button className="iconbtn" aria-label="Notifications"><Bell /></button><div className="circle">YS</div></div>
          </header>

          <div className="page"><div className="page-inner">
            <div className="heading"><div><div className="overline">OPERATIONS / INVENTORY</div><h1>Inventory</h1><p>A clear view of stock, availability, and movement across your business.</p></div><div className="actions"><button className="btn"><Download size={14} />Export</button><button className="btn primary"><Plus size={14} />New item</button></div></div>

            <div className="metrics">
              <div className="metric"><div className="metric-title">Total inventory items <ClipboardList /></div><div className="metric-value">2,846</div><div className="metric-foot"><span className="positive">↗ 8.2%</span> from last month</div></div>
              <div className="metric"><div className="metric-title">Inventory value <CreditCard /></div><div className="metric-value">₹48.2L</div><div className="metric-foot">Across <span className="metric-emphasis">4 warehouses</span></div></div>
              <div className="metric"><div className="metric-title">Low stock items <TriangleAlert /></div><div className="metric-value">18</div><div className="metric-foot"><span className="caution">Needs attention</span> · 6 critical</div></div>
              <div className="metric"><div className="metric-title">Stock accuracy <CheckCircle2 /></div><div className="metric-value">98.6<span className="metric-percent">%</span></div><div className="metric-foot"><span className="positive">↗ 1.4%</span> from last audit</div></div>
            </div>

            <div className="section-head"><div><h2>Items</h2><p>Manage stock quantities, product details and warehouse availability.</p></div><button className="subtle-link">View stock movements ↗</button></div>
            <div className="tabs" role="tablist" aria-label="Inventory status filters"><button className="tab active" role="tab" aria-selected="true">All items <span>8</span></button><button className="tab" role="tab" aria-selected="false">Low stock <span>2</span></button><button className="tab" role="tab" aria-selected="false">Out of stock <span>1</span></button><button className="tab" role="tab" aria-selected="false">Reserved <span>1</span></button></div>

            <div className="table-tools"><div className="left-tools"><label className="search"><Search /><input placeholder="Search items or SKU..." aria-label="Search inventory" /></label><button className="filter"><Filter />Filters</button></div><div className="right-tools"><select className="filter" aria-label="Warehouse"><option>All warehouses</option><option>Main warehouse</option><option>East depot</option><option>West warehouse</option></select><button className="filter"><Boxes />Columns</button></div></div>

            <div className="table-card"><div className="table-scroll"><table><thead><tr><th><input type="checkbox" aria-label="Select all visible rows" /></th><th>ITEM <span className="sort-indicator">↕</span></th><th>SKU</th><th>CATEGORY</th><th>WAREHOUSE</th><th className="number">ON HAND</th><th className="number">AVAILABLE</th><th>STATUS</th><th /></tr></thead><tbody>{items.map((item) => <tr key={item.sku}><td><input type="checkbox" aria-label={`Select ${item.name}`} /></td><td><div className="item-cell"><div className="item-icon"><Package size={15} /></div><div><div className="item-name">{item.name}</div><div className="item-sub">Updated recently</div></div></div></td><td className="sku">{item.sku}</td><td>{item.category}</td><td>{item.warehouse}</td><td className="number stock">{item.on} <span className="muted">{item.unit}</span></td><td className="number">{item.available} <span className="muted">{item.unit}</span></td><td><span className={`badge ${item.tone}`}>{item.status}</span></td><td><button className="row-menu" aria-label={`More actions for ${item.name}`}>···</button></td></tr>)}</tbody></table></div><div className="table-footer"><span>Showing 1–6 of 8 items</span><div className="pagination"><button className="pg" aria-label="Previous page">‹</button><button className="pg active">1</button><button className="pg" aria-label="Next page">›</button></div></div></div>

            <div className="below">
              <div className="mini-card"><div className="mini-head"><h3>Recent stock movements</h3><span>Last 24 hours</span></div>
                <div className="movement"><div className="movement-icon"><ArrowUp size={16} /></div><div className="movement-info"><b>Aluminium Sheet 2mm</b><small>Stock received · PO-1042 · 10:42 AM</small></div><div className="movement-qty plus">+120 pcs</div></div>
                <div className="movement"><div className="movement-icon outgoing"><ArrowDown size={16} /></div><div className="movement-info"><b>Steel Fasteners M8</b><small>Production issue · WO-0831 · 09:18 AM</small></div><div className="movement-qty minus">−80 pcs</div></div>
                <div className="movement"><div className="movement-icon"><ArrowUp size={16} /></div><div className="movement-info"><b>Copper Wire 1.5mm</b><small>Warehouse transfer · TR-0226 · Yesterday</small></div><div className="movement-qty plus">+250 m</div></div>
              </div>
              <div className="mini-card"><div className="mini-head"><h3>Warehouse overview</h3><span>4 locations</span></div>
                <div className="location-row"><Warehouse className="loc-icon" /><div className="loc-details"><b>Main warehouse</b><small>Hyderabad · Primary location</small></div><div className="loc-count">1,482 items</div></div>
                <div className="location-row"><Warehouse className="loc-icon" /><div className="loc-details"><b>East depot</b><small>Distribution center</small></div><div className="loc-count">824 items</div></div>
                <div className="location-row"><Warehouse className="loc-icon" /><div className="loc-details"><b>West warehouse</b><small>Regional storage</small></div><div className="loc-count">540 items</div></div>
              </div>
            </div>
            <div className="concept-note">SPINDL · PRODUCT DESIGN CONCEPT 01 · Illustrative data · Interactive HTML prototype</div>
          </div></div>
        </main>
      </div>
    </div>
  );
}

const root = document.getElementById('design-preview-root');
if (!root) throw new Error('Missing design preview root');
createRoot(root).render(<StrictMode><Preview /></StrictMode>);
