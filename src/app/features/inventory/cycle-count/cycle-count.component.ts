import { UiLabelPipe, UiOptionsPipe } from '../../../shared/pipes/ui-label.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ProgressBarModule } from 'primeng/progressbar';
import { SkeletonModule } from 'primeng/skeleton';
import { AvatarModule } from 'primeng/avatar';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MultiSelectModule } from 'primeng/multiselect';
import { DropdownModule } from 'primeng/dropdown';
import { MessageService } from 'primeng/api';
import { InventoryService } from '../inventory.service';
import { CycleCount, CreateCycleCountDto, InventoryItem } from '../../../core/models/inventory.model';
import { AuthService } from '../../../core/auth/auth.service';
import { StorageLocationService } from '../storage-location.service';
import { StorageLocation } from '../storage-location.model';
import { CatalogItemsService } from '../catalog-items.service';
import { forkJoin } from 'rxjs';
import { WarehouseContextService } from '../../../core/warehouse/warehouse-context.service';

const WAREHOUSE_STORAGE_KEY = 'wms_selected_warehouse_id';

@Component({
  selector: 'app-cycle-count',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe, CommonModule, FormsModule, TranslateModule, TableModule, ButtonModule, TagModule, ProgressBarModule, SkeletonModule, AvatarModule, DialogModule, InputNumberModule, MultiSelectModule, DropdownModule],
  templateUrl: './cycle-count.component.html',
  styleUrl: './cycle-count.component.scss',})
export class CycleCountComponent implements OnInit {
  private invService = inject(InventoryService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private storageLocationService = inject(StorageLocationService);
  private catalogItemsService = inject(CatalogItemsService);
  private warehouseContext = inject(WarehouseContextService);
  counts = signal<CycleCount[]>([]);
  loading = signal(true);
  submitting = signal(false);
  optionsLoading = signal(false);
  showCreateDialog = signal(false);
  storageLocations = signal<StorageLocation[]>([]);
  catalogItems = signal<InventoryItem[]>([]);
  warehouseOptions = signal<{ label: string; value: string }[]>([]);
  selectedWarehouseId = '';

  newCount = {
    targetLocationIds: [] as string[],
    targetItemIds: [] as string[],
    varianceThreshold: 0,
    scheduledDate: this.toDateTimeLocal(new Date()),
  };

  get summaryCards() {
    const counts = this.counts();
    return [
      { label: 'Total Counts', value: counts.length, icon: 'pi-list' },
      { label: 'In Progress', value: counts.filter(count => count.status.toLowerCase() === 'released').length, icon: 'pi-spin pi-spinner' },
      { label: 'Completed', value: counts.filter(count => count.status.toLowerCase() === 'completed').length, icon: 'pi-check-circle' },
      { label: 'Count Tasks', value: counts.reduce((total, count) => total + count.countTasks.length, 0), icon: 'pi-list-check' },
    ];
  }

  constructor() {
    this.warehouseContext.warehouseSelectionChanges.pipe(takeUntilDestroyed()).subscribe(warehouseId => {
      const nextWarehouseId = warehouseId ?? '';
      if (nextWarehouseId === this.selectedWarehouseId) return;
      this.selectedWarehouseId = nextWarehouseId;
      this.onWarehouseChange();
    });
  }

  ngOnInit(): void { this.warehouseContext.initialize(); }

  onWarehouseChange(): void {
    if (typeof localStorage !== 'undefined' && this.selectedWarehouseId) {
      localStorage.setItem(WAREHOUSE_STORAGE_KEY, this.selectedWarehouseId);
    }
    this.counts.set([]);
    this.newCount.targetLocationIds = [];
    this.newCount.targetItemIds = [];
    this.storageLocations.set([]);
    this.catalogItems.set([]);
    this.loadCounts();
  }

  getProgress(count: CycleCount): number {
    const completed = count.countTasks.filter(task => task.status?.toLowerCase() === 'completed' || task.countedQuantity !== undefined).length;
    return count.countTasks.length ? Math.round((completed / count.countTasks.length) * 100) : 0;
  }

  startNewCount(): void {
    if (!this.selectedWarehouseId) {
      this.handleMissingWarehouse();
      return;
    }
    this.showCreateDialog.set(true);
    this.loadTargetOptions();
  }

  startCount(count: CycleCount): void {
    this.invService.releaseCycleCount(count.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Released', detail: 'Cycle count has been released for counting.' });
        this.loadCounts();
      },
    });
  }

  viewCount(count: CycleCount): void {
    this.invService.getCycleCountById(count.id).subscribe({
      next: detail => this.messageService.add({
        severity: 'info', summary: 'Cycle Count Details',
        detail: `${detail.countTasks.length} count task(s), status: ${detail.status}.`,
      }),
    });
  }

  createCount(): void {
    const initiatedBy = this.authService.getCurrentUser()?.id;
    const { targetLocationIds, targetItemIds } = this.newCount;

    if (!initiatedBy || !targetLocationIds.length || !targetItemIds.length) {
      this.messageService.add({ severity: 'warn', summary: 'Missing details', detail: 'Provide at least one location, one item, and a signed-in user.' });
      return;
    }

    const body: CreateCycleCountDto = {
      warehouseId: this.selectedWarehouseId,
      targetLocationIds,
      targetItemIds,
      varianceThreshold: this.newCount.varianceThreshold,
      scheduledDate: new Date(this.newCount.scheduledDate).toISOString(),
      initiatedBy,
    };
    this.submitting.set(true);
    this.invService.createCycleCount(body).subscribe({
      next: () => {
        this.submitting.set(false);
        this.showCreateDialog.set(false);
        this.messageService.add({ severity: 'success', summary: 'Cycle count created', detail: 'The new cycle count was scheduled.' });
        this.loadCounts();
      },
      error: () => this.submitting.set(false),
    });
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' {
    switch (status.toLowerCase()) {
      case 'completed': return 'success';
      case 'released': case 'inprogress': case 'in_progress': return 'info';
      case 'reconciled': case 'cancelled': return 'danger';
      default: return 'warning';
    }
  }

  private loadCounts(): void {
    if (!this.selectedWarehouseId) {
      this.counts.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.invService.getCycleCounts(this.selectedWarehouseId).subscribe({
      next: counts => { this.counts.set(counts); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private handleMissingWarehouse(): void {
    this.loading.set(false);
    this.messageService.add({ severity: 'warn', summary: 'Warehouse required', detail: 'Select or create a warehouse before managing cycle counts.' });
  }

  private loadTargetOptions(): void {
    this.optionsLoading.set(true);
    forkJoin({
      locations: this.storageLocationService.getStorageLocations(this.selectedWarehouseId),
      items: this.catalogItemsService.getCatalogItems({ page: 1 }),
    }).subscribe({
      next: ({ locations, items }) => {
        this.storageLocations.set(locations.filter(location => location.isActive));
        this.catalogItems.set(items.data);
        this.optionsLoading.set(false);
      },
      error: () => {
        this.optionsLoading.set(false);
        this.messageService.add({ severity: 'error', summary: 'Options unavailable', detail: 'Unable to load available storage locations and items.' });
      },
    });
  }

  private toDateTimeLocal(date: Date): string {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return offsetDate.toISOString().slice(0, 16);
  }

}
