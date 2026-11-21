import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Eye,
  Filter,
  GitBranch,
  KeyRound,
  Layers,
  Lock,
  Mail,
  Plus,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import type { TenantBranchSummary } from '../../types/crm';

export interface TeamMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  branchIds?: string[];
  managerUserId?: string | null;
}

export interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  accepted: boolean;
}

interface TeamBranch extends TenantBranchSummary {
  active: boolean;
}

export interface TeamRole {
  roleCode: string;
  displayName: string;
}

interface TeamSession {
  role?: string;
}

interface InviteLink {
  email: string;
  link: string;
}

interface OwnershipLink {
  email: string;
  expiresAt: string;
  transferToken: string;
}

type MemberScope = {
  branchIds: string[];
  managerUserId: string | null;
};

export interface TeamPanelProps {
  members: TeamMember[];
  invitations: TeamInvitation[];
  roles: TeamRole[];
  latestInvite: InviteLink | null;
  loading: boolean;
  saving: boolean;
  session: TeamSession | null;
  ownershipLink: OwnershipLink | null;
  onInvite: (event: FormEvent<HTMLFormElement>) => void;
  onRole: (id: string, role: string) => void;
  onActive: (id: string, active: boolean) => void;
  onScope: (id: string, scope: MemberScope) => void;
  onCopy: (message?: string) => void;
  onOwnershipRequest: (payload: { targetMembershipId: string; password: FormDataEntryValue | null }) => void;
  onOwnershipConfirm: (payload: { token: FormDataEntryValue | null; password: FormDataEntryValue | null }) => void;
  onResend: (id: string) => void;
}

type TeamSubTab = 'members' | 'invitations' | 'roles' | 'governance';

function isBranch(value: unknown): value is TeamBranch {
  return (
    value !== null &&
    typeof value === 'object' &&
    'id' in value &&
    'name' in value &&
    'active' in value &&
    typeof (value as { id: unknown }).id === 'string' &&
    typeof (value as { name: unknown }).name === 'string' &&
    typeof (value as { active: unknown }).active === 'boolean'
  );
}

// Helper to get initials
function getInitials(name: string): string {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return (name || 'U').substring(0, 2).toUpperCase();
}

// Role metadata descriptions
const ROLE_DEFINITIONS: Record<
  string,
  {
    title: string;
    description: string;
    badgeClass: string;
    responsibilities: string[];
  }
> = {
  OWNER: {
    title: 'Workspace Owner',
    description:
      'Supreme jurisdiction over company data, billing, security, module entitlements, and ownership transfers.',
    badgeClass: 'owner',
    responsibilities: [
      'Full Database Jurisdiction (*)',
      'Billing & Module Entitlements',
      'Ownership Transfer Governance',
      'API Security & Webhook Setup',
      'Compliance & Audit Export'
    ]
  },
  ADMIN: {
    title: 'Workspace Administrator',
    description:
      'Supervisory authority. Manages team invitations, branches, custom fields, and module configurations.',
    badgeClass: 'admin',
    responsibilities: [
      'Team & Role Administration',
      'Branch Creation & Scopes',
      'Custom Fields Schema Publishing',
      'Cross-Module Operations',
      'Notification Dispatch Rules'
    ]
  },
  MANAGER: {
    title: 'Operations Manager',
    description:
      'Supervises departmental execution, approves purchase orders, reconciles ledger, and signs off quality gates.',
    badgeClass: 'manager',
    responsibilities: [
      'Purchase Order Approvals',
      'Inventory Adjustments & Stock Takes',
      'Work Order Outputs & Sign-offs',
      'Customer Credit Notes & Refunds',
      'Quality Standard Overrides'
    ]
  },
  OPERATOR: {
    title: 'Floor Operator',
    description:
      'Conducts day-to-day warehouse movements, assembly runs, quality testing, and customer quotes.',
    badgeClass: 'operator',
    responsibilities: [
      'Goods Receipt & Movements',
      'Job Card Output & Scrap Logging',
      'Inspection Queue Submissions',
      'Sales Quotation Drafting',
      'Item Catalog Verification'
    ]
  },
  VIEWER: {
    title: 'Read-Only Auditor',
    description:
      'Auditing and read-only transparency. Can inspect all records, reports, and dashboards without modification rights.',
    badgeClass: 'viewer',
    responsibilities: [
      'Operational Dashboard Views',
      'Catalog & Inventory Lookup',
      'Customer & Order Status Views',
      'Financial Summary Insights',
      'No Mutating Privileges'
    ]
  }
};

type PermissionLevel = 'FULL' | 'MANAGE' | 'VIEW' | 'NONE';

interface PermissionCapability {
  name: string;
  description: string;
  roles: {
    OWNER: PermissionLevel;
    ADMIN: PermissionLevel;
    MANAGER: PermissionLevel;
    OPERATOR: PermissionLevel;
    VIEWER: PermissionLevel;
  };
}

interface PermissionCategory {
  category: string;
  icon: typeof Shield;
  capabilities: PermissionCapability[];
}

