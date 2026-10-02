import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Warehouse } from '../../features/settings/warehouse.model';
import { WarehouseService } from '../../features/settings/warehouse.service';

const SELECTED_WAREHOUSE_KEY = 'wms_selected_warehouse_id';

/** The one selected warehouse shared by every operational screen and real-time hub. */
@Injectable({ providedIn: 'root' })
export class WarehouseContextService {
  private readonly warehouseApi = inject(WarehouseService);
  private readonly platformId = inject(PLATFORM_ID);
  private initialized = false;

  private readonly _warehouses = signal<Warehouse[]>([]);
  private readonly _selectedWarehouseId = signal<string | null>(null);
  private readonly warehouseSelection = new BehaviorSubject<string | null>(null);

  readonly warehouses = this._warehouses.asReadonly();
  readonly selectedWarehouseId = this._selectedWarehouseId.asReadonly();
  /** Emits immediately whenever the active warehouse changes. */
  readonly warehouseSelectionChanges = this.warehouseSelection.asObservable();

  constructor() {
    // Restore the last selection before the warehouse lookup finishes.  Feature
    // pages can therefore request their data immediately after a browser refresh
    // instead of treating the brief lookup period as "no warehouse selected".
    if (isPlatformBrowser(this.platformId)) {
      const savedWarehouseId = localStorage.getItem(SELECTED_WAREHOUSE_KEY);
      this._selectedWarehouseId.set(savedWarehouseId);
      this.warehouseSelection.next(savedWarehouseId);
    }
  }

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;

    this.warehouseApi.getWarehouses().subscribe({
      next: warehouses => {
        this._warehouses.set(warehouses);
        const savedId = isPlatformBrowser(this.platformId) ? localStorage.getItem(SELECTED_WAREHOUSE_KEY) : null;
        const initialId = warehouses.some(warehouse => warehouse.id === savedId) ? savedId : warehouses[0]?.id ?? null;
        this.selectWarehouse(initialId);
      },
    });
  }

  selectWarehouse(warehouseId: string | null): void {
    this._selectedWarehouseId.set(warehouseId);
    this.warehouseSelection.next(warehouseId);
    if (isPlatformBrowser(this.platformId)) {
      if (warehouseId) localStorage.setItem(SELECTED_WAREHOUSE_KEY, warehouseId);
      else localStorage.removeItem(SELECTED_WAREHOUSE_KEY);
    }
  }
}
