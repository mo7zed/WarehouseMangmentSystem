import { SkillType } from './work-assignment.model';

export type OperatorStatus = 'Available' | 'Busy' | 'OnBreak' | 'Offline' | string;

export interface OperatorSkill {
  skillType: SkillType;
  certifiedDate: string;
  expiresAt?: string | null;
}

export interface OperatorShift {
  startTime: string;
  endTime: string;
  workDays: string[];
}

export interface OperatorPerformanceMetrics {
  tasksCompletedToday: number;
  averageTaskDurationMinutes: number;
  pickAccuracyRate: number;
  errorRate: number;
}

export interface OperatorProfile {
  id: string;
  userId: string;
  warehouseId: string;
  skills: OperatorSkill[];
  authorizedZoneIds: string[];
  shift: OperatorShift;
  currentWorkload: number;
  maxConcurrentTasks: number;
  performanceMetrics: OperatorPerformanceMetrics;
  status: OperatorStatus;
  lastActivityAt?: string | null;
  createdAt: string;
}

export interface CreateOperatorProfileDto {
  userId: string;
  warehouseId: string;
  shiftStartTime: string;
  shiftEndTime: string;
  workDays: string[];
  maxConcurrentTasks: number;
}

export interface CreateOperatorSkillDto {
  skillType: SkillType;
  certifiedDate: string;
  expiresAt?: string | null;
}
