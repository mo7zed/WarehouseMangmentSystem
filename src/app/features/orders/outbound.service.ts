import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { CreatePackTaskDto, CreatePickWaveDto, PackTask, PickTask, PickWave, WarehouseUser } from './outbound.model';

@Injectable({ providedIn: 'root' })
export class OutboundService {
  private api = inject(BaseApiService);

  getWarehouseUsers(warehouseId: string): Observable<WarehouseUser[]> { return this.api.get<WarehouseUser[]>(`users/by-warehosue/${warehouseId}`); }

  getPickTasks(warehouseId: string, filters: { waveId?: string; operatorId?: string; status?: string } = {}): Observable<PickTask[]> {
    return this.api.get<PickTask[]>('pick-tasks', { warehouseId, ...filters });
  }
  assignPickTask(taskId: string, operatorId: string): Observable<void> { return this.api.post<void>(`pick-tasks/${taskId}/assign`, { operatorId }); }
  startPickTask(taskId: string): Observable<void> { return this.api.post<void>(`pick-tasks/${taskId}/start`, {}); }
  confirmPick(taskId: string, pickedQuantity: number): Observable<void> { return this.api.post<void>(`pick-tasks/${taskId}/confirm-pick`, { pickedQuantity }); }
  shortPick(taskId: string, pickedQuantity: number, reason: string): Observable<void> { return this.api.post<void>(`pick-tasks/${taskId}/short-pick`, { pickedQuantity, reason }); }
  cancelPickTask(taskId: string): Observable<void> { return this.api.post<void>(`pick-tasks/${taskId}/cancel`, {}); }

  getPackTasks(warehouseId: string): Observable<PackTask[]> { return this.api.get<PackTask[]>('pack-tasks', { warehouseId }); }
  createPackTask(body: CreatePackTaskDto): Observable<PackTask> { return this.api.post<PackTask>('pack-tasks', body); }
  startPackTask(taskId: string): Observable<void> { return this.api.post<void>(`pack-tasks/${taskId}/start`, {}); }
  verifyPackItem(taskId: string, packItemId: string): Observable<void> { return this.api.post<void>(`pack-tasks/${taskId}/verify-item`, { packItemId }); }
  completePackTask(taskId: string, verifiedByOperatorId: string): Observable<void> { return this.api.post<void>(`pack-tasks/${taskId}/complete`, { verifiedByOperatorId }); }
  failPackTask(taskId: string, reason: string): Observable<void> { return this.api.post<void>(`pack-tasks/${taskId}/fail`, { reason }); }

  getPickWaves(warehouseId: string, status?: string): Observable<PickWave[]> { return this.api.get<PickWave[]>('pick-waves', { warehouseId, status }); }
  createPickWave(body: CreatePickWaveDto): Observable<PickWave> { return this.api.post<PickWave>('pick-waves', body); }
  releasePickWave(waveId: string): Observable<void> { return this.api.post<void>(`pick-waves/${waveId}/release`, {}); }
  cancelPickWave(waveId: string): Observable<void> { return this.api.post<void>(`pick-waves/${waveId}/cancel`, {}); }
}
