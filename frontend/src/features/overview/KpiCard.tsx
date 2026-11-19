import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';

export type KpiAccent = 'purple' | 'amber' | 'blue' | 'green' | 'neutral';
export type KpiSpark = 'sales' | 'orders' | 'inventory' | 'customers';

export interface KpiCardProps {
  title: string;
  value: string | number;
  change?: string;
  positive?: boolean;
  detail?: string;
  icon: LucideIcon;
  accent?: KpiAccent;
  spark?: KpiSpark;
  badge?: string;
  badgeTone?: 'neutral' | 'positive' | 'warning' | 'purple' | 'blue';
  onClick?: () => void;
}

export function KpiCard({
  title,
  value,
  change,
  positive,
  detail,
  icon: Icon,
  accent = 'neutral',
  badge,
  badgeTone,
  onClick,
}: KpiCardProps) {
  const isClickable = Boolean(onClick);

  // Compute effective badge text & tone
  const effectiveBadge = badge ?? change;
  const effectiveTone =
    badgeTone ??
    (positive !== undefined
      ? positive
        ? 'positive'
        : 'warning'
      : accent === 'purple'
      ? 'purple'
      : accent === 'amber'
      ? 'warning'
      : accent === 'green'
      ? 'positive'
      : 'neutral');

  return (
    <section
      className={`kpi-card ${isClickable ? 'kpi-card-clickable' : ''}`}
      onClick={onClick}
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={
        isClickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={isClickable ? `${title}: ${value}. Click to view details.` : undefined}
    >
      <div className="kpi-top">
        <span className="kpi-title">{title}</span>
        <span className="kpi-icon" aria-hidden="true">
          <Icon size={14} />
        </span>
      </div>

      <div className="kpi-value">{value}</div>

      <div className="kpi-bottom">
        {effectiveBadge && (
          <span className={`kpi-badge kpi-badge-${effectiveTone}`}>
            {effectiveTone === 'positive' && <ArrowUpRight size={11} aria-hidden="true" />}
            {effectiveTone === 'warning' && <ArrowDownRight size={11} aria-hidden="true" />}
            <span>{effectiveBadge}</span>
          </span>
        )}
        {detail && <span className="kpi-detail">{detail}</span>}
      </div>
    </section>
  );
}
