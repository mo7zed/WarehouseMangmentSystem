export interface PutawayTask {
  id: string;
  shipmentId: string;
  warehouseId: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantityToPlace: number;
  uomCode: string;
  uomName: string;
  lotNumber: string | null;
  serialNumber: string | null;
  expirationDate: string | null;
  recommendedBinId: string | null;
  recommendedBinLabel: string | null;
  actualBinId: string | null;
  allocationMode: string;
  status: string;
  priority: string;
  assignedTo: string | null;
  assignedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  overrideReason: string | null;
  createdAt: string;
}

export interface PutawayRecommendationRequest {
  warehouseId: string;
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  uomCode: string;
  uomName: string;
  lotNumber?: string;
  expirationDate?: string;
}

/** The API may include additional scoring or capacity details for a recommendation. */
export interface PutawayRecommendation {
  recommendedBinId?: string | null;
  recommendedBinLabel?: string | null;
  binId?: string | null;
  binLabel?: string | null;
  allocationMode?: string | number | null;
  [key: string]: unknown;
}

export interface AssignPutawayTaskDto { operatorId: string; }

export interface CompletePutawayTaskDto {
  operatorId: string;
  actualBinId: string;
  overrideReason?: string;
}
