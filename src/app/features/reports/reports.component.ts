import { UiLabelPipe, UiOptionsPipe } from '../../shared/pipes/ui-label.pipe';
import { Component, DestroyRef, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TabViewModule } from 'primeng/tabview';
import { DropdownModule } from 'primeng/dropdown';
import { CalendarModule } from 'primeng/calendar';
import { CardModule } from 'primeng/card';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { Subscription } from 'rxjs';
import { ReportsService, ReportData, ReportDates, InventoryReportType } from './reports.service';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [UiLabelPipe, UiOptionsPipe,
    CommonModule, FormsModule, TranslateModule,
    TableModule, ButtonModule, TabViewModule,
    DropdownModule, CalendarModule, CardModule, TagModule,
  ],
  templateUrl: './reports.component.html',
  styleUrl: './reports.component.scss',
})
export class ReportsComponent implements OnInit, OnDestroy {
  private reportsService = inject(ReportsService);
  private messageService = inject(MessageService);
  private warehouseContext = inject(WarehouseContextService);
  private destroyRef = inject(DestroyRef);

  currentReport = signal<ReportData | null>(null);
  reportLoading = signal(true);
  private reportRequest?: Subscription;
  ngOnDestroy(): void { this.reportRequest?.unsubscribe(); }
  activeTabIndex = 0;
  inventoryType: InventoryReportType = 'category';
  reportError = signal(false);
  dateRange: Date[] | null = null;

  inventoryReportTypes = [
    { label: 'Inventory by Category', value: 'category' },
    { label: 'Inventory Aging', value: 'aging' },
    { label: 'ABC Analysis', value: 'abc' },
  ];

  ngOnInit(): void {
    this.warehouseContext.warehouseSelectionChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadCurrentReport());
  }

  onTabChange(event: { index: number }): void {
    this.activeTabIndex = event.index;
    this.loadCurrentReport();
  }

  loadInventoryReport(): void {
    if (this.activeTabIndex === 0) this.loadCurrentReport();
  }

  loadCurrentReport(): void {
    this.reportRequest?.unsubscribe();
    this.currentReport.set(null);
    this.reportError.set(false);
    const warehouseId = this.warehouseContext.selectedWarehouseId();
    if (!warehouseId) {
      this.currentReport.set(null);
      this.reportLoading.set(false);
      return;
    }

    this.reportLoading.set(true);
    const dates = this.reportDates();
    const loaders = [
      () => this.reportsService.getInventoryReport(warehouseId, this.inventoryType, dates),
      () => this.reportsService.getOrderReport(warehouseId, dates),
      () => this.reportsService.getProductivityReport(warehouseId, dates),
      () => this.reportsService.getComplianceReport(warehouseId, dates),
    ];

    this.reportRequest = loaders[this.activeTabIndex]().subscribe({
      next: report => {
        this.currentReport.set(report);
        this.reportLoading.set(false);
      },
      error: error => {
        this.reportError.set(true);
        this.currentReport.set(null);
        this.reportLoading.set(false);
        this.messageService.add({
          severity: 'error',
          summary: 'Unable to load report',
          detail: error?.error?.message ?? 'The report could not be loaded for the selected warehouse.',
        });
      },
    });
  }

  private reportDates(): ReportDates {
    const format = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    return this.dateRange?.[0] && this.dateRange?.[1]
      ? { from: format(this.dateRange[0]), to: format(this.dateRange[1]) } : {};
  }

  exportCsv(): void {
    const report = this.currentReport();
    if (!report) return;
    this.reportsService.exportCsv(report.rows, report.title.replace(/\s/g, '_').toLowerCase());
    this.messageService.add({ severity: 'success', summary: 'Exported', detail: 'CSV downloaded.' });
  }

  exportExcel(): void {
    const report = this.currentReport();
    if (!report) return;
    this.reportsService.exportExcel(report.rows, report.title.replace(/\s/g, '_').toLowerCase());
    this.messageService.add({ severity: 'success', summary: 'Exported', detail: 'Excel file downloaded.' });
  }

  printReport(): void { if (this.currentReport() && !this.reportLoading() && !this.reportError()) window.print(); }

  summaryKeys(summary: Record<string, number | string>): string[] {
    return Object.keys(summary);
  }

  formatKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
  }
}
