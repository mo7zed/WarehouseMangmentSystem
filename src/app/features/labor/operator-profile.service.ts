import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { CreateOperatorProfileDto, CreateOperatorSkillDto, OperatorProfile, OperatorStatus } from './operator-profile.model';

@Injectable({ providedIn: 'root' })
export class OperatorProfileService {
  private api = inject(BaseApiService);
  private readonly endpoint = 'labor/operators';

  getOperators(warehouseId: string): Observable<OperatorProfile[]> {
    return this.api.get<OperatorProfile[]>(this.endpoint, { warehouseId });
  }

  getOperator(profileId: string): Observable<OperatorProfile> {
    return this.api.get<OperatorProfile>(`${this.endpoint}/${profileId}`);
  }

  createOperator(body: CreateOperatorProfileDto): Observable<OperatorProfile> {
    return this.api.post<OperatorProfile>(this.endpoint, body);
  }

  updateStatus(profileId: string, newStatus: OperatorStatus): Observable<void> {
    return this.api.post<void>(`${this.endpoint}/${profileId}/status`, { newStatus });
  }

  addSkill(profileId: string, body: CreateOperatorSkillDto): Observable<void> {
    return this.api.post<void>(`${this.endpoint}/${profileId}/skills`, body);
  }

  removeSkill(profileId: string, skillType: string): Observable<void> {
    return this.api.delete<void>(`${this.endpoint}/${profileId}/skills/${encodeURIComponent(skillType)}`);
  }

  addZone(profileId: string, zoneId: string): Observable<void> {
    return this.api.post<void>(`${this.endpoint}/${profileId}/zones`, { zoneId });
  }

  removeZone(profileId: string, zoneId: string): Observable<void> {
    return this.api.delete<void>(`${this.endpoint}/${profileId}/zones/${zoneId}`);
  }
}
