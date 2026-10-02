import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, map, of, defer, catchError, timeout } from 'rxjs';
import {
  AdminRole,
  AdminUser,
  ApiPermission,
  ApiRole,
  ApiUser,
  AssignUserRoleRequest,
  CreateAdminUserRequest,
  AuditLogEntry,
  AuditLogFilter,
  AuditLogsPage,
  ApiAuditLog,
  ApiAuditLogsResponse,
  SystemHealth,
} from '../../core/models/admin.model';
import { BaseApiService } from '../../core/services/base-api.service';

@Injectable({ providedIn: 'root' })
export class AdminService {
  private api = inject(BaseApiService);

  getUsers(): Observable<AdminUser[]> {
    return this.api.get<ApiUser[] | { items?: ApiUser[]; data?: ApiUser[] }>('users').pipe(
      map(response => {
        const users = Array.isArray(response) ? response : response.items ?? response.data ?? [];
        return users.map(user => this.mapUser(user));
      }),
    );
  }

  getUser(id: string): Observable<AdminUser> {
    return this.api.get<ApiUser>(`users/${id}`).pipe(map(user => this.mapUser(user)));
  }

  createUser(request: CreateAdminUserRequest): Observable<AdminUser> {
    return this.api.post<ApiUser>('users', request).pipe(map(user => this.mapUser(user)));
  }

  assignRole(userId: string, request: AssignUserRoleRequest): Observable<AdminUser> {
    return this.api.post<ApiUser>(`users/${userId}/roles`, request).pipe(map(user => this.mapUser(user)));
  }

  removeRole(userId: string, roleAssignmentId: string): Observable<void> {
    return this.api.delete<void>(`users/${userId}/roles/${roleAssignmentId}`);
  }

  lockUser(userId: string, reason: string): Observable<void> {
    return this.api.post<void>(`users/${userId}/lock`, { reason });
  }

  unlockUser(userId: string): Observable<void> {
    return this.api.post<void>(`users/${userId}/unlock`, {});
  }

  deactivateUser(userId: string): Observable<void> {
    return this.api.post<void>(`users/${userId}/deactivate`, {});
  }

  getRoles(): Observable<AdminRole[]> {
    return forkJoin({
      roles: this.api.get<ApiRole[] | { items?: ApiRole[]; data?: ApiRole[] }>('roles'),
      permissions: this.api.get<ApiPermission[] | { items?: ApiPermission[]; data?: ApiPermission[] }>('permissions'),
    }).pipe(
      map(({ roles, permissions }) => {
        const roleList = this.unwrapList(roles);
        const permissionList = this.unwrapList(permissions);
        const permissionCodeById = new Map(permissionList.map(permission => [permission.id, permission.code]));

        return roleList.map(role => ({
          id: role.id,
          name: role.name,
          description: role.description ?? '',
          permissionIds: role.permissionIds ?? [],
          permissions: (role.permissionIds ?? []).map(id => permissionCodeById.get(id) ?? id),
          isSystemRole: role.isSystemRole ?? false,
          userCount: 0,
        }));
      }),
    );
  }

  getAuditLogs(filter?: AuditLogFilter): Observable<AuditLogsPage> {
    return this.api.get<ApiAuditLogsResponse>('audit-logs', {
      page: filter?.page ?? 1,
      pageSize: filter?.pageSize ?? 20,
    }).pipe(
      map(response => ({
        page: response.page,
        pageSize: response.pageSize,
        totalCount: response.totalCount,
        items: (response.items ?? []).map(log => this.mapAuditLog(log)),
      })),
    );
  }

  getSystemHealth(): Observable<SystemHealth> {
    return defer(() => {
      const started = performance.now();
      // This authenticated read measures connectivity, not overall service health.
      return this.api.get<unknown>('warehouses').pipe(
        timeout(10000),
        map((): SystemHealth => ({ apiStatus: 'reachable', latencyMs: Math.round(performance.now() - started), lastChecked: new Date() })),
        catchError(() => of<SystemHealth>({ apiStatus: 'unreachable', latencyMs: null, lastChecked: new Date() })),
      );
    });
  }

  private mapUser(user: ApiUser): AdminUser {
    const roles = (user.roles ?? user.roleAssignments ?? []).map(role => ({
      id: role.roleAssignmentId ?? role.userRoleId ?? role.id ?? '',
      roleId: role.roleId ?? '',
      roleName: role.roleName ?? role.name ?? role.roleId ?? 'Assigned role',
      warehouseScope: role.warehouseScope ?? role.warehouseId,
    }));
    const status = this.mapStatus(user);

    return {
      id: user.id ?? user.userId ?? '',
      username: user.username ?? user.userName ?? '',
      email: user.email ?? '',
      name: user.fullName ?? user.name ?? user.username ?? user.email ?? 'Unnamed user',
      role: roles[0]?.roleName ?? 'No role',
      status,
      roles,
      warehouseId: user.warehouseScope ?? user.warehouseId,
      language: user.language,
      lastLogin: this.toDate(user.lastLoginAtUtc ?? user.lastLoginUtc ?? user.lastLogin),
      createdAt: this.toDate(user.createdAtUtc ?? user.createdAt),
    };
  }

  private unwrapList<T>(response: T[] | { items?: T[]; data?: T[] }): T[] {
    return Array.isArray(response) ? response : response.items ?? response.data ?? [];
  }

  private mapStatus(user: ApiUser): AdminUser['status'] {
    const rawStatus = user.status?.toLowerCase();

    if (user.isLocked || user.locked || rawStatus === 'locked') {
      return 'locked';
    }

    if (user.isActive === false || user.active === false || rawStatus === 'inactive' || rawStatus === 'deactivated') {
      return 'inactive';
    }

    if (user.isActive === true || user.active === true || rawStatus === 'active') {
      return 'active';
    }

    return rawStatus ? 'unknown' : 'active';
  }

  private mapAuditLog(log: ApiAuditLog): AuditLogEntry {
    return {
      id: log.id,
      userId: log.actorUserId ?? '',
      userName: log.actorUsername ?? 'System',
      action: log.action,
      module: log.targetType ?? this.deriveModule(log.action),
      targetId: log.targetId ?? undefined,
      details: this.formatAuditDetails(log.details),
      ipAddress: log.ipAddress ?? '—',
      timestamp: this.toDate(log.occurredAtUtc) ?? new Date(),
    };
  }

  private deriveModule(action: string): string {
    return action.replace(/Command$/, '') || action;
  }

  private formatAuditDetails(details: string | null): string {
    if (!details) {
      return '—';
    }

    try {
      const parsed = JSON.parse(details) as Record<string, unknown>;
      return Object.entries(parsed)
        .filter(([key]) => !key.toLowerCase().includes('password'))
        .map(([key, value]) => `${key}: ${value}`)
        .join(' · ') || details;
    } catch {
      return details;
    }
  }

  private toDate(value?: string): Date | undefined {
    if (!value) {
      return undefined;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
}
