import { Injectable, inject } from '@angular/core';
import { WarehouseService } from './warehouse.service';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private warehouseService = inject(WarehouseService);

  // Expose warehouse service methods
  getWarehouses() {
    return this.warehouseService.getWarehouses();
  }

  getWarehouseById(id: string) {
    return this.warehouseService.getWarehouseById(id);
  }

  createWarehouse(data: any) {
    return this.warehouseService.createWarehouse(data);
  }

  activateWarehouse(id: string) {
    return this.warehouseService.activateWarehouse(id);
  }

  // Expose signals
  get warehouses$() {
    return this.warehouseService.warehouses$;
  }

  get loading$() {
    return this.warehouseService.loading$;
  }

  get error$() {
    return this.warehouseService.error$;
  }
}
