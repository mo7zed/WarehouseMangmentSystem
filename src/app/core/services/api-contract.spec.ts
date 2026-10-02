import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReceivingService } from '../../features/receiving/receiving.service';
import { CatalogItemsService } from '../../features/inventory/catalog-items.service';
import { WorkAssignmentService } from '../../features/labor/work-assignment.service';
import { InventoryService } from '../../features/inventory/inventory.service';
import { OrdersService } from '../../features/orders/orders.service';
import { PutawayService } from '../../features/receiving/putaway.service';
import { AdminService } from '../../features/admin/admin.service';
import { ReportsService } from '../../features/reports/reports.service';
import { ReceivingComponent } from '../../features/receiving/receiving.component';
import { OrdersComponent } from '../../features/orders/orders.component';
import { WarehouseContextService } from '../warehouse/warehouse-context.service';
import { AuthService } from '../auth/auth.service';
import { MessageService } from 'primeng/api';
import { Subject } from 'rxjs';
import { ASN, Order } from '../models/order.model';
import { PutawayTask } from '../../features/receiving/putaway.model';
import { StorageLocation } from '../../features/inventory/storage-location.model';
import { ReturnsComponent } from '../../features/returns/returns.component';
import { ReturnAuthorization } from '../../features/returns/returns.service';

