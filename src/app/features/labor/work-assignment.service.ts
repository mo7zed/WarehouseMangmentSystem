import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { CreateWorkAssignmentDto, WorkAssignment } from './work-assignment.model';

@Injectable({ providedIn: 'root' })
export class WorkAssignmentService {
  private api = inject(BaseApiService);
  private readonly endpoint = 'labor/assignments';

  getAssignments(warehouseId: string): Observable<WorkAssignment[]> {
    return this.api.get<WorkAssignment[]>(this.endpoint, { warehouseId });
  }

  getAssignment(id: string): Observable<WorkAssignment> {
    return this.api.get<WorkAssignment>(`${this.endpoint}/${id}`);
  }

  createAssignment(body: CreateWorkAssignmentDto): Observable<WorkAssignment> {
    return this.api.post<WorkAssignment>(this.endpoint, body);
  }

  assign(id: string, body: { operatorId: string }): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/assign`, body);
  }

  accept(id: string): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/accept`, null);
  }

  start(id: string): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/start`, null);
  }

  complete(id: string): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/complete`, null);
  }

  fail(id: string, body: { reason: string }): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/fail`, body);
  }

  cancel(id: string): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/cancel`, null);
  }

  reassign(id: string, body: { newOperatorId: string; reason: string }): Observable<unknown> {
    return this.api.post<unknown>(`${this.endpoint}/${id}/reassign`, body);
  }

  balance(warehouseId: string): Observable<WorkAssignment[]> {
    return this.api.post<WorkAssignment[]>(`${this.endpoint}/balance`, null, { warehouseId });
  }

}
