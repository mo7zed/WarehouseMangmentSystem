import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CreatedResource } from '../../core/models/api.model';
import { ASN } from '../../core/models/order.model';
import { BaseApiService } from '../../core/services/base-api.service';
import { ApiAsn, CreateAsnDto } from './asn.model';
import { CreateInboundShipmentDto, InboundShipment, InboundShipmentDiscrepancy, InboundShipmentInspection } from './inbound-shipment.model';

@Injectable({ providedIn: 'root' })
export class ReceivingService {
  private api = inject(BaseApiService);

  getASNs(warehouseId: string): Observable<ASN[]> {
    // Swagger's all-ASNs endpoint has no warehouse query parameter.
    return this.api.get<ApiAsn[]>('asns').pipe(map(list =>
      list.filter(asn => asn.warehouseId === warehouseId).map(asn => this.mapApiAsn(asn))));
  }


  getPendingASNs(warehouseId: string): Observable<ASN[]> {
    return this.api
      .get<ApiAsn[]>('asns/pending', { warehouseId })
      .pipe(map(list => list.map(asn => this.mapApiAsn(asn))));
  }

  createASN(body: CreateAsnDto): Observable<CreatedResource> {
    return this.api.post<CreatedResource>('asns', body);
  }

  getInboundShipments(warehouseId: string): Observable<InboundShipment[]> {
    return this.api.get<InboundShipment[]>(`inbound-shipments/by-warehouse/${warehouseId}`);
  }

  getInboundShipment(id: string): Observable<InboundShipment> {
    return this.api.get<InboundShipment>(`inbound-shipments/${id}`);
  }

  getPendingInboundShipments(warehouseId: string): Observable<InboundShipment[]> {
    return this.api.get<InboundShipment[]>('inbound-shipments/pending', { warehouseId });
  }

  createInboundShipment(body: CreateInboundShipmentDto): Observable<CreatedResource> {
    return this.api.post<CreatedResource>('inbound-shipments', body);
  }

  addInboundShipmentDiscrepancy(id: string, body: Omit<InboundShipmentDiscrepancy, 'id' | 'reportedAt'>): Observable<unknown> {
    return this.api.post<unknown>(`inbound-shipments/${id}/discrepancies`, body);
  }

  addInboundShipmentInspection(id: string, body: Omit<InboundShipmentInspection, 'id' | 'inspectedAt'>): Observable<unknown> {
    return this.api.post<unknown>(`inbound-shipments/${id}/inspections`, body);
  }

  completeInboundShipmentReceiving(id: string): Observable<void> {
    return this.api.post<void>(`inbound-shipments/${id}/complete-receiving`, {});
  }

  private mapApiAsn(asn: ApiAsn): ASN {
    return {
      id: asn.id,
      asnNumber: `${asn.id.slice(0, 8)}…${asn.id.slice(-4)}`.toUpperCase(),
      supplierId: asn.supplierId,
      supplierName: asn.supplierName,
      status: this.normalizeStatus(asn.status),
      expectedDate: asn.expectedArrivalDate,
      items: (asn.lines ?? []).map(line => ({
        id: line.id,
        asnId: asn.id,
        itemId: line.itemId,
        sku: line.sku,
        itemName: line.itemName,
        expectedQty: line.expectedQuantity,
        receivedQty: line.receivedQuantity,
        damagedQty: 0,
        uom: line.uomName || line.uomCode,
        uomCode: line.uomCode,
        uomName: line.uomName,
        lotNumber: line.lotNumber ?? undefined,
        expirationDate: line.expirationDate ?? undefined,
        isFullyReceived: line.isFullyReceived,
      })),
      warehouseId: asn.warehouseId,
      notes: asn.notes ?? undefined,
      createdAt: asn.createdAt,
    };
  }

  private normalizeStatus(status: string): ASN['status'] {
    const normalized = status.replace(/([a-z])([A-Z])/g, '$1_$2').toLowerCase().replace(/\s+/g, '_');
    const map: Record<string, ASN['status']> = {
      confirmed: 'expected',
      expected: 'expected',
      partially_received: 'partially_received',
      partial: 'partially_received',
      complete: 'complete',
      completed: 'complete',
      fully_received: 'complete',
      cancelled: 'cancelled',
      canceled: 'cancelled',
    };
    return map[normalized] ?? 'expected';
  }
}
