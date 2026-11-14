export interface LeadActivity {
  id: string;
  activityType: string;
  body: string;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  actorUserId: string;
}

export interface LeadRecord {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  stage: string;
  ownerUserId: string;
  branchId: string;
  expectedValue: number | string | null;
  nextActivityTitle: string | null;
  nextActivityAt: string | null;
  convertedCustomerId: string | null;
  createdAt: string;
  updatedAt: string;
  activities: LeadActivity[];
}

export interface TenantBranchSummary {
  id: string;
  name: string;
  defaultBranch: boolean;
}

export interface LeadConversionResult {
  leadId: string;
  customerId: string;
  customerName: string;
  customerCreated: boolean;
  quoteId: string | null;
  quoteNumber: string | null;
}
