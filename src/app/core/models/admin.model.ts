export type AdminUserStatus = 'active' | 'inactive' | 'locked' | 'unknown';

export interface AdminUserRoleAssignment {
  id: string;
  roleId: string;
  roleName: string;
  warehouseScope?: string;
}

export interface AdminUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  status: AdminUserStatus;
  roles: AdminUserRoleAssignment[];
  warehouseId?: string;
  language?: string;
  lastLogin?: Date;
  createdAt?: Date;
}

export interface CreateAdminUserRequest {
  username: string;
  email: string;
  fullName: string;
  password: string;
  initialRoleId: string;
  warehouseScope: string;
  language: string;
}

export interface AssignUserRoleRequest {
  roleId: string;
  warehouseScope: string;
}

export interface LockUserRequest {
  reason: string;
}

export interface ApiUserRoleAssignment {
  id?: string;
  roleAssignmentId?: string;
  userRoleId?: string;
  roleId?: string;
  roleName?: string;
  name?: string;
  warehouseScope?: string;
  warehouseId?: string;
}

export interface ApiUser {
  id?: string;
  userId?: string;
  username?: string;
  userName?: string;
  email?: string;
  fullName?: string;
  name?: string;
  language?: string;
  warehouseScope?: string;
  warehouseId?: string;
  isActive?: boolean;
  active?: boolean;
  isLocked?: boolean;
  locked?: boolean;
  status?: string;
  lastLoginAtUtc?: string;
  lastLoginUtc?: string;
  lastLogin?: string;
  createdAtUtc?: string;
  createdAt?: string;
  roles?: ApiUserRoleAssignment[];
  roleAssignments?: ApiUserRoleAssignment[];
}

export interface AdminRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  permissionIds: string[];
  isSystemRole: boolean;
  userCount: number;
}

export interface AdminPermission {
  id: string;
  resource: string;
  action: string;
  constraint?: string | null;
  code: string;
}

export interface ApiRole {
  id: string;
  name: string;
  description?: string;
  permissionIds?: string[];
  isSystemRole?: boolean;
}

export interface ApiPermission {
  id: string;
  resource: string;
  action: string;
  constraint?: string | null;
  code: string;
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  targetId?: string;
  details: string;
  ipAddress: string;
  timestamp: Date;
}

export interface ApiAuditLog {
  id: string;
  occurredAtUtc: string;
  actorUserId: string | null;
  actorUsername: string | null;
  ipAddress: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: string | null;
}

export interface ApiAuditLogsResponse {
  items: ApiAuditLog[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface AuditLogFilter {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface AuditLogsPage {
  items: AuditLogEntry[];
  page: number;
  pageSize: number;
  totalCount: number;
}

export interface SystemHealth {
  apiStatus: 'reachable' | 'unreachable';
  latencyMs: number | null;
  lastChecked: Date;
}
