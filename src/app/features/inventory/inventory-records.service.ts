import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  InventoryQuarantineRequest,
  InventoryRecord,
  InventoryReservationRequest,
} from '../../core/models/inventory.model';
import { BaseApiService } from '../../core/services/base-api.service';

@Injectable({ providedIn: 'root' })
export class InventoryRecordsService {
  private api = inject(BaseApiService);

  getByWarehouse(warehouseId: string): Observable<InventoryRecord[]> {
    return this.api.get<InventoryRecord[]>(`inventory-records/by-warehouse/${warehouseId}`);
  }

  getById(id: string): Observable<InventoryRecord> {
    return this.api.get<InventoryRecord>(`inventory-records/${id}`);
  }

  getByItem(itemId: string): Observable<InventoryRecord[]> {
    return this.api.get<InventoryRecord[]>(`inventory-records/by-item/${itemId}`);
  }

  getByLocation(locationId: string): Observable<InventoryRecord[]> {
    return this.api.get<InventoryRecord[]>(`inventory-records/by-location/${locationId}`);
  }

  reserve(id: string, body: InventoryReservationRequest): Observable<InventoryRecord> {
    return this.api.post<InventoryRecord>(`inventory-records/${id}/reserve`, body);
  }

  release(id: string, body: InventoryReservationRequest): Observable<InventoryRecord> {
    return this.api.post<InventoryRecord>(`inventory-records/${id}/release`, body);
  }

  quarantine(id: string, body: InventoryQuarantineRequest): Observable<InventoryRecord> {
    return this.api.post<InventoryRecord>(`inventory-records/${id}/quarantine`, body);
  }
}
