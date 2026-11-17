import { Activity, ArrowUpRight, type LucideIcon } from 'lucide-react';

export type KpiAccent = 'purple' | 'amber' | 'blue' | 'green';
export type KpiSpark = 'sales' | 'orders' | 'inventory' | 'customers';

export interface KpiCardProps {
  title: string;
  value: string | number;
  change: string;
  positive?: boolean;
  detail: string;
  icon: LucideIcon;
  accent: KpiAccent;
  spark: KpiSpark;
  onClick?: () => void;
}

const sparkPaths: Record<KpiSpark, string> = {
  sales: 'M0 25 C14 24 12 14 23 17 S35 24 45 13 S62 16 72 8 S87 13 100 2',
  orders: 'M0 18 C12 14 16 23 28 20 S40 7 52 11 S65 17 76 10 S90 12 100 4',
  inventory: 'M0 23 C15 21 17 14 28 18 S42 12 51 15 S67 20 76 9 S90 12 100 3',
  customers: 'M0 21 C11 15 18 19 27 12 S40 17 52 8 S65 12 73 6 S89 10 100 1',
};

export function KpiCard({ title, value, change, positive, detail, icon: Icon, accent, spark, onClick }: KpiCardProps) {
  const isClickable = Boolean(onClick);

  return (
    <section
      className={`panel kpi-card ${isClickable ? 'kpi-card-clickable' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      aria-label={isClickable ? `${title}: ${value}. Click to view details.` : undefined}
    >
      <div className="kpi-top">
        <span>{title}</span>
        <span className={`kpi-icon ${accent}`}>
          <Icon size={14} aria-hidden="true" />
        </span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className="kpi-bottom">
        <span className={`change ${positive ? 'positive' : ''}`}>
          {positive ? <ArrowUpRight size={13} aria-hidden="true" /> : <Activity size={13} aria-hidden="true" />} {change}
        </span>
        <span className="kpi-detail">{detail}</span>
      </div>
      <svg className={`sparkline ${accent}`} viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
        <path d={sparkPaths[spark]} />
      </svg>
    </section>
  );
}
