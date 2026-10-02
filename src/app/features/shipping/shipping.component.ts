import { canShipmentAction } from '../../shared/utils/workflow-actions';
import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageService } from 'primeng/api';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';
import { AuthService } from '../../core/auth/auth.service';
import { CarrierAssignment, DeliveryRequest, LabelRequest, OutboundShipment, ShipmentPackage, ShippingService } from './shipping.service';
type Action = 'carrier' | 'label' | 'manifest' | 'dispatch' | 'transit' | 'delivery' | 'fail';
@Component({ selector: 'app-shipping', standalone: true, imports: [UiLabelPipe, UiOptionsPipe, TranslateModule, CommonModule, FormsModule, TableModule, ButtonModule, TagModule, DialogModule, InputTextModule], templateUrl: './shipping.component.html', styleUrl: './shipping.component.scss' })
export class ShippingComponent implements OnInit {
    private shipping = inject(ShippingService);
    private warehouses = inject(WarehouseContextService);
    private auth = inject(AuthService);
    private messages = inject(MessageService);
    shipments = signal<OutboundShipment[]>([]);
    loading = signal(true);
    actionLoading = signal<Action | null>(null);
    selected = signal<OutboundShipment | null>(null);
    selectedWarehouseId = '';
    showDetails = false;
    activeAction: Action | null = null;
    carrier: CarrierAssignment = this.emptyCarrier();
    label: LabelRequest = { packageId: '', trackingNumber: '', labelUrl: '', format: 'PDF' };
    manifestNumber = '';
    dispatchForm = { scanData: '', photoUrl: '' };
    delivery: DeliveryRequest = { receivedBy: '', signatureUrl: '', photoUrl: '' };
    failReason = '';
    constructor() { this.warehouses.warehouseSelectionChanges.pipe(takeUntilDestroyed()).subscribe(id => { this.selectedWarehouseId = id ?? ''; this.loadShipments(); }); }
    ngOnInit(): void { this.warehouses.initialize(); }
    loadShipments(): void { if (!this.selectedWarehouseId) {
        this.shipments.set([]);
        this.loading.set(false);
        return;
    } this.loading.set(true); this.shipping.getShipments(this.selectedWarehouseId).subscribe({ next: s => { this.shipments.set(s); this.loading.set(false); }, error: () => { this.shipments.set([]); this.loading.set(false); } }); }
    openDetails(s: OutboundShipment): void { this.selected.set(s); this.carrier = { carrierId: s.carrierId, carrierName: s.carrierName ?? '', street: s.shippingAddressStreet ?? '', city: s.shippingAddressCity ?? '', region: s.shippingAddressRegion ?? '', postalCode: s.shippingAddressPostalCode ?? '', country: s.shippingAddressCountry ?? '', estimatedDeliveryDate: s.estimatedDeliveryDate }; this.label = { packageId: s.packages[0]?.id ?? '', trackingNumber: s.packages[0]?.trackingNumber ?? '', labelUrl: '', format: 'PDF' }; this.manifestNumber = s.manifestNumber ?? ''; this.activeAction = null; this.showDetails = true; }
    canAction(action: Action): boolean { const s = this.selected(); return !!s && !this.actionLoading() && canShipmentAction(s.status, action); }
    submit(action: Action): void { const s = this.selected(); if (!s || !this.canAction(action))
        return; let request; if (action === 'carrier')
        request = this.shipping.assignCarrier(s.id, this.carrier);
    else if (action === 'label') {
        if (!this.label.packageId || !this.label.trackingNumber)
            return;
        request = this.shipping.createLabel(s.id, this.label);
    }
    else if (action === 'manifest') {
        if (!this.manifestNumber.trim())
            return;
        request = this.shipping.createManifest(s.id, this.manifestNumber.trim());
    }
    else if (action === 'dispatch') {
        const userId = this.auth.getCurrentUser()?.id;
        if (!userId) {
            this.messages.add({ severity: 'warn', summary: 'Shipping', detail: 'Your user identity is required to dispatch.' });
            return;
        }
        request = this.shipping.dispatch(s.id, { confirmedByUserId: userId, ...this.dispatchForm });
    }
    else if (action === 'transit')
        request = this.shipping.markInTransit(s.id);
    else if (action === 'delivery') {
        if (!this.delivery.receivedBy.trim())
            return;
        request = this.shipping.recordDelivery(s.id, this.delivery);
    }
    else {
        if (!this.failReason.trim())
            return;
        request = this.shipping.fail(s.id, this.failReason.trim());
    } this.actionLoading.set(action); request.subscribe({ next: () => { this.actionLoading.set(null); this.showDetails = false; this.messages.add({ severity: 'success', summary: 'Shipping', detail: 'Shipment updated.' }); this.loadShipments(); }, error: () => this.actionLoading.set(null) }); }
    shipmentLabel(s: OutboundShipment): string { return s.manifestNumber || this.tracking(s) || `Shipment created ${new Date(s.createdAt).toLocaleDateString()}`; }
    packageLabel(p: ShipmentPackage): string { return p.trackingNumber || 'Unlabeled package'; }
    tracking(s: OutboundShipment): string { return s.packages.map(p => p.trackingNumber).filter(Boolean).join(', ') || ''; }
    statusLabel(status: number | string): string { const labels: Record<number, string> = { 0: 'Pending', 1: 'Carrier Assigned', 2: 'Manifested', 3: 'Dispatched', 4: 'In Transit', 5: 'Delivered', 6: 'Failed' }; return typeof status === 'number' ? labels[status] ?? `Status ${status}` : status.replace(/[_-]/g, ' '); }
    severity(status: number | string): 'success' | 'info' | 'warning' | 'danger' { const text = this.statusLabel(status).toLowerCase(); return text.includes('deliver') ? 'success' : text.includes('fail') ? 'danger' : text.includes('pending') ? 'warning' : 'info'; }
    private emptyCarrier(): CarrierAssignment { return { carrierId: null, carrierName: '', street: '', city: '', region: '', postalCode: '', country: '', estimatedDeliveryDate: null }; }
}
