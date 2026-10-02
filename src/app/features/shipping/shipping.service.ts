import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export interface ShipmentPackage { id: string; packTaskId: string; trackingNumber: string | null; labelUrl: string | null; labelFormat: string | null; labelGeneratedAt: string | null; weightKg: number | null; lengthCm: number | null; widthCm: number | null; heightCm: number | null; hasLabel: boolean; }
export interface OutboundShipment { id: string; warehouseId: string; orderIds: string[]; status: number | string; carrierId: string | null; carrierName: string | null; shippingAddressStreet: string | null; shippingAddressCity: string | null; shippingAddressRegion: string | null; shippingAddressPostalCode: string | null; shippingAddressCountry: string | null; estimatedDeliveryDate: string | null; manifestNumber: string | null; manifestTotalPackages: number | null; manifestTotalWeightKg: number | null; dispatchedAt: string | null; podReceivedBy: string | null; podDeliveredAt: string | null; createdAt: string; packages: ShipmentPackage[]; }
export interface CarrierAssignment { carrierId?: string | null; carrierName: string; street: string; city: string; region: string; postalCode: string; country: string; estimatedDeliveryDate?: string | null; }
export interface LabelRequest { packageId: string; trackingNumber: string; labelUrl: string; format: string; }
export interface DispatchRequest { confirmedByUserId: string; scanData?: string; photoUrl?: string; }
export interface DeliveryRequest { receivedBy: string; signatureUrl?: string; photoUrl?: string; }

@Injectable({ providedIn: 'root' })
export class ShippingService {
  private readonly api = inject(BaseApiService);
  getShipments(warehouseId: string, page = 1, pageSize = 25): Observable<OutboundShipment[]> { return this.api.get<OutboundShipment[] | { data?: OutboundShipment[]; items?: OutboundShipment[]; results?: OutboundShipment[] }>('shipments', { warehouseId, page, pageSize }).pipe(map(r => Array.isArray(r) ? r : r.data ?? r.items ?? r.results ?? [])); }
  assignCarrier(id: string, body: CarrierAssignment): Observable<unknown> { return this.api.post(`shipments/${id}/carrier`, body); }
  createLabel(id: string, body: LabelRequest): Observable<unknown> { return this.api.post(`shipments/${id}/label`, body); }
  createManifest(id: string, manifestNumber: string): Observable<unknown> { return this.api.post(`shipments/${id}/manifest`, { manifestNumber }); }
  dispatch(id: string, body: DispatchRequest): Observable<unknown> { return this.api.post(`shipments/${id}/dispatch`, body); }
  markInTransit(id: string): Observable<unknown> { return this.api.post(`shipments/${id}/in-transit`, {}); }
  recordDelivery(id: string, body: DeliveryRequest): Observable<unknown> { return this.api.post(`shipments/${id}/delivery`, body); }
  fail(id: string, reason: string): Observable<unknown> { return this.api.post(`shipments/${id}/fail`, { reason }); }
}
