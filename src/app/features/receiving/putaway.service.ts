import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { AssignPutawayTaskDto, CompletePutawayTaskDto, PutawayRecommendation, PutawayRecommendationRequest, PutawayTask } from './putaway.model';

@Injectable({ providedIn: 'root' })
export class PutawayService {
  private api = inject(BaseApiService);

  getTasks(warehouseId: string): Observable<PutawayTask[]> {
    return this.api.get<PutawayTask[]>('putaway', { warehouseId });
  }

  recommend(request: PutawayRecommendationRequest): Observable<PutawayRecommendation> {
    return this.api.get<PutawayRecommendation>('putaway/recommend', { ...request });
  }

  generateForShipment(shipmentId: string): Observable<unknown> {
    return this.api.post<unknown>(`putaway/shipments/${shipmentId}/generate`, {});
  }

  assign(taskId: string, body: AssignPutawayTaskDto): Observable<void> {
    return this.api.post<void>(`putaway/${taskId}/assign`, body);
  }

  start(taskId: string): Observable<void> {
    return this.api.post<void>(`putaway/${taskId}/start`, {});
  }

  complete(taskId: string, body: CompletePutawayTaskDto): Observable<void> {
    return this.api.post<void>(`putaway/${taskId}/complete`, body);
  }
}
