import { UiLabelPipe, UiOptionsPipe } from '../../../shared/pipes/ui-label.pipe';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService } from 'primeng/api';
import { StorageLocationService } from '../storage-location.service';
import { CreateStorageLocationDto, StorageLocation } from '../storage-location.model';
import { WarehouseService } from '../../settings/warehouse.service';
import { Warehouse, WarehouseAisle, WarehouseRack, WarehouseShelf, WarehouseZone } from '../../settings/warehouse.model';
import { STORAGE_TYPE_OPTIONS } from '../../settings/warehouse-layout.constants';
import { WarehouseContextService } from '../../../core/warehouse/warehouse-context.service';

const WAREHOUSE_STORAGE_KEY = 'wms_selected_warehouse_id';

interface CreateStorageLocationForm extends CreateStorageLocationDto {}

interface LayoutOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-bin-tree',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule,
    FormsModule,
    TranslateModule,
    TableModule,
    ButtonModule,
    ProgressBarModule,
    TagModule,
    TooltipModule,
    SkeletonModule,
    DialogModule,
    DropdownModule,
    InputTextModule,
    InputNumberModule,
  ],
  templateUrl: './bin-tree.component.html',
  styleUrl: './bin-tree.component.scss',})
export class BinTreeComponent implements OnInit {
  private storageService = inject(StorageLocationService);
  private warehouseService = inject(WarehouseService);
  private messageService = inject(MessageService);
  private warehouseContext = inject(WarehouseContextService);

  locations = signal<StorageLocation[]>([]);
  warehouseOptions = signal<{ label: string; value: string }[]>([]);
  zoneOptions = signal<LayoutOption[]>([]);
  aisleOptions = signal<LayoutOption[]>([]);
  rackOptions = signal<LayoutOption[]>([]);
  shelfOptions = signal<LayoutOption[]>([]);
  viewLocationData = signal<StorageLocation | null>(null);
  loading = signal(false);
  viewLoading = signal(false);
  creating = signal(false);
  blocking = signal(false);
  layoutLoading = signal(false);
  busyLocationId = signal<string | null>(null);

  selectedWarehouseId = '';
  expandedRows: Record<string, boolean> = {};
  showCreateDialog = false;
  showBlockDialog = false;
  showViewDialog = false;
  blockTarget: StorageLocation | null = null;
  blockReason = '';

  storageTypeOptions = [...STORAGE_TYPE_OPTIONS];
  createForm = this.emptyCreateForm();
  private layoutZones: WarehouseZone[] = [];
  private layoutLabels = new Map<string, string>();

  constructor() {
    this.warehouseContext.warehouseSelectionChanges.pipe(takeUntilDestroyed()).subscribe(warehouseId => {
      const nextWarehouseId = warehouseId ?? '';
      if (nextWarehouseId === this.selectedWarehouseId) return;
      this.selectedWarehouseId = nextWarehouseId;
      this.onWarehouseChange();
    });
  }

  ngOnInit(): void { this.warehouseContext.initialize(); }

  loadWarehouses(): void {
    this.warehouseService.getWarehouses().subscribe({
      next: warehouses => {
        this.warehouseOptions.set(warehouses.map(w => ({
          label: this.getWarehouseLabel(w),
          value: w.id,
        })));

        const savedId = typeof localStorage !== 'undefined'
          ? localStorage.getItem(WAREHOUSE_STORAGE_KEY)
          : null;
        const defaultId = savedId && warehouses.some(w => w.id === savedId)
          ? savedId
          : warehouses[0]?.id ?? '';

        this.selectedWarehouseId = defaultId;
        if (defaultId) {
          this.loadLocations();
        }
      },
    });
  }

  onWarehouseChange(): void {
    if (typeof localStorage !== 'undefined' && this.selectedWarehouseId) {
      localStorage.setItem(WAREHOUSE_STORAGE_KEY, this.selectedWarehouseId);
    }
    this.expandedRows = {};
    this.loadLocations();
  }

