import { Subject, takeUntil } from 'rxjs';
import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SkeletonModule } from 'primeng/skeleton';
import { TooltipModule } from 'primeng/tooltip';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { FormsModule } from '@angular/forms';
import { MessageService } from 'primeng/api';
import { ReceivingService } from './receiving.service';
import { ASN } from '../../core/models/order.model';
import { CreateAsnDto } from './asn.model';
import { AuthService } from '../../core/auth/auth.service';
import { CreateInboundShipmentDto, InboundShipment } from './inbound-shipment.model';
import { PutawayRecommendation, PutawayRecommendationRequest, PutawayTask } from './putaway.model';
import { PutawayService } from './putaway.service';
import { CatalogItemsService } from '../inventory/catalog-items.service';
import { InventoryItem } from '../../core/models/inventory.model';
import { AdminService } from '../admin/admin.service';
import { AdminUser } from '../../core/models/admin.model';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';
import { StorageLocationService } from '../inventory/storage-location.service';
import { StorageLocation } from '../inventory/storage-location.model';



import { CreateAsnLineFormLine, CreateAsnForm, InboundLineForm, InboundShipmentForm, PutawayRecommendationForm } from './receiving-forms.model';

@Component({
  selector: 'app-receiving',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule, FormsModule, TranslateModule,
    TableModule, ButtonModule, TagModule,
    DialogModule, InputTextModule, InputNumberModule,
    SkeletonModule, TooltipModule, DropdownModule, CalendarModule,
  ],
  templateUrl: './receiving.component.html',
  styleUrl: './receiving.component.scss',})
