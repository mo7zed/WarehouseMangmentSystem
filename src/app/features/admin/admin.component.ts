import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { TabViewModule } from 'primeng/tabview';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '../../core/auth/auth.service';
import { AdminRole, AdminUser, AuditLogEntry, SystemHealth } from '../../core/models/admin.model';
import { SettingsService } from '../settings/settings.service';
import { Warehouse } from '../settings/warehouse.model';
import { AdminService } from './admin.service';

interface UserForm {
  username: string;
  email: string;
  fullName: string;
  password: string;
  initialRoleId: string;
  warehouseScope: string;
  language: string;
}

interface RoleForm {
  userId: string;
  roleId: string;
  warehouseScope: string;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule,
    FormsModule,
    TranslateModule,
    TableModule,
    ButtonModule,
    TagModule,
    TabViewModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    TooltipModule,
  ],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.scss',
})
export class AdminComponent implements OnInit {
  private adminService = inject(AdminService);
  private settingsService = inject(SettingsService);
  private authService = inject(AuthService);
  private messageService = inject(MessageService);

  users = signal<AdminUser[]>([]);
  roles = signal<AdminRole[]>([]);
  roleOptions = signal<{ label: string; value: string }[]>([]);
  warehouseOptions = signal<{ label: string; value: string }[]>([]);
  private warehouseNameById = new Map<string, string>();
  auditLogs = signal<AuditLogEntry[]>([]);
  auditTotalCount = signal(0);
  auditPageSize = 20;
  auditFirst = 0;
  health = signal<SystemHealth | null>(null);

  usersLoading = signal(true);
  rolesLoading = signal(true);
  auditLoading = signal(true);
  saving = signal(false);
  busyUserId = signal<string | null>(null);

  showUserDialog = false;
  showRoleDialog = false;
  showLockDialog = false;
  selectedUser: AdminUser | null = null;
  auditSearch = '';
  lockReason = '';

  userForm: UserForm = this.emptyUserForm();
  roleForm: RoleForm = this.emptyRoleForm();

  ngOnInit(): void {
    this.loadUsers();
    this.loadRoles();
    this.loadWarehouses();
    this.adminService.getSystemHealth().subscribe(h => this.health.set(h));
  }

  loadUsers(): void {
    this.usersLoading.set(true);
    this.adminService.getUsers().subscribe({
      next: users => {
        this.users.set(users);
        this.usersLoading.set(false);
      },
      error: err => {
        this.usersLoading.set(false);
        this.showError('Failed to load users', err);
      },
    });
  }

  loadRoles(): void {
    this.rolesLoading.set(true);
    this.adminService.getRoles().subscribe({
      next: roles => {
        this.roles.set(roles);
        this.roleOptions.set(roles.map(role => ({ label: role.name, value: role.id })));
        this.rolesLoading.set(false);
      },
      error: () => this.rolesLoading.set(false),
    });
  }

  loadWarehouses(): void {
    this.settingsService.getWarehouses().subscribe({
      next: warehouses => {
        this.warehouseNameById = new Map(warehouses.map(warehouse => [warehouse.id, this.getWarehouseLabel(warehouse)]));
        this.warehouseOptions.set(warehouses.map(warehouse => ({
          label: this.getWarehouseLabel(warehouse),
          value: warehouse.id,
        })));
      },
      error: err => this.showError('Failed to load warehouses', err),
    });
  }

  onAuditLazyLoad(event: TableLazyLoadEvent): void {
    const rows = event.rows ?? this.auditPageSize;
    const page = Math.floor((event.first ?? 0) / rows) + 1;
    this.auditFirst = event.first ?? 0;
    this.auditPageSize = rows;
    this.loadAuditLogs(page, rows);
  }

  onAuditSearch(): void {
    this.auditFirst = 0;
    this.loadAuditLogs(1, this.auditPageSize);
  }

  reloadAuditLogs(): void {
    const page = Math.floor(this.auditFirst / this.auditPageSize) + 1;
    this.loadAuditLogs(page, this.auditPageSize);
  }

  loadAuditLogs(page = 1, pageSize = this.auditPageSize): void {
    this.auditLoading.set(true);
    this.adminService.getAuditLogs({ page, pageSize }).subscribe({
      next: result => {
        let items = result.items;
        if (this.auditSearch.trim()) {
          const q = this.auditSearch.trim().toLowerCase();
          items = items.filter(log =>
            log.userName.toLowerCase().includes(q) ||
            log.action.toLowerCase().includes(q) ||
            log.module.toLowerCase().includes(q) ||
            log.details.toLowerCase().includes(q) ||
            log.ipAddress.toLowerCase().includes(q)
          );
        }
        this.auditLogs.set(items);
        this.auditTotalCount.set(result.totalCount);
        this.auditLoading.set(false);
      },
      error: () => {
        this.auditLogs.set([]);
        this.auditTotalCount.set(0);
        this.auditLoading.set(false);
      },
    });
  }