const PERMISSION_MATRIX: PermissionCategory[] = [
  {
    category: 'Platform & Governance',
    icon: Shield,
    capabilities: [
      {
        name: 'Workspace Ownership & Handover',
        description: 'Initiate or confirm primary fiscal & legal workspace ownership transfers.',
        roles: { OWNER: 'FULL', ADMIN: 'NONE', MANAGER: 'NONE', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'Billing & Module Entitlements',
        description: 'Configure subscriptions, payment gateways, and activate modular add-ons.',
        roles: { OWNER: 'FULL', ADMIN: 'MANAGE', MANAGER: 'VIEW', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'Team Membership & Role Assignments',
        description: 'Invite members, assign system roles, and revoke account credentials.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'VIEW', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'Operating Branch Creation & Scopes',
        description: 'Define physical plant branches and assign operator location constraints.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'MANAGE', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'Custom Fields Schema Publishing',
        description: 'Author and publish dynamic schema fields across customer & item entities.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'VIEW', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'API Keys & Outbound Webhooks',
        description: 'Provision tenant-level cryptographic tokens and webhook endpoints.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'NONE', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'System Audit Logs & Regulatory Export',
        description: 'Inspect immutable system event ledgers and download cryptographic audit trails.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'VIEW', OPERATOR: 'NONE', VIEWER: 'VIEW' }
      }
    ]
  },
  {
    category: 'Procurement & Inventory',
    icon: Database,
    capabilities: [
      {
        name: 'Supplier Master Directory',
        description: 'Create and update approved procurement vendors and tax credentials.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'VIEW', VIEWER: 'VIEW' }
      },
      {
        name: 'Purchase Orders & Requisitions',
        description: 'Draft purchase requisitions and supplier procurement contracts.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'MANAGE', VIEWER: 'VIEW' }
      },
      {
        name: 'Purchase Order Approval Authority',
        description: 'Authorize financial commitments exceeding standard department thresholds.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'Goods Receipt & Stock Dispatches',
        description: 'Post physical intake receipts, putaway, and warehouse transfers.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'FULL', VIEWER: 'VIEW' }
      },
      {
        name: 'Inventory Adjustments & Cycle Counts',
        description: 'Execute physical inventory audits and post variance write-offs.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'MANAGE', VIEWER: 'VIEW' }
      }
    ]
  },
  {
    category: 'Manufacturing & Engineering',
    icon: Layers,
    capabilities: [
      {
        name: 'Bill of Materials (BOM) Specs',
        description: 'Define multi-level assembly specifications, component scrap & lines.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'VIEW', VIEWER: 'VIEW' }
      },
      {
        name: 'Work Order Execution & Scrap Logging',
        description: 'Launch shop floor work orders, register good output, and log material scrap.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'FULL', VIEWER: 'VIEW' }
      },
      {
        name: 'Engineering Change Orders (ECO)',
        description: 'Approve engineering revision diffs, BOM updates, and effective cutoffs.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'NONE', VIEWER: 'VIEW' }
      },
      {
        name: 'Quality Gate Sign-offs & Inspections',
        description: 'Execute lot sampling, submit test queues, and approve quarantine passes.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'FULL', VIEWER: 'VIEW' }
      },
      {
        name: 'Quality Standards & Deviation Overrides',
        description: 'Grant managerial waivers for out-of-spec production releases.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'NONE', VIEWER: 'NONE' }
      }
    ]
  },
  {
    category: 'Commercial & Accounting',
    icon: Building2,
    capabilities: [
      {
        name: 'Customer Directory & Credit Terms',
        description: 'Manage buyer accounts, payment terms, and approved credit limits.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'MANAGE', VIEWER: 'VIEW' }
      },
      {
        name: 'Commercial Quotations & Sales Orders',
        description: 'Draft pricing quotes, negotiate margins, and confirm customer sales.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'FULL', VIEWER: 'VIEW' }
      },
      {
        name: 'Invoicing, POS Sales & Settlements',
        description: 'Issue commercial tax invoices, execute counter POS sales, and record receipts.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'MANAGE', VIEWER: 'VIEW' }
      },
      {
        name: 'Credit Notes, Returns & Cash Refunds',
        description: 'Authorize customer credit notes, debit adjustments, and cash returns.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'NONE', VIEWER: 'NONE' }
      },
      {
        name: 'General Ledger, JVs & Financial Reports',
        description: 'Sign off manual journal entries, view P&L, balance sheets, and tax filings.',
        roles: { OWNER: 'FULL', ADMIN: 'FULL', MANAGER: 'FULL', OPERATOR: 'NONE', VIEWER: 'VIEW' }
      }
    ]
  }
];

function renderPermBadge(level: PermissionLevel) {
  switch (level) {
    case 'FULL':
      return (
        <span className="matrix-perm-badge full">
          <CheckCircle2 size={11} /> Full
        </span>
      );
    case 'MANAGE':
      return (
        <span className="matrix-perm-badge manage">
          <Check size={11} /> Manage
        </span>
      );
    case 'VIEW':
      return (
        <span className="matrix-perm-badge view">
          <Eye size={11} /> View
        </span>
      );
    case 'NONE':
    default:
      return <span className="matrix-perm-badge none">—</span>;
  }
}

export function TeamPanel({
  members,
  invitations,
  roles,
  latestInvite,
  loading,
  saving,
  session,
  ownershipLink,
  onInvite,
  onRole,
  onActive,
  onScope,
  onCopy,
  onOwnershipRequest,
  onOwnershipConfirm,
  onResend
}: TeamPanelProps) {
  const [activeTab, setActiveTab] = useState<TeamSubTab>('members');
  const [branches, setBranches] = useState<TeamBranch[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Matrix tab filters
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState('ALL');
  const [matrixSearchQuery, setMatrixSearchQuery] = useState('');

  // Modals
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [scopeMember, setScopeMember] = useState<TeamMember | null>(null);
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [selectedManagerUserId, setSelectedManagerUserId] = useState<string | null>(null);

  // Ownership transfer state
  const [targetMembershipId, setTargetMembershipId] = useState('');
  const [inviteLinkBanner, setInviteLinkBanner] = useState<InviteLink | null>(null);

  // Synchronize latest invite to local banner state
  useEffect(() => {
    if (latestInvite) {
      setInviteLinkBanner(latestInvite);
    }
  }, [latestInvite]);

  // Load tenant branches
  useEffect(() => {
    let current = true;
    apiFetch(`${API}/tenant/branches`)
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: unknown) => {
        if (current && Array.isArray(rows)) {
          setBranches(rows.filter(isBranch));
        }
      })
      .catch(() => {
        if (current) setBranches([]);
      });
    return () => {
      current = false;
    };
  }, []);

  // Filtered members
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      // Role filter
      if (roleFilter !== 'ALL' && m.role !== roleFilter) return false;
      // Status filter
      if (statusFilter === 'ACTIVE' && !m.active) return false;
      if (statusFilter === 'INACTIVE' && m.active) return false;
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = m.name.toLowerCase().includes(q);
        const matchesEmail = m.email.toLowerCase().includes(q);
        const matchesRole = m.role.toLowerCase().includes(q);
        return matchesName || matchesEmail || matchesRole;
      }
      return true;
    });
  }, [members, roleFilter, statusFilter, searchQuery]);

  // Filtered invitations
  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return inv.email.toLowerCase().includes(q) || inv.role.toLowerCase().includes(q);
      }
      return true;
    });
  }, [invitations, searchQuery]);

  // KPI calculations
  const activeMembers = useMemo(() => members.filter((m) => m.active).length, [members]);
  const pendingInvites = useMemo(() => invitations.filter((i) => !i.accepted).length, [invitations]);

  // Current Owner calculation
  const currentOwner = useMemo(() => {
    return members.find((m) => m.role === 'OWNER') || null;
  }, [members]);

  // Filtered Matrix for Sub-tab 3
  const filteredMatrix = useMemo(() => {
    return PERMISSION_MATRIX.map((cat) => {
      if (matrixCategoryFilter !== 'ALL' && cat.category !== matrixCategoryFilter) {
        return null;
      }
      const matchingCaps = cat.capabilities.filter((cap) => {
        if (!matrixSearchQuery.trim()) return true;
        const q = matrixSearchQuery.toLowerCase();
        return cap.name.toLowerCase().includes(q) || cap.description.toLowerCase().includes(q);
      });
      if (matchingCaps.length === 0) return null;
      return { ...cat, capabilities: matchingCaps };
    }).filter((cat): cat is NonNullable<typeof cat> => cat !== null);
  }, [matrixCategoryFilter, matrixSearchQuery]);

  // Map of users by userId for manager lookups
  const userMap = useMemo(() => {
    const map = new Map<string, TeamMember>();
    members.forEach((m) => map.set(m.userId, m));
    return map;
  }, [members]);

  // Open edit scope modal
  const openScopeModal = (member: TeamMember) => {
    setScopeMember(member);
    setSelectedBranchIds(member.branchIds || []);
    setSelectedManagerUserId(member.managerUserId || null);
  };

  // Close scope modal
  const closeScopeModal = () => {
    setScopeMember(null);
    setSelectedBranchIds([]);
    setSelectedManagerUserId(null);
  };

  // Save member scope
  const handleSaveScope = () => {
    if (!scopeMember) return;
    onScope(scopeMember.id, {
      branchIds: selectedBranchIds,
      managerUserId: selectedManagerUserId
    });
    closeScopeModal();
  };

  // Toggle branch selection
  const toggleBranchSelection = (branchId: string) => {
    setSelectedBranchIds((prev) =>
      prev.includes(branchId) ? prev.filter((id) => id !== branchId) : [...prev, branchId]
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 1. Linear Executive KPI Strip */}
      <div className="sales-metric-strip">
        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">ACTIVE WORKSPACE TEAM</span>
            <Users size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {activeMembers} Members
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{members.length - activeMembers} Inactive</span> ·{' '}
            {members.length} Total Registered
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SEAT ALLOCATION & QUOTA</span>
            <CheckCircle2 size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {activeMembers} / 25 Allocated
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Enterprise Tier</span> · 19 Available Seats
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">PENDING INVITATIONS</span>
            <Mail size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {pendingInvites} Pending
          </div>
          <div className="sales-metric-sub">
            Awaiting 7-day secure one-time activation
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SECURITY & ACCESS GOVERNANCE</span>
            <ShieldCheck size={13} style={{ color: 'var(--sp-text-muted)' }} />
          </div>
          <div className="sales-metric-val" style={{ fontVariantNumeric: 'tabular-nums' }}>
            {roles.length || 5} System Roles
          </div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">SOC 2 / ISO 27001</span> · Least Privilege
          </div>
        </div>
      </div>

      {/* 2. Invitation Link Ready Banner (Dismissible) */}
      {inviteLinkBanner && (
        <div
          style={{
            padding: '14px 16px',
            background: 'var(--sp-brand-soft)',
            border: '1px solid rgba(94, 70, 193, 0.25)',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '6px',
                background: 'var(--sp-brand)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <KeyRound size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                Activation link ready for {inviteLinkBanner.email}
              </div>
              <div
                style={{
                  fontSize: '11.5px',
                  color: 'var(--sp-text-secondary)',
                  marginTop: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>Valid for 7 days. Token shown only once.</span>
                <code
                  style={{
                    color: 'var(--sp-brand)',
                    background: 'rgba(94, 70, 193, 0.08)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '380px'
                  }}
                >
                  {inviteLinkBanner.link}
                </code>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button
              type="button"
              className="sales-action-btn primary"
              onClick={() => {
                navigator.clipboard.writeText(inviteLinkBanner.link).then(() => {
                  onCopy('Invitation link copied');
                });
              }}
            >
              <Copy size={13} /> Copy Link
            </button>
            <button
              type="button"
              className="sales-action-btn secondary"
              onClick={() => setInviteLinkBanner(null)}
              title="Dismiss banner"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 3. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'members' ? 'active' : ''}`}
            onClick={() => setActiveTab('members')}
          >
            <Users size={14} />
            <span>Members & Access</span>
            <span className="sales-subnav-badge">{members.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'invitations' ? 'active' : ''}`}
            onClick={() => setActiveTab('invitations')}
          >
            <Mail size={14} />
            <span>Pending Invitations</span>
            <span className="sales-subnav-badge">{pendingInvites}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'roles' ? 'active' : ''}`}
            onClick={() => setActiveTab('roles')}
          >
            <ShieldCheck size={14} />
            <span>Roles & Permissions Matrix</span>
            <span className="sales-subnav-badge">{roles.length || 5} roles</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'governance' ? 'active' : ''}`}
            onClick={() => setActiveTab('governance')}
          >
            <Lock size={14} />
            <span>Governance & Ownership Transfer</span>
            {session?.role === 'OWNER' && (
              <span className="sales-subnav-badge" style={{ background: '#f3e8ff', color: '#7e22ce' }}>
                Owner Action
              </span>
            )}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            className="sales-action-btn primary"
            onClick={() => setShowInviteModal(true)}
          >
            <UserPlus size={13} />
            <span>Invite Teammate</span>
          </button>
        </div>
      </div>

      {/* 4. SUB-TAB 1: Members & Access */}
      {activeTab === 'members' && (
        <div className="sales-table-card">
          {/* High-density Linear toolbar */}
          <div className="sales-toolbar" style={{ padding: '12px 14px', borderBottom: '1px solid var(--sp-border)' }}>
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${roleFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setRoleFilter('ALL')}
              >
                All Roles <span className="sales-pill-count">{members.length}</span>
              </button>
              {roles.map((r) => (
                <button
                  key={r.roleCode}
                  type="button"
                  className={`sales-pill-btn ${roleFilter === r.roleCode ? 'active' : ''}`}
                  onClick={() => setRoleFilter(r.roleCode)}
                >
                  {r.displayName}{' '}
                  <span className="sales-pill-count">
                    {members.filter((m) => m.role === r.roleCode).length}
                  </span>
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="sales-search-box">
                <Search size={14} className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  placeholder="Search member by name, email, or role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setSearchQuery('')}
                    title="Clear search"
                  >
                    <X size={12} />
                  </button>
                ) : (
                  <kbd className="sales-search-kbd">/</kbd>
                )}
              </div>

              <select
                className="sales-filter-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
                style={{ height: '28px', fontSize: '11.5px' }}
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active ({activeMembers})</option>
                <option value="INACTIVE">Inactive ({members.length - activeMembers})</option>
              </select>
            </div>
          </div>

          {/* Members Table */}
          <div className="sales-table-scroll">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>MEMBER</th>
                  <th style={{ width: '20%' }}>EMAIL</th>
                  <th style={{ width: '15%' }}>WORKSPACE ROLE</th>
                  <th style={{ width: '14%' }}>ASSIGNED BRANCHES</th>
                  <th style={{ width: '10%' }}>REPORTS TO</th>
                  <th style={{ width: '7%' }}>STATUS</th>
                  <th style={{ width: '8%', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      Loading workspace team members…
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-cell">
                      No workspace members match your criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((member) => {
                    const roleDef = ROLE_DEFINITIONS[member.role] || {
                      title: member.role,
                      badgeClass: 'viewer'
                    };
                    const manager = member.managerUserId ? userMap.get(member.managerUserId) : null;
                    const assignedBranches = (member.branchIds || [])
                      .map((bId) => branches.find((b) => b.id === bId))
                      .filter(Boolean) as TeamBranch[];

                    return (
                      <tr key={member.id} className="sales-row">
                        {/* Member Name + Avatar */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div className={`team-avatar ${member.active ? '' : 'inactive'}`}>
                              {getInitials(member.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '13px' }}>
                                {member.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                Member ID: {member.id.substring(0, 8)}…
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td style={{ fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                          <span>
                            {member.email}
                          </span>
                        </td>

                        {/* Role */}
                        <td>
                          {member.role === 'OWNER' ? (
                            <span className="team-role-badge owner">
                              <Shield size={11} /> {roleDef.title}
                            </span>
                          ) : (
                            <select
                              className="sales-filter-select"
                              value={member.role}
                              disabled={member.role === 'OWNER'}
                              onChange={(e) => onRole(member.id, e.target.value)}
                              style={{
                                height: '26px',
                                padding: '0 6px',
                                fontSize: '11px',
                                fontWeight: 600
                              }}
                            >
                              {roles
                                .filter((r) => r.roleCode !== 'OWNER')
                                .map((r) => (
                                  <option key={r.roleCode} value={r.roleCode}>
                                    {r.displayName}
                                  </option>
                                ))}
                            </select>
                          )}
                        </td>

                        {/* Assigned Branches */}
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            {assignedBranches.length > 0 ? (
                              assignedBranches.map((br) => (
                                <span key={br.id} className="team-branch-pill">
                                  <Building2 size={10} /> {br.name}
                                </span>
                              ))
                            ) : (
                              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                All branches (Global)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Reports To Manager */}
                        <td>
                          {manager ? (
                            <span className="team-manager-pill">
                              <Users size={11} /> {manager.name}
                            </span>
                          ) : member.role === 'OWNER' ? (
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              Principal
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                              Direct to Owner
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`sales-status-chip ${member.active ? 'active' : 'inactive'}`}>
                            {member.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                            {member.role === 'OWNER' ? (
                              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontStyle: 'italic' }}>
                                Workspace Owner
                              </span>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="sales-action-btn secondary"
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => openScopeModal(member)}
                                  title="Edit branch assignments and manager hierarchy"
                                >
                                  <Sliders size={12} /> Scope
                                </button>

                                <button
                                  type="button"
                                  className={`sales-action-btn ${member.active ? 'secondary' : 'primary'}`}
                                  style={{ padding: '3px 8px', fontSize: '11px' }}
                                  onClick={() => onActive(member.id, !member.active)}
                                  title={member.active ? 'Deactivate member login' : 'Reactivate member account'}
                                >
                                  {member.active ? <UserMinus size={12} /> : <UserCheck size={12} />}
                                  <span>{member.active ? 'Deactivate' : 'Reactivate'}</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 2: Pending Invitations */}
      {activeTab === 'invitations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="sales-table-card">
            <div className="sales-toolbar" style={{ padding: '12px 14px', borderBottom: '1px solid var(--sp-border)' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text-secondary)' }}>
                Pending Invitations ({filteredInvitations.length})
              </span>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div className="sales-search-box">
                  <Search size={14} className="sales-search-icon" />
                  <input
                    className="sales-search-input"
                    placeholder="Filter invitations by email or role…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      className="sales-search-clear"
                      onClick={() => setSearchQuery('')}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  ) : (
                    <kbd className="sales-search-kbd">/</kbd>
                  )}
                </div>
              </div>
            </div>

            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>INVITEE EMAIL</th>
                    <th style={{ width: '20%' }}>ASSIGNED ROLE</th>
                    <th style={{ width: '20%' }}>EXPIRATION DATE</th>
                    <th style={{ width: '15%' }}>STATUS</th>
                    <th style={{ width: '15%', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvitations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-cell">
                        No pending invitations found. Invite a teammate above to get started.
                      </td>
                    </tr>
                  ) : (
                    filteredInvitations.map((invite) => {
                      const isExpired = new Date(invite.expiresAt) < new Date();
                      const roleDef = ROLE_DEFINITIONS[invite.role] || {
                        title: invite.role,
                        badgeClass: 'viewer'
                      };

                      return (
                        <tr key={invite.id} className="sales-row">
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Mail size={14} style={{ color: 'var(--sp-text-muted)' }} />
                              <span style={{ fontWeight: 600, color: 'var(--sp-text)', fontSize: '12.5px' }}>
                                {invite.email}
                              </span>
                            </div>
                          </td>

                          <td>
                            <span className={`team-role-badge ${roleDef.badgeClass}`}>
                              {roleDef.title}
                            </span>
                          </td>

                          <td style={{ fontSize: '12px', color: 'var(--sp-text-secondary)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Clock size={12} />
                              <span>{new Date(invite.expiresAt).toLocaleDateString()}</span>
                            </div>
                          </td>

                          <td>
                            <span
                              className={`sales-status-chip ${
                                invite.accepted ? 'completed' : isExpired ? 'overdue' : 'pending'
                              }`}
                            >
                              {invite.accepted ? 'Accepted' : isExpired ? 'Expired' : 'Pending Activation'}
                            </span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            {!invite.accepted && (
                              <button
                                type="button"
                                className="sales-action-btn secondary"
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                                onClick={() => onResend(invite.id)}
                                title="Generate a fresh one-time invitation token"
                              >
                                <RefreshCw size={12} /> Resend Invite
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 3: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* 5-Role Executive Summary Strip */}
          <div className="team-role-summary-strip">
            {Object.entries(ROLE_DEFINITIONS).map(([code, def]) => {
              const count = members.filter((m) => m.role === code).length;
              return (
                <div key={code} className="team-role-summary-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={`team-role-badge ${def.badgeClass}`}>{code}</span>
                    <span
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--sp-text-secondary)',
                        background: 'var(--sp-surface-hover)',
                        padding: '1.5px 6px',
                        borderRadius: '10px',
                        border: '1px solid var(--sp-border)',
                        fontVariantNumeric: 'tabular-nums'
                      }}
                    >
                      {count} {count === 1 ? 'Seat' : 'Seats'}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)', marginTop: '4px' }}>
                    {def.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', lineHeight: '1.4', marginTop: '2px' }}>
                    {code === 'OWNER' && 'Supreme database, billing, & handover jurisdiction.'}
                    {code === 'ADMIN' && 'User management, branch scopes, & custom schemas.'}
                    {code === 'MANAGER' && 'Departmental approvals, sign-offs, & ledger review.'}
                    {code === 'OPERATOR' && 'Daily warehouse intake, jobs, & quote drafts.'}
                    {code === 'VIEWER' && 'Read-only inspection without mutation rights.'}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Matrix Filter & Search Toolbar */}
          <div className="sales-toolbar" style={{ marginTop: '2px' }}>
            <div className="sales-pill-group">
              <button
                type="button"
                className={`sales-pill-btn ${matrixCategoryFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setMatrixCategoryFilter('ALL')}
              >
                All Capabilities <span className="sales-pill-count">{PERMISSION_MATRIX.reduce((acc, c) => acc + c.capabilities.length, 0)}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${matrixCategoryFilter === 'Platform & Governance' ? 'active' : ''}`}
                onClick={() => setMatrixCategoryFilter('Platform & Governance')}
              >
                Platform <span className="sales-pill-count">{PERMISSION_MATRIX[0].capabilities.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${matrixCategoryFilter === 'Procurement & Inventory' ? 'active' : ''}`}
                onClick={() => setMatrixCategoryFilter('Procurement & Inventory')}
              >
                Procurement <span className="sales-pill-count">{PERMISSION_MATRIX[1].capabilities.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${matrixCategoryFilter === 'Manufacturing & Engineering' ? 'active' : ''}`}
                onClick={() => setMatrixCategoryFilter('Manufacturing & Engineering')}
              >
                Manufacturing <span className="sales-pill-count">{PERMISSION_MATRIX[2].capabilities.length}</span>
              </button>
              <button
                type="button"
                className={`sales-pill-btn ${matrixCategoryFilter === 'Commercial & Accounting' ? 'active' : ''}`}
                onClick={() => setMatrixCategoryFilter('Commercial & Accounting')}
              >
                Commercial <span className="sales-pill-count">{PERMISSION_MATRIX[3].capabilities.length}</span>
              </button>
            </div>

            <div className="sales-search-box">
              <Search size={14} className="sales-search-icon" />
              <input
                className="sales-search-input"
                placeholder="Filter permissions or capabilities..."
                value={matrixSearchQuery}
                onChange={(e) => setMatrixSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Structured Permissions Matrix Table */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '280px' }}>CAPABILITY & SPECIFICATION</th>
                    <th style={{ width: '105px', textAlign: 'center' }}>
                      <span className="team-role-badge owner">OWNER</span>
                    </th>
                    <th style={{ width: '105px', textAlign: 'center' }}>
                      <span className="team-role-badge admin">ADMIN</span>
                    </th>
                    <th style={{ width: '105px', textAlign: 'center' }}>
                      <span className="team-role-badge manager">MANAGER</span>
                    </th>
                    <th style={{ width: '105px', textAlign: 'center' }}>
                      <span className="team-role-badge operator">OPERATOR</span>
                    </th>
                    <th style={{ width: '105px', textAlign: 'center' }}>
                      <span className="team-role-badge viewer">VIEWER</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrix.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="sales-empty-cell">
                        <div className="sales-empty-state">
                          <Shield size={32} className="sales-empty-icon" />
                          <div className="sales-empty-title">No capabilities match</div>
                          <div className="sales-empty-desc">Try clearing your search query.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredMatrix.map((group) => {
                      const GroupIcon = group.icon;
                      return (
                        <Fragment key={group.category}>
                          <tr className="matrix-category-header">
                            <td colSpan={6}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <GroupIcon size={13} style={{ color: 'var(--sp-brand)' }} />
                                <span>{group.category}</span>
                                <span style={{ fontSize: '10.5px', color: 'var(--sp-text-muted)', fontWeight: 400 }}>
                                  ({group.capabilities.length} capabilities)
                                </span>
                              </div>
                            </td>
                          </tr>
                          {group.capabilities.map((cap) => (
                            <tr key={cap.name} className="sales-row">
                              <td>
                                <strong style={{ fontSize: '12.5px', color: 'var(--sp-text)', display: 'block' }}>
                                  {cap.name}
                                </strong>
                                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', display: 'block', marginTop: '1px' }}>
                                  {cap.description}
                                </span>
                              </td>
                              <td style={{ textAlign: 'center' }}>{renderPermBadge(cap.roles.OWNER)}</td>
                              <td style={{ textAlign: 'center' }}>{renderPermBadge(cap.roles.ADMIN)}</td>
                              <td style={{ textAlign: 'center' }}>{renderPermBadge(cap.roles.MANAGER)}</td>
                              <td style={{ textAlign: 'center' }}>{renderPermBadge(cap.roles.OPERATOR)}</td>
                              <td style={{ textAlign: 'center' }}>{renderPermBadge(cap.roles.VIEWER)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Permissions Legend Strip */}
          <div style={{ padding: '12px 16px', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase' }}>
              Permission Tiers:
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="matrix-perm-badge full"><CheckCircle2 size={11} /> Full</span>
                <span>Unrestricted create, edit, approve & delete</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="matrix-perm-badge manage"><Check size={11} /> Manage</span>
                <span>Operational execution & department actions</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="matrix-perm-badge view"><Eye size={11} /> View</span>
                <span>Read-only inspection transparency</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="matrix-perm-badge none">—</span>
                <span>Action restricted & endpoint blocked</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 4: Governance & Ownership Transfer */}
      {activeTab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Active Workspace Owner Card */}
          <div style={{ background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: 'var(--sp-brand-soft)', color: 'var(--sp-brand)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', fontWeight: 700 }}>
                  {currentOwner ? getInitials(currentOwner.name) : 'OW'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      {currentOwner ? currentOwner.name : 'Primary Workspace Owner'}
                    </h3>
                    <span className="team-role-badge owner">WORKSPACE OWNER</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                    {currentOwner?.email || 'owner@spindl.internal'} · Active Legal Signatory & Supreme Authority
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="customer-risk-chip good">
                  <CheckCircle2 size={11} /> Active Jurisdiction
                </span>
                <span className="sales-ref-badge">SOC-2 / ISO 27001 Protocol</span>
              </div>
            </div>

            {/* Governance Principles */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--sp-border)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                <ShieldCheck size={14} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Single-Owner Invariant:</strong> Exclusively one active owner account per tenant workspace.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                <KeyRound size={14} color="var(--sp-brand)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>Mutual Authentication:</strong> Requires password verification from both sender and recipient.</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '11.5px', color: 'var(--sp-text-secondary)' }}>
                <Clock size={14} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span><strong>24-Hour Expiration:</strong> Handover tokens automatically revoke after 24 hours of issuance.</span>
              </div>
            </div>
          </div>

          {/* 2-Step Handover Console */}
          <div className="team-transfer-grid">
            {/* Step 1: Initiate Transfer Request */}
            <div className="team-transfer-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: 'var(--sp-brand)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  1
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Step 1: Request Ownership Transfer
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                    Authorized exclusively to the active Workspace Owner
                  </span>
                </div>
              </div>

              {session?.role === 'OWNER' ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    onOwnershipRequest({
                      targetMembershipId,
                      password: form.get('password')
                    });
                    e.currentTarget.reset();
                  }}
                  style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
                >
                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                      Designate New Owner:
                    </label>
                    <select
                      className="sales-filter-select"
                      required
                      value={targetMembershipId}
                      onChange={(e) => setTargetMembershipId(e.target.value)}
                      style={{ width: '100%', height: '34px' }}
                    >
                      <option value="">Select an active Admin or Manager…</option>
                      {members
                        .filter((m) => m.active && ['ADMIN', 'MANAGER'].includes(m.role))
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.email}) · {m.role}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                      Verify Owner Password:
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      autoComplete="current-password"
                      placeholder="Confirm your login password"
                      className="sales-filter-select"
                      style={{ width: '100%', height: '34px' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={saving || !targetMembershipId}
                    style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                  >
                    <Lock size={13} /> {saving ? 'Generating Token…' : 'Generate Transfer Token'}
                  </button>

                  {ownershipLink && (
                    <div
                      style={{
                        marginTop: '8px',
                        padding: '12px',
                        background: 'rgba(16, 185, 129, 0.05)',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ fontSize: '12px', color: '#065f46' }}>
                          Transfer Token Generated for {ownershipLink.email}
                        </strong>
                        <span style={{ fontSize: '10.5px', color: '#059669', fontWeight: 500 }}>
                          Expires {new Date(ownershipLink.expiresAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', margin: '3px 0 6px' }}>
                        Share this token securely with {ownershipLink.email}. They must use Step 2 to complete the handover.
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <code
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            background: 'var(--sp-surface)',
                            border: '1px solid var(--sp-border)',
                            borderRadius: '4px',
                            fontSize: '11px',
                            color: 'var(--sp-brand)',
                            wordBreak: 'break-all',
                            fontFamily: 'monospace'
                          }}
                        >
                          {ownershipLink.transferToken}
                        </code>
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ padding: '6px 10px', fontSize: '11px', flexShrink: 0 }}
                          onClick={() => {
                            navigator.clipboard.writeText(ownershipLink.transferToken).then(() => {
                              onCopy('Transfer token copied to clipboard');
                            });
                          }}
                        >
                          <Copy size={12} /> Copy
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              ) : (
                <div style={{ padding: '16px', background: 'var(--sp-surface-hover)', borderRadius: '6px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                  Only the current Workspace Owner can initiate an ownership handover.
                </div>
              )}
            </div>

            {/* Step 2: Confirm Ownership (Transferee action) */}
            <div className="team-transfer-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '26px',
                    height: '26px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '12px',
                    fontWeight: 700
                  }}
                >
                  2
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Step 2: Confirm & Sign Ownership
                  </h4>
                  <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                    Executed by the designated recipient
                  </span>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const form = new FormData(e.currentTarget);
                  onOwnershipConfirm({
                    token: form.get('token'),
                    password: form.get('password')
                  });
                  e.currentTarget.reset();
                }}
                style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}
              >
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                    Paste Received Transfer Token:
                  </label>
                  <input
                    type="text"
                    name="token"
                    required
                    placeholder="e.g. 95d605ade32807f6ee02b48cc803a8c1..."
                    className="sales-filter-select"
                    style={{ width: '100%', height: '34px', fontFamily: 'monospace', fontSize: '11.5px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                    Confirm Your Account Password:
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    autoComplete="current-password"
                    placeholder="Enter your login password"
                    className="sales-filter-select"
                    style={{ width: '100%', height: '34px' }}
                  />
                </div>

                <div style={{ padding: '8px 10px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.25)', fontSize: '11px', color: '#b45309' }}>
                  <AlertTriangle size={12} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                  Signing grants you irrevocable jurisdiction over this workspace. The previous owner will be reassigned as Administrator.
                </div>

                <button
                  type="submit"
                  className="button button-primary"
                  disabled={saving}
                  style={{ alignSelf: 'flex-start', marginTop: '2px' }}
                >
                  <CheckCircle2 size={13} /> {saving ? 'Verifying…' : 'Accept Ownership & Sign'}
                </button>
              </form>
            </div>
          </div>

          {/* Audit Guardrails Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
            <div style={{ padding: '12px 14px', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                <ShieldCheck size={14} color="#10b981" />
                <span>Zero Downtime Transition</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', lineHeight: '1.45' }}>
                Ongoing work orders, POS terminal shifts, and supplier POs continue operating without interruption.
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--sp-brand)' }} >
                <KeyRound size={14} color="var(--sp-brand)" />
                <span>Demotion Protection</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', lineHeight: '1.45' }}>
                The outgoing owner is automatically reassigned as Workspace Administrator to prevent accidental lockout.
              </div>
            </div>

            <div style={{ padding: '12px 14px', background: 'var(--sp-surface)', border: '1px solid var(--sp-border)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '4px' }}>
                <CheckCircle2 size={14} color="#10b981" />
                <span>Immutable Event Logging</span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', lineHeight: '1.45' }}>
                Transfer requests and confirmations are cryptographically recorded in the tenant audit log with client IP addresses.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL 1: Invite Teammate Dialog */}
      {showInviteModal && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !saving) setShowInviteModal(false);
          }}
        >
          <div className="record-modal" style={{ width: 'min(460px, 95vw)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                borderBottom: '1px solid var(--sp-border)',
                paddingBottom: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={16} style={{ color: 'var(--sp-brand)' }} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Invite New Teammate
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--sp-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                onInvite(e);
                setShowInviteModal(false);
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}
            >
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '6px' }}>
                  Work Email Address:
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  maxLength={254}
                  placeholder="colleague@northstar.io"
                  className="sales-filter-select"
                  style={{ width: '100%', height: '36px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '6px' }}>
                  Workspace Role:
                </label>
                <select
                  name="role"
                  defaultValue="VIEWER"
                  className="sales-filter-select"
                  style={{ width: '100%', height: '36px' }}
                >
                  {roles
                    .filter((r) => r.roleCode !== 'OWNER')
                    .map((r) => (
                      <option key={r.roleCode} value={r.roleCode}>
                        {r.displayName} — {ROLE_DEFINITIONS[r.roleCode]?.title || r.roleCode}
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', display: 'block', marginTop: '4px' }}>
                  Generates a secure 7-day single-use activation link.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--sp-border)'
                }}
              >
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setShowInviteModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={saving}
                >
                  {saving ? 'Creating…' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 9. MODAL 2: Edit Scope (Branches & Manager Hierarchy) */}
      {scopeMember && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeScopeModal();
          }}
        >
          <div className="record-modal" style={{ width: 'min(480px, 95vw)' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
                borderBottom: '1px solid var(--sp-border)',
                paddingBottom: '12px'
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Configure Member Scope
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  {scopeMember.name} ({scopeMember.email})
                </span>
              </div>
              <button
                type="button"
                onClick={closeScopeModal}
                style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'var(--sp-text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Branch Assignment */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '8px' }}>
                  Assigned Operating Branches:
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
                  {branches.filter((b) => b.active).length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                      No active branches configured in this workspace.
                    </span>
                  ) : (
                    branches
                      .filter((b) => b.active)
                      .map((branch) => {
                        const isSelected = selectedBranchIds.includes(branch.id);
                        return (
                          <label
                            key={branch.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              padding: '8px 10px',
                              borderRadius: '6px',
                              background: isSelected ? 'var(--sp-brand-soft)' : 'var(--sp-surface-hover)',
                              border: `1px solid ${isSelected ? 'var(--sp-brand)' : 'var(--sp-border)'}`,
                              cursor: 'pointer'
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleBranchSelection(branch.id)}
                            />
                            <div>
                              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                                {branch.name}
                              </div>
                                <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                                  {branch.defaultBranch ? 'Default Headquarters' : 'Branch Location'}
                                </div>
                            </div>
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              {/* Reports To Manager */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '6px' }}>
                  Reports to Manager:
                </label>
                <select
                  value={selectedManagerUserId || ''}
                  onChange={(e) => setSelectedManagerUserId(e.target.value || null)}
                  className="sales-filter-select"
                  style={{ width: '100%', height: '36px' }}
                >
                  <option value="">Direct to Workspace Owner / No Manager</option>
                  {members
                    .filter(
                      (m) =>
                        m.active &&
                        m.userId !== scopeMember.userId &&
                        ['OWNER', 'ADMIN', 'MANAGER'].includes(m.role)
                    )
                    .map((candidate) => (
                      <option key={candidate.userId} value={candidate.userId}>
                        {candidate.name} ({candidate.email}) · {candidate.role}
                      </option>
                    ))}
                </select>
                <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', display: 'block', marginTop: '4px' }}>
                  Used to evaluate team-level permissions and order approval hierarchies.
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '8px',
                  marginTop: '10px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--sp-border)'
                }}
              >
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={closeScopeModal}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={handleSaveScope}
                >
                  Save Scope
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
