import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { CardModule } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ButtonModule } from 'primeng/button';
import { SelectButtonModule } from 'primeng/selectbutton';
import { SkeletonModule } from 'primeng/skeleton';
import { MessagesModule } from 'primeng/messages';
import { BadgeModule } from 'primeng/badge';
import { Subscription, forkJoin, interval } from 'rxjs';
import { DashboardService } from './dashboard.service';
import { KpiCard, Alert, ActivityLog, ChartData } from '../../core/models/shared.model';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TranslateModule,
    CardModule, ChartModule, TableModule, TagModule,
    ButtonModule, SelectButtonModule, SkeletonModule,
    MessagesModule, BadgeModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',})
export class DashboardComponent implements OnInit, OnDestroy {
  private dashService = inject(DashboardService);
  private warehouseContext = inject(WarehouseContextService);

  loading = signal(true);
  kpis = signal<KpiCard[]>([]);
  alerts = signal<Alert[]>([]);
  activity = signal<ActivityLog[]>([]);
  chartRange = signal<'7d' | '30d'>('7d');
  barChartData = signal<ChartData>({ labels: [], datasets: [] });
  lineChartData = signal<ChartData>({ labels: [], datasets: [] });
  doughnutData = signal<ChartData>({ labels: [], datasets: [] });

  private refreshSub?: Subscription;
  private warehouseSub?: Subscription;
  private loadSub?: Subscription;
  private selectedWarehouseId: string | null = null;

  barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#64748b', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
    },
  };

  lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#64748b', font: { size: 11 } } } },
    scales: {
      x: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' } },
      y: { ticks: { color: '#64748b' }, grid: { color: '#e2e8f0' }, min: 0, max: 100 },
    },
  };

  doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 10 }, padding: 12, boxWidth: 10 } }
    },
    cutout: '65%',
  };

  ngOnInit(): void {
    this.warehouseSub = this.warehouseContext.warehouseSelectionChanges.subscribe(warehouseId => {
      this.selectedWarehouseId = warehouseId;
      this.loadData();
    });
    this.warehouseContext.initialize();
    // Auto-refresh every 30 seconds
    this.refreshSub = interval(30000).subscribe(() => this.loadData());
  }

  ngOnDestroy(): void {
    this.refreshSub?.unsubscribe();
    this.warehouseSub?.unsubscribe();
    this.loadSub?.unsubscribe();
  }

  loadData(): void {
    const warehouseId = this.selectedWarehouseId;
    this.loadSub?.unsubscribe();

    if (!warehouseId) {
      this.kpis.set([]);
      this.alerts.set([]);
      this.activity.set([]);
      this.barChartData.set({ labels: [], datasets: [] });
      this.lineChartData.set({ labels: [], datasets: [] });
      this.doughnutData.set({ labels: [], datasets: [] });
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadSub = forkJoin({
      kpis: this.dashService.getKpis(warehouseId),
      alerts: this.dashService.getAlerts(warehouseId),
      activity: this.dashService.getRecentActivity(warehouseId),
      inboundOutbound: this.dashService.getInboundOutboundChart(warehouseId, this.chartRange()),
      fulfillment: this.dashService.getFulfillmentChart(warehouseId, this.chartRange()),
      inventoryByCategory: this.dashService.getInventoryByCategory(warehouseId),
    }).subscribe({
      next: data => {
        this.kpis.set(data.kpis);
        this.alerts.set(data.alerts.alerts);
        this.activity.set(data.activity);
        this.barChartData.set(data.inboundOutbound);
        this.lineChartData.set(data.fulfillment);
        this.doughnutData.set(data.inventoryByCategory);
        this.loading.set(false);
      },
      error: () => { this.barChartData.set({ labels: [], datasets: [] }); this.lineChartData.set({ labels: [], datasets: [] }); this.doughnutData.set({ labels: [], datasets: [] }); this.kpis.set([]); this.alerts.set([]); this.activity.set([]); this.loading.set(false); },
    });
  }

  refresh(): void {
    this.loadData();
  }

  setRange(range: '7d' | '30d'): void {
    this.chartRange.set(range);
    this.loadData();
  }

  unreadAlertCount(): number {
    return this.alerts().filter(a => !a.read).length;
  }

  markAlertRead(alert: Alert): void {
    if (alert.read) return;

    this.dashService.markAlertRead(alert.id).subscribe({
      next: () => this.alerts.update(alerts =>
        alerts.map(item => item.id === alert.id ? { ...item, read: true } : item),
      ),
    });
  }

  getUserInitials(name: string): string {
    return name.split(' ').map(n => n[0]).join('').slice(0, 2);
  }
}
