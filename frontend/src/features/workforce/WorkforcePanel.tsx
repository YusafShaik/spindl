import React, { useState, useEffect, useMemo, FormEvent } from 'react';
import {
  Award,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Filter,
  HardHat,
  LayoutGrid,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Wrench,
  X
} from 'lucide-react';
import { API, apiFetch } from '../../lib/api/client';
import { Status } from '../../components/ui/Status';
import type {
  WorkforceSkill,
  WorkforceShift,
  RosterAssignment,
  WorkforceSummary,
  WorkforceEmployee,
  EmployeeSkill,
  QualificationLevel,
  QualificationStatus,
  UpsertQualificationPayload,
  CreateSkillPayload,
  CreateShiftPayload,
  UpdateShiftPayload,
  CreateRosterPayload,
  CreateEmployeePayload,
  InitialSkillAssignmentPayload
} from '../../types/workforce';

interface WorkforcePanelProps {
  role?: string;
  notify: (message: string) => void;
}

type WorkforceTab = 'employees' | 'roster' | 'shifts';

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

function getLevelBadgeClass(level: QualificationLevel): string {
  switch (level) {
    case 'MASTER':
    case 'SPECIALIST':
      return 'sales-sub-highlight';
    default:
      return 'sales-warehouse-pill';
  }
}

