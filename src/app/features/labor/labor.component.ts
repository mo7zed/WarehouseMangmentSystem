import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { TabViewModule } from 'primeng/tabview';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { MultiSelectModule } from 'primeng/multiselect';
import { MessageService } from 'primeng/api';
import { WarehouseService } from '../settings/warehouse.service';
import { AdminService } from '../admin/admin.service';
import { WorkAssignmentService } from './work-assignment.service';
import { OperatorProfileService } from './operator-profile.service';
import { CreateWorkAssignmentDto, LaborTaskPriority, SkillType, WorkAssignment, WorkAssignmentStatus, WorkTaskType } from './work-assignment.model';
import { CreateOperatorProfileDto, CreateOperatorSkillDto, OperatorProfile, OperatorStatus } from './operator-profile.model';
import { SelectOption } from '../../core/models/shared.model';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';

const WAREHOUSE_STORAGE_KEY = 'wms_selected_warehouse_id';

@Component({
  selector: 'app-labor',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe, CommonModule, FormsModule, TranslateModule, CardModule, TabViewModule, TableModule, ButtonModule, TagModule, DialogModule, InputTextModule, DropdownModule, MultiSelectModule],
  templateUrl: './labor.component.html',
  styleUrl: './labor.component.scss',
})
export class LaborComponent implements OnInit {
  private assignmentsApi = inject(WorkAssignmentService);
  private operatorsApi = inject(OperatorProfileService);
  private warehouses = inject(WarehouseService);
  private admin = inject(AdminService);
  private messages = inject(MessageService);
  private warehouseContext = inject(WarehouseContextService);

  assignments = signal<WorkAssignment[]>([]);
  operators = signal<OperatorProfile[]>([]);
  loading = signal(true);
  operatorsLoading = signal(false);
  creating = signal(false);
  creatingOperator = signal(false);
  updatingOperator = signal(false);
  showCreateDialog = signal(false);
  showCreateOperatorDialog = signal(false);
  showOperatorDialog = signal(false);
  selectedOperator = signal<OperatorProfile | null>(null);
  private zoneNames = signal<Record<string, string>>({});
  zoneOptions = signal<SelectOption[]>([]);
  private operatorNames = signal<Record<string, string>>({});
  private userNames = signal<Record<string, string>>({});
  userOptions = signal<SelectOption[]>([]);
  warehouseOptions = signal<SelectOption[]>([]);
  warehouseId = '';

  readonly operatorStatuses: OperatorStatus[] = ['Available', 'Busy', 'OnBreak', 'Offline'];
  readonly workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  newOperator = this.emptyOperator();
  newSkill = this.emptySkill();
  newZoneId = '';

  readonly taskTypes: WorkTaskType[] = ['Putaway', 'Pick', 'Pack', 'CycleCount', 'Receiving', 'Transfer', 'QualityInspection'];
  readonly priorities: LaborTaskPriority[] = ['Critical', 'High', 'Normal', 'Low'];
  readonly skillOptions: SelectOption[] = [
    { label: 'Forklift certified', value: 'ForkliftCertified' },
    { label: 'Hazmat trained', value: 'HazmatTrained' },
    { label: 'Cold storage authorized', value: 'ColdStorageAuthorized' },
    { label: 'RF scanner proficient', value: 'RFScannerProficient' },
    { label: 'Quality inspector', value: 'QualityInspector' },
    { label: 'Returns specialist', value: 'ReturnsSpecialist' },
  ];
  newAssignment = this.emptyAssignment();

  constructor() {
    this.warehouseContext.warehouseSelectionChanges.pipe(takeUntilDestroyed()).subscribe(warehouseId => {
      const nextWarehouseId = warehouseId ?? '';
      if (nextWarehouseId === this.warehouseId) return;
      this.warehouseId = nextWarehouseId;
      this.onWarehouseChange();
    });
  }

  ngOnInit(): void { this.warehouseContext.initialize(); }

  onWarehouseChange(): void {
    if (typeof localStorage !== 'undefined' && this.warehouseId) {
      localStorage.setItem(WAREHOUSE_STORAGE_KEY, this.warehouseId);
    }
    this.assignments.set([]);
    this.operators.set([]);
    this.zoneNames.set({});
    this.zoneOptions.set([]);
    this.loadAssignments();
    this.loadOperators();
  }

  get summary() {
    const assignments = this.assignments();
    return {
      total: assignments.length,
      pending: assignments.filter(a => a.status === 'Pending').length,
      active: assignments.filter(a => ['Assigned', 'Accepted', 'InProgress'].includes(a.status)).length,
      completed: assignments.filter(a => a.status === 'Completed').length,
    };
  }

