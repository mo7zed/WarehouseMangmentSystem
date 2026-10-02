import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { StepsModule } from 'primeng/steps';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ProgressBarModule } from 'primeng/progressbar';
import { TagModule } from 'primeng/tag';
import { DropdownModule } from 'primeng/dropdown';
import { MessageModule } from 'primeng/message';
import { MenuItem, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { getApiErrorMessage } from '../../core/utils/api-error.util';
import { WarehouseLayoutService } from './warehouse-layout.service';
import { Warehouse } from './warehouse.model';
import { WarehouseLayoutContext } from './warehouse-layout.model';
import { ZONE_TYPE_OPTIONS, STORAGE_TYPE_OPTIONS } from './warehouse-layout.constants';

function minLessThanMax(minKey: string, maxKey: string) {
  return (group: AbstractControl): ValidationErrors | null => {
    const min = Number(group.get(minKey)?.value);
    const max = Number(group.get(maxKey)?.value);
    if (!Number.isNaN(min) && !Number.isNaN(max) && min >= max) {
      return { rangeInvalid: { minKey, maxKey } };
    }
    return null;
  };
}

@Component({
  selector: 'app-warehouse-setup-wizard',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    StepsModule,
    ButtonModule,
    InputTextModule,
    InputNumberModule,
    ProgressBarModule,
    TagModule,
    DropdownModule,
    MessageModule,
  ],
  templateUrl: './warehouse-setup-wizard.component.html',
  styleUrl: './warehouse-setup-wizard.component.scss',
})
export class WarehouseSetupWizardComponent implements OnInit {
  @Input({ required: true }) warehouse!: Warehouse;
  @Output() completed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  private layoutService = inject(WarehouseLayoutService);
  private fb = inject(FormBuilder);
  private messageService = inject(MessageService);
  private translate = inject(TranslateService);

  activeStep = signal(0);
  saving = signal(false);
  ctx = signal<WarehouseLayoutContext>({ warehouseId: '' });
  lastCreatedSummary = signal<string | null>(null);
  lastApiError = signal<string | null>(null);
  createdCodes = signal<{ zone?: string; aisle?: string; rack?: string; shelf?: string }>({});
  steps: MenuItem[] = [];

  readonly zoneTypeOptions = [...ZONE_TYPE_OPTIONS];
  readonly storageTypeOptions = [...STORAGE_TYPE_OPTIONS];

  zoneForm = this.fb.group(
    {
      code: ['', [Validators.required, Validators.pattern(/\S+/)]],
      name: ['', [Validators.required, Validators.pattern(/\S+/)]],
      zoneType: ['Storage', Validators.required],
      storageType: ['Ambient', Validators.required],
      tempMinCelsius: [15, Validators.required],
      tempMaxCelsius: [25, Validators.required],
      humidityMinPercent: [40, Validators.required],
      humidityMaxPercent: [60, Validators.required],
    },
    {
      validators: [
        minLessThanMax('tempMinCelsius', 'tempMaxCelsius'),
        minLessThanMax('humidityMinPercent', 'humidityMaxPercent'),
      ],
    }
  );

  aisleForm = this.fb.group({
    code: ['', Validators.required],
  });

  rackForm = this.fb.group({
    code: ['', Validators.required],
  });

  shelfForm = this.fb.group({
    code: ['', Validators.required],
    level: [1, [Validators.required, Validators.min(1)]],
  });

  ngOnInit(): void {
    this.ctx.set({ warehouseId: this.warehouse.id });
    this.steps = [
      { label: this.translate.instant('SETTINGS.STEP_ZONE') },
      { label: this.translate.instant('SETTINGS.STEP_AISLE') },
      { label: this.translate.instant('SETTINGS.STEP_RACK') },
      { label: this.translate.instant('SETTINGS.STEP_SHELF') },
    ];
  }

  progressPercent(): number {
    return Math.round(((this.activeStep() + 1) / 4) * 100);
  }

  currentStepTitle(): string {
    const keys = [
      'SETTINGS.STEP_ZONE_TITLE',
      'SETTINGS.STEP_AISLE_TITLE',
      'SETTINGS.STEP_RACK_TITLE',
      'SETTINGS.STEP_SHELF_TITLE',
    ];
    return this.translate.instant(keys[this.activeStep()] ?? keys[0]);
  }

  statusSeverity(status: string): 'success' | 'secondary' | 'info' | 'warning' | 'danger' {
    switch (status) {
      case 'Active':
        return 'success';
      case 'UnderSetup':
        return 'warning';
      case 'Maintenance':
        return 'info';
      case 'Inactive':
        return 'danger';
      default:
        return 'secondary';
    }
  }

  canSubmitStep(): boolean {
    if (this.warehouse.operationalStatus === 'Active') {
      return false;
    }
    switch (this.activeStep()) {
      case 0:
        return this.zoneForm.valid;
      case 1:
        return this.aisleForm.valid;
      case 2:
        return this.rackForm.valid;
      case 3:
        return this.shelfForm.valid;
      default:
        return false;
    }
  }

