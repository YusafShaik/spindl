export type StatusTone = 'green' | 'amber' | 'red' | 'slate' | 'blue' | 'purple';

export interface StatusProps {
  label: string;
}

export function statusTone(label: string): StatusTone {
  const l = (label || '').trim().toLowerCase();

  // 1. Success / Settled / Active / Fulfilled / Converted (Green indicator)
  if (
    l === 'paid' ||
    l === 'posted' ||
    l === 'settled' ||
    l === 'active' ||
    l === 'in stock' ||
    l === 'in_stock' ||
    l === 'completed' ||
    l === 'released' ||
    l === 'approved' ||
    l === 'delivered' ||
    l === 'fulfilled' ||
    l === 'closed' ||
    l === 'healthy' ||
    l === 'ready' ||
    l === 'operational' ||
    l === 'received' ||
    l === 'converted' ||
    l === 'verified' ||
    l === 'resolved'
  ) {
    return 'green';
  }

  // 2. In Transit / Underway / Scheduled (Blue indicator)
  if (
    l === 'in transit' ||
    l === 'in_transit' ||
    l === 'transit' ||
    l === 'dispatched'
  ) {
    return 'blue';
  }

  // 3. Pending / Warning / In-Progress / Unpaid / Low stock / Packed (Amber indicator)
  if (
    l === 'unpaid' ||
    l === 'partially paid' ||
    l === 'partially_paid' ||
    l === 'partial' ||
    l === 'pending' ||
    l === 'in progress' ||
    l === 'in_progress' ||
    l === 'packed' ||
    l === 'low stock' ||
    l === 'low_stock' ||
    l === 'on hold' ||
    l === 'on_hold' ||
    l === 'open' ||
    l === 'due' ||
    l === 'review' ||
    l.includes('await') ||
    l.includes('hold') ||
    l.includes('partial')
  ) {
    return 'amber';
  }

  // 4. Destructive / Error / Overdue / Rejected / Out of stock / Breakdown (Red indicator)
  if (
    l === 'overdue' ||
    l === 'rejected' ||
    l === 'cancelled' ||
    l === 'canceled' ||
    l === 'void' ||
    l === 'failed' ||
    l === 'breakdown' ||
    l === 'emergency' ||
    l === 'under_maintenance' ||
    l.includes('out') ||
    l.includes('shortage')
  ) {
    return 'red';
  }

  // 4. Default / Neutral Backlog / Draft (Slate indicator)
  return 'slate';
}

export function Status({ label }: StatusProps) {
  const tone = statusTone(label);
  return (
    <span className={`status status-${tone}`}>
      <i aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

