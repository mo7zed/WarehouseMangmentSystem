import { UiLabelPipe, UiOptionsPipe } from '../../../shared/pipes/ui-label.pipe';
import { createCsv, downloadFile } from '../../../shared/utils/download.util';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { Table, TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DropdownModule } from 'primeng/dropdown';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { SkeletonModule } from 'primeng/skeleton';
import { MessageService } from 'primeng/api';
import { Store } from '@ngrx/store';
import { InventoryRecordsService } from '../inventory-records.service';
import { PageShellComponent, PageHeaderComponent, FiltersBarComponent, SectionCardComponent } from '../../../shared/ui';
import { InventoryActions } from '../state/inventory.actions';
import { inventoryFeature, InventoryRecordView, selectInventoryBinOptions, selectInventoryRecordCount, selectInventoryStatusOptions } from '../state/inventory.state';
import { WarehouseContextService } from '../../../core/warehouse/warehouse-context.service';
import { distinctUntilChanged } from 'rxjs';

@Component({
  selector: 'app-inventory-list',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe, CommonModule, FormsModule, TranslateModule, TableModule, ButtonModule, InputTextModule, DropdownModule, TagModule, DialogModule, TooltipModule, SkeletonModule, PageShellComponent, PageHeaderComponent, FiltersBarComponent, SectionCardComponent],
  templateUrl: './inventory-list.component.html',
  styleUrl: './inventory-list.component.scss',
})
export class InventoryListComponent implements OnInit {
  private inventoryRecords = inject(InventoryRecordsService);
  private messageService = inject(MessageService);
  private store = inject(Store);
  private destroyRef = inject(DestroyRef);
  private warehouseContext = inject(WarehouseContextService);

  readonly items = this.store.selectSignal(inventoryFeature.selectItems);
  readonly loading = this.store.selectSignal(inventoryFeature.selectLoading);
  readonly loadError = this.store.selectSignal(inventoryFeature.selectError);
  saving = signal(false);
  readonly totalRecords = this.store.selectSignal(selectInventoryRecordCount);
  searchQuery = '';
  selectedStatus = '';
  selectedBin = '';
  readonly statusOptions = this.store.selectSignal(selectInventoryStatusOptions);
  readonly binOptions = this.store.selectSignal(selectInventoryBinOptions);
  selectedRecord: InventoryRecordView | null = null;
  showRecordDialog = false;
  showActionDialog = false;
  action: 'reserve' | 'release' | 'quarantine' = 'reserve';
  actionData = { orderId: '', quantity: 1, reason: '' };

  ngOnInit(): void {
    this.warehouseContext.warehouseSelectionChanges.pipe(
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.loadItems());
  }

  loadItems(): void {
    this.store.dispatch(InventoryActions.loadRecords());
  }

  onSearch(): void { /* PrimeNG applies the global filter in the template. */ }

  applyFilters(table: Table): void {
    table.filter(this.selectedStatus || null, 'status', 'equals');
    table.filter(this.selectedBin || null, 'binName', 'equals');
  }

  clearFilters(table: Table): void {
    this.searchQuery = '';
    this.selectedStatus = '';
    this.selectedBin = '';
    table.clear();
  }

  getStatusSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const normalized = status.toLowerCase();
    if (normalized === 'available') return 'success';
    if (normalized === 'quarantined' || normalized === 'quarantine') return 'danger';
    if (normalized.includes('reserved')) return 'warning';
    return 'info';
  }

  viewRecord(record: InventoryRecordView): void { this.selectedRecord = record; this.showRecordDialog = true; }

  openAction(record: InventoryRecordView, action: 'reserve' | 'release' | 'quarantine'): void {
    this.selectedRecord = record;
    this.action = action;
    this.actionData = { orderId: '', quantity: 1, reason: '' };
    this.showActionDialog = true;
  }

  validAction(): boolean {
    if (!this.selectedRecord) return false;
    if (this.action === 'quarantine') return !!this.actionData.reason.trim();
    const max = this.action === 'reserve' ? this.selectedRecord.availableQuantity : this.selectedRecord.reservedQuantity;
    return !!this.actionData.orderId.trim() && Number.isFinite(this.actionData.quantity) && this.actionData.quantity > 0 && this.actionData.quantity <= max;
  }

  submitAction(): void {
    if (!this.selectedRecord || !this.validAction() || this.saving()) return;
    this.saving.set(true);
    const id = this.selectedRecord.id;
    const request = this.action === 'quarantine'
      ? this.inventoryRecords.quarantine(id, { reason: this.actionData.reason })
      : this.action === 'reserve'
        ? this.inventoryRecords.reserve(id, { orderId: this.actionData.orderId, quantity: this.actionData.quantity })
        : this.inventoryRecords.release(id, { orderId: this.actionData.orderId, quantity: this.actionData.quantity });
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.showActionDialog = false;
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Inventory record updated successfully.' });
        this.loadItems();
      },
      error: () => this.saving.set(false),
    });
  }

  exportCsv(): void {
    const headers = ['SKU', 'Item name', 'Bin', 'Quantity', 'Reserved', 'Available', 'UOM', 'Status'];
    const rows = this.items().map((record) => [record.sku, record.itemName, record.binName, record.quantity, record.reservedQuantity, record.availableQuantity, record.uomCode, record.status]);
    downloadFile(createCsv([headers, ...rows]), 'inventory-records.csv', 'text/csv;charset=utf-8');
  }
}
