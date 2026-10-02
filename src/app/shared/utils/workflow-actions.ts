export type OrderAction = 'allocate' | 'readyForPicking' | 'markPicking' | 'markPicked' | 'markPacking' | 'markPacked' | 'markShipped' | 'markDelivered';
export type ShipmentAction = 'carrier' | 'label' | 'manifest' | 'dispatch' | 'transit' | 'delivery' | 'fail';

const normalize = (status: string | number) => String(status).replace(/[\s_-]/g, '').toLowerCase();

export function canEditReturn(status: string | number): boolean {
  const names = ['created', 'authorized', 'awaitingreceipt', 'rejected', 'received', 'dispositioned', 'closed'];
  const state = /^\d+$/.test(String(status)) ? names[Number(status)] : normalize(status);
  return ['created', 'authorized', 'awaitingreceipt', 'received', 'dispositioned'].includes(state);
}

// UI transition guards; the server remains authoritative for stock and business validation.
export function canOrderAction(status: string, action: OrderAction): boolean {
  const allowed: Record<OrderAction, string[]> = {
    allocate: ['received', 'validating', 'partiallyallocated', 'backordered'],
    readyForPicking: ['allocated'], markPicking: ['readyforpicking'],
    markPicked: ['picking'], markPacking: ['picked'], markPacked: ['packing'],
    markShipped: ['packed', 'readyforshipping'], markDelivered: ['shipped'],
  };
  return allowed[action].includes(normalize(status));
}

export function canShipmentAction(status: string | number, action: ShipmentAction): boolean {
  const names = ['pending', 'carrierassigned', 'manifested', 'dispatched', 'intransit', 'delivered', 'failed'];
  const state = /^\d+$/.test(String(status)) ? names[Number(status)] : normalize(status);
  const allowed: Record<ShipmentAction, string[]> = {
    carrier: ['pending', 'carrierassigned'], label: ['carrierassigned', 'manifested'],
    manifest: ['carrierassigned'], dispatch: ['manifested'], transit: ['dispatched'],
    delivery: ['dispatched', 'intransit'], fail: ['pending', 'carrierassigned', 'manifested', 'dispatched', 'intransit'],
  };
  return allowed[action].includes(state);
}
