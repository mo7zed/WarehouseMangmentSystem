export interface InventoryItem {
  /** Preserve the catalog's unit name separately from its API code. */
  uomName?: string;
  id: string;
  sku: string;
  name: string;
  nameAr: string;
  description?: string;
  category: string;
  warehouseId: string;
  warehouseName: string;
  binId: string;
  binCode: string;
  zoneId: string;
  zoneName: string;
  quantity: number;
  reservedQty: number;
  availableQty: number;
  uom: string;
  weight?: number;
  dimensions?: { l: number; w: number; h: number };
  barcode?: string;
  strategy: 'FIFO' | 'FEFO' | 'LIFO';
  status: 'active' | 'inactive' | 'low_stock' | 'out_of_stock';
  minThreshold: number;
  maxThreshold: number;
  reorderPoint: number;
  costPrice: number;
  sellingPrice: number;
  expiryDate?: Date;
  lotNumber?: string;
  serialNumber?: string;
  lastUpdated: Date;
  imageUrl?: string;
}

export interface StockTransfer {
  id?: string;
  itemId: string;
  sourceBinId: string;
  destinationBinId: string;
  quantity: number;
  reason: string;
  notes?: string;
  status?: 'pending' | 'completed' | 'cancelled';
  createdAt?: Date;
  completedAt?: Date;
}

export interface CycleCount {
  id: string;
  warehouseId: string;
  targetLocations: string[];
  targetItems: string[];
  status: string;
  varianceThreshold: number;
  scheduledDate: string;
  completedDate: string | null;
  initiatedBy: string;
  countTasks: CycleCountTask[];
}

export interface CycleCountTask {
  id?: string;
  itemId?: string;
  locationId?: string;
  expectedQuantity?: number;
  countedQuantity?: number;
  status?: string;
  [key: string]: unknown;
}

export interface CreateCycleCountDto {
  warehouseId: string;
  targetLocationIds: string[];
  targetItemIds: string[];
  varianceThreshold: number;
  scheduledDate: string;
  initiatedBy: string;
}

/** Records the counted items for one count task. */
export interface SubmitCycleCountResultsDto {
  countTaskId: string;
  countedItems: Array<{
    itemId: string;
    countedQuantityAmount: number;
    uomCode: string;
    uomName: string;
    lotNumber?: string | null;
  }>;
}

export interface LotTracking {
  id: string;
  itemId: string;
  lotNumber: string;
  serialNumber?: string;
  quantity: number;
  expiryDate?: Date;
  manufacturingDate?: Date;
  supplierId?: string;
  status: 'active' | 'expired' | 'quarantine';
  binCode: string;
}

export interface ReplenishmentAlert {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  currentQty: number;
  minThreshold: number;
  reorderPoint: number;
  suggestedQty: number;
  priority: 'high' | 'medium' | 'low';
  warehouseName: string;
}

export interface BinNode {
  key: string;
  label: string;
  data: {
    type: 'warehouse' | 'zone' | 'bin';
    code: string;
    capacity?: number;
    used?: number;
    utilization?: number;
  };
  icon: string;
  children?: BinNode[];
}

export interface InventoryFilter {
  page?: number;
  limit?: number;
  search?: string;
  warehouseId?: string;
  category?: string;
  status?: string;
  strategy?: string;
  zoneId?: string;
}

/** A physical stock balance held at one storage location. */
export interface InventoryRecord {
  id: string;
  itemId: string;
  itemName: string;
  sku: string;
  storageLocationId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  uomCode: string;
  uomName: string;
  lotNumber?: string | null;
  serialNumber?: string | null;
  expirationDate?: string | null;
  receivedDate: string;
  status: string;
  lastMovementAt?: string | null;
}

export interface InventoryReservationRequest {
  orderId: string;
  quantity: number;
}

export interface InventoryQuarantineRequest {
  reason: string;
}