export class ReceivingComponent implements OnInit {
  private receivingService = inject(ReceivingService);
  private messageService = inject(MessageService);
  private authService = inject(AuthService);
  private putawayService = inject(PutawayService);
  private catalogItemsService = inject(CatalogItemsService);
  private adminService = inject(AdminService);
  private warehouseContext = inject(WarehouseContextService);
  private destroyRef = inject(DestroyRef);
  private warehouseChanged = new Subject<void>();
  private locationsService = inject(StorageLocationService);
  putawayBins = signal<StorageLocation[]>([]);
  putawayBinsLoading = signal(false);
  readonly currentUserName = this.authService.getCurrentUser()?.name ?? this.authService.getCurrentUser()?.username ?? '';
  readonly isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value.trim());

  knownSuppliers = computed(() => [...new Map(this.asns().map(asn => [asn.supplierId, { id: asn.supplierId, name: asn.supplierName }])).values()]);

  selectSupplier(id: string): void {
    const supplier = this.knownSuppliers().find(s => s.id === id);
    this.createForm.supplierId = supplier?.id ?? '';
    this.createForm.supplierName = supplier?.name ?? '';
  }

  receivableAsns(): ASN[] { return this.asns().filter(a => a.status !== 'cancelled' && a.items.some(i => i.receivedQty < i.expectedQty)); }

  asns = signal<ASN[]>([]);
  putawayTasks = signal<PutawayTask[]>([]);
  putawayLoading = signal(false);
  putawayActionLoading = signal<string | null>(null);
  putawayReconciliationWarning = signal<string | null>(null);
  loading = signal(false);
  creatingAsn = signal(false);
  activeTab = signal<'asn' | 'putaway' | 'recommendation' | 'inbound'>('asn');
  asnStatusFilter = signal<string>('');
  selectedWarehouseId = '';
  expandedRows: Record<string, boolean> = {};
  showCreateAsn = false;
  inboundShipments = signal<InboundShipment[]>([]);
  inboundLoading = signal(false);
  inboundPendingOnly = signal(false);
  selectedInboundShipment = signal<InboundShipment | null>(null);
  showCreateInboundShipment = false;
  showInboundDetails = false;
  creatingInboundShipment = signal(false);
  completingInboundShipment = signal(false);
  inboundForm = this.emptyInboundShipmentForm();
  discrepancyForm = { lineId: '', type: '', description: '' };
  inspectionForm = { result: '', notes: '' };
  showCompletePutaway = false;
  selectedPutawayTask = signal<PutawayTask | null>(null);
  completePutawayForm = { actualBinId: '', overrideReason: '' };
  showAssignPutaway = false;
  assignedPutawayTask = signal<PutawayTask | null>(null);
  putawayOperators = signal<AdminUser[]>([]);
  putawayOperatorsLoading = signal(false);
  selectedPutawayOperatorId = '';
  recommendationForm = this.emptyRecommendationForm();
  recommendation = signal<PutawayRecommendation | null>(null);
  recommendationLoading = signal(false);
  catalogItems = signal<InventoryItem[]>([]);
  catalogItemsLoading = signal(false);

  createForm = this.emptyCreateForm();

  statusFilters = [
    { label: 'All', value: '' },
    { label: 'Expected', value: 'expected' },
    { label: 'Partial', value: 'partially_received' },
    { label: 'Complete', value: 'complete' },
  ];

  filteredAsns = signal<ASN[]>([]);

  pendingPutaway(): number {
    return this.putawayTasks().filter(t => t.status.toLowerCase() === 'pending').length;
  }

  isPutawayFinished(task: PutawayTask): boolean {
    return task.status.toLowerCase() === 'completed' || !!task.completedAt;
  }

  putawaySeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' {
    const value = status.toLowerCase();
    return value === 'completed' ? 'success' : value === 'overridden' ? 'warning' : value === 'pending' ? 'info' : 'secondary';
  }

  constructor() {
    this.warehouseContext.warehouseSelectionChanges.pipe(takeUntilDestroyed()).subscribe(warehouseId => {
      const nextWarehouseId = warehouseId ?? '';
      if (nextWarehouseId === this.selectedWarehouseId) return;
      this.selectedWarehouseId = nextWarehouseId;
      this.onWarehouseChange();
    });
  }

  ngOnInit(): void {
    this.warehouseContext.initialize();
    this.loadCatalogItems();
  }

  loadCatalogItems(): void {
    this.catalogItemsLoading.set(true);
    this.catalogItemsService.getCatalogItems({ page: 1 }).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        this.catalogItems.set(response.data.filter(item => item.status === 'active'));
        this.catalogItemsLoading.set(false);
      },
      error: () => { this.catalogItems.set([]); this.catalogItemsLoading.set(false); },
    });
  }

  onRecommendationItemChange(itemId: string): void {
    const item = this.catalogItems().find(candidate => candidate.id === itemId);
    if (!item) return;

    this.recommendationForm.itemId = item.id;
    this.recommendationForm.sku = item.sku;
    this.recommendationForm.itemName = item.name;
    this.recommendationForm.uomCode = item.uom;
    this.recommendationForm.uomName = item.uomName || item.uom;
    this.recommendation.set(null);
  }

  onCreateAsnItemChange(line: CreateAsnLineFormLine, itemId: string): void {
    const item = this.catalogItems().find(candidate => candidate.id === itemId);
    if (!item) return;

    line.itemId = item.id;
    line.sku = item.sku;
    line.itemName = item.name;
    line.uomCode = item.uom;
    line.uomName = item.uomName || item.uom;
  }

  onInboundItemChange(line: InboundLineForm, itemId: string): void {
    const item = this.catalogItems().find(candidate => candidate.id === itemId);
    if (!item) return;

    line.itemId = item.id;
    line.sku = item.sku;
    line.itemName = item.name;
    line.uomCode = item.uom;
    line.uomName = item.uomName || item.uom;
  }

  onWarehouseChange(): void {
    this.warehouseChanged.next();
    this.putawayReconciliationWarning.set(null);
    this.asns.set([]); this.inboundShipments.set([]); this.putawayTasks.set([]); this.recommendation.set(null);
    this.showCreateAsn = this.showCreateInboundShipment = this.showInboundDetails = this.showCompletePutaway = this.showAssignPutaway = false;

    this.expandedRows = {};
    this.loadASNs();
    this.loadInboundShipments();
    this.loadPutaway();
  }

  setStatusFilter(value: string): void {
    this.asnStatusFilter.set(value);
    this.applyStatusFilter();
  }

  loadASNs(): void {
    if (!this.selectedWarehouseId) {
      this.asns.set([]);
      this.applyStatusFilter();
      return;
    }

    this.loading.set(true);
    this.receivingService.getASNs(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: list => {
        this.asns.set(list);
        this.applyStatusFilter();
        this.loading.set(false);
      },
      error: () => {
        this.asns.set([]);
        this.applyStatusFilter();
        this.loading.set(false);
      },
    });
  }

  loadInboundShipments(): void {
    if (!this.selectedWarehouseId) { this.inboundShipments.set([]); this.inboundLoading.set(false); return; }
    this.inboundLoading.set(true);
    const request = this.inboundPendingOnly()
      ? this.receivingService.getPendingInboundShipments(this.selectedWarehouseId)
      : this.receivingService.getInboundShipments(this.selectedWarehouseId);
    request.pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: shipments => {
        this.inboundShipments.set(this.selectedWarehouseId ? shipments.filter(s => s.warehouseId === this.selectedWarehouseId) : shipments);
        this.inboundLoading.set(false);
      },
      error: () => { this.inboundShipments.set([]); this.inboundLoading.set(false); },
    });
  }

  setInboundPendingOnly(value: boolean): void {
    this.inboundPendingOnly.set(value);
    this.loadInboundShipments();
  }

  openCreateInboundShipment(): void {
    this.inboundForm = this.emptyInboundShipmentForm();
    this.showCreateInboundShipment = true;
  }

  onInboundAsnChange(asnId: string | null | undefined): void {
    const asn = this.asns().find(candidate => candidate.id === asnId);
    if (!asn) {
      this.inboundForm.asnId = '';
      this.inboundForm.lines = [this.emptyInboundLine()];
      return;
    }

    this.inboundForm.asnId = asn.id;
    this.inboundForm.lines = asn.items.filter(item => item.expectedQty > item.receivedQty).map(item => ({
      itemId: item.itemId,
      sku: item.sku,
      itemName: item.itemName,
      receivedQuantity: Math.max(item.expectedQty - item.receivedQty, 0),
      uomCode: item.uomCode || item.uom,
      uomName: item.uomName || item.uom,
      lotNumber: item.lotNumber || '',
      serialNumber: '',
      expirationDate: item.expirationDate ? new Date(item.expirationDate) : null,
      condition: 'Good',
      receivedBy: this.authService.getCurrentUser()?.id ?? '',
    }));
  }

  addInboundLine(): void { this.inboundForm.lines.push(this.emptyInboundLine()); }

  removeInboundLine(index: number): void { this.inboundForm.lines.splice(index, 1); }

  canCreateInboundShipment(): boolean {
    return !!this.selectedWarehouseId && this.inboundForm.lines.length > 0 && this.inboundForm.lines.every(line =>
      line.itemId.trim() && line.sku.trim() && line.itemName.trim() && line.receivedQuantity > 0 &&
      line.uomCode.trim() && line.uomName.trim() && line.condition.trim() && line.receivedBy.trim());
  }

  submitCreateInboundShipment(): void {
    if (this.creatingInboundShipment() || !this.canCreateInboundShipment()) return;
    const body: CreateInboundShipmentDto = {
      warehouseId: this.selectedWarehouseId,
      asnId: this.inboundForm.asnId.trim() || undefined,
      lines: this.inboundForm.lines.map(line => ({
        itemId: line.itemId.trim(), sku: line.sku.trim(), itemName: line.itemName.trim(),
        receivedQuantity: line.receivedQuantity, uomCode: line.uomCode.trim(), uomName: line.uomName.trim(),
        lotNumber: line.lotNumber?.trim() || undefined, serialNumber: line.serialNumber?.trim() || undefined,
        expirationDate: line.expirationDate ? this.toIsoString(line.expirationDate) : undefined,
        condition: line.condition.trim(), receivedBy: line.receivedBy.trim(),
      })),
    };
    this.creatingInboundShipment.set(true);
    this.receivingService.createInboundShipment(body).subscribe({
      next: shipment => {
        this.creatingInboundShipment.set(false); this.showCreateInboundShipment = false;
        this.messageService.add({ severity: 'success', summary: 'Shipment Created', detail: 'Inbound shipment was created.' });
        this.openInboundDetails(shipment.id); this.loadInboundShipments(); this.loadASNs();
      },
      error: () => this.creatingInboundShipment.set(false),
    });
  }

  openInboundDetails(id: string): void {
    this.receivingService.getInboundShipment(id).subscribe({
      next: shipment => { this.selectedInboundShipment.set(shipment); this.discrepancyForm = { lineId: '', type: '', description: '' }; this.inspectionForm = { result: '', notes: '' }; this.showInboundDetails = true; },
    });
  }

  addDiscrepancy(): void {
    const shipment = this.selectedInboundShipment();
    const reportedBy = this.authService.getCurrentUser()?.id ?? '';
    if (!shipment || !this.discrepancyForm.lineId || !this.discrepancyForm.type.trim() || !this.discrepancyForm.description.trim() || !reportedBy) return;
    this.receivingService.addInboundShipmentDiscrepancy(shipment.id, { ...this.discrepancyForm, type: this.discrepancyForm.type.trim(), description: this.discrepancyForm.description.trim(), reportedBy }).subscribe(() => this.refreshInboundDetails(shipment.id));
  }

  addInspection(): void {
    const shipment = this.selectedInboundShipment();
    const inspectedBy = this.authService.getCurrentUser()?.id ?? '';
    if (!shipment || !this.inspectionForm.result.trim() || !inspectedBy) return;
    this.receivingService.addInboundShipmentInspection(shipment.id, { inspectedBy, result: this.inspectionForm.result.trim(), notes: this.inspectionForm.notes.trim() || undefined }).subscribe(() => this.refreshInboundDetails(shipment.id));
  }

  completeReceiving(): void {
    const shipment = this.selectedInboundShipment();
    if (!shipment) return;
    this.completingInboundShipment.set(true);
    this.receivingService.completeInboundShipmentReceiving(shipment.id).subscribe({
      next: () => { this.completingInboundShipment.set(false); this.refreshInboundDetails(shipment.id); this.loadInboundShipments(); this.messageService.add({ severity: 'success', summary: 'Receiving Complete', detail: 'The inbound shipment has been completed.' }); },
      error: () => this.completingInboundShipment.set(false),
    });
  }

  inboundSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' { const value = status.toLowerCase(); return value.includes('complete') ? 'success' : value.includes('progress') ? 'warning' : 'info'; }

  shortId(value: string | null | undefined): string { return value ? value.slice(0, 8).toUpperCase() : '—'; }

  asnNumber(asnId: string | null | undefined): string {
    if (!asnId) return '—';
    return this.asns().find(asn => asn.id === asnId)?.asnNumber ?? this.shortId(asnId);
  }

  inboundShipmentLabel(shipment: InboundShipment): string {
    return `IN-${this.shortId(shipment.id)}`;
  }

  private refreshInboundDetails(id: string): void { this.receivingService.getInboundShipment(id).subscribe(shipment => { this.selectedInboundShipment.set(shipment); this.discrepancyForm = { lineId: '', type: '', description: '' }; this.inspectionForm = { result: '', notes: '' }; }); }

  applyStatusFilter(): void {
    const filter = this.asnStatusFilter();
    const list = filter
      ? this.asns().filter(a => a.status === filter)
      : this.asns();
    this.filteredAsns.set(list);
  }

  toggleAsnRow(asn: ASN): void {
    if (this.expandedRows[asn.id]) {
      delete this.expandedRows[asn.id];
    } else {
      this.expandedRows[asn.id] = true;
    }
    this.expandedRows = { ...this.expandedRows };
  }

  loadPutaway(): void {
    if (!this.selectedWarehouseId) {
      this.putawayTasks.set([]);
      return;
    }
    this.putawayLoading.set(true);
    this.putawayService.getTasks(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tasks => { this.putawayTasks.set(tasks); this.putawayLoading.set(false); },
      error: () => { this.putawayTasks.set([]); this.putawayLoading.set(false); },
    });
  }

  canRequestRecommendation(): boolean {
    const form = this.recommendationForm;
    return !!(this.selectedWarehouseId && form.itemId.trim() && form.sku.trim() && form.itemName.trim() &&
      form.quantity > 0 && form.uomCode.trim() && form.uomName.trim());
  }

  requestRecommendation(): void {
    if (!this.canRequestRecommendation()) return;
    const form = this.recommendationForm;
    const request: PutawayRecommendationRequest = {
      warehouseId: this.selectedWarehouseId,
      itemId: form.itemId.trim(),
      sku: form.sku.trim(),
      itemName: form.itemName.trim(),
      quantity: form.quantity,
      uomCode: form.uomCode.trim(),
      uomName: form.uomName.trim(),
      lotNumber: form.lotNumber.trim() || undefined,
      expirationDate: form.expirationDate ? this.toIsoString(form.expirationDate) : undefined,
    };

    this.recommendationLoading.set(true);
    this.recommendation.set(null);
    this.putawayService.recommend(request).subscribe({
      next: recommendation => { this.recommendation.set(recommendation); this.recommendationLoading.set(false); },
      error: () => this.recommendationLoading.set(false),
    });
  }

  recommendationMode(value: string | number | null | undefined): string {
    // Numeric enum values are not documented; do not guess a stock-rotation strategy.
    return typeof value === 'string' ? value : '';
  }

  openReceiveWizard(asn?: ASN): void {
    this.openCreateInboundShipment();
    if (asn) this.onInboundAsnChange(asn.id);
  }

  openCreateAsnDialog(): void {
    this.createForm = this.emptyCreateForm();
    this.showCreateAsn = true;
  }

  addCreateLine(): void {
    this.createForm.lines.push(this.emptyCreateLine());
  }

  removeCreateLine(index: number): void {
    this.createForm.lines.splice(index, 1);
  }

  canCreateAsn(): boolean {
    return !!(
      this.selectedWarehouseId &&
      this.isUuid(this.createForm.supplierId) &&
      this.createForm.supplierName.trim() &&
      this.createForm.expectedArrivalDate &&
      this.createForm.lines.length > 0 &&
      this.createForm.lines.every(line =>
        line.itemId.trim() &&
        line.sku.trim() &&
        line.itemName.trim() &&
        line.expectedQuantity > 0 &&
        line.uomCode.trim() &&
        line.uomName.trim()
      )
    );
  }

  submitCreateAsn(): void {
    if (this.creatingAsn() || !this.canCreateAsn()) return;

    const body: CreateAsnDto = {
      warehouseId: this.selectedWarehouseId,
      supplierId: this.createForm.supplierId.trim(),
      supplierName: this.createForm.supplierName.trim(),
      expectedArrivalDate: this.toIsoString(this.createForm.expectedArrivalDate)!,
      notes: this.createForm.notes.trim() || undefined,
      lines: this.createForm.lines.map(line => ({
        itemId: line.itemId.trim(),
        sku: line.sku.trim(),
        itemName: line.itemName.trim(),
        expectedQuantity: line.expectedQuantity,
        uomCode: line.uomCode.trim(),
        uomName: line.uomName.trim(),
        lotNumber: line.lotNumber?.trim() || undefined,
        expirationDate: line.expirationDate ? this.toIsoString(line.expirationDate) : undefined,
      })),
    };

    this.creatingAsn.set(true);
    this.receivingService.createASN(body).subscribe({
      next: asn => {
        this.creatingAsn.set(false);
        this.showCreateAsn = false;
        this.messageService.add({ severity: 'success', summary: 'ASN Created', detail: `ASN ${asn.id.slice(0, 8).toUpperCase()} was created successfully.`, life: 4000 });
        this.loadASNs();
      },
      error: () => this.creatingAsn.set(false),
    });
  }

  generatePutawayTasks(shipment: InboundShipment): void {
    this.putawayActionLoading.set(`generate-${shipment.id}`);
    this.putawayService.generateForShipment(shipment.id).subscribe({
      next: () => { this.putawayActionLoading.set(null); this.loadPutaway(); this.messageService.add({ severity: 'success', summary: 'Putaway Tasks Generated', detail: 'Tasks were generated for this shipment.' }); },
      error: () => this.putawayActionLoading.set(null),
    });
  }

  openAssignPutaway(task: PutawayTask): void {
    this.assignedPutawayTask.set(task);
    this.selectedPutawayOperatorId = task.assignedTo ?? '';
    this.showAssignPutaway = true;
    this.putawayOperatorsLoading.set(true);
    this.adminService.getUsers().subscribe({
      next: users => {
        this.putawayOperators.set(this.getAssignableOperators(users));
        this.putawayOperatorsLoading.set(false);
      },
      error: () => { this.putawayOperators.set([]); this.putawayOperatorsLoading.set(false); },
    });
  }

  assignPutaway(): void {
    const task = this.assignedPutawayTask();
    const operatorId = this.selectedPutawayOperatorId;
    if (!task || !operatorId || this.putawayActionLoading() || this.isPutawayFinished(task)) return;
    this.putawayActionLoading.set(task.id);
    this.putawayService.assign(task.id, { operatorId }).subscribe({
      next: () => {
        this.putawayActionLoading.set(null);
        this.showAssignPutaway = false;
        this.loadPutaway();
        this.messageService.add({ severity: 'success', summary: 'Task Assigned', detail: 'The selected operator has been assigned.' });
      },
      error: () => this.putawayActionLoading.set(null),
    });
  }

  startPutaway(task: PutawayTask): void {
    if (!task.assignedTo || task.startedAt || this.isPutawayFinished(task) || this.putawayActionLoading()) return;
    this.putawayActionLoading.set(task.id);
    this.putawayService.start(task.id).subscribe({
      next: () => { this.putawayActionLoading.set(null); this.loadPutaway(); },
      error: () => this.putawayActionLoading.set(null),
    });
  }

  openCompletePutaway(task: PutawayTask): void {
    if (!task.startedAt || this.isPutawayFinished(task) || this.putawayReconciliationWarning() === task.id) return;
    this.selectedPutawayTask.set(task);
    this.completePutawayForm = { actualBinId: task.actualBinId ?? task.recommendedBinId ?? '', overrideReason: '' };
    this.showCompletePutaway = true;
    this.putawayBins.set([]);
    this.putawayBinsLoading.set(true);
    this.locationsService.getStorageLocations(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
      next: bins => { this.putawayBins.set(bins.filter(b => b.isActive && b.status.toLowerCase() === 'available')); this.putawayBinsLoading.set(false); },
      error: () => this.putawayBinsLoading.set(false),
    });
  }

  canCompletePutaway(): boolean {
    const task = this.selectedPutawayTask();
    return !!task?.startedAt && !!task.assignedTo && !this.isPutawayFinished(task) && this.putawayReconciliationWarning() !== task.id && !this.putawayActionLoading() &&
      this.putawayBins().some(b => b.id === this.completePutawayForm.actualBinId) &&
      (this.completePutawayForm.actualBinId === task.recommendedBinId || !!this.completePutawayForm.overrideReason.trim());
  }

  completePutaway(): void {
    const task = this.selectedPutawayTask();
    const operatorId = task?.assignedTo;
    if (!task || !operatorId || !this.canCompletePutaway()) return;
    this.putawayActionLoading.set(task.id);
    this.putawayService.complete(task.id, {
      operatorId,
      actualBinId: this.completePutawayForm.actualBinId.trim(),
      overrideReason: this.completePutawayForm.overrideReason.trim() || undefined,
    }).subscribe({
      next: () => { this.putawayActionLoading.set(null); this.showCompletePutaway = false; this.loadPutaway(); this.messageService.add({ severity: 'success', summary: 'Putaway Complete', detail: 'The putaway task was completed.' }); },
      error: () => {
        // A failed response can still leave server state committed. Never retry blindly.
        this.putawayService.getTasks(this.selectedWarehouseId).pipe(takeUntil(this.warehouseChanged), takeUntilDestroyed(this.destroyRef)).subscribe({
          next: tasks => {
            this.putawayTasks.set(tasks);
            this.putawayActionLoading.set(null);
            this.showCompletePutaway = false;
            this.putawayReconciliationWarning.set(task.id);
          },
          error: () => { this.putawayActionLoading.set(null); this.showCompletePutaway = false; this.putawayReconciliationWarning.set(task.id); },
        });
      },
    });
  }

  getASNStatusLabel(status: string): string {
    const map: Record<string, string> = {
      expected: 'Expected',
      partially_received: 'Partial',
      complete: 'Complete',
      cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }

  getASNSeverity(status: string): 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast' {
    const map: Record<string, 'success' | 'info' | 'warning' | 'danger' | 'secondary' | 'contrast'> = {
      expected: 'info',
      partially_received: 'warning',
      complete: 'success',
      cancelled: 'danger',
    };
    return map[status] ?? 'secondary';
  }

  private emptyCreateForm(): CreateAsnForm {
    return {
      supplierId: '',
      supplierName: '',
      expectedArrivalDate: null,
      notes: '',
      lines: [this.emptyCreateLine()],
    };
  }

  private emptyCreateLine(): CreateAsnLineFormLine {
    return {
      itemId: '',
      sku: '',
      itemName: '',
      expectedQuantity: 1,
      uomCode: '',
      uomName: '',
      lotNumber: '',
      expirationDate: null,
    };
  }

  private emptyInboundShipmentForm(): InboundShipmentForm { return { asnId: '', lines: [this.emptyInboundLine()] }; }

  private emptyInboundLine(): InboundLineForm { return { itemId: '', sku: '', itemName: '', receivedQuantity: 1, uomCode: '', uomName: '', lotNumber: '', serialNumber: '', expirationDate: null, condition: 'Good', receivedBy: this.authService.getCurrentUser()?.id ?? '' }; }

  private emptyRecommendationForm(): PutawayRecommendationForm {
    return { itemId: '', sku: '', itemName: '', quantity: 1, uomCode: 'EA', uomName: 'Each', lotNumber: '', expirationDate: null };
  }

  private getAssignableOperators(users: AdminUser[]): AdminUser[] {
    const activeWarehouseUsers = users.filter(user =>
      user.status === 'active' && (!user.warehouseId || user.warehouseId === this.selectedWarehouseId),
    );
    const operators = activeWarehouseUsers.filter(user =>
      `${user.role} ${user.roles.map(role => role.roleName).join(' ')}`.toLowerCase().includes('operator'),
    );
    return operators.length ? operators : activeWarehouseUsers;
  }

  private toIsoString(value: Date | string | null): string | undefined {
    if (!value) return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return date.toISOString();
  }
}
