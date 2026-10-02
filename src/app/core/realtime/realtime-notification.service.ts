import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, effect, inject, signal } from '@angular/core';
import type { HubConnection } from '@microsoft/signalr';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { WarehouseContextService } from '../warehouse/warehouse-context.service';

export type WarehouseHub = 'inbound' | 'labor' | 'outbound' | 'orders' | 'shipping' | 'returns';
export type NotificationSeverity = 'info' | 'success' | 'warning' | 'danger';
export interface RealtimeNotification {
 id: string; source: WarehouseHub; title: string; message: string; type: NotificationSeverity;
 timestamp: Date; read: boolean; data?: unknown;
}
interface HubPayload { id?: string; title?: string; message?: string; type?: NotificationSeverity; timestamp?: string | Date; data?: unknown; }
const hubs: WarehouseHub[] = ['inbound', 'labor', 'outbound', 'orders', 'shipping', 'returns'];

@Injectable({ providedIn: 'root' })
export class RealtimeNotificationService {
 private readonly auth = inject(AuthService);
 private readonly warehouse = inject(WarehouseContextService);
 private readonly platform = inject(PLATFORM_ID);
 private readonly connections = new Map<WarehouseHub, HubConnection>();
 private readonly retries = new Map<WarehouseHub, ReturnType<typeof setTimeout>>();
 private readonly notices = signal<RealtimeNotification[]>([]);
 private readonly connected = signal<WarehouseHub[]>([]);
 private generation = 0;
 private activeKey: string | null = null;
 private queue: Promise<void> = Promise.resolve();
 readonly notifications = this.notices.asReadonly();
 readonly connectedHubs = this.connected.asReadonly();
 readonly isConnected = computed(() => this.connected().length === hubs.length);
 readonly unreadCount = computed(() => this.notices().filter(item => !item.read).length);

 constructor() {
  effect(() => {
   const key = this.auth.isAuthenticated() && this.warehouse.selectedWarehouseId()
    ? this.auth.currentUser()?.id + ':' + this.warehouse.selectedWarehouseId() : null;
   this.queue = this.queue.then(() => this.reconcile(key)).catch(() => undefined);
  });
 }

 start(): Promise<void> { return this.queue; }

 async stop(): Promise<void> {
  this.generation++;
  for (const timer of this.retries.values()) clearTimeout(timer);
  this.retries.clear();
  const connections = [...this.connections.values()];
  this.connections.clear();
  this.connected.set([]);
  this.notices.set([]);
  this.activeKey = null;
  await Promise.allSettled(connections.map(connection => connection.stop()));
 }

 markAllRead(): void { this.notices.update(items => items.map(item => ({ ...item, read: true }))); }

 private async reconcile(key: string | null): Promise<void> {
  if (!isPlatformBrowser(this.platform) || key === this.activeKey) return;
  await this.stop();
  if (!key || !this.auth.isAuthenticated()) return;
  const warehouseId = this.warehouse.selectedWarehouseId();
  if (!warehouseId || key !== this.auth.currentUser()?.id + ':' + warehouseId) return;
  this.activeKey = key;
  const generation = this.generation;
  await Promise.all(hubs.map(hub => this.connect(hub, warehouseId, generation)));
 }

 private async connect(hub: WarehouseHub, warehouseId: string, generation: number, attempt = 0): Promise<void> {
  const { HubConnectionBuilder, LogLevel } = await import('@microsoft/signalr');
  if (generation !== this.generation) return;
  const connection = new HubConnectionBuilder()
   .withUrl(environment.apiUrl.replace(/\/api\/?$/, '') + '/hubs/' + hub + '?warehouseId=' + encodeURIComponent(warehouseId), {
    withCredentials: false,
    accessTokenFactory: async () => {
     if (this.auth.isAccessTokenExpired()) await firstValueFrom(this.auth.refreshAccessToken());
     return this.auth.getToken() ?? '';
    },
   })
   .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
   .configureLogging(LogLevel.Error).build();
  connection.on('Notification', (payload: HubPayload) => { if (generation === this.generation) this.add(hub, payload); });
  connection.on('ASNCreated', (payload: { asnId: string; supplierName: string }) => {
   if (generation === this.generation) this.add(hub, { id: payload.asnId, title: 'ASN', message: payload.supplierName });
  });
  connection.onreconnecting(() => this.setConnected(hub, false, generation));
  connection.onreconnected(() => this.setConnected(hub, true, generation));
  const retry = () => {
   if (generation !== this.generation || this.retries.has(hub)) return;
   this.retries.set(hub, setTimeout(() => {
    this.retries.delete(hub);
    if (generation === this.generation) void this.connect(hub, warehouseId, generation, attempt + 1);
   }, Math.min(30000, 2000 * Math.pow(2, attempt))));
  };
  connection.onclose(() => { this.setConnected(hub, false, generation); retry(); });
  this.connections.set(hub, connection);
  try {
   await connection.start();
   if (generation !== this.generation) { await connection.stop(); return; }
   this.setConnected(hub, true, generation);
  } catch {
   this.setConnected(hub, false, generation);
   retry();
  }
 }

 private setConnected(hub: WarehouseHub, connected: boolean, generation: number): void {
  if (generation !== this.generation) return;
  this.connected.update(current => connected ? [...new Set([...current, hub])] : current.filter(item => item !== hub));
 }

 private add(source: WarehouseHub, payload: HubPayload): void {
  const parsed = payload.timestamp ? new Date(payload.timestamp) : new Date();
  const item: RealtimeNotification = {
   id: payload.id ?? crypto.randomUUID(), source, title: payload.title ?? source,
   message: payload.message ?? '', type: payload.type ?? 'info',
   timestamp: Number.isNaN(parsed.getTime()) ? new Date() : parsed, read: false, data: payload.data,
  };
  this.notices.update(items => [item, ...items.filter(existing => existing.id !== item.id || existing.source !== source)].slice(0, 100));
 }
}
