import { canEditReturn, canOrderAction, canShipmentAction } from './workflow-actions';

describe('Workflow action guards', () => {
  it('blocks edits to closed, rejected and unknown returns', () => {
    for (const status of [6, '6', 'Closed', 3, 'Rejected', 'unknown']) expect(canEditReturn(status)).toBeFalse();
    expect(canEditReturn('Awaiting Receipt')).toBeTrue();
    expect(canEditReturn(4)).toBeTrue();
  });
  it('prevents allocating or reopening shipped and terminal orders', () => {
    for (const status of ['shipped', 'delivered', 'cancelled']) {
      expect(canOrderAction(status, 'allocate')).toBeFalse();
      expect(canOrderAction(status, 'readyForPicking')).toBeFalse();
    }
    expect(canOrderAction('shipped', 'markDelivered')).toBeTrue();
    expect(canOrderAction('delivered', 'markDelivered')).toBeFalse();
  });
  it('enables ordered transitions and fails closed for unknown states', () => {
    expect(canOrderAction('received', 'allocate')).toBeTrue();
    expect(canOrderAction('allocated', 'readyForPicking')).toBeTrue();
    expect(canOrderAction('ready_for_shipping', 'markShipped')).toBeTrue();
    expect(canOrderAction('unknown', 'allocate')).toBeFalse();
  });
  it('blocks all shipment mutations after delivery or failure for numeric and text states', () => {
    for (const status of [5, '5', 'Delivered', 6, 'Failed']) {
      for (const action of ['carrier', 'label', 'manifest', 'dispatch', 'transit', 'delivery', 'fail'] as const)
        expect(canShipmentAction(status, action)).withContext(`${status}: ${action}`).toBeFalse();
    }
  });
  it('allows dispatch only after manifest and delivery only after dispatch', () => {
    expect(canShipmentAction('CarrierAssigned', 'dispatch')).toBeFalse();
    expect(canShipmentAction(2, 'dispatch')).toBeTrue();
    expect(canShipmentAction('Dispatched', 'delivery')).toBeTrue();
    expect(canShipmentAction('In Transit', 'delivery')).toBeTrue();
    expect(canShipmentAction('unknown', 'delivery')).toBeFalse();
  });
});