describe('API contracts observed in the live Swagger audit', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), MessageService,
      { provide: WarehouseContextService, useValue: { warehouseSelectionChanges: new Subject<string>(), initialize: () => {} } },
      { provide: AuthService, useValue: { getCurrentUser: () => ({ id: 'operator' }) } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('never submits mutations for a closed return even when handlers are called directly', () => {
    const component = TestBed.runInInjectionContext(() => new ReturnsComponent());
    const ret = { id: 'closed-return', status: 6, closedAt: '2026-09-28', lines: [] } as unknown as ReturnAuthorization;
    component.selectedReturn.set(ret);
    component.authorize(ret); component.awaitingReceipt(ret); component.receive(ret);
    component.inspect(ret, 'line', 'Good'); component.close(ret); component.openReject();
    expect(component.showRejectDialog).toBeFalse();
    http.expectNone(() => true);
  });

  it('accepts an ID-only ASN creation response without treating a saved record as a failure', () => {
    let saved = '';
    TestBed.inject(ReceivingService).createASN({ warehouseId: 'wh', supplierId: 'supplier', supplierName: 'Supplier', expectedArrivalDate: '2026-09-27T00:00:00Z', lines: [] })
      .subscribe({ next: result => saved = result.id, error: fail });
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/asns')).flush({ id: 'created-asn' }, { status: 201, statusText: 'Created' });
    expect(saved).toBe('created-asn');
    http.expectNone(r => r.method === 'GET');
  });

  it('maps PascalCase received states rather than reverting them to Expected', () => {
    TestBed.inject(ReceivingService).getPendingASNs('wh').subscribe(result => {
      expect(result.map(a => a.status)).toEqual(['complete', 'partially_received', 'expected']);
    });
    http.expectOne(r => r.url.endsWith('/asns/pending') && r.params.get('warehouseId') === 'wh')
      .flush(['FullyReceived', 'PartiallyReceived', 'Confirmed'].map((status, i) => ({ id: String(i), status, lines: [] })));
  });

  it('preserves FEFO and LIFO instead of silently displaying FIFO', () => {
    TestBed.inject(CatalogItemsService).getCatalogItems().subscribe(result => {
      expect(result.data.map(i => i.strategy)).toEqual(['FEFO', 'LIFO']);
    });
    http.expectOne(r => r.url.endsWith('/catalog-items')).flush(['FEFO', 'LIFO'].map((allocationStrategy, i) => ({
      id: String(i), sku: String(i), name: 'Item', allocationStrategy, status: 'Active', updatedAt: '2026-09-27',
    })));
  });

  it('builds a catalog request with a valid velocity and selected allocation strategy', () => {
    const service = TestBed.inject(CatalogItemsService);
    const body = service.toCreateDto({ sku: 'TEST', name: 'Test', strategy: 'FEFO' });
    expect(body.velocityClass).toBe('MediumMover');
    expect(body.allocationStrategy).toBe('FEFO');
    expect(body.tempMinCelsius).toBeNull();
    expect('allocationStrategy' in service.toUpdateDto({ strategy: 'FEFO' })).toBeFalse();
    service.create(body).subscribe(result => expect(result.id).toBe('item'));
    http.expectOne(r => r.method === 'POST' && r.url.endsWith('/catalog-items')).flush({ id: 'item' }, { status: 201, statusText: 'Created' });
  });

  it('sends labor balancing warehouse in the query and no JSON payload', () => {
    TestBed.inject(WorkAssignmentService).balance('wh').subscribe();
    const request = http.expectOne(r => r.url.endsWith('/labor/assignments/balance'));
    expect(request.request.method).toBe('POST');
    expect(request.request.params.get('warehouseId')).toBe('wh');
    expect(request.request.body).toBeNull();
    request.flush([]);
  });

  it('records one cycle-count task with the documented countedItems structure', () => {
    const body = { countTaskId: 'task', countedItems: [{ itemId: 'item', countedQuantityAmount: 10, uomCode: 'EA', uomName: 'Each', lotNumber: null }] };
    TestBed.inject(InventoryService).submitCycleCountResults('count', body).subscribe();
    const request = http.expectOne(r => r.url.endsWith('/cycle-counts/count/count-results'));
    expect(request.request.body).toEqual(body);
    expect(request.request.body.results).toBeUndefined();
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('links an existing shipment when marking an order shipped', () => {
    TestBed.inject(OrdersService).markShipped('order', 'shipment').subscribe();
    const request = http.expectOne(r => r.url.endsWith('/orders/order/mark-shipped'));
    expect(request.request.body).toEqual({ shipmentId: 'shipment' });
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('accepts empty successful responses when completing receiving and putaway', () => {
    let completed = 0;
    TestBed.inject(ReceivingService).completeInboundShipmentReceiving('inbound').subscribe(() => completed++);
    TestBed.inject(PutawayService).complete('task', { operatorId: 'operator', actualBinId: 'bin' }).subscribe(() => completed++);
    http.expectOne(r => r.url.endsWith('/inbound-shipments/inbound/complete-receiving')).flush(null, { status: 204, statusText: 'No Content' });
    http.expectOne(r => r.url.endsWith('/putaway/task/complete')).flush(null, { status: 204, statusText: 'No Content' });
    expect(completed).toBe(2);
  });

  it('measures connectivity only after a successful request', () => {
    let received = false;
    TestBed.inject(AdminService).getSystemHealth().subscribe(result => {
      received = true; expect(result.apiStatus).toBe('reachable'); expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });
    expect(received).toBeFalse();
    http.expectOne(r => r.url.endsWith('/warehouses')).flush([]);
    expect(received).toBeTrue();
  });

  it('never claims connectivity is healthy after a failed request', () => {
    TestBed.inject(AdminService).getSystemHealth().subscribe(result => {
      expect(result.apiStatus).toBe('unreachable'); expect(result.latencyMs).toBeNull();
    });
    http.expectOne(r => r.url.endsWith('/warehouses')).flush({}, { status: 500, statusText: 'Server Error' });
  });

  it('requests the category snapshot without a misleading valuation type or dates', () => {
    TestBed.inject(ReportsService).getInventoryReport('wh', 'category', { from: '2099-01-01', to: '2099-01-02' }).subscribe();
    const request = http.expectOne(r => r.url.endsWith('/reports/inventory'));
    expect(request.request.params.keys()).toEqual(['warehouseId']);
    request.flush({ title: 'Inventory by Category', rows: [] });
  });

  it('opens real receiving with only outstanding ASN quantities and performs no premature write', () => {
    const component = TestBed.runInInjectionContext(() => new ReceivingComponent());
    const asn = { id: 'asn', items: [
      { itemId: 'one', expectedQty: 10, receivedQty: 3, uom: 'EA' },
      { itemId: 'two', expectedQty: 5, receivedQty: 5, uom: 'EA' },
    ] } as ASN;
    component.asns.set([asn]);
    component.openReceiveWizard(asn);
    expect(component.showCreateInboundShipment).toBeTrue();
    expect(component.inboundForm.asnId).toBe('asn');
    expect(component.inboundForm.lines.length).toBe(1);
    expect(component.inboundForm.lines[0].receivedQuantity).toBe(7);
    expect(component.inboundForm.lines[0].receivedBy).toBe('operator');
    http.expectNone(() => true);
  });

  it('only offers shipments containing the selected order in the same warehouse', () => {
    const component = TestBed.runInInjectionContext(() => new OrdersComponent());
    const order = { id: 'order', warehouseId: 'wh', status: 'packed' } as Order;
    component.viewOrder(order);
    http.expectOne(r => r.url.endsWith('/shipments')).flush([
      { id: 'matching', warehouseId: 'wh', orderIds: ['order'] },
      { id: 'other-order', warehouseId: 'wh', orderIds: ['other'] },
      { id: 'other-warehouse', warehouseId: 'other', orderIds: ['order'] },
    ]);
    expect(component.shipmentOptions().map(s => s.value)).toEqual(['matching']);
    component.shipmentId = 'other-order';
    component.runAction(order, 'markShipped');
    http.expectNone(r => r.method === 'POST');
  });

  it('loads completed ASNs from the documented full list and isolates the selected warehouse', () => {
    TestBed.inject(ReceivingService).getASNs('wh').subscribe(list => {
      expect(list.map(a => a.id)).toEqual(['complete']);
      expect(list[0].status).toBe('complete');
    });
    const req = http.expectOne(r => r.url.endsWith('/asns') && r.method === 'GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush([{ id: 'complete', warehouseId: 'wh', status: 'FullyReceived', lines: [] },
      { id: 'other', warehouseId: 'other', status: 'Confirmed', lines: [] }]);
  });

  it('does not complete a pending putaway or an unverified alternative bin', () => {
    const component = TestBed.runInInjectionContext(() => new ReceivingComponent());
    const task = { id: 'task', status: 'Pending', recommendedBinId: 'recommended', startedAt: null, assignedTo: 'assigned-operator' } as PutawayTask;
    component.selectedPutawayTask.set(task);
    component.completePutawayForm = { actualBinId: 'other', overrideReason: '' };
    component.putawayBins.set([{ id: 'other' } as StorageLocation]);
    expect(component.canCompletePutaway()).toBeFalse();
    component.selectedPutawayTask.set({ ...task, status: 'InProgress', startedAt: '2026-09-27' });
    expect(component.canCompletePutaway()).toBeFalse();
    component.completePutaway();
    http.expectNone(r => r.method === 'POST');
    component.completePutawayForm.overrideReason = 'Approved alternate location';
    expect(component.canCompletePutaway()).toBeTrue();
    component.completePutaway();
    const complete = http.expectOne(r => r.url.endsWith('/putaway/task/complete'));
    expect(complete.request.body.operatorId).toBe('assigned-operator');
    complete.flush(null, { status: 204, statusText: 'No Content' });
    // No selected warehouse in this isolated test, so no follow-up list request.
  });

  it('preserves a unit name distinct from its code when filling receiving lines', () => {
    const component = TestBed.runInInjectionContext(() => new ReceivingComponent());
    component.catalogItems.set([{ id: 'item', sku: 'SKU', name: 'Item', uom: 'EA', uomName: 'Each' } as import('../models/inventory.model').InventoryItem]);
    component.addCreateLine();
    component.onCreateAsnItemChange(component.createForm.lines[0], 'item');
    expect(component.createForm.lines[0].uomName).toBe('Each');
    component.onInboundItemChange(component.inboundForm.lines[0], 'item');
    expect(component.inboundForm.lines[0].uomName).toBe('Each');
    TestBed.inject(CatalogItemsService).getCatalogItems().subscribe(result => expect(result.data[0].uomName).toBe('Each'));
    http.expectOne(r => r.url.endsWith('/catalog-items')).flush([{ id: 'item', sku: 'SKU', name: 'Item', status: 'Active', baseUOM: { code: 'EA', name: 'Each' } }]);
  });

  it('reconciles completion after a server error and never resubmits a task saved as complete', () => {
    const component = TestBed.runInInjectionContext(() => new ReceivingComponent());
    component.selectedWarehouseId = 'wh';
    const task = { id: 'task', assignedTo: 'worker', startedAt: '2026-09-27', status: 'InProgress', recommendedBinId: 'bin' } as PutawayTask;
    component.selectedPutawayTask.set(task);
    component.showCompletePutaway = true;
    component.completePutawayForm = { actualBinId: 'bin', overrideReason: '' };
    component.putawayBins.set([{ id: 'bin' } as StorageLocation]);
    component.completePutaway();
    http.expectOne(r => r.url.endsWith('/putaway/task/complete')).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(r => r.url.endsWith('/putaway')).flush([{ ...task, status: 'Completed', completedAt: '2026-09-27' }]);
    expect(component.showCompletePutaway).toBeFalse();
    expect(component.putawayReconciliationWarning()).toBe('task');
    component.openCompletePutaway(component.putawayTasks()[0]);
    http.expectNone(r => r.method === 'POST');
  });

  it('requires reconciliation after an ambiguous error without inventing a completed state', () => {
    const component = TestBed.runInInjectionContext(() => new ReceivingComponent());
    component.selectedWarehouseId = 'wh';
    const task = { id: 'task', assignedTo: 'worker', startedAt: '2026-09-28', status: 'InProgress', recommendedBinId: 'bin' } as PutawayTask;
    component.selectedPutawayTask.set(task);
    component.showCompletePutaway = true;
    component.completePutawayForm = { actualBinId: 'bin', overrideReason: '' };
    component.putawayBins.set([{ id: 'bin' } as StorageLocation]);
    component.completePutaway();
    http.expectOne(r => r.url.endsWith('/putaway/task/complete')).flush({}, { status: 500, statusText: 'Server Error' });
    http.expectOne(r => r.url.endsWith('/putaway')).flush([task]);
    expect(component.putawayTasks()[0].status).toBe('InProgress');
    expect(component.putawayReconciliationWarning()).toBe('task');
    expect(component.showCompletePutaway).toBeFalse();
    component.openCompletePutaway(task); component.completePutaway();
    expect(component.showCompletePutaway).toBeFalse();
    http.expectNone(() => true);
  });
});
