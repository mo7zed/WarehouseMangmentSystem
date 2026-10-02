import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CycleCount, CreateCycleCountDto, SubmitCycleCountResultsDto } from '../../core/models/inventory.model';
import { BaseApiService } from '../../core/services/base-api.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private api = inject(BaseApiService);

  getCycleCounts(warehouseId: string): Observable<CycleCount[]> {
    return this.api.get<CycleCount[]>('cycle-counts', { warehouseId });
  }

  getCycleCountById(id: string): Observable<CycleCount> {
    return this.api.get<CycleCount>(`cycle-counts/${id}`);
  }

  createCycleCount(body: CreateCycleCountDto): Observable<CycleCount> {
    return this.api.post<CycleCount>('cycle-counts', body);
  }

  releaseCycleCount(id: string): Observable<CycleCount> {
    return this.api.post<CycleCount>(`cycle-counts/${id}/release`, {});
  }

  submitCycleCountResults(id: string, body: SubmitCycleCountResultsDto): Observable<CycleCount> {
    return this.api.post<CycleCount>(`cycle-counts/${id}/count-results`, body);
  }

  reconcileCycleCount(id: string): Observable<CycleCount> {
    return this.api.post<CycleCount>(`cycle-counts/${id}/reconcile`, {});
  }

  completeCycleCount(id: string): Observable<CycleCount> {
    return this.api.post<CycleCount>(`cycle-counts/${id}/complete`, {});
  }

}
