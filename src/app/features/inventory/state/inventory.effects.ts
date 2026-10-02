import { Injectable, inject } from '@angular/core';
import { Actions, createEffect, ofType } from '@ngrx/effects';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { InventoryRecordsService } from '../inventory-records.service';
import { StorageLocationService } from '../storage-location.service';
import { InventoryActions } from './inventory.actions';
import { WarehouseContextService } from '../../../core/warehouse/warehouse-context.service';

@Injectable()
export class InventoryEffects {
  private actions$ = inject(Actions);
  private inventoryRecords = inject(InventoryRecordsService);
  private storageLocations = inject(StorageLocationService);
  private warehouseContext = inject(WarehouseContextService);

  readonly loadRecords$ = createEffect(() => this.actions$.pipe(
    ofType(InventoryActions.loadRecords, InventoryActions.refreshRecords),
    switchMap(() => {
      const warehouseId = this.warehouseContext.selectedWarehouseId();

      if (!warehouseId) {
        return of(InventoryActions.loadRecordsSuccess({ items: [] }));
      }

      return forkJoin({
        records: this.inventoryRecords.getByWarehouse(warehouseId),
        locations: this.storageLocations.getStorageLocations(warehouseId),
      }).pipe(
        map(({ records, locations }) => {
          const bins = new Map(locations.map(location => [location.id, location.binCode]));
          return records.map(record => ({ ...record, binName: bins.get(record.storageLocationId) ?? '—' }));
        }),
        map(items => InventoryActions.loadRecordsSuccess({ items })),
        catchError(error => of(InventoryActions.loadRecordsFailure({ error: error.message ?? 'Unable to load inventory records.' }))),
      );
    }),
  ));
}
