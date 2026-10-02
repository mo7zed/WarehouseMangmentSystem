import { Injectable, inject, signal } from '@angular/core';
import { BaseApiService } from '../../core/services/base-api.service';
import { Warehouse, CreateWarehouseDto } from './warehouse.model';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class WarehouseService {
  private api = inject(BaseApiService);

  private warehouses = signal<Warehouse[]>([]);
  private loading = signal(false);
  private error = signal<string | null>(null);

  readonly warehouses$ = this.warehouses;
  readonly loading$ = this.loading;
  readonly error$ = this.error;

  getWarehouses(): Observable<Warehouse[]> {
    this.loading.set(true);
    this.error.set(null);

    return new Observable(observer => {
      this.api.get<Warehouse[]>('warehouses').subscribe({
        next: (data) => {
          this.warehouses.set(data);
          this.loading.set(false);
          observer.next(data);
          observer.complete();
        },
        error: (err) => {
          this.error.set(err.message);
          this.loading.set(false);
          observer.error(err);
        }
      });
    });
  }

  getWarehouseById(id: string): Observable<Warehouse> {
    return this.api.get<Warehouse>(`warehouses/${id}`);
  }

  createWarehouse(data: CreateWarehouseDto): Observable<{ id: string }> {
    return new Observable(observer => {
      this.api.post<{ id: string }>('warehouses', data).subscribe({
        next: (response) => {
          // Reload warehouses
          this.getWarehouses().subscribe();
          observer.next(response);
          observer.complete();
        },
        error: (err) => {
          this.error.set(err.message);
          observer.error(err);
        }
      });
    });
  }

  activateWarehouse(id: string): Observable<void> {
    return new Observable(observer => {
      this.api.post<void>(`warehouses/${id}/activate`, null).subscribe({
        next: () => {
          this.getWarehouses().subscribe();
          observer.next();
          observer.complete();
        },
        error: (err) => { 
          this.error.set(err.message);
          observer.error(err);
        },
      });
    });
  }
}
