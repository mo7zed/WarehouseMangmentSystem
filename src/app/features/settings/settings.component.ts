import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
// src/app/features/settings/settings.component.ts

import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { TabViewModule } from 'primeng/tabview';
import { ButtonModule } from 'primeng/button';
import { TableModule } from 'primeng/table';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { DialogModule } from 'primeng/dialog';
import { SkeletonModule } from 'primeng/skeleton';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DividerModule } from 'primeng/divider';
import { MessageService, ConfirmationService } from 'primeng/api';
import { SettingsService } from './settings.service';
import { Warehouse } from './warehouse.model';
import { WarehouseSetupWizardComponent } from './warehouse-setup-wizard.component';
import {
  PageShellComponent,
  PageHeaderComponent,
  FiltersBarComponent,
  SectionCardComponent,
} from '../../shared/ui';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    TranslateModule,
    TabViewModule,
    ButtonModule,
    TableModule,
    InputTextModule,
    InputNumberModule,
    DialogModule,
    SkeletonModule,
    TagModule,
    TooltipModule,
    ConfirmDialogModule,
    DividerModule,
    WarehouseSetupWizardComponent,
    PageShellComponent,
    PageHeaderComponent,
    FiltersBarComponent,
    SectionCardComponent,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent implements OnInit {
  private settingsService = inject(SettingsService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private confirmService = inject(ConfirmationService);
  private translate = inject(TranslateService);

  warehouses = signal<Warehouse[]>([]);
  searchQuery = signal('');
  loading = signal(false);

  warehouseStats = computed(() => {
    const list = this.warehouses();
    return {
      total: list.length,
      active: list.filter((w) => w.operationalStatus === 'Active').length,
      underSetup: list.filter((w) => w.operationalStatus === 'UnderSetup').length,
    };
  });

  filteredWarehouses = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    const list = this.warehouses();
    if (!q) return list;
    return list.filter(
      (w) =>
        w.code?.toLowerCase().includes(q) ||
        w.name?.toLowerCase().includes(q) ||
        w.address?.city?.toLowerCase().includes(q)
    );
  });
  displayWarehouseDialog = signal(false);
  displaySetupWizard = signal(false);
  setupWarehouse = signal<Warehouse | null>(null);
  setupSaving = signal(false);
  activatingId = signal<string | null>(null);

  warehouseForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(10)]],
    name: ['', Validators.required],
    street: ['', Validators.required],
    city: ['', Validators.required],
    region: ['', Validators.required],
    postalCode: ['', Validators.required],
    country: ['', Validators.required],
    latitude: [0, Validators.required],
    longitude: [0, Validators.required],
    totalAreaM2: [0, Validators.required],
    usableAreaM2: [0, Validators.required],
    ceilingHeightM: [0, Validators.required],
    timezone: ['UTC', Validators.required],
  });

  ngOnInit() {
    this.loadWarehouses();
  }

  loadWarehouses() {
    this.loading.set(true);
    this.settingsService.getWarehouses().subscribe({
      next: (data) => {
        this.warehouses.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading warehouses:', err);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load warehouses',
          life: 5000
        });
        this.loading.set(false);
      }
    });
  }

  openSetupWizard(warehouse: Warehouse) {
    this.setupWarehouse.set(warehouse);
    this.displaySetupWizard.set(true);
  }

  closeSetupWizard() {
    this.displaySetupWizard.set(false);
    this.setupWarehouse.set(null);
  }

  onSetupCompleted() {
    const warehouse = this.setupWarehouse();
    this.closeSetupWizard();
    this.loadWarehouses();

    if (warehouse && this.canActivate(warehouse)) {
      this.confirmService.confirm({
        message: this.translate.instant('SETTINGS.ACTIVATE_AFTER_SETUP_MSG', {
          name: warehouse.name,
        }),
        header: this.translate.instant('SETTINGS.ACTIVATE_WAREHOUSE'),
        icon: 'pi pi-check-circle',
        acceptLabel: this.translate.instant('SETTINGS.ACTIVATE_WAREHOUSE'),
        rejectLabel: this.translate.instant('COMMON.CANCEL'),
        accept: () => this.activateWarehouse(warehouse),
      });
    }
  }

  canActivate(warehouse: Warehouse): boolean {
    return warehouse.operationalStatus === 'UnderSetup';
  }

  confirmActivateWarehouse(warehouse: Warehouse) {
    this.confirmService.confirm({
      message: this.translate.instant('SETTINGS.ACTIVATE_CONFIRM_MSG', {
        name: warehouse.name,
        code: warehouse.code,
      }),
      header: this.translate.instant('SETTINGS.ACTIVATE_WAREHOUSE'),
      icon: 'pi pi-check-circle',
      acceptLabel: this.translate.instant('SETTINGS.ACTIVATE_WAREHOUSE'),
      rejectLabel: this.translate.instant('COMMON.CANCEL'),
      accept: () => this.activateWarehouse(warehouse),
    });
  }

  activateWarehouse(warehouse: Warehouse) {
    this.activatingId.set(warehouse.id);
    this.settingsService.activateWarehouse(warehouse.id).subscribe({
      next: () => {
        this.activatingId.set(null);
        this.messageService.add({
          severity: 'success',
          summary: this.translate.instant('COMMON.SUCCESS'),
          detail: this.translate.instant('SETTINGS.ACTIVATE_SUCCESS', { name: warehouse.name }),
          life: 5000,
        });
        this.loadWarehouses();
      },
      error: (err) => {
        this.activatingId.set(null);
        console.error('Error activating warehouse:', err);

        // The global error handler shows the API's domain message for 422 responses.
        // Avoid adding a second, generic notification over it.
        if ((err as { status?: number })?.status === 422) {
          return;
        }

        const apiMsg =
          (err as { error?: { message?: string; title?: string } })?.error?.message ||
          (err as { message?: string })?.message;
        this.messageService.add({
          severity: 'error',
          summary: this.translate.instant('COMMON.ERROR'),
          detail: apiMsg || this.translate.instant('SETTINGS.ACTIVATE_FAILED'),
          life: 6000,
        });
      },
    });
  }

  openAddWarehouseDialog() {
    this.warehouseForm.reset({ timezone: 'UTC', latitude: 0, longitude: 0, totalAreaM2: 0, usableAreaM2: 0, ceilingHeightM: 0 });
    this.displayWarehouseDialog.set(true);
  }

  saveWarehouse() {
    if (this.warehouseForm.invalid) return;

    const formData = this.warehouseForm.value as any;

    this.settingsService.createWarehouse(formData).subscribe({
      next: () => {
        this.messageService.add({
          severity: 'success',
          summary: 'Success',
          detail: 'Warehouse created successfully',
        });
          this.displayWarehouseDialog.set(false);
          this.loadWarehouses();
        },
        error: (err) => {
          console.error('Error creating warehouse:', err);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to create warehouse',
            life: 5000
          });
        }
      });
  }

  getStatusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warning' | 'danger' {
    switch (status) {
      case 'Active': return 'success';
      case 'UnderSetup': return 'warning';
      case 'Maintenance': return 'info';
      case 'Inactive': return 'danger';
      default: return 'secondary';
    }
  }
}