  openCreate(): void {
    if (!this.warehouseId) return this.noWarehouse();
    this.newAssignment = this.emptyAssignment();
    this.showCreateDialog.set(true);
  }

  createAssignment(): void {
    if (!this.newAssignment.sourceTaskId.trim()) {
      this.messages.add({ severity: 'warn', summary: 'Source task required', detail: 'Enter the task ID that this work assignment represents.' });
      return;
    }
    const body: CreateWorkAssignmentDto = {
      ...this.newAssignment,
      warehouseId: this.warehouseId,
      requiredSkills: this.newAssignment.requiredSkills,
      dueBy: this.newAssignment.dueBy ? new Date(this.newAssignment.dueBy).toISOString() : null,
      zoneId: this.newAssignment.zoneId?.trim() || null,
      notes: this.newAssignment.notes.trim() || null,
    };
    this.creating.set(true);
    this.assignmentsApi.createAssignment(body).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreateDialog.set(false);
        this.messages.add({ severity: 'success', summary: 'Assignment created', detail: 'The work assignment is ready for labor allocation.' });
        this.loadAssignments();
      },
      error: () => this.creating.set(false),
    });
  }

  runAction(assignment: WorkAssignment, action: 'accept' | 'start' | 'complete' | 'cancel'): void {
    const request = this.assignmentsApi[action](assignment.id);
    request.subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Assignment updated', detail: `Assignment ${action}ed successfully.` });
        this.loadAssignments();
      },
    });
  }

  balanceWorkload(): void {
    if (!this.warehouseId) return this.noWarehouse();
    this.assignmentsApi.balance(this.warehouseId).subscribe({
      next: () => {
        this.messages.add({ severity: 'success', summary: 'Workload balanced', detail: 'The labor assignments were rebalanced.' });
        this.loadAssignments();
      },
    });
  }

  openCreateOperator(): void {
    if (!this.warehouseId) return this.noWarehouse();
    this.newOperator = this.emptyOperator();
    this.showCreateOperatorDialog.set(true);
  }

  createOperator(): void {
    if (this.creatingOperator()) return;
    if (!this.newOperator.userId || !this.newOperator.workDays.length) {
      this.messages.add({ severity: 'warn', summary: 'Operator details required', detail: 'Select a user and at least one work day.' });
      return;
    }
    const body: CreateOperatorProfileDto = { ...this.newOperator, warehouseId: this.warehouseId };
    this.creatingOperator.set(true);
    this.operatorsApi.createOperator(body).subscribe({
      next: () => { this.creatingOperator.set(false); this.showCreateOperatorDialog.set(false); this.messages.add({ severity: 'success', summary: 'Operator added', detail: 'The operator profile was created.' }); this.loadOperators(); },
      error: () => this.creatingOperator.set(false),
    });
  }

  openOperator(operator: OperatorProfile): void {
    this.selectedOperator.set(operator);
    this.newSkill = this.emptySkill();
    this.newZoneId = '';
    this.showOperatorDialog.set(true);
    this.operatorsApi.getOperator(operator.id).subscribe({ next: profile => this.selectedOperator.set(profile) });
  }

  updateOperatorStatus(newStatus: OperatorStatus): void {
    const operator = this.selectedOperator();
    if (!operator || newStatus === operator.status) return;
    this.updatingOperator.set(true);
    this.operatorsApi.updateStatus(operator.id, newStatus).subscribe({
      next: () => { this.updatingOperator.set(false); this.refreshSelectedOperator(operator.id); },
      error: () => this.updatingOperator.set(false),
    });
  }

  addOperatorSkill(): void {
    const operator = this.selectedOperator();
    if (!operator || !this.newSkill.skillType || !this.newSkill.certifiedDate) return;
    const body: CreateOperatorSkillDto = { skillType: this.newSkill.skillType as SkillType, certifiedDate: new Date(this.newSkill.certifiedDate).toISOString(), expiresAt: this.newSkill.expiresAt ? new Date(this.newSkill.expiresAt).toISOString() : null };
    this.operatorsApi.addSkill(operator.id, body).subscribe({ next: () => { this.newSkill = this.emptySkill(); this.refreshSelectedOperator(operator.id); } });
  }

  removeOperatorSkill(skillType: string): void {
    const operator = this.selectedOperator();
    if (!operator) return;
    this.operatorsApi.removeSkill(operator.id, skillType).subscribe({ next: () => this.refreshSelectedOperator(operator.id) });
  }

  addOperatorZone(): void {
    const operator = this.selectedOperator();
    if (!operator || !this.newZoneId) return;
    this.operatorsApi.addZone(operator.id, this.newZoneId).subscribe({ next: () => { this.newZoneId = ''; this.refreshSelectedOperator(operator.id); } });
  }

  removeOperatorZone(zoneId: string): void {
    const operator = this.selectedOperator();
    if (!operator) return;
    this.operatorsApi.removeZone(operator.id, zoneId).subscribe({ next: () => this.refreshSelectedOperator(operator.id) });
  }

  operatorStatusSeverity(status: OperatorStatus): 'success' | 'info' | 'warning' | 'danger' {
    return status === 'Available' ? 'success' : status === 'Busy' ? 'info' : status === 'OnBreak' ? 'warning' : 'danger';
  }

  statusSeverity(status: WorkAssignmentStatus): 'success' | 'info' | 'warning' | 'danger' {
    if (status === 'Completed') return 'success';
    if (status === 'Cancelled' || status === 'Failed') return 'danger';
    if (status === 'InProgress' || status === 'Accepted') return 'info';
    return 'warning';
  }

  prioritySeverity(priority: LaborTaskPriority): 'danger' | 'warning' | 'info' | 'success' {
    return priority === 'Critical' ? 'danger' : priority === 'High' ? 'warning' : priority === 'Normal' ? 'info' : 'success';
  }

  zoneName(zoneId?: string | null): string {
    return zoneId ? this.zoneNames()[zoneId] ?? zoneId : '—';
  }

  operatorName(operatorId?: string | null): string {
    return operatorId ? this.operatorNames()[operatorId] ?? 'Assigned operator' : 'Unassigned';
  }

  private loadAssignments(): void {
    if (!this.warehouseId) {
      this.assignments.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.loadReferenceData();
    this.assignmentsApi.getAssignments(this.warehouseId).subscribe({
      next: assignments => { this.assignments.set(assignments); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private loadOperators(): void {
    if (!this.warehouseId) { this.operators.set([]); return; }
    this.operatorsLoading.set(true);
    this.operatorsApi.getOperators(this.warehouseId).subscribe({
      next: operators => {
        this.operators.set(operators);
        this.refreshOperatorNames();
        this.operatorsLoading.set(false);
      },
      error: () => this.operatorsLoading.set(false),
    });
  }

  private refreshSelectedOperator(profileId: string): void {
    this.operatorsApi.getOperator(profileId).subscribe({ next: profile => { this.selectedOperator.set(profile); this.loadOperators(); } });
  }

  private loadReferenceData(): void {
    this.warehouses.getWarehouseById(this.warehouseId).subscribe({
      next: warehouse => {
        const zones = warehouse.zones ?? [];
        this.zoneNames.set(Object.fromEntries(zones.map(zone => [zone.id, zone.name ?? zone.code ?? zone.id])));
        this.zoneOptions.set(zones.map(zone => ({ label: zone.name ?? zone.code ?? zone.id, value: zone.id })));
      },
    });
    this.admin.getUsers().subscribe({
      next: users => {
        this.userNames.set(Object.fromEntries(users.map(user => [user.id, user.name])));
        this.refreshOperatorNames();
        this.userOptions.set(users.map(user => ({ label: `${user.name} (${user.email || user.username})`, value: user.id })));
      },
    });
  }

  private refreshOperatorNames(): void {
    const names = { ...this.userNames() };
    for (const operator of this.operators()) {
      const name = names[operator.userId];
      if (name) names[operator.id] = name;
    }
    this.operatorNames.set(names);
  }

  private noWarehouse(): void {
    this.loading.set(false);
    this.messages.add({ severity: 'warn', summary: 'Warehouse required', detail: 'Select or create a warehouse before managing labor.' });
  }

  private emptyAssignment() {
    return { taskType: 'Pick' as WorkTaskType, sourceTaskId: '', priority: 'Normal' as LaborTaskPriority, requiredSkills: [] as SkillType[], zoneId: '', dueBy: '', notes: '' };
  }

  private emptyOperator(): CreateOperatorProfileDto {
    return { userId: '', warehouseId: '', shiftStartTime: '08:00', shiftEndTime: '16:00', workDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'], maxConcurrentTasks: 4 };
  }

  private emptySkill(): { skillType: SkillType | ''; certifiedDate: string; expiresAt: string } {
    return { skillType: '', certifiedDate: '', expiresAt: '' };
  }

}