  goBack(): void {
    if (this.activeStep() > 0) {
      this.activeStep.update((s) => s - 1);
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onNext(): void {
    const step = this.activeStep();
    if (step === 0) this.submitZone();
    else if (step === 1) this.submitAisle();
    else if (step === 2) this.submitRack();
    else if (step === 3) this.submitShelf();
  }

  private submitZone(): void {
    if (!this.canSubmitStep() || this.zoneForm.invalid) {
      this.zoneForm.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.lastApiError.set(null);
    const body = this.buildZonePayload();
    this.layoutService.createZone(this.warehouse.id, body).subscribe({
      next: (res) => {
        this.ctx.update((c) => ({ ...c, zoneId: res.zoneId }));
        this.createdCodes.update(c => ({ ...c, zone: body.code }));
        this.lastCreatedSummary.set(this.translate.instant('SETTINGS.ZONE_CREATED_DETAIL', { name: body.name }));
        this.toastSuccess('SETTINGS.ZONE_CREATED');
        this.activeStep.set(1);
        this.saving.set(false);
      },
      error: (err) => this.handleError(err, 'SETTINGS.ZONE_CREATE_FAILED'),
    });
  }

  private buildZonePayload() {
    const raw = this.zoneForm.getRawValue();
    return {
      code: raw.code!.trim(),
      name: raw.name!.trim(),
      zoneType: String(raw.zoneType).trim(),
      storageType: String(raw.storageType).trim(),
      tempMinCelsius: Number(raw.tempMinCelsius),
      tempMaxCelsius: Number(raw.tempMaxCelsius),
      humidityMinPercent: Number(raw.humidityMinPercent),
      humidityMaxPercent: Number(raw.humidityMaxPercent),
    };
  }

  private submitAisle(): void {
    if (this.aisleForm.invalid || !this.ctx().zoneId) return;
    this.saving.set(true);
    const { zoneId, warehouseId } = this.ctx();
    this.lastApiError.set(null);
    const aisleBody = { code: this.aisleForm.getRawValue().code!.trim() };
    this.layoutService.createAisle(warehouseId, zoneId!, aisleBody).subscribe({
      next: (res) => {
        this.ctx.update((c) => ({ ...c, aisleId: res.aisleId }));
        this.createdCodes.update(c => ({ ...c, aisle: aisleBody.code }));
        this.lastCreatedSummary.set(this.translate.instant('SETTINGS.AISLE_CREATED_DETAIL', { code: aisleBody.code }));
        this.toastSuccess('SETTINGS.AISLE_CREATED');
        this.activeStep.set(2);
        this.saving.set(false);
      },
      error: (err) => this.handleError(err, 'SETTINGS.AISLE_CREATE_FAILED'),
    });
  }

  private submitRack(): void {
    if (this.rackForm.invalid || !this.ctx().zoneId || !this.ctx().aisleId) return;
    this.saving.set(true);
    this.lastApiError.set(null);
    const { warehouseId, zoneId, aisleId } = this.ctx();
    this.layoutService
      .createRack(warehouseId, zoneId!, aisleId!, {
        code: this.rackForm.getRawValue().code!.trim(),
      })
      .subscribe({
        next: (res) => {
          this.ctx.update((c) => ({ ...c, rackId: res.rackId }));
          const code = this.rackForm.getRawValue().code!.trim();
          this.createdCodes.update(c => ({ ...c, rack: code }));
          this.lastCreatedSummary.set(this.translate.instant('SETTINGS.RACK_CREATED_DETAIL', { code }));
          this.toastSuccess('SETTINGS.RACK_CREATED');
          this.activeStep.set(3);
          this.saving.set(false);
        },
        error: (err) => this.handleError(err, 'SETTINGS.RACK_CREATE_FAILED'),
      });
  }

  private submitShelf(): void {
    if (this.shelfForm.invalid || !this.ctx().rackId) return;
    this.saving.set(true);
    this.lastApiError.set(null);
    const { warehouseId, zoneId, aisleId, rackId } = this.ctx();
    this.layoutService
      .createShelf(warehouseId, zoneId!, aisleId!, rackId!, {
        code: this.shelfForm.getRawValue().code!.trim(),
        level: Number(this.shelfForm.getRawValue().level ?? 1),
      })
      .subscribe({
        next: (res) => {
          this.ctx.update((c) => ({ ...c, shelfId: res.shelfId }));
          const code = this.shelfForm.getRawValue().code!.trim();
          this.createdCodes.update(c => ({ ...c, shelf: code }));
          this.lastCreatedSummary.set(
            this.translate.instant('SETTINGS.SETUP_COMPLETE_DETAIL', { code })
          );
          this.toastSuccess('SETTINGS.SETUP_COMPLETE');
          this.saving.set(false);
          this.completed.emit();
        },
        error: (err) => this.handleError(err, 'SETTINGS.SHELF_CREATE_FAILED'),
      });
  }

  private toastSuccess(key: string): void {
    this.messageService.add({
      severity: 'success',
      summary: this.translate.instant('COMMON.SUCCESS'),
      detail: this.translate.instant(key),
      life: 4000,
    });
  }

  private handleError(err: unknown, key: string): void {
    this.saving.set(false);
    this.lastApiError.set(getApiErrorMessage(err, this.translate.instant(key)));
  }
}
