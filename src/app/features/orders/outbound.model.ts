export interface PickTask {
  id: string;
  waveId: string;
  warehouseId: string;
  zoneId: string;
  orderId: string;
  orderLineId: string;
  itemId: string;
  sku: string;
  sourceLocationId: string;
  binLabel: string;
  requestedQuantity: number;
  pickedQuantity: number | null;
  uomCode: string;
  uomName: string;
  lotNumber?: string | null;
  expirationDate?: string | null;
  assignedOperatorId?: string | null;
  priority: string;
  status: string;
  pickSequence: number;
  assignedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  shortPickReason?: string | null;
  createdAt: string;
}

export interface WarehouseUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  roles: { roleName: string }[];
}

export interface PackTaskItem {
  id: string;
  itemId: string;
  sku: string;
  quantity: number;
  uomCode: string;
  lotNumber?: string | null;
  isVerified: boolean;
}

export interface PackTask {
  id: string;
  orderId: string;
  warehouseId: string;
  status: string;
  containerType: string;
  totalWeightKg: number;
  assignedOperatorId?: string | null;
  verifiedBy?: string | null;
  packedAt?: string | null;
  failureReason?: string | null;
  createdAt: string;
  items: PackTaskItem[];
}

export interface CreatePackTaskDto {
  orderId: string;
  warehouseId: string;
  containerType: string;
  assignedOperatorId: string;
  items: CreatePackTaskItemDto[];
}

export interface CreatePackTaskItemDto {
  itemId: string;
  sku: string;
  quantity: number;
  uomCode: string;
  weightKgPerUnit: number;
  lotNumber: string;
}

export interface PickWave {
  id: string;
  warehouseId: string;
  waveType: string;
  status: string;
  totalTasks: number;
  completedTasks: number;
  createdBy: string;
  createdAt: string;
  releasedAt?: string | null;
  completedAt?: string | null;
  orderIds: string[];
  pickTaskIds: string[];
}

export interface CreatePickWaveDto {
  warehouseId: string;
  waveType: string;
  createdByUserId: string;
  lines: CreatePickWaveLineDto[];
}

export interface CreatePickWaveLineDto {
  /** Used only by the create-pick-wave form; it is omitted before the API request. */
  inventoryRecordId?: string;
  orderId: string;
  orderLineId: string;
  itemId: string;
  sku: string;
  sourceBinId: string;
  zoneId: string;
  binLabel: string;
  quantity: number;
  uomCode: string;
  uomName: string;
  itemLengthCm: number;
  itemWidthCm: number;
  itemHeightCm: number;
  itemWeightKg: number;
  lotNumber: string;
  expirationDate?: string | null;
  priority: string;
}
