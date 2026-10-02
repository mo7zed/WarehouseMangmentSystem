import { Injectable, inject } from '@angular/core';
import { createCsv, createExcelXml, downloadFile } from '../../shared/utils/download.util';
import { Observable } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';

export interface ReportRow {
  label: string;
  value: number | string;
  trend?: number | null;
  category?: string;
}

export interface ReportData {
  title: string;
  rows: ReportRow[];
  summary?: Record<string, number | string>;
}

export type InventoryReportType = 'category' | 'aging' | 'abc';

export interface ReportDates { from?: string; to?: string; }

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private api = inject(BaseApiService);

  getInventoryReport(warehouseId: string, type: InventoryReportType, dates: ReportDates = {}): Observable<ReportData> {
    return this.api.get<ReportData>('reports/inventory', { warehouseId, type: type === 'category' ? undefined : type, ...(type === 'category' ? {} : dates) });
  }

  getOrderReport(warehouseId: string, dates: ReportDates = {}): Observable<ReportData> {
    return this.api.get<ReportData>('reports/orders', { warehouseId, ...dates });
  }

  getProductivityReport(warehouseId: string, dates: ReportDates = {}): Observable<ReportData> {
    return this.api.get<ReportData>('reports/productivity', { warehouseId, ...dates });
  }

  getComplianceReport(warehouseId: string, dates: ReportDates = {}): Observable<ReportData> {
    return this.api.get<ReportData>('reports/compliance', { warehouseId, ...dates });
  }

  exportCsv(rows: ReportRow[], filename: string): void {
    downloadFile(createCsv(this.exportRows(rows)), filename + '.csv', 'text/csv;charset=utf-8');
  }
  exportExcel(rows: ReportRow[], filename: string): void {
    downloadFile(createExcelXml(this.exportRows(rows)), filename + '.xml', 'application/vnd.ms-excel;charset=utf-8');
  }
  private exportRows(rows: ReportRow[]): unknown[][] {
    return [['Label', 'Value', 'Trend', 'Category'],
      ...rows.map(row => [row.label, row.value, row.trend ?? '', row.category ?? ''])];
  }
}