  loadLocations(): void {
    if (!this.selectedWarehouseId) {
      this.locations.set([]);
      return;
    }

    this.loading.set(true);
    this.storageService.getStorageLocations(this.selectedWarehouseId).subscribe({
      next: list => {
        this.locations.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.locations.set([]);
        this.loading.set(false);
      },
    });
  }

  toggleRow(loc: StorageLocation): void {
    if (this.expandedRows[loc.id]) {
      delete this.expandedRows[loc.id];
    } else {
      this.expandedRows[loc.id] = true;
    }
    this.expandedRows = { ...this.expandedRows };
  }

  viewLocation(loc: StorageLocation): void {
    this.showViewDialog = true;
    this.viewLocationData.set(null);
    this.viewLoading.set(true);
    this.storageService.getStorageLocationById(loc.id).subscribe({
      next: data => {
        this.viewLocationData.set(data);
        this.viewLoading.set(false);
      },
      error: () => {
        this.viewLocationData.set(loc);
        this.viewLoading.set(false);
      },
    });
  }

  openCreateDialog(): void {
    this.createForm = this.emptyCreateForm();
    this.showCreateDialog = true;
    this.loadWarehouseLayout();
  }

  onZoneChange(): void {
    this.createForm.aisleId = '';
    this.createForm.rackId = '';
    this.createForm.shelfId = '';
    const zone = this.layoutZones.find(item => item.id === this.createForm.zoneId);
    this.aisleOptions.set(this.toOptions(zone?.aisles ?? []));
    this.rackOptions.set([]);
    this.shelfOptions.set([]);
  }

  onAisleChange(): void {
    this.createForm.rackId = '';
    this.createForm.shelfId = '';
    const aisle = this.getSelectedAisle();
    this.rackOptions.set(this.toOptions(aisle?.racks ?? []));
    this.shelfOptions.set([]);
  }

  onRackChange(): void {
    this.createForm.shelfId = '';
    const rack = this.getSelectedRack();
    this.shelfOptions.set(this.toOptions(rack?.shelves ?? []));
  }

  canCreate(): boolean {
    return !!(
      this.selectedWarehouseId &&
      this.createForm.zoneId.trim() &&
      this.createForm.aisleId.trim() &&
      this.createForm.rackId.trim() &&
      this.createForm.shelfId.trim() &&
      this.createForm.binLabel.trim() &&
      this.createForm.storageType
    );
  }

  submitCreate(): void {
    if (!this.canCreate()) return;

    this.creating.set(true);
    this.storageService.createStorageLocation(this.selectedWarehouseId, {
      ...this.createForm,
      zoneId: this.createForm.zoneId.trim(),
      aisleId: this.createForm.aisleId.trim(),
      rackId: this.createForm.rackId.trim(),
      shelfId: this.createForm.shelfId.trim(),
      binLabel: this.createForm.binLabel.trim(),
    }).subscribe({
      next: () => {
        this.creating.set(false);
        this.showCreateDialog = false;
        this.messageService.add({ severity: 'success', summary: 'Bin Created', detail: 'Storage location was created successfully.', life: 4000 });
        this.loadLocations();
      },
      error: () => this.creating.set(false),
    });
  }

  openBlockDialog(loc: StorageLocation): void {
    this.blockTarget = loc;
    this.blockReason = '';
    this.showBlockDialog = true;
  }

  submitBlock(): void {
    if (!this.blockTarget || !this.blockReason.trim()) return;

    this.blocking.set(true);
    this.storageService.blockStorageLocation(this.blockTarget.id, this.blockReason.trim()).subscribe({
      next: () => {
        this.blocking.set(false);
        this.showBlockDialog = false;
        this.messageService.add({ severity: 'success', summary: 'Bin Blocked', detail: `${this.blockTarget!.binCode} has been blocked.`, life: 4000 });
        this.loadLocations();
      },
      error: () => this.blocking.set(false),
    });
  }

  releaseLocation(loc: StorageLocation): void {
    this.busyLocationId.set(loc.id);
    this.storageService.releaseStorageLocation(loc.id).subscribe({
      next: () => {
        this.busyLocationId.set(null);
        this.messageService.add({ severity: 'success', summary: 'Bin Released', detail: `${loc.binCode} is now available.`, life: 4000 });
        this.loadLocations();
      },
      error: () => this.busyLocationId.set(null),
    });
  }

