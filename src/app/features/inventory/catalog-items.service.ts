import { CreatedResource } from '../../core/models/api.model';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { BaseApiService } from '../../core/services/base-api.service';
import { InventoryItem, InventoryFilter } from '../../core/models/inventory.model';
import { PagedResponse } from '../../core/models/shared.model';

export interface CatalogItem {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  category: { categoryId: string; name: string; parentCategoryId?: string | null };
  dimensions: { lengthCm: number; widthCm: number; heightCm: number; weightKg: number };
  storageRequirements: {
    requiredStorageType: string; tempMinCelsius: number | null; tempMaxCelsius: number | null;
    humidityMinPercent: number | null; humidityMaxPercent: number | null; isHazardous: boolean;
    hazmatClass?: string | null; requiresBatchTracking: boolean; requiresSerialTracking: boolean;
  };
  baseUOM: { code: string; name: string };
  alternateUOMs: CatalogUomConversion[];
  velocityClass: 'FastMover' | 'MediumMover' | 'SlowMover';
  /** Stock-rotation method returned by the Catalog Items API, when configured. */
  allocationStrategy: InventoryItem['strategy'];
  status: string;
  barcode?: { value: string; format: string } | null;
  rfidTag?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCatalogItemDto {
  sku: string; name: string; description: string; categoryId: string; categoryName: string;
  parentCategoryId: string; lengthCm: number; widthCm: number; heightCm: number; weightKg: number;
  requiredStorageType: string; tempMinCelsius: number | null; tempMaxCelsius: number | null;
  humidityMinPercent: number | null; humidityMaxPercent: number | null; isHazardous: boolean;
  hazmatClass: string | null; requiresBatchTracking: boolean; requiresSerialTracking: boolean;
  baseUOMCode: string; baseUOMName: string; velocityClass: 'FastMover' | 'MediumMover' | 'SlowMover';
  allocationStrategy: InventoryItem['strategy'];
  barcodeValue: string | null; barcodeFormat: string | null; rfidTag: string | null;
}

export type UpdateCatalogItemDto = Omit<CreateCatalogItemDto,
  'sku' | 'baseUOMCode' | 'baseUOMName' | 'velocityClass' | 'barcodeValue' | 'barcodeFormat' | 'rfidTag' | 'allocationStrategy'>;

export interface CatalogUomConversion {
  fromUOMCode: string; fromUOMName: string; toUOMCode: string; toUOMName: string; conversionFactor: number;
}

@Injectable({ providedIn: 'root' })
export class CatalogItemsService {
  private api = inject(BaseApiService);

  getCatalogItems(filter?: InventoryFilter): Observable<PagedResponse<InventoryItem>> {
    return this.api.get<CatalogItem[]>('catalog-items').pipe(map(items => {
      let filtered = items.map(item => this.toInventoryItem(item));
      const query = filter?.search?.toLowerCase();
      if (query) filtered = filtered.filter(item => item.sku.toLowerCase().includes(query) || item.name.toLowerCase().includes(query));
      if (filter?.category) filtered = filtered.filter(item => item.category === filter.category);
      if (filter?.status) filtered = filtered.filter(item => item.status === this.toInventoryStatus(filter.status!));
      const page = filter?.page ?? 1;
      // The current API returns the full catalog; never silently truncate it.
      const limit = filter?.limit ?? Math.max(1, filtered.length);
      const total = filtered.length;
      return { data: filtered.slice((page - 1) * limit, page * limit), total, page, limit, totalPages: Math.ceil(total / limit) };
    }));
  }

  getById(id: string): Observable<CatalogItem> { return this.api.get<CatalogItem>(`catalog-items/${id}`); }
  getBySku(sku: string): Observable<CatalogItem> { return this.api.get<CatalogItem>(`catalog-items/by-sku/${encodeURIComponent(sku)}`); }
  create(body: CreateCatalogItemDto): Observable<CreatedResource> { return this.api.post<CreatedResource>('catalog-items', body); }
  update(id: string, body: UpdateCatalogItemDto): Observable<void> { return this.api.put<void>(`catalog-items/${id}`, body); }
  addUomConversion(id: string, body: CatalogUomConversion): Observable<unknown> { return this.api.post<unknown>(`catalog-items/${id}/uom-conversions`, body); }
  setVelocityClass(id: string, velocityClass: CatalogItem['velocityClass']): Observable<void> { return this.api.patch<void>(`catalog-items/${id}/velocity-class`, { velocityClass }); }
  deactivate(id: string): Observable<void> { return this.api.post<void>(`catalog-items/${id}/deactivate`, {}); }

  toCreateDto(item: Partial<InventoryItem>): CreateCatalogItemDto {
    const categoryName = item.category || 'Uncategorized';
    const uom = item.uom || 'PCS';
    return {
      sku: item.sku || '', name: item.name || '', description: item.description || '',
      categoryId: categoryName, categoryName, parentCategoryId: '',
      lengthCm: item.dimensions?.l || 0, widthCm: item.dimensions?.w || 0, heightCm: item.dimensions?.h || 0, weightKg: item.weight || 0,
      requiredStorageType: 'Ambient', tempMinCelsius: null, tempMaxCelsius: null, humidityMinPercent: null, humidityMaxPercent: null,
      isHazardous: false, hazmatClass: null, requiresBatchTracking: false, requiresSerialTracking: false,
      baseUOMCode: uom, baseUOMName: item.uomName || uom, velocityClass: 'MediumMover', allocationStrategy: item.strategy ?? 'FIFO',
      barcodeValue: item.barcode || null, barcodeFormat: item.barcode ? 'Code128' : null, rfidTag: null,
    };
  }

  toUpdateDto(item: Partial<InventoryItem>): UpdateCatalogItemDto {
    const { sku: _sku, baseUOMCode: _uomCode, baseUOMName: _uomName, velocityClass: _velocity, barcodeValue: _barcodeValue, barcodeFormat: _barcodeFormat, rfidTag: _rfid, allocationStrategy: _strategy, ...body } = this.toCreateDto(item);
    return body;
  }

  private toInventoryItem(item: CatalogItem): InventoryItem {
    return {
      id: item.id, sku: item.sku, name: item.name, nameAr: '', description: item.description ?? undefined,
      category: item.category?.name ?? '', warehouseId: '', warehouseName: '', binId: '', binCode: '', zoneId: '', zoneName: '',
      quantity: 0, reservedQty: 0, availableQty: 0, uom: item.baseUOM?.code || item.baseUOM?.name || '', uomName: item.baseUOM?.name || item.baseUOM?.code || '', weight: item.dimensions?.weightKg,
      dimensions: { l: item.dimensions?.lengthCm ?? 0, w: item.dimensions?.widthCm ?? 0, h: item.dimensions?.heightCm ?? 0 },
      barcode: item.barcode?.value ?? undefined, strategy: item.allocationStrategy, status: this.toInventoryStatus(item.status),
      minThreshold: 0, maxThreshold: 0, reorderPoint: 0, costPrice: 0, sellingPrice: 0, lastUpdated: new Date(item.updatedAt),
    };
  }

  private toInventoryStatus(status: string): InventoryItem['status'] {
    return status.toLowerCase() === 'active' ? 'active' : 'inactive';
  }
}
