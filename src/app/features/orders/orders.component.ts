import { canOrderAction, OrderAction } from '../../shared/utils/workflow-actions';
import { Subject, takeUntil } from 'rxjs';
import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { TooltipModule } from 'primeng/tooltip';
import { TabViewModule } from 'primeng/tabview';
import { MessageService } from 'primeng/api';
import { OrdersService } from './orders.service';
import { CreateOrderDto, Order } from '../../core/models/order.model';
import { InventoryItem, InventoryRecord } from '../../core/models/inventory.model';
import { PageShellComponent, PageHeaderComponent } from '../../shared/ui';
import { WarehouseService } from '../settings/warehouse.service';
import { Observable } from 'rxjs';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { OutboundService } from './outbound.service';
import { CreatePackTaskDto, CreatePickWaveDto, PackTask, PickTask, PickWave, WarehouseUser } from './outbound.model';
import { CatalogItemsService } from '../inventory/catalog-items.service';
import { InventoryRecordsService } from '../inventory/inventory-records.service';
import { StorageLocationService } from '../inventory/storage-location.service';
import { StorageLocation } from '../inventory/storage-location.model';
import { ShippingService } from '../shipping/shipping.service';
import { Subscription } from 'rxjs';



@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule, FormsModule, TranslateModule,
    TableModule, ButtonModule, TagModule, TabViewModule,
    DropdownModule, InputTextModule, DialogModule,
    TooltipModule,
    PageShellComponent, PageHeaderComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',})
export class OrdersComponent implements OnInit {
  private ordersService = inject(OrdersService);
  private warehouseService = inject(WarehouseService);
  private messageService = inject(MessageService);
  private warehouseContext = inject(WarehouseContextService);
  private destroyRef = inject(DestroyRef);
  private warehouseChanged = new Subject<void>();
  private outboundService = inject(OutboundService);
  private authService = inject(AuthService);
  private catalogItemsService = inject(CatalogItemsService);
  private inventoryRecordsService = inject(InventoryRecordsService);
  private storageLocationService = inject(StorageLocationService);
  private shippingService = inject(ShippingService);
  private shipmentRequest?: Subscription;
  shipmentOptions = signal<{ label: string; value: string }[]>([]);
  shipmentLoading = signal(false);
  shipmentId = '';
  shipmentPage = 1;
  shipmentHasNext = false;

  orders = signal<Order[]>([]);
  loading = signal(true);
  totalOrders = signal(0);
  pickTasks = signal<PickTask[]>([]);
  packTasks = signal<PackTask[]>([]);
  pickWaves = signal<PickWave[]>([]);
  warehouseUsers = signal<WarehouseUser[]>([]);
  pickTasksLoading = signal(false);
  packTasksLoading = signal(false);
  pickWavesLoading = signal(false);
  catalogItems = signal<InventoryItem[]>([]);
  catalogItemsLoading = signal(false);
  inventoryRecords = signal<InventoryRecord[]>([]);
  inventoryRecordsLoading = signal(false);
  storageLocations = signal<StorageLocation[]>([]);
  zoneNames = signal<Record<string, string>>({});

  searchQuery = '';
  statusFilter = '';
  channelFilter = '';
  priorityFilter = '';

  showOrderDetail = false;
  showCreateOrder = false;
  showCreatePackTask = false;
  showCreatePickWave = false;
  selectedOrder: Order | null = null;
  selectedWarehouseId = '';
  actionLoading = signal<string | null>(null);
  creatingOrder = signal(false);
  creatingPackTask = signal(false);
  creatingPickWave = signal(false);
  outboundActionLoading = signal<string | null>(null);
  newOrder: CreateOrderDto = this.createEmptyOrder();
  newPackTask: CreatePackTaskDto = this.createEmptyPackTask();
  newPickWave: CreatePickWaveDto = this.createEmptyPickWave();

