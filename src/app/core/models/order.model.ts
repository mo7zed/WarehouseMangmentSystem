export type OrderStatus =
  | 'received' | 'validating' | 'allocated' | 'partially_allocated' | 'ready_for_picking'
  | 'picking' | 'picked' | 'packing' | 'packed' | 'ready_for_shipping'
  | 'shipped' | 'delivered' | 'cancelled' | 'backordered';
export type OrderPriority = 'critical' | 'high' | 'normal' | 'low';
export type OrderChannel = 'erp' | 'ecommerce' | 'edi' | 'manual' | 'api';
export type OrderLineStatus = 'pending' | 'allocated' | 'partially_allocated' | 'picking' | 'picked' | 'packing' | 'packed' | 'shipped' | 'cancelled' | 'backordered';
export type ApiOrderPriority = 'Critical' | 'High' | 'Normal' | 'Low';
export type ApiOrderChannel = 'ERP' | 'Ecommerce' | 'EDI' | 'Manual' | 'API';
export type AllocationStrategy = 'FIFO' | 'FEFO' | 'LIFO';

export interface Order {
  id: string;
  orderNumber: string;
  channel: OrderChannel;
  status: OrderStatus;
  priority: OrderPriority;
  customerId: string;
  customerName: string;
  customerAddress: string;
  lines: OrderLine[];
  assignedPicker?: string;
  assignedPickerName?: string;
  warehouseId: string;
  totalItems: number;
  totalWeight?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  requiredDate?: Date;
  shippedAt?: Date;
  deliveredAt?: Date;
}

export interface OrderLine {
  id: string;
  orderId: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  pickedQty: number;
  uom: string;
  binCode?: string;
  lotNumber?: string;
  status: OrderLineStatus;
}

export interface PickTask {
  id: string;
  orderId: string;
  orderNumber: string;
  assignedTo: string;
  assignedToName: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  itemsTotal: number;
  itemsPicked: number;
  bins: string[];
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export interface Wave {
  id: string;
  waveNumber: string;
  status: 'draft' | 'released' | 'in_progress' | 'completed';
  orderCount: number;
  orders: string[];
  assignedOperators: string[];
  warehouseId: string;
  createdAt: Date;
  releasedAt?: Date;
  completedAt?: Date;
}

export interface OrderFilter {
  page?: number;
  limit?: number;
  status?: string;
  channel?: string;
  priority?: string;
  from?: string;
  to?: string;
  search?: string;
}

/** API contract for POST /api/orders. */
export interface CreateOrderDto {
  warehouseId: string;
  externalOrderId: string;
  channel: ApiOrderChannel;
  sourceSystem: string;
  customerId: string;
  customerName: string;
  priority: ApiOrderPriority;
  allocationStrategy: AllocationStrategy;
  requestedShipDate: string;
  shippingStreet: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostalCode: string;
  shippingCountry: string;
  consolidationGroupId?: string | null;
  notes?: string | null;
  lines: CreateOrderLineDto[];
}

export interface CreateOrderLineDto {
  itemId: string;
  sku: string;
  requestedQuantity: number;
  uomCode: string;
}

/** API response returned by GET /api/orders. */
export interface ApiOrder {
  id: string;
  externalOrderId: string;
  channel: string;
  sourceSystem: string;
  customerId: string;
  customerName: string;
  warehouseId: string;
  priority: string;
  status: string;
  allocationStrategy: string;
  requestedShipDate: string;
  shippingStreet: string;
  shippingCity: string;
  shippingRegion: string;
  shippingPostalCode: string;
  shippingCountry: string;
  consolidationGroupId: string | null;
  notes: string | null;
  createdAt: string;
  allocatedAt: string | null;
  lines: ApiOrderLine[];
}

export interface ApiOrderLine {
  id: string;
  itemId: string;
  sku: string;
  requestedQuantity: number;
  allocatedQuantity: number;
  pickedQuantity: number;
  packedQuantity: number;
  shippedQuantity: number;
  uomCode: string;
  lineStatus: string;
  allocations: unknown[];
}

export interface CancelOrderDto {
  reason: string;
}

export interface ASN {
  id: string;
  asnNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'expected' | 'partially_received' | 'complete' | 'cancelled' | string;
  expectedDate: Date | string;
  receivedDate?: Date | string;
  items: ASNItem[];
  warehouseId: string;
  notes?: string | null;
  createdAt?: Date | string;
}

export interface ASNItem {
  id: string;
  asnId?: string;
  itemId: string;
  sku: string;
  itemName: string;
  expectedQty: number;
  receivedQty: number;
  damagedQty?: number;
  uom: string;
  uomCode?: string;
  uomName?: string;
  lotNumber?: string;
  expirationDate?: Date | string;
  isFullyReceived?: boolean;
  condition?: 'good' | 'damaged' | 'partial';
}

export interface PutawayTask {
  id: string;
  asnId: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  uom: string;
  suggestedBin: string;
  confirmedBin?: string;
  status: 'pending' | 'completed';
  assignedTo?: string;
}

export interface Shipment {
  id: string;
  shipmentNumber: string;
  orderId: string;
  orderNumber: string;
  carrier: string;
  trackingNumber?: string;
  status: 'pending' | 'dispatched' | 'in_transit' | 'delivered' | 'failed';
  tmsSyncStatus: 'synced' | 'pending' | 'error';
  tmsSyncedAt?: Date;
  weight?: number;
  labelUrl?: string;
  dispatchedAt?: Date;
  createdAt: Date;
}

export interface Return {
  id: string;
  rmaNumber: string;
  orderId: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  status: 'requested' | 'received' | 'inspected' | 'dispositioned' | 'completed';
  reasonCode: string;
  reasonDescription: string;
  items: ReturnItem[];
  photos?: string[];
  createdAt: Date;
  completedAt?: Date;
}

export interface ReturnItem {
  id: string;
  returnId: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  uom: string;
  condition: 'good' | 'damaged' | 'defective';
  disposition?: 'restock' | 'refurbish' | 'discard' | 'quarantine';
}