  getAuditActionSeverity(log: AuditLogEntry): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const details = log.details.toLowerCase();
    if (details.includes('succeeded: false') || details.includes('error:')) {
      return 'danger';
    }
    if (details.includes('succeeded: true')) {
      return 'success';
    }
    if (log.action.toLowerCase().includes('delete')) {
      return 'danger';
    }
    if (log.action.toLowerCase().includes('create')) {
      return 'success';
    }
    return 'info';
  }

  openUserDialog(): void {
    this.userForm = this.emptyUserForm();
    this.showUserDialog = true;
  }

  createUser(): void {
    if (!this.canCreateUser()) {
      return;
    }

    this.saving.set(true);
    this.adminService.createUser(this.userForm).subscribe({
      next: () => {
        this.saving.set(false);
        this.showUserDialog = false;
        this.loadUsers();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'User created successfully.' });
      },
      error: err => {
        this.saving.set(false);
        this.showError('Failed to create user', err);
      },
    });
  }

  openRoleDialog(user: AdminUser): void {
    this.selectedUser = user;
    this.roleForm = { ...this.emptyRoleForm(), userId: user.id, warehouseScope: user.warehouseId ?? '' };
    this.showRoleDialog = true;
  }

  assignRole(): void {
    if (!this.roleForm.userId || !this.roleForm.roleId) {
      return;
    }

    this.saving.set(true);
    this.adminService.assignRole(this.roleForm.userId, {
      roleId: this.roleForm.roleId,
      warehouseScope: this.roleForm.warehouseScope,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showRoleDialog = false;
        this.loadUsers();
        this.messageService.add({ severity: 'success', summary: 'Saved', detail: 'Role assigned successfully.' });
      },
      error: err => {
        this.saving.set(false);
        this.showError('Failed to assign role', err);
      },
    });
  }

  removeRole(user: AdminUser, roleAssignmentId: string): void {
    this.busyUserId.set(user.id);
    this.adminService.removeRole(user.id, roleAssignmentId).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.loadUsers();
        this.messageService.add({ severity: 'success', summary: 'Removed', detail: 'Role removed successfully.' });
      },
      error: err => {
        this.busyUserId.set(null);
        this.showError('Failed to remove role', err);
      },
    });
  }

  openLockDialog(user: AdminUser): void {
    this.selectedUser = user;
    this.lockReason = '';
    this.showLockDialog = true;
  }

  lockUser(): void {
    if (!this.selectedUser || !this.lockReason.trim()) {
      return;
    }

    const userId = this.selectedUser.id;
    this.saving.set(true);
    this.adminService.lockUser(userId, this.lockReason.trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.showLockDialog = false;
        this.loadUsers();
        this.messageService.add({ severity: 'success', summary: 'Locked', detail: 'User locked successfully.' });
      },
      error: err => {
        this.saving.set(false);
        this.showError('Failed to lock user', err);
      },
    });
  }

  unlockUser(user: AdminUser): void {
    this.busyUserId.set(user.id);
    this.adminService.unlockUser(user.id).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.loadUsers();
        this.messageService.add({ severity: 'success', summary: 'Unlocked', detail: 'User unlocked successfully.' });
      },
      error: err => {
        this.busyUserId.set(null);
        this.showError('Failed to unlock user', err);
      },
    });
  }

  deactivateUser(user: AdminUser): void {
    this.busyUserId.set(user.id);
    this.adminService.deactivateUser(user.id).subscribe({
      next: () => {
        this.busyUserId.set(null);
        this.loadUsers();
        this.messageService.add({ severity: 'success', summary: 'Deactivated', detail: 'User deactivated successfully.' });
      },
      error: err => {
        this.busyUserId.set(null);
        this.showError('Failed to deactivate user', err);
      },
    });
  }

  canCreateUser(): boolean {
    return !!(
      this.userForm.username.trim() &&
      this.userForm.email.trim() &&
      this.userForm.fullName.trim() &&
      this.userForm.password &&
      this.userForm.initialRoleId.trim() &&
      this.userForm.warehouseScope.trim() &&
      this.userForm.language.trim()
    );
  }

  canManageUsers(): boolean {
    return this.authService.hasPermission('users:write');
  }

  canManageRoles(): boolean {
    return this.authService.hasPermission('roles:write');
  }

  getRolePermissions(roleId: string): string[] {
    return this.roles().find(role => role.id === roleId)?.permissions ?? [];
  }

  getRoleUserCount(role: AdminRole): number {
    return this.users().filter(user =>
      user.roles.some(assignment => assignment.roleId === role.id || assignment.roleName === role.name)
    ).length;
  }

  getUserPermissions(user: AdminUser): string[] {
    const permissions = new Set<string>();
    const roles = this.roles();

    user.roles.forEach(assignment => {
      const role = roles.find(item => item.id === assignment.roleId || item.name === assignment.roleName);
      role?.permissions.forEach(permission => permissions.add(permission));
    });

    return [...permissions].sort();
  }

  getWarehouseName(warehouseId: string): string {
    return this.warehouseNameById.get(warehouseId) ?? warehouseId;
  }

  getStatusSeverity(status: AdminUser['status']): 'success' | 'secondary' | 'info' | 'warning' | 'danger' {
    switch (status) {
      case 'active':
        return 'success';
      case 'locked':
        return 'warning';
      case 'inactive':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  private emptyUserForm(): UserForm {
    return {
      username: '',
      email: '',
      fullName: '',
      password: '',
      initialRoleId: '',
      warehouseScope: '',
      language: 'English',
    };
  }

  private emptyRoleForm(): RoleForm {
    return {
      userId: '',
      roleId: '',
      warehouseScope: '',
    };
  }

  private getWarehouseLabel(warehouse: Warehouse): string {
    const parts = [warehouse.code, warehouse.name].filter(Boolean);
    return parts.length ? parts.join(' - ') : warehouse.id;
  }

  private showError(fallback: string, err: unknown): void {
    const detail =
      (err as { error?: { message?: string; title?: string } })?.error?.message ||
      (err as { error?: { message?: string; title?: string } })?.error?.title ||
      (err as { message?: string })?.message ||
      fallback;

    this.messageService.add({ severity: 'error', summary: 'Error', detail, life: 6000 });
  }
}