  canBlock(loc: StorageLocation): boolean {
    const status = loc.status.toLowerCase();
    return status === 'available' && loc.isActive;
  }

  canRelease(loc: StorageLocation): boolean {
    const status = loc.status.toLowerCase();
    return status.includes('block') || status.includes('maintenance');
  }

  getUtilizationPercent(loc: StorageLocation): number {
    const max = loc.capacity.maxItemCount;
    if (!max) return 0;
    return Math.round((loc.currentUtilization.currentItemCount / max) * 100);
  }

  getUtilizationClass(val: number): string {
    return val > 80 ? 'util-high' : val > 60 ? 'util-mid' : 'util-low';
  }

  getUtilizationColor(val: number): string {
    return val > 80 ? 'var(--color-danger)' : val > 60 ? 'var(--color-warning)' : 'var(--color-success)';
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const normalized = status.toLowerCase();
    if (normalized.includes('available')) return 'success';
    if (normalized.includes('block')) return 'danger';
    if (normalized.includes('maintenance')) return 'warning';
    if (normalized.includes('full')) return 'warning';
    return 'info';
  }

  /** Shows the human-readable layout code while retaining the ID for API operations. */
  layoutLabel(id: string): string {
    return this.layoutLabels.get(id) ?? id;
  }

  private getWarehouseLabel(warehouse: Warehouse): string {
    const parts = [warehouse.code, warehouse.name].filter(Boolean);
    return parts.length ? parts.join(' - ') : warehouse.id;
  }

  private loadWarehouseLayout(): void {
    if (!this.selectedWarehouseId) return;

    this.layoutLoading.set(true);
    this.layoutZones = [];
    this.zoneOptions.set([]);
    this.aisleOptions.set([]);
    this.rackOptions.set([]);
    this.shelfOptions.set([]);
    this.warehouseService.getWarehouseById(this.selectedWarehouseId).subscribe({
      next: warehouse => {
        this.layoutZones = warehouse.zones ?? [];
        this.layoutLabels = new Map();
        this.indexLayoutItems(this.layoutZones);
        this.zoneOptions.set(this.toOptions(this.layoutZones));
        this.layoutLoading.set(false);
      },
      error: () => this.layoutLoading.set(false),
    });
  }

  private getSelectedAisle(): WarehouseAisle | undefined {
    return this.layoutZones
      .find(zone => zone.id === this.createForm.zoneId)?.aisles
      ?.find(aisle => aisle.id === this.createForm.aisleId);
  }

  private getSelectedRack(): WarehouseRack | undefined {
    return this.getSelectedAisle()?.racks
      ?.find(rack => rack.id === this.createForm.rackId);
  }

  private toOptions(items: Array<WarehouseZone | WarehouseAisle | WarehouseRack | WarehouseShelf>): LayoutOption[] {
    return items.map(item => ({
      label: item.code || ('name' in item ? item.name : undefined) || item.id,
      value: item.id,
    }));
  }

  private indexLayoutItems(items: Array<WarehouseZone | WarehouseAisle | WarehouseRack | WarehouseShelf>): void {
    for (const item of items) {
      this.layoutLabels.set(item.id, item.code || ('name' in item ? item.name : undefined) || item.id);
      if ('aisles' in item) this.indexLayoutItems(item.aisles ?? []);
      if ('racks' in item) this.indexLayoutItems(item.racks ?? []);
      if ('shelves' in item) this.indexLayoutItems(item.shelves ?? []);
    }
  }

  private emptyCreateForm(): CreateStorageLocationForm {
    return {
      zoneId: '',
      aisleId: '',
      rackId: '',
      shelfId: '',
      binLabel: '',
      storageType: 'Ambient',
      maxWeightKg: 0,
      maxVolumeM3: 0,
      maxItemCount: 0,
      lengthCm: 0,
      widthCm: 0,
      heightCm: 0,
    };
  }
}