  statusOptions = [
    { label: 'Received', value: 'received' }, { label: 'Validating', value: 'validating' },
    { label: 'Allocated', value: 'allocated' }, { label: 'Partially Allocated', value: 'partially_allocated' },
    { label: 'Ready for Picking', value: 'ready_for_picking' }, { label: 'Picking', value: 'picking' },
    { label: 'Picked', value: 'picked' }, { label: 'Packing', value: 'packing' }, { label: 'Packed', value: 'packed' },
    { label: 'Ready for Shipping', value: 'ready_for_shipping' }, { label: 'Shipped', value: 'shipped' },
    { label: 'Delivered', value: 'delivered' }, { label: 'Cancelled', value: 'cancelled' }, { label: 'Backordered', value: 'backordered' },
  ];
  channelOptions = [
    { label: 'ERP', value: 'erp' }, { label: 'E-Commerce', value: 'ecommerce' }, { label: 'EDI', value: 'edi' },
    { label: 'Manual', value: 'manual' }, { label: 'API', value: 'api' },
  ];
  priorityOptions = [
    { label: 'Critical', value: 'critical' }, { label: 'High', value: 'high' }, { label: 'Normal', value: 'normal' }, { label: 'Low', value: 'low' },
  ];
  createPriorityOptions = [
    { label: 'Critical', value: 'Critical' }, { label: 'High', value: 'High' }, { label: 'Normal', value: 'Normal' }, { label: 'Low', value: 'Low' },
  ];
  allocationStrategyOptions = ['FIFO', 'FEFO', 'LIFO'];

  constructor() {
    this.warehouseContext.warehouseSelectionChanges.pipe(takeUntilDestroyed()).subscribe(warehouseId => {
      const nextWarehouseId = warehouseId ?? '';
      if (nextWarehouseId === this.selectedWarehouseId) return;
      this.selectedWarehouseId = nextWarehouseId;
      this.onWarehouseChange();
    });
  }

  ngOnInit(): void { this.warehouseContext.initialize(); }

  onWarehouseChange(): void {
    this.warehouseChanged.next();
    this.shipmentId = ''; this.shipmentOptions.set([]); this.shipmentLoading.set(false); this.selectedOrder = null;
    this.orders.set([]); this.pickTasks.set([]); this.packTasks.set([]); this.pickWaves.set([]);
    this.showOrderDetail = this.showCreateOrder = this.showCreatePackTask = this.showCreatePickWave = false;

    this.loadOrders();
    this.loadOutbound();
    this.loadZoneNames();
  }

  openCreateOrder(): void {
    if (!this.selectedWarehouseId) {
      this.messageService.add({ severity: 'warn', summary: 'Warehouse required', detail: 'Select a warehouse before creating an order.' });
      return;
    }
    this.newOrder = this.createEmptyOrder();
    this.loadCatalogItems();
    this.showCreateOrder = true;
  }

