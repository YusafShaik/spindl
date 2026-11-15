import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './preview.css';

function Preview() {
  return (
    <main className="min-h-screen bg-sp-canvas px-6 py-8 font-sans text-sp-text">
      <div className="mx-auto grid max-w-5xl gap-8">
        <header className="grid gap-2">
          <h1 className="sp-type-page">Spindl design foundation</h1>
          <p className="sp-type-body text-sp-text-secondary">Isolated Tailwind v4 preview. These examples are primitive samples, not an application screen.</p>
        </header>

        <section className="grid gap-4">
          <h2 className="sp-type-section">Typography roles</h2>
          <div className="grid gap-3 rounded-lg border border-sp-border bg-sp-surface p-5">
            <p className="sp-type-panel">Panel heading · Inter 15 / 22 · 600</p>
            <p className="sp-type-body">Body copy · Inter 14 / 22 · 400</p>
            <p className="sp-type-table">Table value · Inter 14 / 20 · 400</p>
            <p className="sp-type-table-head">TABLE HEADING · INTER 12 / 18 · 600</p>
            <p className="sp-type-label">Form label · Inter 13 / 20 · 600</p>
            <p className="sp-type-meta text-sp-text-muted">Helper metadata · Inter 12 / 18 · 400</p>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="sp-type-section">Semantic colors</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Canvas', 'bg-sp-canvas'], ['Sidebar', 'bg-sp-sidebar'],
              ['Surface', 'bg-sp-surface'], ['Subtle', 'bg-sp-surface-subtle'],
              ['Hover', 'bg-sp-surface-hover'], ['Brand', 'bg-sp-brand text-white'],
              ['Brand soft', 'bg-sp-brand-soft text-sp-brand'], ['Success', 'bg-sp-success-soft text-sp-success'],
              ['Warning', 'bg-sp-warning-soft text-sp-warning'], ['Danger', 'bg-sp-danger-soft text-sp-danger'],
              ['Info', 'bg-sp-info-soft text-sp-info'],
            ].map(([label, classes]) => <div key={label} className={`sp-type-meta rounded-md border border-sp-border p-3 ${classes}`}>{label}</div>)}
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="sp-type-section">Spacing and borders</h2>
          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-sp-border bg-sp-surface p-5">
            {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((unit) => <div key={unit} className="grid justify-items-center gap-2"><div className="bg-sp-brand-soft" style={{ width: unit * 4, height: unit * 4 }} /><span className="sp-type-meta text-sp-text-muted">{unit * 4}px</span></div>)}
            <div className="sp-type-meta rounded-md border border-sp-border-strong px-3 py-2">1px semantic border</div>
          </div>
        </section>

        <section className="grid gap-4">
          <h2 className="sp-type-section">Interaction states</h2>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-sp-border bg-sp-surface p-5">
            <button className="sp-type-control rounded-md border border-sp-brand bg-sp-brand px-3 py-2 text-white transition-colors hover:bg-sp-brand-hover active:bg-sp-brand-active">Hover / press</button>
            <button className="sp-type-control rounded-md border border-sp-border bg-sp-surface px-3 py-2 text-sp-text transition-colors hover:border-sp-border-strong hover:bg-sp-surface-hover">Secondary hover</button>
            <button disabled className="sp-type-control cursor-not-allowed rounded-md border border-sp-border bg-sp-surface px-3 py-2 text-sp-text-disabled">Disabled</button>
            <input aria-label="Preview input" placeholder="Focus this field" className="sp-type-input h-9 rounded-md border border-sp-border bg-sp-surface px-3 text-sp-text placeholder:text-sp-text-muted focus:border-sp-brand focus:outline-2 focus:outline-sp-focus" />
          </div>
        </section>
      </div>
    </main>
  );
}

const root = document.getElementById('design-preview-root');
if (!root) throw new Error('Missing design preview root');

createRoot(root).render(<StrictMode><Preview /></StrictMode>);
