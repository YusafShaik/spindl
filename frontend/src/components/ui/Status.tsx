export type StatusTone = 'green' | 'amber' | 'red' | 'purple';

export interface StatusProps {
  label: string;
}

function statusTone(label: string): StatusTone {
  if (label === 'Paid' || label === 'In stock' || label === 'Active') return 'green';
  if (label.toLowerCase().includes('await') || label === 'Low stock' || label === 'On hold') return 'amber';
  if (label.includes('Out')) return 'red';
  return 'purple';
}

export function Status({ label }: StatusProps) {
  return <span className={`status status-${statusTone(label)}`}><i aria-hidden="true" />{label}</span>;
}
