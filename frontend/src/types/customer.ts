export interface CustomerRecord {
  id: string;
  code: string;
  name: string;
  email: string;
  orders: number;
  outstanding: string;
  status: string;
  initials: string;
  tone: string;
  customerType?: string | null;
  contactName?: string | null;
  phone?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  taxId?: string | null;
  paymentTermsDays?: number;
  creditLimit?: number | string | null;
  tags?: string | null;
  ownerUserId?: string | null;
  creditHold: boolean;
}

export interface CustomerTimelineEvent {
  occurredAt: string;
  eventType: string;
  reference: string;
  status: string;
  amount: number | string | null;
}
