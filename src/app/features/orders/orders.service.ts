import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  ApiOrder,
  CancelOrderDto,
  CreateOrderDto,
  Order,
  OrderFilter,
} from '../../core/models/order.model';
import { BaseApiService } from '../../core/services/base-api.service';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private api = inject(BaseApiService);

  getOrders(warehouseId: string, filter?: OrderFilter): Observable<{ data: Order[]; total: number }> {
    return this.api.get<ApiOrder[]>('orders', { warehouseId }).pipe(map(apiOrders => {
      let list = apiOrders.map(order => this.mapOrder(order));
    if (filter?.status) list = list.filter(o => o.status === filter.status);
    if (filter?.channel) list = list.filter(o => o.channel === filter.channel);
    if (filter?.priority) list = list.filter(o => o.priority === filter.priority);
    const search = filter?.search?.toLowerCase();
    if (search) list = list.filter(o => o.orderNumber.toLowerCase().includes(search) || o.customerName.toLowerCase().includes(search));
      return { data: list.slice(0, filter?.limit ?? list.length), total: list.length };
    }));
  }

  createOrder(body: CreateOrderDto): Observable<ApiOrder> { return this.api.post<ApiOrder>('orders', body); }
  allocate(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/allocate`, {}); }
  readyForPicking(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/ready-for-picking`, {}); }
  markPicking(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/mark-picking`, {}); }
  markPicked(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/mark-picked`, {}); }
  markPacking(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/mark-packing`, {}); }
  markPacked(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/mark-packed`, {}); }
  markShipped(id: string, shipmentId: string): Observable<void> { return this.api.post<void>(`orders/${id}/mark-shipped`, { shipmentId }); }
  markDelivered(id: string): Observable<void> { return this.api.post<void>(`orders/${id}/mark-delivered`, {}); }
  cancel(id: string, body: CancelOrderDto): Observable<void> { return this.api.post<void>(`orders/${id}/cancel`, body); }

  private mapOrder(order: ApiOrder): Order {
    const status = order.status.replace(/([a-z])([A-Z])/g, '$1_$2').replace(/[^a-zA-Z0-9]+/g, '_').toLowerCase();
    return {
      id: order.id,
      orderNumber: order.externalOrderId,
      channel: order.channel.toLowerCase() as Order['channel'],
      status: status as Order['status'],
      priority: order.priority.toLowerCase() as Order['priority'],
      customerId: order.customerId,
      customerName: order.customerName,
      customerAddress: [order.shippingStreet, order.shippingCity, order.shippingCountry].filter(Boolean).join(', '),
      warehouseId: order.warehouseId,
      notes: order.notes ?? undefined,
      totalItems: order.lines.reduce((total, line) => total + line.requestedQuantity, 0),
      createdAt: new Date(order.createdAt),
      updatedAt: new Date(order.allocatedAt ?? order.createdAt),
      requiredDate: new Date(order.requestedShipDate),
      lines: order.lines.map(line => ({
        id: line.id, orderId: order.id, itemId: line.itemId, sku: line.sku, itemName: line.sku,
        quantity: line.requestedQuantity, pickedQty: line.pickedQuantity, uom: line.uomCode,
        status: line.lineStatus.toLowerCase() as Order['lines'][number]['status'],
      })),
    };
  }
}
