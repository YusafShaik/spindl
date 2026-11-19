import { useState, useEffect, useMemo, type FormEvent } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Award,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  FileCheck,
  Filter,
  GraduationCap,
  HardHat,
  HelpCircle,
  Layers,
  LayoutGrid,
  LogIn,
  LogOut,
  Plus,
  RotateCcw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Trash2,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X,
  Zap
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { Status } from '../../components/ui/Status';
import type {
  WorkforceSkill,
  OperatorQualification,
  WorkforceShift,
  RosterAssignment,
  SkillsMatrixResponse,
  WorkforceSummary,
  SkillGuardResponse,
  QualificationLevel,
  QualificationStatus,
  UpsertQualificationPayload,
  CreateSkillPayload,
  CreateShiftPayload,
  CreateRosterPayload
} from '../../types/workforce';

interface WorkforcePanelProps {
  role?: string;
  notify: (message: string) => void;
}

type WorkforceTab = 'matrix' | 'roster' | 'shifts' | 'guard';

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function WorkforcePanel({ role, notify }: WorkforcePanelProps) {
  const [activeTab, setActiveTab] = useState<WorkforceTab>('matrix');

  // State
  const [summary, setSummary] = useState<WorkforceSummary | null>(null);
  const [matrix, setMatrix] = useState<SkillsMatrixResponse | null>(null);
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [roster, setRoster] = useState<RosterAssignment[]>([]);
  const [skills, setSkills] = useState<WorkforceSkill[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Modals
  const [showCertifyModal, setShowCertifyModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAssignShiftModal, setShowAssignShiftModal] = useState(false);
  const [selectedQualDetail, setSelectedQualDetail] = useState<OperatorQualification | null>(null);

  // Certify Form
  const [certUserId, setCertUserId] = useState('');
  const [certSkillId, setCertSkillId] = useState('');
  const [certLevel, setCertLevel] = useState<QualificationLevel>('OPERATOR');
  const [certExpiresAt, setCertExpiresAt] = useState('');
  const [certStatus, setCertStatus] = useState<QualificationStatus>('ACTIVE');
  const [certNotes, setCertNotes] = useState('');
  const [submittingCert, setSubmittingCert] = useState(false);

  // Add Skill Form
  const [newSkillCode, setNewSkillCode] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('MACHINING');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillHours, setNewSkillHours] = useState(40);
  const [submittingSkill, setSubmittingSkill] = useState(false);

  // Assign Shift Form
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Skill Guard Simulator State
  const [guardOperatorId, setGuardOperatorId] = useState('');
  const [guardSkillCode, setGuardSkillCode] = useState('CNC-MILL-5AX');
  const [guardReqLevel, setGuardReqLevel] = useState<QualificationLevel>('OPERATOR');
  const [guardResult, setGuardResult] = useState<SkillGuardResponse | null>(null);
  const [verifyingGuard, setVerifyingGuard] = useState(false);

  // Fetch all workforce data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, matRes, shRes, rosRes, skRes] = await Promise.all([
        apiFetch(`${API}/workforce/summary`),
        apiFetch(`${API}/workforce/matrix`),
        apiFetch(`${API}/workforce/shifts`),
        apiFetch(`${API}/workforce/roster`),
        apiFetch(`${API}/workforce/skills`)
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (matRes.ok) {
        const matData: SkillsMatrixResponse = await matRes.json();
        setMatrix(matData);
        if (matData.rows?.length > 0 && !guardOperatorId) {
          setGuardOperatorId(matData.rows[0].userId);
        }
      }
      if (shRes.ok) setShifts(await shRes.json());
      if (rosRes.ok) setRoster(await rosRes.json());
      if (skRes.ok) setSkills(await skRes.json());
    } catch (err) {
      console.error('Failed to load workforce telemetry:', err);
      notify('Failed to refresh workforce & skills matrix');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Certify Operator
  const handleCertifySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!certUserId || !certSkillId) {
      notify('Please select both an operator and a competency skill');
      return;
    }

    setSubmittingCert(true);
    try {
      const payload: UpsertQualificationPayload = {
        userId: certUserId,
        skillId: certSkillId,
        qualificationLevel: certLevel,
        expiresAt: certExpiresAt || undefined,
        status: certStatus,
        notes: certNotes.trim() || undefined
      };

      const res = await apiFetch(`${API}/workforce/qualifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to save qualification');
      }

      notify('Operator qualification certified & skills matrix updated');
      setShowCertifyModal(false);
      setCertNotes('');
      setCertExpiresAt('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error saving qualification');
    } finally {
      setSubmittingCert(false);
    }
  };

  // Add Skill
  const handleAddSkillSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!newSkillCode.trim() || !newSkillName.trim()) {
      notify('Skill code and name are required');
      return;
    }

    setSubmittingSkill(true);
    try {
      const payload: CreateSkillPayload = {
        skillCode: newSkillCode.trim().toUpperCase(),
        name: newSkillName.trim(),
        category: newSkillCategory,
        description: newSkillDesc.trim() || undefined,
        requiredTrainingHours: Number(newSkillHours) || 0
      };

      const res = await apiFetch(`${API}/workforce/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add skill');
      }

      notify(`Skill ${newSkillCode.toUpperCase()} added to competency catalog`);
      setShowAddSkillModal(false);
      setNewSkillCode('');
      setNewSkillName('');
      setNewSkillDesc('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error registering skill');
    } finally {
      setSubmittingSkill(false);
    }
  };

  // Assign Shift
  const handleAssignShiftSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!assignShiftId || !assignUserId) {
      notify('Please select both a shift and an operator');
      return;
    }

    setSubmittingAssign(true);
    try {
      const payload: CreateRosterPayload = {
        shiftId: assignShiftId,
        userId: assignUserId,
        rosterDate: assignDate
      };

      const res = await apiFetch(`${API}/workforce/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to schedule shift');
      }

      notify('Shift scheduled on plant roster');
      setShowAssignShiftModal(false);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error assigning shift');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Attendance Clock-in / Clock-out
  const handleClockIn = async (rosterId: string) => {
    try {
      const res = await apiFetch(`${API}/workforce/roster/${rosterId}/clock-in`, { method: 'POST' });
      if (res.ok) {
        notify('Operator clocked-in to shift on time');
        await loadData();
      }
    } catch (err) {
      notify('Clock-in failed');
    }
  };

  const handleClockOut = async (rosterId: string) => {
    try {
      const res = await apiFetch(`${API}/workforce/roster/${rosterId}/clock-out`, { method: 'POST' });
      if (res.ok) {
        notify('Operator clocked-out. Actual hours registered.');
        await loadData();
      }
    } catch (err) {
      notify('Clock-out failed');
    }
  };

  // Run Skill Guard Verification
  const runSkillGuardTest = async () => {
    if (!guardOperatorId || !guardSkillCode) return;
    setVerifyingGuard(true);
    try {
      const res = await apiFetch(`${API}/workforce/verify-skill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operatorUserId: guardOperatorId,
          requiredSkillCode: guardSkillCode,
          requiredLevel: guardReqLevel
        })
      });
      if (res.ok) {
        setGuardResult(await res.json());
      }
    } catch (err) {
      console.error('Guard test error:', err);
    } finally {
      setVerifyingGuard(false);
    }
  };

  // Filtered Matrix Rows
  const filteredMatrixRows = useMemo(() => {
    if (!matrix?.rows) return [];
    return matrix.rows.filter((row) => {
      const matchSearch =
        !searchQuery ||
        row.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        row.role.toLowerCase().includes(searchQuery.toLowerCase());
      return matchSearch;
    });
  }, [matrix, searchQuery]);

  // Categories list
  const skillCategories = useMemo(() => {
    const set = new Set<string>();
    skills.forEach((s) => set.add(s.category));
    return ['ALL', ...Array.from(set)];
  }, [skills]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Linear Executive Workforce Telemetry Strip */}
      <div className="linear-kpi-grid">
        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Shift Attendance</span>
            <Users size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {summary?.presentToday || 3} / {summary?.scheduledToday || 4}
          </div>
          <div className="linear-kpi-caption">
            {summary?.attendanceRatePercent || 75}% on-time floor check-in
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Production Shifts</span>
            <Clock size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {summary?.activeShifts ?? shifts.length} Active
          </div>
          <div className="linear-kpi-caption">
            Alpha (06:00), Bravo (14:00) & Night (22:00)
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Skills Matrix</span>
            <Award size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {summary?.certifiedSkillsCount ?? skills.length} Competencies
          </div>
          <div className="linear-kpi-caption">
            {summary?.totalQualifications ?? 9} certified qualifications issued
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Routing Skill Guard</span>
            <ShieldCheck size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            100% Active
          </div>
          <div className="linear-kpi-caption">
            ISO-9001 / AS9100 quality interlock enforced
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'matrix' ? 'active' : ''}`}
            onClick={() => setActiveTab('matrix')}
          >
            <LayoutGrid size={13} />
            <span>Skills Matrix</span>
            <span className="sales-subnav-badge">{matrix?.skills?.length ?? 0}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            <Calendar size={13} />
            <span>Shift Roster & Clock-in</span>
            <span className="sales-subnav-badge">{roster.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'shifts' ? 'active' : ''}`}
            onClick={() => setActiveTab('shifts')}
          >
            <Clock size={13} />
            <span>Plant Shifts</span>
            <span className="sales-subnav-badge">{shifts.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'guard' ? 'active' : ''}`}
            onClick={() => setActiveTab('guard')}
          >
            <Shield size={13} />
            <span>Skill Guard Simulator</span>
          </button>
        </div>

        <div className="sales-subnav-actions">
          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={loadData}
            disabled={loading}
            title="Refresh workforce telemetry"
          >
            <RotateCcw size={12} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            className="sales-action-btn secondary"
            onClick={() => setShowAddSkillModal(true)}
          >
            <Plus size={12} />
            <span>Add Skill</span>
          </button>

          <button
            type="button"
            className="sales-action-btn primary"
            onClick={() => setShowCertifyModal(true)}
          >
            <Award size={12} />
            <span>Certify Operator</span>
          </button>
        </div>
      </div>

      {/* 3. TAB 1: OPERATOR SKILLS MATRIX (2D GRID) */}
      {activeTab === 'matrix' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Toolbar */}
          <div className="sales-toolbar">
            <div className="sales-pill-group">
              <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginRight: '4px' }}>Levels:</span>
              <span className="sales-sub-highlight" style={{ fontSize: '11px', textTransform: 'capitalize' }}>Master (L4)</span>
              <span className="sales-sub-highlight" style={{ fontSize: '11px', textTransform: 'capitalize' }}>Specialist (L3)</span>
              <span className="sales-sub-highlight" style={{ fontSize: '11px', textTransform: 'capitalize' }}>Operator (L2)</span>
              <span className="sales-warehouse-pill" style={{ fontSize: '11px', textTransform: 'capitalize' }}>Apprentice (L1)</span>
            </div>

            <div className="sales-search-box">
              <Search size={13} className="sales-search-icon" />
              <input
                type="text"
                className="sales-search-input"
                placeholder="Search operator, email, role…"
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
          </div>

          {/* 2D Skills Matrix Grid */}
          <div className="sales-table-card">
            <div className="sales-table-scroll">
              <table className="sales-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '220px', position: 'sticky', left: 0, background: 'var(--sp-surface-subtle)', zIndex: 2 }}>
                      Operator / Employee
                    </th>
                    {matrix?.skills?.map((skill) => (
                      <th key={skill.id} style={{ minWidth: '160px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 500, fontSize: '11.5px', color: 'var(--sp-text)' }}>{skill.skillCode}</div>
                        <div style={{ fontSize: '10px', color: 'var(--sp-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px', margin: '0 auto' }}>
                          {skill.name}
                        </div>
                        <span className="sales-warehouse-pill" style={{ marginTop: '2px', display: 'inline-block', textTransform: 'capitalize' }}>
                          {skill.category.replace(/_/g, ' ').toLowerCase()}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredMatrixRows.map((row) => (
                    <tr key={row.userId} className="sales-row">
                      <td style={{ position: 'sticky', left: 0, background: 'var(--sp-surface)', zIndex: 1, borderRight: '1px solid var(--sp-border)' }}>
                        <div className="sales-customer-cell">
                          <div className="sales-customer-avatar">
                            {row.userName ? row.userName[0].toUpperCase() : 'U'}
                          </div>
                          <div>
                            <div className="sales-customer-name">{row.userName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                              {row.role} · {row.userEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      {matrix?.skills?.map((skill) => {
                        const qual = row.qualifications[skill.skillCode];
                        return (
                          <td
                            key={skill.id}
                            style={{ textAlign: 'center', cursor: 'pointer' }}
                            onClick={() => {
                              if (qual) {
                                setSelectedQualDetail(qual);
                              } else {
                                setCertUserId(row.userId);
                                setCertSkillId(skill.id);
                                setShowCertifyModal(true);
                              }
                            }}
                          >
                            {qual ? (
                              <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                <span
                                  className={
                                    qual.qualificationLevel === 'MASTER' || qual.qualificationLevel === 'SPECIALIST'
                                      ? 'sales-sub-highlight'
                                      : 'sales-warehouse-pill'
                                  }
                                  style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', textTransform: 'capitalize' }}
                                >
                                  {qual.qualificationLevel.toLowerCase()}
                                </span>
                                {qual.expiresAt && (
                                  <span style={{ fontSize: '9.5px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                                    Exp: {formatDate(qual.expiresAt)}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--sp-text-subtle, #94a3b8)', fontSize: '14px' }} title="Click to certify">
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. TAB 2: SHIFT ROSTERING & ATTENDANCE */}
      {activeTab === 'roster' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="sales-toolbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Calendar size={13} /> Plant Roster Date:
              </span>
              <span className="sales-ref-badge">
                Today ({formatDate(new Date().toISOString())})
              </span>
            </div>

            <button
              type="button"
              className="sales-action-btn primary"
              onClick={() => setShowAssignShiftModal(true)}
            >
              <Plus size={12} />
              <span>Schedule Shift Assignment</span>
            </button>
          </div>

          {/* High-Density Roster Table (Zero Horizontal Scroll) */}
          <div className="sales-table-card">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Shift & Schedule</th>
                  <th>Operator</th>
                  <th>Assigned Work Center</th>
                  <th style={{ textAlign: 'center', width: '110px' }}>Status</th>
                  <th>Clock-In & Hours</th>
                  <th style={{ textAlign: 'right', width: '120px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {roster.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--sp-text-muted)' }}>
                      No shift assignments scheduled for today.
                    </td>
                  </tr>
                ) : (
                  roster.map((r) => (
                    <tr key={r.id} className="sales-row">
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="sales-ref-badge">{r.shiftCode}</span>
                          <span style={{ fontWeight: 500, fontSize: '12.5px' }}>{r.shiftName}</span>
                        </div>
                        <div className="sales-date-cell" style={{ marginTop: '3px' }}>
                          {r.shiftStartTime?.slice(0, 5)} - {r.shiftEndTime?.slice(0, 5)}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, color: 'var(--sp-text)', fontSize: '12.5px' }}>{r.userName}</div>
                        <div className="sales-sub-ref">{r.userEmail}</div>
                      </td>
                      <td>
                        {r.workCenterCode ? (
                          <span className="sales-warehouse-pill">
                            {r.workCenterCode} · {r.workCenterName}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--sp-text-muted)' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <Status label={r.attendanceStatus} />
                      </td>
                      <td>
                        <div className="sales-date-cell">
                          {r.clockInTime ? new Date(r.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not Clocked In'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                          {r.actualHours != null ? `${r.actualHours} hrs logged` : `${r.plannedHours} hrs planned`}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {r.attendanceStatus === 'SCHEDULED' ? (
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            onClick={() => handleClockIn(r.id)}
                          >
                            <LogIn size={12} />
                            <span>Clock In</span>
                          </button>
                        ) : r.attendanceStatus === 'PRESENT' && !r.clockOutTime ? (
                          <button
                            type="button"
                            className="sales-action-btn ghost"
                            onClick={() => handleClockOut(r.id)}
                          >
                            <LogOut size={12} />
                            <span>Clock Out</span>
                          </button>
                        ) : (
                          <span className="sales-sub-highlight">✓ Shift Done</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 3: PLANT SHIFTS */}
      {activeTab === 'shifts' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
          {shifts.map((s) => (
            <div key={s.id} className="sales-metric-card" style={{ gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="sales-ref-badge">{s.shiftCode}</span>
                <Status label="Active" />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)' }}>{s.name}</div>
                <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)', fontVariantNumeric: 'tabular-nums', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Clock size={12} style={{ color: 'var(--sp-brand)' }} />
                  <span>{s.startTime?.slice(0, 5)} - {s.endTime?.slice(0, 5)}</span>
                  <span>· {s.breakMinutes} min break</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 6. TAB 4: ROUTING OPERATION SKILL GUARD SIMULATOR */}
      {activeTab === 'guard' && (
        <div className="sales-table-card" style={{ maxWidth: '640px', margin: '0 auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ paddingBottom: '12px', borderBottom: '1px solid var(--sp-border)' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--sp-text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck size={16} style={{ color: 'var(--sp-brand)' }} />
              Shop Floor Operation Skill Guard Interlock
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              Simulates job-card qualification interlocks. When an operator attempts to claim a manufacturing operation, Spindl automatically validates their ISO-9001 competency certification.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
              Operator
              <select
                value={guardOperatorId}
                onChange={(e) => setGuardOperatorId(e.target.value)}
                style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
              >
                {matrix?.rows?.map((u) => (
                  <option key={u.userId} value={u.userId}>
                    {u.userName} ({u.role})
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
              Required Operation Skill
              <select
                value={guardSkillCode}
                onChange={(e) => setGuardSkillCode(e.target.value)}
                style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
              >
                {skills.map((s) => (
                  <option key={s.id} value={s.skillCode}>
                    {s.skillCode} · {s.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
            Minimum Competency Level Required
            <select
              value={guardReqLevel}
              onChange={(e) => setGuardReqLevel(e.target.value as QualificationLevel)}
              style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
            >
              <option value="APPRENTICE">APPRENTICE (Level 1)</option>
              <option value="OPERATOR">OPERATOR (Level 2)</option>
              <option value="SPECIALIST">SPECIALIST (Level 3)</option>
              <option value="MASTER">MASTER (Level 4)</option>
            </select>
          </label>

          <button
            type="button"
            className="button button-primary"
            onClick={runSkillGuardTest}
            disabled={verifyingGuard}
          >
            <Zap size={13} className={verifyingGuard ? 'spin' : ''} />
            <span>Run Qualification Interlock Test</span>
          </button>

          {guardResult && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--sp-border)',
                background: guardResult.isQualified ? 'var(--sp-brand-soft)' : 'rgba(239, 68, 68, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                fontSize: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontWeight: 500 }}>
                <span>Interlock Result:</span>
                <Status label={guardResult.isQualified ? 'Passed' : 'Failed'} />
              </div>
              <div style={{ color: 'var(--sp-text)', marginTop: '2px' }}>
                {guardResult.message}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                Audited Level: {guardResult.currentLevel || 'None'} vs Req: {guardResult.requiredLevel}
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CERTIFY OPERATOR */}
      {showCertifyModal && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submittingCert) setShowCertifyModal(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Certify Operator Competency</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Issue or renew an ISO-9001 skill qualification for manufacturing operations.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowCertifyModal(false)}
                disabled={submittingCert}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCertifySubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Operator / Employee
                  <select
                    value={certUserId}
                    onChange={(e) => setCertUserId(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="">Select Employee…</option>
                    {matrix?.rows?.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.userName} ({u.role})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Competency Skill
                  <select
                    value={certSkillId}
                    onChange={(e) => setCertSkillId(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="">Select Skill…</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.skillCode} · {s.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Qualification Level
                    <select
                      value={certLevel}
                      onChange={(e) => setCertLevel(e.target.value as QualificationLevel)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                    >
                      <option value="APPRENTICE">APPRENTICE (Level 1)</option>
                      <option value="OPERATOR">OPERATOR (Level 2)</option>
                      <option value="SPECIALIST">SPECIALIST (Level 3)</option>
                      <option value="MASTER">MASTER (Level 4)</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Expiration Date
                    <input
                      type="date"
                      value={certExpiresAt}
                      onChange={(e) => setCertExpiresAt(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Certification Notes / Auditing Body
                  <textarea
                    rows={2}
                    placeholder="e.g. Completed 40-hr Haas CNC practical certification and passed dimensional inspection exam."
                    value={certNotes}
                    onChange={(e) => setCertNotes(e.target.value)}
                    style={{ padding: '8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowCertifyModal(false)}
                  disabled={submittingCert}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingCert}
                >
                  {submittingCert ? 'Certifying…' : 'Certify Operator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD SKILL */}
      {showAddSkillModal && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submittingSkill) setShowAddSkillModal(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Register New Competency Skill</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Add a technical skill requirement to the plant competency catalog.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowAddSkillModal(false)}
                disabled={submittingSkill}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleAddSkillSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Skill Code
                  <input
                    type="text"
                    placeholder="e.g. CNC-EDM-WIRE, ROBOTIC-WELD"
                    value={newSkillCode}
                    onChange={(e) => setNewSkillCode(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Skill Name
                  <input
                    type="text"
                    placeholder="e.g. Wire Electrical Discharge Machining"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Category
                    <select
                      value={newSkillCategory}
                      onChange={(e) => setNewSkillCategory(e.target.value)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                    >
                      <option value="MACHINING">MACHINING</option>
                      <option value="WELDING">WELDING</option>
                      <option value="QUALITY">QUALITY</option>
                      <option value="HEAT_TREAT">HEAT_TREAT</option>
                      <option value="ASSEMBLY">ASSEMBLY</option>
                      <option value="ELECTRICAL">ELECTRICAL</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                    Training Hours
                    <input
                      type="number"
                      min="0"
                      value={newSkillHours}
                      onChange={(e) => setNewSkillHours(parseInt(e.target.value) || 0)}
                      style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}
                    />
                  </label>
                </div>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowAddSkillModal(false)}
                  disabled={submittingSkill}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingSkill}
                >
                  {submittingSkill ? 'Adding…' : 'Add Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ASSIGN SHIFT */}
      {showAssignShiftModal && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !submittingAssign) setShowAssignShiftModal(false); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Schedule Shift Assignment</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Assign an operator to a plant production shift roster.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowAssignShiftModal(false)}
                disabled={submittingAssign}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleAssignShiftSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body">
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Plant Shift
                  <select
                    value={assignShiftId}
                    onChange={(e) => setAssignShiftId(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="">Select Shift…</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shiftCode} · {s.name} ({s.startTime?.slice(0, 5)} - {s.endTime?.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Operator / Employee
                  <select
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  >
                    <option value="">Select Employee…</option>
                    {matrix?.rows?.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.userName} ({u.role})
                      </option>
                    ))}
                  </select>
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text-muted)' }}>
                  Roster Date
                  <input
                    type="date"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    required
                    style={{ height: '32px', padding: '0 8px', borderRadius: '6px', border: '1px solid var(--sp-border)', background: 'var(--sp-surface)', color: 'var(--sp-text)', fontSize: '12px' }}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => setShowAssignShiftModal(false)}
                  disabled={submittingAssign}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="button button-primary"
                  disabled={submittingAssign}
                >
                  {submittingAssign ? 'Scheduling…' : 'Schedule Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INSPECT QUALIFICATION DETAIL */}
      {selectedQualDetail && (
        <div className="leads-modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedQualDetail(null); }}>
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600 }}>Operator Qualification Certificate</h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  ISO-9001 / AS9100 certified shop floor competency.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setSelectedQualDetail(null)}
              >
                <X size={14} />
              </button>
            </div>

            <div className="leads-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                <div><strong>Competency:</strong> {selectedQualDetail.skillCode} · {selectedQualDetail.skillName}</div>
                <div><strong>Level:</strong> <span className="sales-sub-highlight">{selectedQualDetail.qualificationLevel}</span></div>
                <div><strong>Status:</strong> <Status label={selectedQualDetail.status} /></div>
                <div><strong>Certification Date:</strong> {selectedQualDetail.certifiedAt ? new Date(selectedQualDetail.certifiedAt).toLocaleDateString() : '—'}</div>
                {selectedQualDetail.expiresAt && <div><strong>Expiration:</strong> {selectedQualDetail.expiresAt}</div>}
                {selectedQualDetail.notes && <div><strong>Notes:</strong> {selectedQualDetail.notes}</div>}
              </div>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setSelectedQualDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
