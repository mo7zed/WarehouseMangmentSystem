import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { DropdownModule } from 'primeng/dropdown';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { InputTextareaModule } from 'primeng/inputtextarea';
import { MessageService } from 'primeng/api';
import { distinctUntilChanged, Observable, Subscription } from 'rxjs';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ReturnsService, ReturnAuthorization, CreateReturnAuthorizationDto } from './returns.service';
import { canEditReturn } from '../../shared/utils/workflow-actions';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { CatalogItemsService } from '../inventory/catalog-items.service';
import { InventoryItem } from '../../core/models/inventory.model';
import { OrdersService } from '../orders/orders.service';
import { Order } from '../../core/models/order.model';
import { ShippingService, OutboundShipment } from '../shipping/shipping.service';
interface ReturnLineForm {
    itemId: string;
    sku: string;
    itemName: string;
    quantity: number;
    uomCode: string;
    uomName: string;
    reasonCode: string;
    notes: string;
}
@Component({ selector: 'app-returns', standalone: true, imports: [UiLabelPipe, UiOptionsPipe, TranslateModule, CommonModule, FormsModule, TableModule, ButtonModule, TagModule, DialogModule, DropdownModule, InputTextModule, InputTextareaModule, InputNumberModule], templateUrl: './returns.component.html', styleUrl: './returns.component.scss' })
export class ReturnsComponent implements OnInit, OnDestroy {
    private returnsService = inject(ReturnsService);
    private warehouseContext = inject(WarehouseContextService);
    private auth = inject(AuthService);
    private messages = inject(MessageService);
    private catalogItemsService = inject(CatalogItemsService);
    private ordersService = inject(OrdersService);
    private shippingService = inject(ShippingService);
    orderOptions = signal<Order[]>([]);
    shipmentOptions = signal<OutboundShipment[]>([]);
    choicesLoading = signal(false);
    shipmentsLoading = signal(false);
    shipmentPage = 1;
    shipmentHasNext = false;
    private choicesRequest?: Subscription;
    private shipmentRequest?: Subscription;
    selectedOrder(): Order | undefined { return this.orderOptions().find(o => o.id === this.createForm.originalOrderId); }
    shipmentLabel(s: OutboundShipment): string { return s.manifestNumber || s.packages.map(p => p.trackingNumber).filter(Boolean).join(', ') || s.id; }
    returns = signal<ReturnAuthorization[]>([]);
    catalogItems = signal<InventoryItem[]>([]);
    catalogLoading = signal(false);
    selectedReturn = signal<ReturnAuthorization | null>(null);
    loading = signal(false);
    saving = signal(false);
    showCreateDialog = false;
    showDetailsDialog = false;
    showRejectDialog = false;
    rejectionReason = '';
    createForm = this.emptyCreateForm();
    page = 1;
    readonly pageSize = 25;
    hasNext = signal(false);
    total = signal<number | null>(null);
    private listRequest?: Subscription;
    ngOnDestroy(): void { this.listRequest?.unsubscribe(); this.choicesRequest?.unsubscribe(); this.shipmentRequest?.unsubscribe(); }
    changePage(delta: number): void {
        const warehouseId = this.warehouseContext.selectedWarehouseId();
        if (!warehouseId || this.loading() || this.page + delta < 1)
            return;
        this.page += delta;
        this.load(warehouseId);
    }
    constructor() {
        this.warehouseContext.warehouseSelectionChanges.pipe(distinctUntilChanged(), takeUntilDestroyed()).subscribe(warehouseId => {
            this.page = 1;
            this.returns.set([]);
            this.selectedReturn.set(null);
            this.showDetailsDialog = false;
            this.showCreateDialog = false;
            this.showRejectDialog = false;
            this.choicesRequest?.unsubscribe(); this.shipmentRequest?.unsubscribe();
            this.orderOptions.set([]); this.shipmentOptions.set([]);
            this.listRequest?.unsubscribe();
            this.hasNext.set(false);
            if (warehouseId)
                this.load(warehouseId);
            else
                this.loading.set(false);
        });
    }
    ngOnInit(): void { this.warehouseContext.initialize(); this.loadCatalogItems(); }
    load(warehouseId: string): void {
        this.listRequest?.unsubscribe();
        this.loading.set(true);
        this.listRequest = this.returnsService.getReturns(warehouseId, this.page, this.pageSize).subscribe({
            next: result => { this.returns.set(result.items); this.hasNext.set(result.hasNext); this.total.set(result.total); this.loading.set(false); },
            error: () => { this.returns.set([]); this.hasNext.set(false); this.loading.set(false); },
        });
    }
    loadCatalogItems(): void { this.catalogLoading.set(true); this.catalogItemsService.getCatalogItems({ page: 1, status: 'active' }).subscribe({ next: response => { this.catalogItems.set(response.data); this.catalogLoading.set(false); }, error: () => { this.catalogItems.set([]); this.catalogLoading.set(false); this.messages.add({ severity: 'warn', summary: 'Catalog unavailable', detail: 'Items could not be loaded from the catalog.' }); } }); }
    openCreateDialog(): void {
        const warehouseId = this.warehouseContext.selectedWarehouseId();
        if (!warehouseId) return;
        this.createForm = this.emptyCreateForm(); this.showCreateDialog = true;
        this.orderOptions.set([]); this.shipmentOptions.set([]); this.choicesLoading.set(true);
        this.choicesRequest?.unsubscribe(); this.shipmentRequest?.unsubscribe();
        this.choicesRequest = this.ordersService.getOrders(warehouseId).subscribe({
            next: result => { this.orderOptions.set(result.data.filter(o => ['shipped', 'delivered'].includes(o.status))); this.choicesLoading.set(false); },
            error: () => this.choicesLoading.set(false),
        });
    }
    selectOrder(id: string): void {
        this.createForm.originalOrderId = id;
        const order = this.selectedOrder();
        this.createForm.customerId = order?.customerId ?? '';
        this.createForm.lines = order?.lines.map(line => ({ ...this.emptyLine(), itemId: line.itemId, sku: line.sku,
            itemName: this.catalogItems().find(i => i.id === line.itemId)?.name ?? line.itemName,
            quantity: line.quantity, uomCode: line.uom, uomName: this.catalogItems().find(i => i.id === line.itemId)?.uomName || line.uom })) ?? [this.emptyLine()];
        this.loadShipments(1);
    }
    loadShipments(page: number): void {
        this.shipmentRequest?.unsubscribe(); this.shipmentOptions.set([]); this.shipmentHasNext = false;
        this.createForm.originalShipmentId = ''; this.shipmentPage = page;
        const order = this.selectedOrder();
        if (!order) { this.shipmentsLoading.set(false); return; }
        this.shipmentsLoading.set(true);
        this.shipmentRequest = this.shippingService.getShipments(order.warehouseId, page, 25).subscribe({
            next: shipments => { this.shipmentHasNext = shipments.length === 25; this.shipmentOptions.set(shipments.filter(s => s.warehouseId === order.warehouseId && s.orderIds.includes(order.id))); this.shipmentsLoading.set(false); },
            error: () => this.shipmentsLoading.set(false),
        });
    }
    canCreate(): boolean {
        const order = this.selectedOrder();
        return !this.saving() && !this.choicesLoading() && !!order && order.customerId === this.createForm.customerId &&
            (!this.createForm.originalShipmentId || this.shipmentOptions().some(s => s.id === this.createForm.originalShipmentId)) &&
            this.createForm.lines.length > 0 && this.validLines() && this.createForm.lines.every(line => order.lines.some(l => l.itemId === line.itemId)) &&
            order.lines.every(line => this.createForm.lines.filter(l => l.itemId === line.itemId).reduce((sum, l) => sum + l.quantity, 0) <= line.quantity);
    }
    addLine(): void { this.createForm.lines.push(this.emptyLine()); }
    removeLine(index: number): void { if (this.createForm.lines.length > 1)
        this.createForm.lines.splice(index, 1); }
    onItemSelected(line: ReturnLineForm, itemId: string): void { const item = this.catalogItems().find(candidate => candidate.id === itemId); if (!item)
        return; line.itemId = item.id; line.sku = item.sku; line.itemName = item.name; line.uomCode = item.uom; line.uomName = item.uomName || item.uom; }
    createReturn(): void { const warehouseId = this.warehouseContext.selectedWarehouseId(); if (!warehouseId || !this.canCreate())
        return; const body: CreateReturnAuthorizationDto = { originalOrderId: this.createForm.originalOrderId.trim(), originalShipmentId: this.createForm.originalShipmentId.trim() || null, customerId: this.createForm.customerId.trim(), warehouseId, notes: this.createForm.notes.trim() || null, lines: this.createForm.lines.map(line => ({ ...line, itemId: line.itemId.trim(), sku: line.sku.trim(), itemName: line.itemName.trim(), uomCode: line.uomCode.trim(), uomName: line.uomName.trim(), reasonCode: line.reasonCode.trim(), notes: line.notes.trim() || null })) }; this.run(this.returnsService.createReturn(body), 'Return authorization created.', () => this.showCreateDialog = false); }
    openDetails(item: ReturnAuthorization): void { this.showDetailsDialog = true; this.selectedReturn.set(item); this.returnsService.getReturn(item.id).subscribe({ next: detail => this.selectedReturn.set(detail) }); }
    canMutate(ret: ReturnAuthorization): boolean { return !this.saving() && !ret.closedAt && canEditReturn(ret.status); }
    authorize(ret: ReturnAuthorization): void { if (!this.canMutate(ret)) return; const id = this.userId(); if (id)
        this.run(this.returnsService.authorize(ret.id, id), 'Return authorized.'); }
    awaitingReceipt(ret: ReturnAuthorization): void { if (!this.canMutate(ret)) return; this.run(this.returnsService.awaitingReceipt(ret.id), 'Return marked awaiting receipt.'); }
    openReject(): void { const ret = this.selectedReturn(); if (!ret || !this.canMutate(ret)) return; this.rejectionReason = ''; this.showRejectDialog = true; }
    reject(): void { const ret = this.selectedReturn(); if (ret && this.canMutate(ret) && this.rejectionReason.trim())
        this.run(this.returnsService.reject(ret.id, this.rejectionReason.trim()), 'Return rejected.', () => this.showRejectDialog = false); }
    receive(ret: ReturnAuthorization): void { if (!this.canMutate(ret)) return; const id = this.userId(); if (id)
        this.run(this.returnsService.receive(ret.id, ret.lines.map(line => ({ lineId: line.id, receivedQuantity: line.receivedQuantity || line.quantity })), id), 'Return received.'); }
    inspect(ret: ReturnAuthorization, lineId: string, condition: string): void { if (!this.canMutate(ret)) return; this.run(this.returnsService.inspect(ret.id, lineId, condition), 'Inspection saved.'); }
    disposition(ret: ReturnAuthorization, line: ReturnAuthorization['lines'][number]): void { if (!this.canMutate(ret)) return; const id = this.userId(); if (id)
        this.run(this.returnsService.disposition(ret.id, line.id, { dispositionType: 'Restock', dispositionedQuantity: line.receivedQuantity || line.quantity, decidedByUserId: id }), 'Disposition saved.'); }
    close(ret: ReturnAuthorization): void { if (!this.canMutate(ret)) return; this.run(this.returnsService.close(ret.id), 'Return closed.', () => this.showDetailsDialog = false); }
    statusLabel(status: number | string): string { const map: Record<string, string> = { '0': 'Created', '1': 'Authorized', '2': 'Awaiting Receipt', '3': 'Rejected', '4': 'Received', '5': 'Dispositioned', '6': 'Closed' }; return map[String(status).toLowerCase()] ?? String(status).replace(/([a-z])([A-Z])/g, '$1 $2'); }
    severity(status: number | string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' { const value = String(status); return value === '6' ? 'success' : value === '3' ? 'danger' : value === '2' || value === '4' ? 'warning' : 'info'; }
    shortId(id: string | null | undefined): string { return id ?? '—'; }
    private run(request: Observable<ReturnAuthorization>, success: string, after?: () => void): void { this.saving.set(true); request.subscribe({ next: updated => { this.saving.set(false); this.selectedReturn.set(updated); this.upsert(updated); after?.(); this.messages.add({ severity: 'success', summary: 'Returns', detail: success }); }, error: () => this.saving.set(false) }); }
    private upsert(_updated: ReturnAuthorization): void { const warehouseId = this.warehouseContext.selectedWarehouseId(); if (warehouseId)
        this.load(warehouseId); }
    private userId(): string | null { const id = this.auth.getCurrentUser()?.id; if (!id)
        this.messages.add({ severity: 'warn', summary: 'Returns', detail: 'Your user identity is required for this action.' }); return id ?? null; }
    private validLines(): boolean { return this.createForm.lines.every(line => !!(line.itemId.trim() && line.sku.trim() && line.itemName.trim() && line.quantity > 0 && line.uomCode.trim() && line.uomName.trim() && line.reasonCode.trim())); }
    private emptyLine(): ReturnLineForm { return { itemId: '', sku: '', itemName: '', quantity: 1, uomCode: 'EA', uomName: 'Each', reasonCode: '', notes: '' }; }
    private emptyCreateForm(): {
        originalOrderId: string;
        originalShipmentId: string;
        customerId: string;
        notes: string;
        lines: ReturnLineForm[];
    } { return { originalOrderId: '', originalShipmentId: '', customerId: '', notes: '', lines: [this.emptyLine()] }; }
}
