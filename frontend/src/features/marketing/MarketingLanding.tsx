import { ArrowDownRight, ArrowRight, ArrowUpRight, Boxes, Factory, FileText, Layers3, Menu, PackageCheck, ShieldCheck, ShoppingCart, Truck, X } from 'lucide-react';
import { useState } from 'react';
import { SpindlLogo } from '../../components/ui/SpindlLogo';

interface MarketingLandingProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

const modules = [
  { icon: ShoppingCart, title: 'Sales', description: 'Quotes, orders, dispatch and invoices in one flow.' },
  { icon: Boxes, title: 'Inventory', description: 'Stock levels, transfers, counts and movement history.' },
  { icon: Factory, title: 'Manufacturing', description: 'Bills of materials, routings and work orders.' },
  { icon: PackageCheck, title: 'Purchasing', description: 'Requisitions, approvals, receipts and supplier bills.' },
  { icon: FileText, title: 'Finance', description: 'Receivables, payables, ledger and operational reports.' },
  { icon: Truck, title: 'Operations', description: 'Quality, logistics, maintenance and workforce.' },
];

export function MarketingLanding({ onSignIn, onGetStarted }: MarketingLandingProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="spindl-site">
      <a className="site-skip" href="#site-main">Skip to content</a>
      <header className="site-nav">
        <div className="site-nav-inner">
          <a className="site-brand" href="#top" aria-label="Spindl home"><SpindlLogo size={27} /><span>Spindl</span></a>
          <button className="site-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
          <nav className={menuOpen ? 'site-links is-open' : 'site-links'} aria-label="Main navigation">
            <a href="#platform" onClick={closeMenu}>Platform</a>
            <a href="#workflow" onClick={closeMenu}>How it works</a>
            <a href="#modules" onClick={closeMenu}>Modules</a>
            <button className="site-login-mobile" onClick={() => { closeMenu(); onSignIn(); }}>Sign in</button>
          </nav>
          <div className="site-nav-actions"><button className="site-sign-in" onClick={onSignIn}>Sign in</button><button className="site-nav-cta" onClick={onGetStarted}>Get started <ArrowRight size={15} /></button></div>
        </div>
      </header>

      <main id="site-main">
        <section className="site-hero" id="top">
          <div className="site-hero-copy">
            
            <h1>ERP for teams that move goods.</h1>
            <p className="site-hero-lede">Connect sales, stock, purchasing and production in one workspace.</p>
            <div className="site-hero-actions"><button className="site-button-primary" onClick={onGetStarted}>Create a workspace <ArrowRight size={16} /></button><a className="site-text-link" href="#platform">Explore the platform <ArrowDownRight size={15} /></a></div>
            
          </div>
          <div className="site-product-wrap" id="platform" aria-label="Illustration of the Spindl operations workspace">
            <span className="site-product-label">Illustrative workspace</span>
            <div className="site-product-orbit site-product-orbit-one" /><div className="site-product-orbit site-product-orbit-two" />
            <div className="site-product-window">
              <div className="site-window-top"><div className="site-window-brand"><SpindlLogo size={19} /><span>Spindl</span></div><span className="site-window-workspace">Workspace <span>⌄</span></span><div className="site-window-avatar">S</div></div>
              <div className="site-window-body">
                <aside className="site-window-sidebar"><span className="site-side-label">Workspace</span><div className="site-side-item active"><Layers3 size={14} /> Overview</div><div className="site-side-item"><ShoppingCart size={14} /> Sales</div><div className="site-side-item"><Boxes size={14} /> Inventory</div><div className="site-side-item"><Factory size={14} /> Production</div><div className="site-side-item"><FileText size={14} /> Accounting</div><div className="site-side-divider"/><span className="site-side-label">Manage</span><div className="site-side-item"><ShieldCheck size={14} /> Settings</div></aside>
                <div className="site-window-main">
                  <div className="site-window-heading"><div><span className="site-window-eyebrow">Overview</span><h2>Overview</h2></div><span className="site-window-period">This month⌄</span></div>
                  <div className="site-window-metrics"><div><span>Sales orders</span><b>Open</b><small>Orders and dispatch</small></div><div><span>Stock items</span><b>Tracked</b><small>Across locations</small></div><div><span>Work orders</span><b>Planned</b><small>Production activity</small></div></div>
                  <div className="site-window-chart"><div className="site-chart-head"><div><b>Business activity</b><span>Invoiced sales and supplier bills</span></div><span className="site-chart-range">Last 6 months⌄</span></div><div className="site-chart-area"><div className="site-chart-y"><span></span><span></span><span></span><span></span></div><div className="site-chart-plot"><div className="site-chart-grid"><i/><i/><i/><i/></div><svg viewBox="0 0 530 116" preserveAspectRatio="none" aria-hidden="true"><path className="chart-fill" d="M0 92 C40 85 53 70 91 77 S143 87 177 60 S233 73 267 48 S321 57 354 35 S411 49 444 27 S494 42 530 14 V116 H0Z"/><path className="chart-line chart-line-indigo" d="M0 92 C40 85 53 70 91 77 S143 87 177 60 S233 73 267 48 S321 57 354 35 S411 49 444 27 S494 42 530 14"/><path className="chart-line chart-line-blue" d="M0 104 C40 96 56 103 91 90 S143 100 177 81 S233 92 267 77 S321 90 354 71 S411 82 444 64 S494 75 530 58"/></svg><div className="site-chart-x"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span></div></div></div><div className="site-chart-legend"><span><i className="metric-dot indigo"/> Invoiced sales</span><span><i className="metric-dot blue"/> Supplier bills</span></div></div>
                  <div className="site-window-bottom"><span><span className="online-dot"/> Workspace connected</span><span>Connected records <ArrowUpRight size={12}/></span></div>
                </div>
              </div>
            </div>

          </div>
          <a className="site-scroll-hint" href="#workflow"><span className="site-scroll-line"/> Explore the workflow</a>
        </section>

        <section className="site-workflow" id="workflow">
          <div className="site-section-head"><h2>One workflow. Every team in sync.</h2><p>Follow the work as it moves through your business. Keep the handoffs, records and stock connected along the way.</p></div>
          <div className="site-flow"><div className="site-flow-track"/><div className="site-flow-step"><span className="flow-index">01</span><span className="flow-icon"><ShoppingCart size={18}/></span><b>Sell</b><small>Quotes and orders</small></div><div className="site-flow-step"><span className="flow-index">02</span><span className="flow-icon"><Boxes size={18}/></span><b>Source</b><small>Stock and purchasing</small></div><div className="site-flow-step"><span className="flow-index">03</span><span className="flow-icon"><Factory size={18}/></span><b>Make</b><small>Plans and work orders</small></div><div className="site-flow-step"><span className="flow-index">04</span><span className="flow-icon"><Truck size={18}/></span><b>Deliver</b><small>Quality and logistics</small></div><div className="site-flow-step"><span className="flow-index">05</span><span className="flow-icon"><FileText size={18}/></span><b>Account</b><small>Invoices and ledger</small></div></div>
          <div className="site-flow-foot"><span>Each step updates the records the next team needs.</span><span className="site-flow-rule"/></div>
        </section>

        <section className="site-modules" id="modules">
          <div className="site-modules-intro"><h2>Run the details.<br/>See the whole operation.</h2><p>Work from shared records across teams, with access shaped by roles and workspace permissions.</p><a href="#site-footer" className="site-text-link">Start with your operation <ArrowRight size={15}/></a></div>
          <div className="site-module-list">{modules.map(({ icon: Icon, title, description }, index) => <article className="site-module-row" key={title}><span className="module-count">0{index + 1}</span><span className="module-icon"><Icon size={18}/></span><div className="module-copy"><h3>{title}</h3><p>{description}</p></div><ArrowUpRight className="module-arrow" size={16}/></article>)}</div>
          <div className="site-modules-note"><span className="site-note-rule"/><span>Use the modules your workspace needs. Your business data stays in place as your setup changes.</span></div>
        </section>

        <section className="site-cta" id="get-started"><div className="site-cta-inner"><div><h2>Bring the work<br/>into one view.</h2><p>Set up a Spindl workspace for your team.</p></div><button className="site-button-primary site-button-large" onClick={onGetStarted}>Create a workspace <ArrowRight size={17}/></button><SpindlLogo className="site-cta-mark" size={190}/></div></section>
      </main>

      <footer className="site-footer" id="site-footer"><div className="site-footer-main"><a className="site-brand" href="#top"><SpindlLogo size={25}/><span>Spindl</span></a><p>Business operations, connected.</p><nav aria-label="Footer navigation"><a href="#platform">Platform</a><a href="#workflow">How it works</a><a href="#modules">Modules</a><button onClick={onSignIn}>Sign in</button></nav></div><div className="site-footer-legal"><span>© {new Date().getFullYear()} Spindl</span><span>Business operations software</span></div></footer>
    </div>
  );
}
