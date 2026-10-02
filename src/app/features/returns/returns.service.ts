import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export interface ReturnAuthorizationLine { id: string; itemId: string; sku: string; itemName: string; quantity: number; uomCode: string; uomName: string; reasonCode: number | string; condition: number | string | null; receivedQuantity: number; dispositionType: number | string | null; dispositionedQuantity: number; lineStatus: number | string; notes: string | null; }
export interface ReturnAuthorization { id: string; originalOrderId: string; originalShipmentId: string | null; customerId: string; warehouseId: string; status: number | string; receivedAt: string | null; closedAt: string | null; rejectionReason: string | null; authorizedBy: string | null; processedBy: string | null; notes: string | null; createdAt: string; lines: ReturnAuthorizationLine[]; }
export interface CreateReturnAuthorizationDto { originalOrderId: string; originalShipmentId?: string | null; customerId: string; warehouseId: string; lines: Array<Pick<ReturnAuthorizationLine, 'itemId' | 'sku' | 'itemName' | 'quantity' | 'uomCode' | 'uomName' | 'reasonCode' | 'notes'>>; notes?: string | null; }

export interface ReturnPage { items: ReturnAuthorization[]; total: number | null; hasNext: boolean; }

@Injectable({ providedIn: 'root' })
export class ReturnsService {
  private api = inject(BaseApiService);
  getReturns(warehouseId: string, page = 1, pageSize = 25): Observable<ReturnPage> {
    return this.api.get<ReturnAuthorization[] | { data?: ReturnAuthorization[]; items?: ReturnAuthorization[]; results?: ReturnAuthorization[]; totalCount?: number; total?: number; hasNextPage?: boolean }>('returns', { warehouseId, page, pageSize }).pipe(
      map(response => {
        const items = Array.isArray(response) ? response : response.data ?? response.items ?? response.results ?? [];
        const total = Array.isArray(response) ? null : response.totalCount ?? response.total ?? null;
        const hasNext = Array.isArray(response) ? items.length === pageSize : response.hasNextPage ?? (total !== null ? page * pageSize < total : items.length === pageSize);
        return { items, total, hasNext };
      }),
    );
  }
  getReturn(id: string): Observable<ReturnAuthorization> { return this.api.get<ReturnAuthorization>(`returns/${id}`); }
  createReturn(body: CreateReturnAuthorizationDto): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>('returns', body); }
  authorize(id: string, authorizedByUserId: string): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/authorize`, { authorizedByUserId }); }
  awaitingReceipt(id: string): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/awaiting-receipt`, {}); }
  reject(id: string, reason: string): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/reject`, { reason }); }
  receive(id: string, receivedLines: Array<{ lineId: string; receivedQuantity: number }>, processedByUserId: string): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/receive`, { receivedLines, processedByUserId }); }
  inspect(id: string, lineId: string, condition: string): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/lines/${lineId}/inspect`, { condition }); }
  disposition(id: string, lineId: string, body: { dispositionType: string; dispositionedQuantity: number; targetBinId?: string | null; overrideReason?: string | null; decidedByUserId: string }): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/lines/${lineId}/disposition`, body); }
  close(id: string): Observable<ReturnAuthorization> { return this.api.post<ReturnAuthorization>(`returns/${id}/close`, {}); }
}
