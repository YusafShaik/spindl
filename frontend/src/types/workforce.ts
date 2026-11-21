export type QualificationLevel = 'APPRENTICE' | 'OPERATOR' | 'SPECIALIST' | 'MASTER';
export type QualificationStatus = 'ACTIVE' | 'PROBATION' | 'EXPIRED' | 'SUSPENDED';
export type AttendanceStatus = 'SCHEDULED' | 'PRESENT' | 'LATE' | 'ABSENT' | 'ON_LEAVE';

export interface WorkforceSkill {
  id: string;
  tenantId: string;
  skillCode: string;
  name: string;
  category: string;
  description?: string | null;
  minCertHours: number;
  createdAt: string;
}

export interface CreateSkillPayload {
  skillCode: string;
  name: string;
  category: string;
  description?: string;
  minCertHours?: number;
  requiredTrainingHours?: number;
}

export interface OperatorQualification {
  id: string;
  tenantId: string;
  userId: string;
  userName: string;
  userEmail: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  skillCategory: string;
  qualificationLevel: QualificationLevel;
  certifiedAt: string;
  expiresAt?: string | null;
  status: QualificationStatus;
  notes?: string | null;
}

export interface UpsertQualificationPayload {
  userId: string;
  skillId: string;
  qualificationLevel: QualificationLevel;
  expiresAt?: string | null;
  status: QualificationStatus;
  notes?: string;
}

export interface WorkforceShift {
  id: string;
  tenantId: string;
  shiftCode: string;
  name: string;
  startTime: string; // HH:mm:ss
  endTime: string;
  breakMinutes: number;
  isActive: boolean;
}

export interface CreateShiftPayload {
  shiftCode: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

export interface UpdateShiftPayload {
  shiftCode?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  breakMinutes?: number;
  isActive?: boolean;
}

export interface RosterAssignment {
  id: string;
  tenantId: string;
  shiftId: string;
  shiftCode: string;
  shiftName: string;
  shiftStartTime: string;
  shiftEndTime: string;
  userId: string;
  userName: string;
  userEmail: string;
  workCenterId?: string | null;
  workCenterCode?: string | null;
  workCenterName?: string | null;
  rosterDate: string;
  plannedHours: number;
  attendanceStatus: AttendanceStatus;
  clockInTime?: string | null;
  clockOutTime?: string | null;
  actualHours?: number | null;
  notes?: string | null;
}

export interface CreateRosterPayload {
  shiftId: string;
  userId: string;
  workCenterId?: string | null;
  rosterDate: string;
  plannedHours?: number;
  notes?: string;
}

export interface EmployeeSkill {
  qualificationId: string;
  skillId: string;
  skillCode: string;
  skillName: string;
  category: string;
  level: QualificationLevel;
  certifiedAt: string;
  expiresAt?: string | null;
  status: QualificationStatus;
  notes?: string | null;
}

export interface WorkforceEmployee {
  id: string; // userId
  membershipId: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  skills: EmployeeSkill[];
  joinedAt: string;
}

export interface InitialSkillAssignmentPayload {
  skillId: string;
  level: QualificationLevel;
}

export interface CreateEmployeePayload {
  name: string;
  email: string;
  role: string;
  skills?: InitialSkillAssignmentPayload[];
}

export interface SkillsMatrixRow {
  userId: string;
  userName: string;
  userEmail: string;
  role: string;
  qualifications: Record<string, OperatorQualification>; // Keyed by skillCode
}

export interface SkillsMatrixResponse {
  skills: WorkforceSkill[];
  rows: SkillsMatrixRow[];
}

export interface SkillGuardRequest {
  operatorUserId: string;
  operationId?: string | null;
  requiredSkillCode: string;
  requiredLevel?: string | null;
}

export interface SkillGuardResponse {
  isQualified: boolean;
  operatorName: string;
  skillCode: string;
  skillName: string;
  currentLevel: string;
  requiredLevel?: string | null;
  isExpired: boolean;
  reason: string;
  message?: string;
}

export interface WorkforceSummary {
  totalOperators: number;
  activeShifts: number;
  presentToday: number;
  scheduledToday: number;
  attendanceRatePercent: number;
  certifiedSkillsCount: number;
  totalQualifications: number;
}
