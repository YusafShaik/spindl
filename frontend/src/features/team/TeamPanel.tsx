import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  ExternalLink,
  Filter,
  GitBranch,
  KeyRound,
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
            <Users size={16} className="sales-metric-icon quotes" />
          </div>
          <div className="sales-metric-val">{activeMembers} Members</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">{members.length - activeMembers} Inactive</span> ·{' '}
            {members.length} Total Registered
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SEAT ALLOCATION & QUOTA</span>
            <CheckCircle2 size={16} className="sales-metric-icon orders" />
          </div>
          <div className="sales-metric-val">{activeMembers} / 25 Allocated</div>
          <div className="sales-metric-sub">
            <span className="sales-sub-highlight">Enterprise Tier</span> · 19 Available Seats
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">PENDING INVITATIONS</span>
            <Mail size={16} className="sales-metric-icon invoices" />
          </div>
          <div className="sales-metric-val">{pendingInvites} Pending</div>
          <div className="sales-metric-sub">
            Awaiting 7-day secure one-time activation
          </div>
        </div>

        <div className="sales-metric-card">
          <div className="sales-metric-header">
            <span className="sales-metric-label">SECURITY & ACCESS GOVERNANCE</span>
            <ShieldCheck size={16} className="sales-metric-icon credits" />
          </div>
          <div className="sales-metric-val">{roles.length || 5} System Roles</div>
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
                >
                  <X size={12} />
                </button>
              ) : (
                <kbd className="sales-search-kbd">/</kbd>
              )}
            </div>

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
                  <th>MEMBER</th>
                  <th>EMAIL</th>
                  <th>WORKSPACE ROLE</th>
                  <th>ASSIGNED BRANCHES</th>
                  <th>REPORTS TO</th>
                  <th>STATUS</th>
                  <th style={{ textAlign: 'right' }}>ACTIONS</th>
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
                        <td style={{ fontSize: '12px', color: 'var(--sp-text)' }}>
                          <span style={{ fontFamily: 'var(--sp-font-mono, monospace)', fontSize: '11.5px' }}>
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
              <div className="sales-search-box">
                <Search size={14} className="sales-search-icon" />
                <input
                  className="sales-search-input"
                  placeholder="Filter invitations by email or role…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="sales-search-clear"
                    onClick={() => setSearchQuery('')}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn primary"
                  onClick={() => setShowInviteModal(true)}
                >
                  <Plus size={13} /> New Invitation
                </button>
              </div>
            </div>

            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th>INVITEE EMAIL</th>
                    <th>ASSIGNED ROLE</th>
                    <th>EXPIRATION DATE</th>
                    <th>STATUS</th>
                    <th style={{ textAlign: 'right' }}>ACTIONS</th>
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
          <div className="team-matrix-grid">
            {Object.entries(ROLE_DEFINITIONS).map(([code, def]) => {
              const count = members.filter((m) => m.role === code).length;
              return (
                <div key={code} className="team-matrix-card">
                  <div className="team-matrix-header">
                    <div>
                      <span className={`team-role-badge ${def.badgeClass}`}>{def.title}</span>
                      <h4 style={{ margin: '6px 0 2px', fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                        {code}
                      </h4>
                    </div>
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 600,
                        color: 'var(--sp-text-secondary)',
                        background: 'var(--sp-surface-hover)',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--sp-border)'
                      }}
                    >
                      {count} Assigned {count === 1 ? 'Seat' : 'Seats'}
                    </span>
                  </div>

                  <p style={{ fontSize: '12px', color: 'var(--sp-text-secondary)', margin: 0, lineHeight: 1.5 }}>
                    {def.description}
                  </p>

                  <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--sp-border)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--sp-text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                      Primary Privileges:
                    </div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {def.responsibilities.map((resp, i) => (
                        <span key={i} className="team-matrix-tag">
                          <Check size={10} style={{ color: '#10b981' }} /> {resp}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 7. SUB-TAB 4: Governance & Ownership Transfer */}
      {activeTab === 'governance' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Security Alert Callout */}
          <div
            style={{
              padding: '14px 16px',
              background: 'rgba(239, 68, 68, 0.05)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px'
            }}
          >
            <ShieldAlert size={20} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#991b1b' }}>
                High-Security Ownership Handover Protocol
              </div>
              <p style={{ fontSize: '12px', color: '#7f1d1d', margin: '4px 0 0', lineHeight: 1.5 }}>
                Workspace ownership grants irrevocable authority over all financial statements, company secrets,
                subscription payment methods, user access rights, and legal audit registers. Transfer tokens expire in 24 hours.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '14px' }}>
            {/* Step 1: Initiate Transfer Request (Owner only) */}
            <div className="team-transfer-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: 'var(--sp-brand)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  1
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Step 1: Request Ownership Transfer
                  </h4>
                  <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
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
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '5px' }}>
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
                    <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '5px' }}>
                      Verify Current Owner Password:
                    </label>
                    <input
                      type="password"
                      name="password"
                      required
                      autoComplete="current-password"
                      placeholder="Enter your current password"
                      className="sales-filter-select"
                      style={{ width: '100%', height: '34px' }}
                    />
                  </div>

                  <button
                    type="submit"
                    className="sales-action-btn primary"
                    disabled={saving || !targetMembershipId}
                    style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                  >
                    <Lock size={13} /> {saving ? 'Generating Token…' : 'Generate Transfer Token'}
                  </button>

                  {ownershipLink && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '12px',
                        background: 'var(--sp-surface-hover)',
                        border: '1px solid var(--sp-border)',
                        borderRadius: '6px'
                      }}
                    >
                      <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                        Transfer Token Ready for {ownershipLink.email}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                        Expires {new Date(ownershipLink.expiresAt).toLocaleString()}. Share securely with the recipient.
                      </div>
                      <code
                        style={{
                          display: 'block',
                          margin: '6px 0',
                          padding: '6px',
                          background: 'var(--sp-surface)',
                          border: '1px solid var(--sp-border)',
                          borderRadius: '4px',
                          fontSize: '11px',
                          color: 'var(--sp-brand)',
                          wordBreak: 'break-all'
                        }}
                      >
                        {ownershipLink.transferToken}
                      </code>
                      <button
                        type="button"
                        className="sales-action-btn secondary"
                        style={{ fontSize: '11px' }}
                        onClick={() => {
                          navigator.clipboard.writeText(ownershipLink.transferToken).then(() => {
                            onCopy('Transfer token copied to clipboard');
                          });
                        }}
                      >
                        <Copy size={12} /> Copy Token
                      </button>
                    </div>
                  )}
                </form>
              ) : (
                <div style={{ padding: '16px', background: 'var(--sp-surface-hover)', borderRadius: '6px', textAlign: 'center', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                  Only the current Workspace Owner can initiate a transfer request.
                </div>
              )}
            </div>

            {/* Step 2: Confirm Ownership (Transferee action) */}
            <div className="team-transfer-box">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#10b981',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  2
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Step 2: Confirm Transfer to Your Account
                  </h4>
                  <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
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
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '5px' }}>
                    Paste Received Transfer Token:
                  </label>
                  <input
                    type="text"
                    name="token"
                    required
                    placeholder="e.g. 95d605ade32807f6ee02b48cc803a8c1..."
                    className="sales-filter-select"
                    style={{ width: '100%', height: '34px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: 'var(--sp-text)', marginBottom: '5px' }}>
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

                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={saving}
                  style={{ alignSelf: 'flex-start', marginTop: '4px' }}
                >
                  <CheckCircle2 size={13} /> {saving ? 'Verifying…' : 'Accept Ownership & Sign'}
                </button>
              </form>
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
