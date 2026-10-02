import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { Alert, ChartData, KpiCard, ActivityLog } from '../../core/models/shared.model';
import { BaseApiService } from '../../core/services/base-api.service';

type DashboardRange = '7d' | '30d';

interface DashboardKpi { value: number; previousValue: number | null; changePercent: number | null; }
interface DashboardSummary {
  kpis: {
    totalActiveSKUs: DashboardKpi;
    openOrders: DashboardKpi & { highPriorityCount: number };
    activePickings: DashboardKpi & { activeOperators: number };
    pendingShipments: DashboardKpi & { dueTodayCount: number };
    returnsToday: DashboardKpi & { needsDispositionCount: number };
    lowStockAlerts: DashboardKpi & { criticalCount: number };
  };
}
interface InboundOutboundResponse { data: Array<{ label: string; inboundQty: number; outboundQty: number }>; }
interface FulfillmentResponse { targetPercent: number; data: Array<{ label: string; fulfillmentRatePercent: number | null }>; }
interface InventoryByCategoryResponse { data: Array<{ categoryName: string; percentage: number }>; }
interface AlertsResponse { data: DashboardAlert[]; unreadCount: number; }
interface DashboardAlert { id: string; severity: string; title: string; message: string; createdAt: string; readAt: string | null; }
interface ActivityResponse { data: DashboardActivity[]; }
interface DashboardActivity { id: string; module: string; action: string; user: { name: string | null } | null; createdAt: string; }

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(BaseApiService);

  getKpis(warehouseId: string): Observable<KpiCard[]> {
    return this.api.get<DashboardSummary>('v1/dashboard/summary', { warehouseId }).pipe(map(response => {
      const { kpis } = response;
      return [
        this.kpi('total_active_skus', 'DASHBOARD.ACTIVE_SKUS', kpis.totalActiveSKUs, undefined, 'pi-box', 'primary'),
        this.kpi('open_orders', 'DASHBOARD.OPEN_ORDERS', kpis.openOrders, `${kpis.openOrders.highPriorityCount} high priority`, 'pi-shopping-cart', 'info'),
        this.kpi('active_pickings', 'DASHBOARD.ACTIVE_PICKINGS', kpis.activePickings, `${kpis.activePickings.activeOperators} operators active`, 'pi-map-marker', 'success'),
        this.kpi('pending_shipments', 'DASHBOARD.PENDING_SHIPMENTS', kpis.pendingShipments, `${kpis.pendingShipments.dueTodayCount} due today`, 'pi-send', 'warning'),
        this.kpi('returns_today', 'DASHBOARD.RETURNS_TODAY', kpis.returnsToday, `${kpis.returnsToday.needsDispositionCount} need disposition`, 'pi-replay', 'danger'),
        this.kpi('low_stock', 'DASHBOARD.LOW_STOCK_ALERTS', kpis.lowStockAlerts, `${kpis.lowStockAlerts.criticalCount} critical`, 'pi-exclamation-triangle', 'danger'),
      ];
    }));
  }

  getInboundOutboundChart(warehouseId: string, range: DashboardRange): Observable<ChartData> {
    return this.api.get<InboundOutboundResponse>('v1/dashboard/inbound-outbound', { warehouseId, range }).pipe(map(response => ({
      labels: response.data.map(item => item.label),
      datasets: [
        { label: 'Inbound', data: response.data.map(item => item.inboundQty), backgroundColor: 'rgba(0, 180, 216, 0.3)', borderColor: '#00B4D8' },
        { label: 'Outbound', data: response.data.map(item => item.outboundQty), backgroundColor: 'rgba(30, 58, 95, 0.5)', borderColor: '#2A4F7F' },
      ],
    })));
  }

  getFulfillmentChart(warehouseId: string, range: DashboardRange): Observable<ChartData> {
    return this.api.get<FulfillmentResponse>('v1/dashboard/fulfillment-rate', { warehouseId, range }).pipe(map(response => ({
      labels: response.data.map(item => item.label),
      datasets: [{ label: `Fulfillment Rate % (Target ${response.targetPercent}%)`, data: response.data.map(item => item.fulfillmentRatePercent ?? 0), borderColor: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }],
    })));
  }

  getInventoryByCategory(warehouseId: string): Observable<ChartData> {
    return this.api.get<InventoryByCategoryResponse>('v1/dashboard/inventory-by-category', { warehouseId }).pipe(map(response => ({
      labels: response.data.map(item => item.categoryName),
      datasets: [{ data: response.data.map(item => item.percentage), backgroundColor: ['#00B4D8', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#6b7280'] }],
    })));
  }

  getAlerts(warehouseId: string): Observable<{ alerts: Alert[]; unreadCount: number }> {
    return this.api.get<AlertsResponse>('v1/dashboard/alerts', { warehouseId, limit: 20, offset: 0 }).pipe(map(response => ({
      unreadCount: response.unreadCount,
      alerts: response.data.map(alert => ({ id: alert.id, type: this.alertType(alert.severity), title: alert.title, message: alert.message, timestamp: new Date(alert.createdAt), read: !!alert.readAt })),
    })));
  }

  getRecentActivity(warehouseId: string): Observable<ActivityLog[]> {
    return this.api.get<ActivityResponse>('v1/dashboard/activity', { warehouseId, limit: 5, offset: 0 }).pipe(map(response =>
      response.data.map(activity => ({ id: activity.id, user: activity.user?.name || 'System', action: this.formatAction(activity.action), module: activity.module, timestamp: new Date(activity.createdAt) })),
    ));
  }

  markAlertRead(alertId: string): Observable<void> { return this.api.patch<void>(`v1/dashboard/alerts/${alertId}/read`, {}); }

  private kpi(id: string, title: string, source: DashboardKpi, subtitle: string | undefined, icon: string, color: KpiCard['color']): KpiCard {
    return { id, title, value: source.value, subtitle, icon, color, trend: source.changePercent ?? undefined, trendLabel: 'vs previous period' };
  }

  private alertType(severity: string): Alert['type'] {
    return severity === 'critical' || severity === 'error' ? 'error' : severity === 'warning' ? 'warning' : severity === 'success' ? 'success' : 'info';
  }

  private formatAction(action: string): string { return action.replace(/Command$/, '').replace(/([a-z])([A-Z])/g, '$1 $2'); }
}