export function WorkforcePanel({ role, notify }: WorkforcePanelProps) {
  const [activeTab, setActiveTab] = useState<WorkforceTab>('employees');

  // Core State
  const [summary, setSummary] = useState<WorkforceSummary | null>(null);
  const [employees, setEmployees] = useState<WorkforceEmployee[]>([]);
  const [shifts, setShifts] = useState<WorkforceShift[]>([]);
  const [roster, setRoster] = useState<RosterAssignment[]>([]);
  const [skills, setSkills] = useState<WorkforceSkill[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [skillFilter, setSkillFilter] = useState('ALL');

  // Modals
  const [showAddEmployeeModal, setShowAddEmployeeModal] = useState(false);
  const [showAddSkillModal, setShowAddSkillModal] = useState(false);
  const [showAssignShiftModal, setShowAssignShiftModal] = useState(false);
  const [skillTargetEmployee, setSkillTargetEmployee] = useState<WorkforceEmployee | null>(null);
  const [inspectingEmployee, setInspectingEmployee] = useState<WorkforceEmployee | null>(null);

  // Check-In / Check-Out Confirmation Modal
  const [pendingClockAction, setPendingClockAction] = useState<{ type: 'IN' | 'OUT'; roster: RosterAssignment } | null>(null);
  const [processingClock, setProcessingClock] = useState(false);

  // Shift Management Modal (Create & Edit)
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<WorkforceShift | null>(null);
  const [shiftFormCode, setShiftFormCode] = useState('');
  const [shiftFormName, setShiftFormName] = useState('');
  const [shiftFormStartTime, setShiftFormStartTime] = useState('06:00');
  const [shiftFormEndTime, setShiftFormEndTime] = useState('14:30');
  const [shiftFormBreakMin, setShiftFormBreakMin] = useState(45);
  const [shiftFormActive, setShiftFormActive] = useState(true);
  const [submittingShift, setSubmittingShift] = useState(false);

  // Add Employee Form State
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empRole, setEmpRole] = useState('OPERATOR');
  const [empInitialSkills, setEmpInitialSkills] = useState<InitialSkillAssignmentPayload[]>([]);
  const [selectedInitialSkillId, setSelectedInitialSkillId] = useState('');
  const [selectedInitialSkillLevel, setSelectedInitialSkillLevel] = useState<QualificationLevel>('OPERATOR');
  const [submittingEmployee, setSubmittingEmployee] = useState(false);

  // Targeted Add-Skill Form State (for specific employee)
  const [targetSkillId, setTargetSkillId] = useState('');
  const [targetSkillLevel, setTargetSkillLevel] = useState<QualificationLevel>('OPERATOR');
  const [targetSkillExpiresAt, setTargetSkillExpiresAt] = useState('');
  const [targetSkillNotes, setTargetSkillNotes] = useState('');
  const [submittingTargetSkill, setSubmittingTargetSkill] = useState(false);

  // Add Skill to Catalog Form State
  const [newSkillCode, setNewSkillCode] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillCategory, setNewSkillCategory] = useState('MACHINING');
  const [newSkillDesc, setNewSkillDesc] = useState('');
  const [newSkillHours, setNewSkillHours] = useState(40);
  const [submittingSkill, setSubmittingSkill] = useState(false);

  // Assign Shift Form State
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignUserId, setAssignUserId] = useState('');
  const [assignUserSearch, setAssignUserSearch] = useState('');
  const [assignDate, setAssignDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Revoking / deleting a qualification
  const [revokingQualId, setRevokingQualId] = useState<string | null>(null);

  // Fetch all workforce data
  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, empRes, shRes, rosRes, skRes] = await Promise.all([
        apiFetch(`${API}/workforce/summary`),
        apiFetch(`${API}/workforce/employees`),
        apiFetch(`${API}/workforce/shifts`),
        apiFetch(`${API}/workforce/roster`),
        apiFetch(`${API}/workforce/skills`)
      ]);

      if (sumRes.ok) setSummary(await sumRes.json());
      if (empRes.ok) {
        const empList: WorkforceEmployee[] = await empRes.json();
        setEmployees(empList);
        // keep inspectingEmployee updated if modal is open
        if (inspectingEmployee) {
          const updated = empList.find((e) => e.id === inspectingEmployee.id);
          if (updated) setInspectingEmployee(updated);
        }
      }
      if (shRes.ok) setShifts(await shRes.json());
      if (rosRes.ok) setRoster(await rosRes.json());
      if (skRes.ok) setSkills(await skRes.json());
    } catch (err: any) {
      console.error('Failed to load workforce telemetry:', err);
      notify('Failed to refresh workforce data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Helper to add skill row in employee creation
  const handleAddInitialSkillRow = () => {
    if (!selectedInitialSkillId) return;
    if (empInitialSkills.some((s) => s.skillId === selectedInitialSkillId)) {
      notify('This skill is already added in the list.');
      return;
    }
    setEmpInitialSkills([
      ...empInitialSkills,
      { skillId: selectedInitialSkillId, level: selectedInitialSkillLevel }
    ]);
    setSelectedInitialSkillId('');
    setSelectedInitialSkillLevel('OPERATOR');
  };

  const handleRemoveInitialSkillRow = (skillId: string) => {
    setEmpInitialSkills(empInitialSkills.filter((s) => s.skillId !== skillId));
  };

  // Create Employee
  const handleCreateEmployeeSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!empName.trim() || !empEmail.trim()) {
      notify('Employee full name and email are required');
      return;
    }

    setSubmittingEmployee(true);
    try {
      const payload: CreateEmployeePayload = {
        name: empName.trim(),
        email: empEmail.trim().toLowerCase(),
        role: empRole,
        skills: empInitialSkills.length > 0 ? empInitialSkills : undefined
      };

      const res = await apiFetch(`${API}/workforce/employees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to add employee');
      }

      notify(`Employee ${empName} successfully added with ${empInitialSkills.length} skills`);
      setShowAddEmployeeModal(false);
      setEmpName('');
      setEmpEmail('');
      setEmpRole('OPERATOR');
      setEmpInitialSkills([]);
      setSelectedInitialSkillId('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error adding employee');
    } finally {
      setSubmittingEmployee(false);
    }
  };

  // Add Skill to specific employee
  const handleTargetSkillSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!skillTargetEmployee || !targetSkillId) {
      notify('Please select a competency skill');
      return;
    }

    setSubmittingTargetSkill(true);
    try {
      const payload: UpsertQualificationPayload = {
        userId: skillTargetEmployee.id,
        skillId: targetSkillId,
        qualificationLevel: targetSkillLevel,
        expiresAt: targetSkillExpiresAt || undefined,
        status: 'ACTIVE',
        notes: targetSkillNotes.trim() || undefined
      };

      const res = await apiFetch(`${API}/workforce/qualifications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to assign skill');
      }

      notify(`Skill assigned to ${skillTargetEmployee.name}`);
      setSkillTargetEmployee(null);
      setTargetSkillId('');
      setTargetSkillExpiresAt('');
      setTargetSkillNotes('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error assigning skill');
    } finally {
      setSubmittingTargetSkill(false);
    }
  };

  // Revoke / Delete Skill from employee
  const handleRevokeSkill = async (qualificationId: string, skillCode: string) => {
    setRevokingQualId(qualificationId);
    try {
      const res = await apiFetch(`${API}/workforce/qualifications/${qualificationId}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error('Failed to revoke qualification');
      }

      notify(`Skill ${skillCode} revoked successfully`);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error revoking qualification');
    } finally {
      setRevokingQualId(null);
    }
  };

  // Add Skill to Catalog
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
      notify('Please select both a shift and an employee');
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

      notify('Shift scheduled for operator');
      setShowAssignShiftModal(false);
      setAssignShiftId('');
      setAssignUserId('');
      setAssignUserSearch('');
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error scheduling shift');
    } finally {
      setSubmittingAssign(false);
    }
  };

  // Confirmed Attendance Clock-in / Clock-out
  const confirmClockAction = async () => {
    if (!pendingClockAction) return;
    setProcessingClock(true);
    try {
      const rosterId = pendingClockAction.roster.id;
      const endpoint = pendingClockAction.type === 'IN' ? 'clock-in' : 'clock-out';
      const res = await apiFetch(`${API}/workforce/roster/${rosterId}/${endpoint}`, { method: 'POST' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Failed to clock ${pendingClockAction.type.toLowerCase()}`);
      }
      notify(`Operator successfully clocked ${pendingClockAction.type === 'IN' ? 'in' : 'out'}`);
      setPendingClockAction(null);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Attendance recording failed');
    } finally {
      setProcessingClock(false);
    }
  };

  // Shift Management Handlers
  const openCreateShiftModal = () => {
    setEditingShift(null);
    setShiftFormCode('');
    setShiftFormName('');
    setShiftFormStartTime('06:00');
    setShiftFormEndTime('14:30');
    setShiftFormBreakMin(45);
    setShiftFormActive(true);
    setShowShiftModal(true);
  };

  const openEditShiftModal = (shift: WorkforceShift) => {
    setEditingShift(shift);
    setShiftFormCode(shift.shiftCode);
    setShiftFormName(shift.name);
    setShiftFormStartTime(shift.startTime?.slice(0, 5) || '06:00');
    setShiftFormEndTime(shift.endTime?.slice(0, 5) || '14:30');
    setShiftFormBreakMin(shift.breakMinutes || 0);
    setShiftFormActive(shift.isActive);
    setShowShiftModal(true);
  };

  const handleShiftFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shiftFormCode.trim() || !shiftFormName.trim()) {
      notify('Shift code and name are required.');
      return;
    }

    setSubmittingShift(true);
    try {
      if (editingShift) {
        const payload: UpdateShiftPayload = {
          shiftCode: shiftFormCode.trim().toUpperCase(),
          name: shiftFormName.trim(),
          startTime: shiftFormStartTime,
          endTime: shiftFormEndTime,
          breakMinutes: shiftFormBreakMin,
          isActive: shiftFormActive
        };

        const res = await apiFetch(`${API}/workforce/shifts/${editingShift.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to update shift');
        }
        notify(`Shift ${shiftFormCode.toUpperCase()} updated successfully`);
      } else {
        const payload: CreateShiftPayload = {
          shiftCode: shiftFormCode.trim().toUpperCase(),
          name: shiftFormName.trim(),
          startTime: shiftFormStartTime,
          endTime: shiftFormEndTime,
          breakMinutes: shiftFormBreakMin
        };

        const res = await apiFetch(`${API}/workforce/shifts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to create shift');
        }
        notify(`Shift ${shiftFormCode.toUpperCase()} created successfully`);
      }
      setShowShiftModal(false);
      await loadData();
    } catch (err: any) {
      notify(err.message || 'Error saving shift');
    } finally {
      setSubmittingShift(false);
    }
  };

  // Filtered Employees
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        !searchQuery ||
        emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
        emp.skills.some(
          (s) =>
            s.skillCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.skillName.toLowerCase().includes(searchQuery.toLowerCase())
        );

      const matchRole =
        roleFilter === 'ALL' ||
        emp.role.toUpperCase() === roleFilter.toUpperCase();

      const matchSkill =
        skillFilter === 'ALL' ||
        emp.skills.some((s) => s.skillId === skillFilter);

      return matchSearch && matchRole && matchSkill;
    });
  }, [employees, searchQuery, roleFilter, skillFilter]);

  // Unique roles present
  const availableRoles = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => set.add(e.role.toUpperCase()));
    return ['ALL', ...Array.from(set)];
  }, [employees]);

  // Filtered employees for assign shift picker
  const filteredAssignEmployees = useMemo(() => {
    if (!assignUserSearch) return employees;
    const q = assignUserSearch.toLowerCase();
    return employees.filter(
      (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
    );
  }, [employees, assignUserSearch]);

  return (
    <div className="sales-screen-layout">
      {/* 1. Linear Executive Workforce Telemetry Strip */}
      <div className="linear-kpi-grid">
        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Total Employees</span>
            <Users size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {summary?.totalOperators ?? employees.length}
          </div>
          <div className="linear-kpi-caption">
            Active manufacturing workforce
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Shift Attendance</span>
            <UserCheck size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {summary?.presentToday ?? 0} / {summary?.scheduledToday ?? 0}
          </div>
          <div className="linear-kpi-caption">
            {summary?.attendanceRatePercent ?? 100}% on-time floor check-in
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Competency Catalog</span>
            <Award size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {skills.length} Skills
          </div>
          <div className="linear-kpi-caption">
            {summary?.totalQualifications ?? 0} certified skill assignments
          </div>
        </div>

        <div className="linear-kpi-card">
          <div className="linear-kpi-top">
            <span className="linear-kpi-title">Plant Shifts</span>
            <Clock size={14} className="linear-kpi-icon" />
          </div>
          <div className="linear-kpi-value">
            {shifts.filter((s) => s.isActive).length} Active
          </div>
          <div className="linear-kpi-caption">
            {shifts.map((s) => s.shiftCode).join(', ') || 'Customizable shifts'}
          </div>
        </div>
      </div>

      {/* 2. Linear Sub-Navigation Tabs */}
      <div className="sales-subnav-container">
        <div className="sales-subnav-tabs">
          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
          >
            <Users size={13} />
            <span>Employees & Skills</span>
            <span className="sales-subnav-badge">{employees.length}</span>
          </button>

          <button
            type="button"
            className={`sales-subnav-tab ${activeTab === 'roster' ? 'active' : ''}`}
            onClick={() => setActiveTab('roster')}
          >
            <Calendar size={13} />
            <span>Shift Attendance & Clock-In</span>
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

          {activeTab === 'employees' ? (
            <>
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setShowAddSkillModal(true)}
              >
                <Plus size={12} />
                <span>Catalog Skill</span>
              </button>

              <button
                type="button"
                className="sales-action-btn primary"
                onClick={() => setShowAddEmployeeModal(true)}
              >
                <UserPlus size={12} />
                <span>Add Employee</span>
              </button>
            </>
          ) : activeTab === 'roster' ? (
            <button
              type="button"
              className="sales-action-btn primary"
              onClick={() => {
                setAssignUserId('');
                setAssignUserSearch('');
                setShowAssignShiftModal(true);
              }}
            >
              <Plus size={12} />
              <span>Schedule Shift Assignment</span>
            </button>
          ) : (
            <button
              type="button"
              className="sales-action-btn primary"
              onClick={openCreateShiftModal}
            >
              <Plus size={12} />
              <span>Add Shift</span>
            </button>
          )}
        </div>
      </div>

      {/* 3. TAB 1: EMPLOYEES & SKILLS DIRECTORY */}
      {activeTab === 'employees' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* High-Density Linear Toolbar with Active Filter Telemetry */}
          <div className="sales-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
            {/* Active Data Telemetry & Clear Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)' }}>
                {filteredEmployees.length === employees.length ? (
                  `All Employees (${employees.length})`
                ) : (
                  <>
                    Showing <strong style={{ color: 'var(--sp-brand)' }}>{filteredEmployees.length}</strong> of {employees.length} employees
                  </>
                )}
              </span>

              {(roleFilter !== 'ALL' || skillFilter !== 'ALL' || searchQuery) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  {roleFilter !== 'ALL' && (
                    <span
                      className="sales-warehouse-pill"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px' }}
                    >
                      Role: <strong>{roleFilter.charAt(0) + roleFilter.slice(1).toLowerCase()}</strong>
                      <button
                        type="button"
                        onClick={() => setRoleFilter('ALL')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sp-text-muted)', display: 'flex' }}
                        title="Clear role filter"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {skillFilter !== 'ALL' && (
                    <span
                      className="sales-warehouse-pill"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px' }}
                    >
                      Skill: <strong>{skills.find((s) => s.id === skillFilter)?.skillCode ?? 'Filtered'}</strong>
                      <button
                        type="button"
                        onClick={() => setSkillFilter('ALL')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sp-text-muted)', display: 'flex' }}
                        title="Clear skill filter"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  {searchQuery && (
                    <span
                      className="sales-warehouse-pill"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '2px 8px' }}
                    >
                      Search: <strong>&ldquo;{searchQuery}&rdquo;</strong>
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sp-text-muted)', display: 'flex' }}
                        title="Clear search"
                      >
                        <X size={11} />
                      </button>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setRoleFilter('ALL');
                      setSkillFilter('ALL');
                      setSearchQuery('');
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--sp-brand)',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '2px 4px',
                      fontWeight: 500
                    }}
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {/* Filter Dropdowns & Search Box */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              {/* Role Filter Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Filter size={12} style={{ color: 'var(--sp-text-muted)' }} />
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="sp-form-select"
                  style={{ height: '32px', width: 'auto', minWidth: '125px', fontSize: '12px', padding: '0 24px 0 8px' }}
                >
                  <option value="ALL">All Roles ({employees.length})</option>
                  {availableRoles
                    .filter((r) => r !== 'ALL')
                    .map((r) => {
                      const count = employees.filter((e) => e.role.toUpperCase() === r).length;
                      return (
                        <option key={r} value={r}>
                          {r.charAt(0) + r.slice(1).toLowerCase()} ({count})
                        </option>
                      );
                    })}
                </select>
              </div>

              {/* Skill Filter Dropdown */}
              {skills.length > 0 && (
                <select
                  value={skillFilter}
                  onChange={(e) => setSkillFilter(e.target.value)}
                  className="sp-form-select"
                  style={{ height: '32px', width: 'auto', minWidth: '135px', fontSize: '12px', padding: '0 24px 0 8px' }}
                >
                  <option value="ALL">All Competencies ({skills.length})</option>
                  {skills.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.skillCode}
                    </option>
                  ))}
                </select>
              )}

              {/* Search Box */}
              <div className="sales-search-box">
                <Search size={13} className="sales-search-icon" />
                <input
                  type="text"
                  className="sales-search-input"
                  placeholder="Search name, email, skill…"
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
          </div>

          {/* Scalable Employee Table */}
          <div className="sales-table-card">
            <table className="sales-table">
              <thead>
                <tr>
                  <th style={{ width: '280px' }}>Employee</th>
                  <th style={{ width: '130px' }}>Role</th>
                  <th>Certified Skills & Qualifications</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Status</th>
                  <th style={{ textAlign: 'right', width: '230px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--sp-text-muted)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                        <Users size={28} style={{ opacity: 0.35 }} />
                        <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--sp-text)' }}>
                          No employees found matching criteria
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--sp-text-muted)' }}>
                          Click &quot;Add Employee&quot; to register new shop floor team members.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="sales-row">
                      {/* 1. Employee Info */}
                      <td>
                        <div className="sales-customer-cell">
                          <div
                            className="sales-customer-avatar"
                            style={{
                              background: 'var(--sp-surface-subtle)',
                              color: 'var(--sp-brand)',
                              fontWeight: 600
                            }}
                          >
                            {emp.name ? emp.name[0].toUpperCase() : 'E'}
                          </div>
                          <div>
                            <div className="sales-customer-name" style={{ fontWeight: 500 }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '2px' }}>
                              {emp.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. Role */}
                      <td>
                        <span className="sales-ref-badge" style={{ textTransform: 'capitalize' }}>
                          {emp.role.toLowerCase()}
                        </span>
                      </td>

                      {/* 3. Skills Badges */}
                      <td>
                        {emp.skills.length === 0 ? (
                          <span style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)', fontStyle: 'italic' }}>
                            No skills assigned
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                            {emp.skills.slice(0, 4).map((sk) => (
                              <span
                                key={sk.qualificationId}
                                className={getLevelBadgeClass(sk.level)}
                                title={`${sk.skillName} (${sk.level})`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 7px',
                                  fontSize: '11px'
                                }}
                              >
                                <strong>{sk.skillCode}</strong>
                                <span style={{ opacity: 0.7, fontSize: '9.5px' }}>{sk.level.slice(0, 3)}</span>
                              </span>
                            ))}
                            {emp.skills.length > 4 && (
                              <button
                                type="button"
                                onClick={() => setInspectingEmployee(emp)}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid var(--sp-border)',
                                  borderRadius: '4px',
                                  padding: '2px 6px',
                                  fontSize: '10.5px',
                                  color: 'var(--sp-brand)',
                                  cursor: 'pointer'
                                }}
                              >
                                +{emp.skills.length - 4} more
                              </button>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 4. Status */}
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11.5px',
                            color: emp.active ? 'var(--sp-text)' : 'var(--sp-text-muted)'
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: emp.active ? 'var(--sp-brand)' : 'var(--sp-border)'
                            }}
                          />
                          {emp.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* 5. Direct Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setSkillTargetEmployee(emp);
                              setTargetSkillId(skills[0]?.id || '');
                              setTargetSkillLevel('OPERATOR');
                              setTargetSkillExpiresAt('');
                              setTargetSkillNotes('');
                            }}
                            title={`Add a skill to ${emp.name}`}
                          >
                            <Plus size={11} />
                            <span>Skill</span>
                          </button>

                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setAssignUserId(emp.id);
                              setShowAssignShiftModal(true);
                            }}
                            title={`Assign a shift to ${emp.name}`}
                          >
                            <Clock size={11} />
                            <span>Shift</span>
                          </button>

                          <button
                            type="button"
                            className="sales-action-btn secondary"
                            style={{ padding: '3px 8px', fontSize: '11px' }}
                            onClick={() => setInspectingEmployee(emp)}
                            title="Manage employee profile and skills"
                          >
                            <span>Manage</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
              onClick={() => {
                setAssignUserId('');
                setAssignUserSearch('');
                setShowAssignShiftModal(true);
              }}
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
                  <th style={{ width: '170px' }}>Shift & Schedule</th>
                  <th>Employee</th>
                  <th>Assigned Work Center</th>
                  <th style={{ textAlign: 'center', width: '110px' }}>Status</th>
                  <th>Clock-In & Hours</th>
                  <th style={{ textAlign: 'right', width: '140px' }}>Actions</th>
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
                        <div style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>
                          {r.clockInTime ? (
                            <span style={{ color: 'var(--sp-text)', fontWeight: 500 }}>
                              In: {new Date(r.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--sp-text-muted)' }}>Not clocked in</span>
                          )}
                          {r.actualHours != null && r.actualHours > 0 && (
                            <span style={{ color: 'var(--sp-text-muted)', marginLeft: '6px' }}>
                              ({r.actualHours} hrs)
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          {!r.clockInTime ? (
                            <button
                              type="button"
                              className="sales-action-btn primary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              onClick={() => setPendingClockAction({ type: 'IN', roster: r })}
                            >
                              <LogIn size={11} />
                              <span>Clock In</span>
                            </button>
                          ) : !r.clockOutTime ? (
                            <button
                              type="button"
                              className="sales-action-btn secondary"
                              style={{ padding: '3px 8px', fontSize: '11px' }}
                              onClick={() => setPendingClockAction({ type: 'OUT', roster: r })}
                            >
                              <LogOut size={11} />
                              <span>Clock Out</span>
                            </button>
                          ) : (
                            <span className="sales-date-cell">Shift Finalized</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. TAB 3: PLANT PRODUCTION SHIFTS */}
      {activeTab === 'shifts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div className="sales-toolbar">
            <div style={{ fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
              Configure plant shift schedules, daily operating hours, and break durations.
            </div>

            <button
              type="button"
              className="sales-action-btn primary"
              onClick={openCreateShiftModal}
            >
              <Plus size={12} />
              <span>Add Shift</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '12px' }}>
            {shifts.map((s) => (
              <div
                key={s.id}
                style={{
                  background: 'var(--sp-surface)',
                  border: '1px solid var(--sp-border)',
                  borderRadius: '8px',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="sales-ref-badge">{s.shiftCode}</span>
                      <strong style={{ fontSize: '13px', color: 'var(--sp-text)' }}>{s.name}</strong>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
                      Plant Production Shift
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 500,
                      background: s.isActive ? 'var(--sp-brand-soft)' : 'var(--sp-surface-subtle)',
                      color: s.isActive ? 'var(--sp-brand)' : 'var(--sp-text-muted)'
                    }}
                  >
                    {s.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', fontSize: '11.5px' }}>
                  <div>
                    <span style={{ color: 'var(--sp-text-muted)', display: 'block', marginBottom: '2px' }}>Hours</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                      {s.startTime?.slice(0, 5)} - {s.endTime?.slice(0, 5)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--sp-text-muted)', display: 'block', marginBottom: '2px' }}>Break</span>
                    <strong style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--sp-text)' }}>
                      {s.breakMinutes} mins
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    className="sales-action-btn secondary"
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    onClick={() => openEditShiftModal(s)}
                  >
                    <Pencil size={11} />
                    <span>Edit Shift</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: ADD EMPLOYEE (WITH INITIAL SKILLS ASSIGNMENT)     */}
      {/* ========================================================= */}
      {showAddEmployeeModal && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submittingEmployee) setShowAddEmployeeModal(false);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '500px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Add New Employee
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Register employee details and assign their operational competencies.
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowAddEmployeeModal(false)}
                disabled={submittingEmployee}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployeeSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body" style={{ gap: '14px' }}>
                {/* Basic Details */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Full Name <span style={{ color: '#ef4444' }}>*</span></span>
                    <input
                      type="text"
                      className="sp-form-input"
                      placeholder="e.g. Vikram Sharma"
                      value={empName}
                      onChange={(e) => setEmpName(e.target.value)}
                      required
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Role / Title <span style={{ color: '#ef4444' }}>*</span></span>
                    <select
                      className="sp-form-select"
                      value={empRole}
                      onChange={(e) => setEmpRole(e.target.value)}
                    >
                      <option value="OPERATOR">Operator</option>
                      <option value="MACHINIST">Machinist</option>
                      <option value="WELDER">Welder</option>
                      <option value="TECHNICIAN">Technician</option>
                      <option value="INSPECTOR">Quality Inspector</option>
                      <option value="ENGINEER">Engineer</option>
                      <option value="SUPERVISOR">Supervisor</option>
                    </select>
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Work Email / Employee ID <span style={{ color: '#ef4444' }}>*</span></span>
                  <input
                    type="email"
                    className="sp-form-input"
                    placeholder="e.g. vikram.sharma@spindl.com"
                    value={empEmail}
                    onChange={(e) => setEmpEmail(e.target.value)}
                    required
                  />
                </label>

                {/* Initial Skills Section */}
                <div style={{ marginTop: '4px', borderTop: '1px solid var(--sp-border)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                      Assign Competency Skills
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--sp-text-muted)' }}>
                      {empInitialSkills.length} selected
                    </span>
                  </div>

                  {skills.length === 0 ? (
                    <div style={{ padding: '8px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                      No competency skills registered in catalog yet. You can create skills using &quot;+ Catalog Skill&quot;.
                    </div>
                  ) : (
                    <div style={{ padding: '10px', background: 'var(--sp-surface-subtle)', border: '1px solid var(--sp-border)', borderRadius: '6px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1.1fr auto', gap: '8px', alignItems: 'center' }}>
                        <select
                          className="sp-form-select"
                          value={selectedInitialSkillId}
                          onChange={(e) => setSelectedInitialSkillId(e.target.value)}
                        >
                          <option value="">Select a skill to add…</option>
                          {skills.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.skillCode} · {s.name}
                            </option>
                          ))}
                        </select>

                        <select
                          className="sp-form-select"
                          value={selectedInitialSkillLevel}
                          onChange={(e) => setSelectedInitialSkillLevel(e.target.value as QualificationLevel)}
                        >
                          <option value="APPRENTICE">Apprentice (L1)</option>
                          <option value="OPERATOR">Operator (L2)</option>
                          <option value="SPECIALIST">Specialist (L3)</option>
                          <option value="MASTER">Master (L4)</option>
                        </select>

                        <button
                          type="button"
                          className="sales-action-btn secondary"
                          style={{ height: '36px', padding: '0 12px' }}
                          onClick={handleAddInitialSkillRow}
                          disabled={!selectedInitialSkillId}
                        >
                          <Plus size={12} />
                          <span>Add</span>
                        </button>
                      </div>

                      {/* Pill list of assigned initial skills */}
                      {empInitialSkills.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--sp-border)' }}>
                          {empInitialSkills.map((assign) => {
                            const sk = skills.find((s) => s.id === assign.skillId);
                            return (
                              <span
                                key={assign.skillId}
                                className="sales-warehouse-pill"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 8px',
                                  fontSize: '11.5px',
                                  background: 'var(--sp-surface)'
                                }}
                              >
                                <strong>{sk?.skillCode ?? 'SKILL'}</strong>
                                <span style={{ opacity: 0.7 }}>({assign.level.toLowerCase()})</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveInitialSkillRow(assign.skillId)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--sp-text-muted)', display: 'flex' }}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setShowAddEmployeeModal(false)}
                  disabled={submittingEmployee}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={submittingEmployee}
                >
                  {submittingEmployee ? 'Adding…' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ADD SKILL TO SPECIFIC EMPLOYEE                   */}
      {/* ========================================================= */}
      {skillTargetEmployee && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submittingTargetSkill) setSkillTargetEmployee(null);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: 'var(--sp-brand-soft)',
                    color: 'var(--sp-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Award size={16} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    Certify Skill for Employee
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    {skillTargetEmployee.name} · {skillTargetEmployee.role}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setSkillTargetEmployee(null)}
                disabled={submittingTargetSkill}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleTargetSkillSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body" style={{ gap: '12px' }}>
                {/* Employee badge preview */}
                <div style={{ padding: '8px 12px', background: 'var(--sp-surface-subtle)', borderRadius: '6px', border: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Target Employee:</span>
                  <strong style={{ color: 'var(--sp-text)' }}>{skillTargetEmployee.name} ({skillTargetEmployee.email})</strong>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Competency Skill <span style={{ color: '#ef4444' }}>*</span></span>
                  <select
                    className="sp-form-select"
                    value={targetSkillId}
                    onChange={(e) => setTargetSkillId(e.target.value)}
                    required
                  >
                    <option value="">Select skill from catalog…</option>
                    {skills.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.skillCode} · {s.name} ({s.category})
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Qualification Level <span style={{ color: '#ef4444' }}>*</span></span>
                    <select
                      className="sp-form-select"
                      value={targetSkillLevel}
                      onChange={(e) => setTargetSkillLevel(e.target.value as QualificationLevel)}
                    >
                      <option value="APPRENTICE">APPRENTICE (Level 1)</option>
                      <option value="OPERATOR">OPERATOR (Level 2)</option>
                      <option value="SPECIALIST">SPECIALIST (Level 3)</option>
                      <option value="MASTER">MASTER (Level 4)</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Expiration Date</span>
                    <input
                      type="date"
                      className="sp-form-input"
                      value={targetSkillExpiresAt}
                      onChange={(e) => setTargetSkillExpiresAt(e.target.value)}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Notes / Certification Details</span>
                  <textarea
                    rows={2}
                    className="sp-form-textarea"
                    placeholder="e.g. Certified on 5-Axis machine controls; passed accuracy tolerances."
                    value={targetSkillNotes}
                    onChange={(e) => setTargetSkillNotes(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setSkillTargetEmployee(null)}
                  disabled={submittingTargetSkill}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={submittingTargetSkill}
                >
                  {submittingTargetSkill ? 'Assigning…' : 'Certify & Assign Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: MANAGE EMPLOYEE PROFILE & SKILLS DRAWER/MODAL    */}
      {/* ========================================================= */}
      {inspectingEmployee && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInspectingEmployee(null);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="leads-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  className="sales-customer-avatar"
                  style={{
                    background: 'var(--sp-surface-subtle)',
                    color: 'var(--sp-brand)',
                    fontWeight: 600
                  }}
                >
                  {inspectingEmployee.name ? inspectingEmployee.name[0].toUpperCase() : 'E'}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    {inspectingEmployee.name}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    {inspectingEmployee.role} · {inspectingEmployee.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setInspectingEmployee(null)}
              >
                <X size={14} />
              </button>
            </div>

            <div className="leads-modal-body" style={{ gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Certified Competencies ({inspectingEmployee.skills.length})
                </span>
                <button
                  type="button"
                  className="sales-action-btn primary"
                  style={{ padding: '3px 8px', fontSize: '11px' }}
                  onClick={() => {
                    const emp = inspectingEmployee;
                    setInspectingEmployee(null);
                    setSkillTargetEmployee(emp);
                    setTargetSkillId(skills[0]?.id || '');
                    setTargetSkillLevel('OPERATOR');
                  }}
                >
                  <Plus size={11} />
                  <span>Add Skill</span>
                </button>
              </div>

              {inspectingEmployee.skills.length === 0 ? (
                <div style={{ padding: '24px 12px', textAlign: 'center', background: 'var(--sp-surface-subtle)', borderRadius: '6px', color: 'var(--sp-text-muted)', fontSize: '12px' }}>
                  No competency skills currently assigned to this employee.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '280px', overflowY: 'auto' }}>
                  {inspectingEmployee.skills.map((sk) => (
                    <div
                      key={sk.qualificationId}
                      style={{
                        padding: '10px',
                        background: 'var(--sp-surface-subtle)',
                        borderRadius: '6px',
                        border: '1px solid var(--sp-border)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="sales-ref-badge">{sk.skillCode}</span>
                          <strong style={{ fontSize: '12px', color: 'var(--sp-text)' }}>{sk.skillName}</strong>
                          <span className={getLevelBadgeClass(sk.level)} style={{ fontSize: '10.5px' }}>
                            {sk.level.toLowerCase()}
                          </span>
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--sp-text-muted)', marginTop: '4px' }}>
                          Category: {sk.category} · Certified: {formatDate(sk.certifiedAt)}
                          {sk.expiresAt && ` · Exp: ${formatDate(sk.expiresAt)}`}
                        </div>
                        {sk.notes && (
                          <div style={{ fontSize: '11px', color: 'var(--sp-text-secondary)', marginTop: '2px', fontStyle: 'italic' }}>
                            {sk.notes}
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        className="sales-action-btn secondary"
                        style={{ padding: '4px 6px', color: 'var(--sp-text-muted)' }}
                        disabled={revokingQualId === sk.qualificationId}
                        onClick={() => handleRevokeSkill(sk.qualificationId, sk.skillCode)}
                        title="Revoke / Delete skill"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setInspectingEmployee(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 4: ADD COMPETENCY SKILL TO CATALOG                  */}
      {/* ========================================================= */}
      {showAddSkillModal && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submittingSkill) setShowAddSkillModal(false);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Register Competency Skill
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Add a standardized manufacturing skill to the company competency catalog.
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
              <div className="leads-modal-body" style={{ gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Skill Code <span style={{ color: '#ef4444' }}>*</span></span>
                  <input
                    type="text"
                    className="sp-form-input"
                    placeholder="e.g. CNC-MILL-5AX, TIG-WELD, CMM-METROLOGY"
                    value={newSkillCode}
                    onChange={(e) => setNewSkillCode(e.target.value.toUpperCase())}
                    required
                  />
                </label>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Skill Name <span style={{ color: '#ef4444' }}>*</span></span>
                  <input
                    type="text"
                    className="sp-form-input"
                    placeholder="e.g. 5-Axis CNC High Speed Milling"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    required
                  />
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Category <span style={{ color: '#ef4444' }}>*</span></span>
                    <select
                      className="sp-form-select"
                      value={newSkillCategory}
                      onChange={(e) => setNewSkillCategory(e.target.value)}
                    >
                      <option value="MACHINING">Machining</option>
                      <option value="WELDING">Welding</option>
                      <option value="QUALITY">Quality / Metrology</option>
                      <option value="HEAT_TREAT">Heat Treatment</option>
                      <option value="ASSEMBLY">Assembly</option>
                      <option value="ELECTRICAL">Electrical</option>
                    </select>
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Training Hours</span>
                    <input
                      type="number"
                      min="0"
                      className="sp-form-input"
                      value={newSkillHours}
                      onChange={(e) => setNewSkillHours(parseInt(e.target.value) || 0)}
                    />
                  </label>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Description / Standards</span>
                  <textarea
                    rows={2}
                    className="sp-form-textarea"
                    placeholder="e.g. Operation of multi-axis DMG MORI milling centers according to ISO 9001 quality rules."
                    value={newSkillDesc}
                    onChange={(e) => setNewSkillDesc(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setShowAddSkillModal(false)}
                  disabled={submittingSkill}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={submittingSkill}
                >
                  {submittingSkill ? 'Adding…' : 'Add Skill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 5: SCHEDULE SHIFT ASSIGNMENT (WITH SEARCH FILTER)   */}
      {/* ========================================================= */}
      {showAssignShiftModal && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submittingAssign) setShowAssignShiftModal(false);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  Schedule Shift Assignment
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  Assign an employee to a plant operating shift.
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
              <div className="leads-modal-body" style={{ gap: '12px' }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Plant Shift <span style={{ color: '#ef4444' }}>*</span></span>
                  <select
                    className="sp-form-select"
                    value={assignShiftId}
                    onChange={(e) => setAssignShiftId(e.target.value)}
                    required
                  >
                    <option value="">Select Shift…</option>
                    {shifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shiftCode} · {s.name} ({s.startTime?.slice(0, 5)} - {s.endTime?.slice(0, 5)})
                      </option>
                    ))}
                  </select>
                </label>

                {/* Scalable Employee Selector with Search Input */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  <label style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Employee <span style={{ color: '#ef4444' }}>*</span></span>
                  </label>
                  {employees.length > 8 && (
                    <input
                      type="text"
                      className="sp-form-input"
                      placeholder="Type to filter employees…"
                      value={assignUserSearch}
                      onChange={(e) => setAssignUserSearch(e.target.value)}
                      style={{ marginBottom: '4px' }}
                    />
                  )}
                  <select
                    className="sp-form-select"
                    value={assignUserId}
                    onChange={(e) => setAssignUserId(e.target.value)}
                    required
                  >
                    <option value="">Select Employee…</option>
                    {filteredAssignEmployees.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role}) · {u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                  <span>Roster Date <span style={{ color: '#ef4444' }}>*</span></span>
                  <input
                    type="date"
                    className="sp-form-input"
                    value={assignDate}
                    onChange={(e) => setAssignDate(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setShowAssignShiftModal(false)}
                  disabled={submittingAssign}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={submittingAssign}
                >
                  {submittingAssign ? 'Scheduling…' : 'Schedule Roster'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 6: CONFIRM CLOCK-IN / CLOCK-OUT                     */}
      {/* ========================================================= */}
      {pendingClockAction && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !processingClock) setPendingClockAction(null);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '440px' }}>
            <div className="leads-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '6px',
                    background: 'var(--sp-brand-soft)',
                    color: 'var(--sp-brand)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {pendingClockAction.type === 'IN' ? <LogIn size={16} /> : <LogOut size={16} />}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                    {pendingClockAction.type === 'IN' ? 'Confirm Employee Clock-In' : 'Confirm Employee Clock-Out'}
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                    {pendingClockAction.roster.userName} · {pendingClockAction.roster.shiftName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setPendingClockAction(null)}
                disabled={processingClock}
              >
                <X size={14} />
              </button>
            </div>

            <div className="leads-modal-body" style={{ gap: '12px' }}>
              <div
                style={{
                  padding: '12px',
                  background: 'var(--sp-surface-subtle)',
                  borderRadius: '6px',
                  border: '1px solid var(--sp-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Employee:</span>
                  <strong style={{ color: 'var(--sp-text)' }}>{pendingClockAction.roster.userName}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Email:</span>
                  <span style={{ color: 'var(--sp-text-secondary)' }}>{pendingClockAction.roster.userEmail}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--sp-text-muted)' }}>Assigned Shift:</span>
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                    <span className="sales-ref-badge" style={{ marginRight: '6px' }}>
                      {pendingClockAction.roster.shiftCode}
                    </span>
                    {pendingClockAction.roster.shiftStartTime?.slice(0, 5)} - {pendingClockAction.roster.shiftEndTime?.slice(0, 5)}
                  </span>
                </div>
                {pendingClockAction.type === 'OUT' && pendingClockAction.roster.clockInTime && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--sp-text-muted)' }}>Clocked In:</span>
                    <span style={{ color: 'var(--sp-text)', fontVariantNumeric: 'tabular-nums' }}>
                      {new Date(pendingClockAction.roster.clockInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                )}
                {pendingClockAction.roster.workCenterCode && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--sp-text-muted)' }}>Work Station:</span>
                    <span>{pendingClockAction.roster.workCenterCode} ({pendingClockAction.roster.workCenterName})</span>
                  </div>
                )}
              </div>

              <p style={{ margin: 0, fontSize: '12px', color: 'var(--sp-text-secondary)', lineHeight: 1.45 }}>
                {pendingClockAction.type === 'IN'
                  ? 'Mark this employee as PRESENT on the plant floor. Clock-in timestamp will be recorded for labor tracking.'
                  : 'Clock out employee from the active shift. Actual floor hours worked will be calculated and attendance finalized.'}
              </p>
            </div>

            <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="sales-action-btn secondary"
                onClick={() => setPendingClockAction(null)}
                disabled={processingClock}
              >
                Cancel
              </button>
              <button
                type="button"
                className="sales-action-btn primary"
                onClick={confirmClockAction}
                disabled={processingClock}
              >
                {processingClock ? (
                  'Processing…'
                ) : pendingClockAction.type === 'IN' ? (
                  <>
                    <LogIn size={13} />
                    <span>Confirm Clock In</span>
                  </>
                ) : (
                  <>
                    <LogOut size={13} />
                    <span>Confirm Clock Out</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 7: CUSTOMIZE / EDIT / CREATE PLANT SHIFT            */}
      {/* ========================================================= */}
      {showShiftModal && (
        <div
          className="leads-modal-overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !submittingShift) setShowShiftModal(false);
          }}
        >
          <div className="leads-modal-dialog" style={{ maxWidth: '460px' }}>
            <div className="leads-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--sp-text)' }}>
                  {editingShift ? `Edit Shift · ${editingShift.shiftCode}` : 'Create New Plant Shift'}
                </h3>
                <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: 'var(--sp-text-muted)' }}>
                  {editingShift ? 'Modify shift schedule, start/end operating times and breaks.' : 'Configure a new production operating shift for workforce rosters.'}
                </p>
              </div>
              <button
                type="button"
                className="leads-modal-close-btn"
                onClick={() => setShowShiftModal(false)}
                disabled={submittingShift}
              >
                <X size={14} />
              </button>
            </div>

            <form onSubmit={handleShiftFormSubmit} style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="leads-modal-body" style={{ gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Shift Code <span style={{ color: '#ef4444' }}>*</span></span>
                    <input
                      type="text"
                      className="sp-form-input"
                      style={{ textTransform: 'uppercase' }}
                      placeholder="e.g. ALPHA"
                      value={shiftFormCode}
                      onChange={(e) => setShiftFormCode(e.target.value.toUpperCase())}
                      required
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Shift Name <span style={{ color: '#ef4444' }}>*</span></span>
                    <input
                      type="text"
                      className="sp-form-input"
                      placeholder="e.g. Morning Shift"
                      value={shiftFormName}
                      onChange={(e) => setShiftFormName(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Start Time <span style={{ color: '#ef4444' }}>*</span></span>
                    <input
                      type="time"
                      className="sp-form-input"
                      value={shiftFormStartTime}
                      onChange={(e) => setShiftFormStartTime(e.target.value)}
                      required
                    />
                  </label>

                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>End Time <span style={{ color: '#ef4444' }}>*</span></span>
                    <input
                      type="time"
                      className="sp-form-input"
                      value={shiftFormEndTime}
                      onChange={(e) => setShiftFormEndTime(e.target.value)}
                      required
                    />
                  </label>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', alignItems: 'center' }}>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11.5px', fontWeight: 500, color: 'var(--sp-text)' }}>
                    <span>Break Duration (minutes)</span>
                    <input
                      type="number"
                      min="0"
                      max="240"
                      className="sp-form-input"
                      value={shiftFormBreakMin}
                      onChange={(e) => setShiftFormBreakMin(Number(e.target.value) || 0)}
                    />
                  </label>

                  {editingShift && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 500, color: 'var(--sp-text)', marginTop: '20px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={shiftFormActive}
                        onChange={(e) => setShiftFormActive(e.target.checked)}
                      />
                      <span>Active Shift</span>
                    </label>
                  )}
                </div>
              </div>

              <div style={{ padding: '12px 20px', borderTop: '1px solid var(--sp-border)', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="sales-action-btn secondary"
                  onClick={() => setShowShiftModal(false)}
                  disabled={submittingShift}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="sales-action-btn primary"
                  disabled={submittingShift}
                >
                  {submittingShift ? 'Saving…' : editingShift ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