  loadCatalogItems(): void {
    this.catalogItemsLoading.set(true);
    this.catalogItemsService.getCatalogItems({ page: 1, status: 'active' }).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.catalogItems.set(response.data);
        for (const line of this.newPickWave.lines) {
          if (line.inventoryRecordId) this.onPickWaveInventoryRecordChange(line, line.inventoryRecordId);
        }
        this.catalogItemsLoading.set(false);
      },
      error: () => {
        this.catalogItems.set([]);
        this.catalogItemsLoading.set(false);
      },
    });
  }

  openCreatePackTask(): void {
    if (!this.selectedWarehouseId) return;
    this.newPackTask = this.createEmptyPackTask();
    this.showCreatePackTask = true;
  }

  openCreatePickWave(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!this.selectedWarehouseId || !userId) {
      this.messageService.add({ severity: 'warn', summary: 'User required', detail: 'Select a warehouse and sign in before creating a pick wave.' });
      return;
    }
    this.newPickWave = this.createEmptyPickWave();
    this.loadCatalogItems();
    this.loadInventoryRecords();
    this.loadStorageLocations();
    this.showCreatePickWave = true;
  }

  createdByUserName(): string {
    return this.authService.getCurrentUser()?.name ?? '';
  }

  loadInventoryRecords(): void {
    this.inventoryRecordsLoading.set(true);
    this.inventoryRecordsService.getByWarehouse(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: records => {
        this.inventoryRecords.set(records.filter(record => record.availableQuantity > 0));
        this.inventoryRecordsLoading.set(false);
      },
      error: () => {
        this.inventoryRecords.set([]);
        this.inventoryRecordsLoading.set(false);
      },
    });
  }

  private loadStorageLocations(): void {
    this.storageLocationService.getStorageLocations(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: locations => this.storageLocations.set(locations),
      error: () => this.storageLocations.set([]),
    });
  }

  private loadZoneNames(): void {
    if (!this.selectedWarehouseId) {
      this.zoneNames.set({});
      return;
    }
    this.warehouseService.getWarehouseById(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: warehouse => this.zoneNames.set(Object.fromEntries(
        (warehouse.zones ?? []).map(zone => [zone.id, zone.name || zone.code || this.translateFallback(zone.id)]),
      )),
      error: () => this.zoneNames.set({}),
    });
  }

  addPackItem(): void { this.newPackTask.items.push({ itemId: '', sku: '', quantity: 1, uomCode: 'EA', weightKgPerUnit: 0, lotNumber: '' }); }
  removePackItem(index: number): void { if (this.newPackTask.items.length > 1) this.newPackTask.items.splice(index, 1); }
  addPickWaveLine(): void { this.newPickWave.lines.push(this.createEmptyPickWaveLine()); }
  removePickWaveLine(index: number): void { if (this.newPickWave.lines.length > 1) this.newPickWave.lines.splice(index, 1); }

  onPackOrderChange(): void {
    const order = this.orders().find(candidate => candidate.id === this.newPackTask.orderId);
    if (!order) return;
    this.newPackTask.items = order.lines.map(line => ({
      itemId: line.itemId,
      sku: line.sku,
      quantity: line.quantity,
      uomCode: line.uom,
      weightKgPerUnit: 0,
      lotNumber: line.lotNumber ?? '',
    }));
  }

  onPickWaveOrderChange(line: CreatePickWaveDto['lines'][number]): void {
    line.orderLineId = '';
    line.inventoryRecordId = '';
    line.itemId = '';
    line.sku = '';
    line.sourceBinId = '';
    line.zoneId = '';
    line.binLabel = '';
    line.uomCode = 'EA';
    line.uomName = 'Each';
    line.lotNumber = '';
    line.expirationDate = null;
  }

  getInventoryRecordsForLine(line: CreatePickWaveDto['lines'][number]): InventoryRecord[] {
    const order = this.orders().find(candidate => candidate.id === line.orderId);
    const orderItemIds = new Set((order?.lines ?? []).map(orderLine => orderLine.itemId));
    return this.inventoryRecords().filter(record => orderItemIds.has(record.itemId));
  }

  onPickWaveInventoryRecordChange(line: CreatePickWaveDto['lines'][number], inventoryRecordId?: string): void {
    const selectedId = inventoryRecordId ?? line.inventoryRecordId;
    line.inventoryRecordId = selectedId;
    const record = this.inventoryRecords().find(candidate => candidate.id === selectedId);
    const order = this.orders().find(candidate => candidate.id === line.orderId);
    const orderLine = order?.lines.find(candidate => candidate.itemId === record?.itemId);
    if (!record || !order || !orderLine) return;
    line.orderLineId = orderLine.id;
    line.itemId = record.itemId;
    line.sku = record.sku;
    line.sourceBinId = record.storageLocationId;
    const location = this.storageLocations().find(candidate => candidate.id === record.storageLocationId);
    line.zoneId = location?.zoneId ?? '';
    if (!location) {
      this.storageLocationService.getStorageLocationById(record.storageLocationId).subscribe({
        next: resolvedLocation => line.zoneId = resolvedLocation.zoneId,
      });
    }
    line.binLabel = this.storageLocationLabel(record.storageLocationId);
    line.quantity = Math.min(orderLine.quantity, record.availableQuantity);
    line.uomCode = record.uomCode;
    line.uomName = record.uomName;
    line.lotNumber = record.lotNumber ?? '';
    line.expirationDate = record.expirationDate ?? null;
    line.priority = order.priority.charAt(0).toUpperCase() + order.priority.slice(1);
    const catalogItem = this.catalogItems().find(item => item.id === record.itemId);
    line.itemLengthCm = catalogItem?.dimensions?.l ?? 0;
    line.itemWidthCm = catalogItem?.dimensions?.w ?? 0;
    line.itemHeightCm = catalogItem?.dimensions?.h ?? 0;
    line.itemWeightKg = catalogItem?.weight ?? 0;
  }

  createPackTask(): void {
    if (!this.newPackTask.orderId || !this.newPackTask.assignedOperatorId || !this.newPackTask.items.every(item => item.itemId && item.sku && item.quantity > 0)) {
      this.messageService.add({ severity: 'warn', summary: 'Incomplete pack task', detail: 'Enter the order, assigned operator, and valid pack items.' });
      return;
    }
    this.creatingPackTask.set(true);
    this.outboundService.createPackTask(this.newPackTask).subscribe({
      next: () => { this.creatingPackTask.set(false); this.showCreatePackTask = false; this.loadOutbound(); this.messageService.add({ severity: 'success', summary: 'Pack task created', detail: 'The pack task is ready for its assigned operator.' }); },
      error: () => this.creatingPackTask.set(false),
    });
  }

  createPickWave(): void {
    if (!this.newPickWave.createdByUserId || !this.newPickWave.lines.every(line => line.orderId && line.orderLineId && line.inventoryRecordId && line.itemId && line.sourceBinId && line.zoneId && line.sku && line.quantity > 0)) {
      this.messageService.add({ severity: 'warn', summary: 'Incomplete pick wave', detail: 'Complete every required line before creating the wave.' });
      return;
    }
    this.creatingPickWave.set(true);
    const body: CreatePickWaveDto = {
      ...this.newPickWave,
      lines: this.newPickWave.lines.map(({ inventoryRecordId: _inventoryRecordId, ...line }) => ({
        ...line,
        expirationDate: line.expirationDate ? new Date(line.expirationDate).toISOString() : null,
      })),
    };
    this.outboundService.createPickWave(body).subscribe({
      next: () => { this.creatingPickWave.set(false); this.showCreatePickWave = false; this.loadOutbound(); this.messageService.add({ severity: 'success', summary: 'Pick wave created', detail: 'Release the wave when it is ready for execution.' }); },
      error: () => this.creatingPickWave.set(false),
    });
  }

  addOrderLine(): void {
    this.newOrder.lines.push({ itemId: '', sku: '', requestedQuantity: 1, uomCode: 'EA' });
  }

  onOrderLineItemChange(line: CreateOrderDto['lines'][number]): void {
    const item = this.catalogItems().find(candidate => candidate.id === line.itemId);
    if (!item) return;
    line.sku = item.sku;
    line.uomCode = item.uom || 'EA';
  }

  removeOrderLine(index: number): void {
    if (this.newOrder.lines.length > 1) this.newOrder.lines.splice(index, 1);
  }

  createOrder(): void {
    if (!this.newOrder.externalOrderId || !this.newOrder.customerId || !this.newOrder.customerName || !this.newOrder.lines.every(line => line.itemId && line.sku && line.requestedQuantity > 0)) {
      this.messageService.add({ severity: 'warn', summary: 'Incomplete order', detail: 'Complete the customer details and at least one valid order line.' });
      return;
    }

    this.creatingOrder.set(true);
    const body: CreateOrderDto = {
      ...this.newOrder,
      requestedShipDate: new Date(this.newOrder.requestedShipDate).toISOString(),
      consolidationGroupId: this.newOrder.consolidationGroupId || null,
      notes: this.newOrder.notes || null,
    };
    this.ordersService.createOrder(body).subscribe({
      next: () => {
        this.creatingOrder.set(false);
        this.showCreateOrder = false;
        this.messageService.add({ severity: 'success', summary: 'Order created', detail: 'The new order has been created.' });
        this.loadOrders();
      },
      error: () => this.creatingOrder.set(false),
    });
  }

  loadOrders(): void {
    if (!this.selectedWarehouseId) {
      this.orders.set([]);
      this.totalOrders.set(0);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.ordersService.getOrders(this.selectedWarehouseId, {
      search: this.searchQuery || undefined,
      status: this.statusFilter || undefined,
      channel: this.channelFilter || undefined,
      priority: this.priorityFilter || undefined,
      limit: 30,
    }).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: res => {
        this.orders.set(res.data);
        this.totalOrders.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.orders.set([]);
        this.totalOrders.set(0);
        this.loading.set(false);
      },
    });
  }

  viewOrder(order: Order): void {
    this.selectedOrder = order;
    this.loadOrderShipments(1);
    this.showOrderDetail = true;
  }

  loadOrderShipments(page: number): void {
    this.shipmentRequest?.unsubscribe();
    this.shipmentId = '';
    this.shipmentOptions.set([]);
    this.shipmentHasNext = false;
    const order = this.selectedOrder;
    if (!order) return;
    this.shipmentPage = page;
    this.shipmentLoading.set(true);
    this.shipmentRequest = this.shippingService.getShipments(order.warehouseId, page, 25)
      .pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
        next: shipments => {
          this.shipmentHasNext = shipments.length === 25;
          this.shipmentOptions.set(shipments.filter(s => s.warehouseId === order.warehouseId && s.orderIds.includes(order.id))
            .map(s => ({ label: [s.manifestNumber, s.carrierName, s.id].filter(Boolean).join(' · '), value: s.id })));
          this.shipmentLoading.set(false);
        },
        error: () => this.shipmentLoading.set(false),
      });
  }

  canAction(order: Order, action: OrderAction): boolean { return !this.actionLoading() && canOrderAction(order.status, action); }

  runAction(order: Order, action: 'allocate' | 'readyForPicking' | 'markPicking' | 'markPicked' | 'markPacking' | 'markPacked' | 'markShipped' | 'markDelivered'): void {
    if (!this.canAction(order, action) || (action === 'markShipped' && !this.shipmentOptions().some(s => s.value === this.shipmentId))) return;
    this.actionLoading.set(action);
    const request: Observable<void> = (() => {
      switch (action) {
        case 'allocate': return this.ordersService.allocate(order.id);
        case 'readyForPicking': return this.ordersService.readyForPicking(order.id);
        case 'markPicking': return this.ordersService.markPicking(order.id);
        case 'markPicked': return this.ordersService.markPicked(order.id);
        case 'markPacking': return this.ordersService.markPacking(order.id);
        case 'markPacked': return this.ordersService.markPacked(order.id);
        case 'markShipped': return this.ordersService.markShipped(order.id, this.shipmentId);
        case 'markDelivered': return this.ordersService.markDelivered(order.id);
      }
    })();
    request.subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.messageService.add({ severity: 'success', summary: 'Order updated', detail: 'Order status updated.' });
        this.showOrderDetail = false;
        this.loadOrders();
      },
      error: () => this.actionLoading.set(null),
    });
  }

  loadOutbound(): void {
    if (!this.selectedWarehouseId) {
      this.pickTasks.set([]); this.packTasks.set([]); this.pickWaves.set([]); this.warehouseUsers.set([]);
      return;
    }
    this.pickTasksLoading.set(true);
    this.outboundService.getPickTasks(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.pickTasks.set(tasks); this.pickTasksLoading.set(false); },
      error: () => this.pickTasksLoading.set(false),
    });
    this.packTasksLoading.set(true);
    this.outboundService.getPackTasks(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.packTasks.set(tasks); this.packTasksLoading.set(false); },
      error: () => this.packTasksLoading.set(false),
    });
    this.pickWavesLoading.set(true);
    this.outboundService.getPickWaves(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: waves => { this.pickWaves.set(waves); this.pickWavesLoading.set(false); },
      error: () => this.pickWavesLoading.set(false),
    });
    this.outboundService.getWarehouseUsers(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: users => this.warehouseUsers.set(users.filter(user => user.status.toLowerCase() === 'active')),
      error: () => this.warehouseUsers.set([]),
    });
  }

  startPickTask(task: PickTask): void { this.runOutboundAction(`pick-start-${task.id}`, this.outboundService.startPickTask(task.id)); }
  confirmPickTask(task: PickTask): void { this.runOutboundAction(`pick-confirm-${task.id}`, this.outboundService.confirmPick(task.id, task.requestedQuantity)); }
  cancelPickTask(task: PickTask): void { this.runOutboundAction(`pick-cancel-${task.id}`, this.outboundService.cancelPickTask(task.id)); }
  startPackTask(task: PackTask): void { this.runOutboundAction(`pack-start-${task.id}`, this.outboundService.startPackTask(task.id)); }
  completePackTask(task: PackTask): void {
    const operatorId = this.authService.getCurrentUser()?.id;
    if (!operatorId) { this.messageService.add({ severity: 'warn', summary: 'Operator required', detail: 'Sign in as an operator before completing a pack task.' }); return; }
    this.runOutboundAction(`pack-complete-${task.id}`, this.outboundService.completePackTask(task.id, operatorId));
  }
  verifyPackItem(task: PackTask, itemId: string): void { this.runOutboundAction(`pack-verify-${itemId}`, this.outboundService.verifyPackItem(task.id, itemId)); }
  releasePickWave(wave: PickWave): void { this.runOutboundAction(`wave-release-${wave.id}`, this.outboundService.releasePickWave(wave.id)); }
  cancelPickWave(wave: PickWave): void { this.runOutboundAction(`wave-cancel-${wave.id}`, this.outboundService.cancelPickWave(wave.id)); }

  outboundSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const normalized = status.toLowerCase();
    if (normalized === 'completed') return 'success';
    if (normalized === 'cancelled' || normalized === 'failed') return 'danger';
    if (normalized === 'inprogress' || normalized === 'in_progress' || normalized === 'started') return 'info';
    return 'warning';
  }

  private runOutboundAction(key: string, request: Observable<void>): void {
    this.outboundActionLoading.set(key);
    request.subscribe({
      next: () => {
        this.outboundActionLoading.set(null);
        this.messageService.add({ severity: 'success', summary: 'Task updated', detail: 'The outbound task has been updated.' });
        this.loadOutbound();
        this.loadOrders();
      },
      error: () => this.outboundActionLoading.set(null),
    });
  }

  formatStatus(s: string): string {
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }

  getStatusSeverity(s: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'secondary'> = {
      received: 'info', validating: 'info', allocated: 'info', partially_allocated: 'warning', ready_for_picking: 'info', picking: 'warning', picked: 'warning', packing: 'warning', packed: 'warning',
      ready_for_shipping: 'success', ready_to_ship: 'success', shipped: 'success', delivered: 'success',
      cancelled: 'danger', backordered: 'warning',
    };
    return map[s] ?? 'secondary';
  }

  getPrioritySeverity(p: string): 'success' | 'info' | 'warning' | 'danger' {
    return p === 'critical' ? 'danger' : p === 'high' ? 'warning' : p === 'normal' ? 'info' : 'success';
  }

  orderNumber(orderId: string): string {
    return this.orders().find(order => order.id === orderId)?.orderNumber ?? this.translateFallback(orderId);
  }

  operatorName(userId?: string | null): string {
    if (!userId) return 'Unassigned';
    return this.warehouseUsers().find(user => user.id === userId)?.fullName ?? this.translateFallback(userId);
  }

  storageLocationLabel(locationId: string): string {
    return this.storageLocations().find(location => location.id === locationId)?.binCode ?? this.translateFallback(locationId);
  }

  zoneLabel(zoneId: string): string {
    return this.zoneNames()[zoneId] ?? this.translateFallback(zoneId);
  }

  pickWaveLabel(wave: PickWave): string {
    return `${wave.waveType} wave · ${new Date(wave.createdAt).toLocaleDateString()}`;
  }

  catalogItemName(itemId: string): string {
    const item = this.catalogItems().find(candidate => candidate.id === itemId);
    return item ? `${item.sku} — ${item.name}` : this.translateFallback(itemId);
  }

  private translateFallback(value: string): string {
    return value ? value.slice(0, 8).toUpperCase() : '—';
  }

  private createEmptyOrder(): CreateOrderDto {
    return {
      warehouseId: this.selectedWarehouseId,
      externalOrderId: '',
      channel: 'Ecommerce',
      sourceSystem: '',
      customerId: '',
      customerName: '',
      priority: 'Normal',
      allocationStrategy: 'FIFO',
      requestedShipDate: new Date().toISOString().slice(0, 16),
      shippingStreet: '',
      shippingCity: '',
      shippingRegion: '',
      shippingPostalCode: '',
      shippingCountry: '',
      consolidationGroupId: null,
      notes: null,
      lines: [{ itemId: '', sku: '', requestedQuantity: 1, uomCode: 'EA' }],
    };
  }

  private createEmptyPackTask(): CreatePackTaskDto {
    return { orderId: '', warehouseId: this.selectedWarehouseId, containerType: 'Carton', assignedOperatorId: '', items: [{ itemId: '', sku: '', quantity: 1, uomCode: 'EA', weightKgPerUnit: 0, lotNumber: '' }] };
  }

  private createEmptyPickWave(): CreatePickWaveDto {
    return { warehouseId: this.selectedWarehouseId, waveType: 'Batch', createdByUserId: this.authService.getCurrentUser()?.id ?? '', lines: [this.createEmptyPickWaveLine()] };
  }

  private createEmptyPickWaveLine(): CreatePickWaveDto['lines'][number] {
    return { inventoryRecordId: '', orderId: '', orderLineId: '', itemId: '', sku: '', sourceBinId: '', zoneId: '', binLabel: '', quantity: 1, uomCode: 'EA', uomName: 'Each', itemLengthCm: 0, itemWidthCm: 0, itemHeightCm: 0, itemWeightKg: 0, lotNumber: '', expirationDate: null, priority: 'Normal' };
  }
}
