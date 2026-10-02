export interface StorageLocationCapacity {
  maxWeightKg: number;
  maxVolumeM3: number;
  maxItemCount: number | null;
}

export interface StorageLocationUtilization {
  usedWeightKg: number;
  usedVolumeM3: number;
  currentItemCount: number;
}

export interface StorageLocationDimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface StorageLocation {
  id: string;
  binCode: string;
  warehouseId: string;
  zoneId: string;
  aisleId: string;
  rackId: string;
  shelfId: string;
  storageType: string;
  capacity: StorageLocationCapacity;
  currentUtilization: StorageLocationUtilization;
  status: string;
  dimensions: StorageLocationDimensions;
  isActive: boolean;
  lastActivityAt: string;
}

export interface CreateStorageLocationDto {
  zoneId: string;
  aisleId: string;
  rackId: string;
  shelfId: string;
  binLabel: string;
  storageType: string;
  maxWeightKg: number;
  maxVolumeM3: number;
  maxItemCount: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

export interface BlockStorageLocationDto {
  reason: string;
}
