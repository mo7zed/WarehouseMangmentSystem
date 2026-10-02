export interface InboundShipmentLine {
  id: string;
  itemId: string;
  sku: string;
  itemName: string;
  receivedQuantity: number;
  uomCode: string;
  uomName: string;
  lotNumber?: string | null;
  serialNumber?: string | null;
  expirationDate?: string | null;
  condition: string;
  receivedBy: string;
  receivedAt: string;
}

export interface InboundShipmentDiscrepancy {
  id?: string;
  lineId: string;
  type: string;
  description: string;
  reportedBy: string;
  reportedAt?: string;
}

export interface InboundShipmentInspection {
  id?: string;
  inspectedBy: string;
  result: string;
  notes?: string | null;
  inspectedAt?: string;
}

export interface InboundShipment {
  id: string;
  asnId?: string | null;
  warehouseId: string;
  status: string;
  arrivedAt?: string | null;
  completedAt?: string | null;
  receivingLines: InboundShipmentLine[];
  discrepancies: InboundShipmentDiscrepancy[];
  inspections: InboundShipmentInspection[];
}

export interface CreateInboundShipmentLineDto {
  itemId: string;
  sku: string;
  itemName: string;
  receivedQuantity: number;
  uomCode: string;
  uomName: string;
  lotNumber?: string;
  serialNumber?: string;
  expirationDate?: string;
  condition: string;
  receivedBy: string;
}

export interface CreateInboundShipmentDto {
  warehouseId: string;
  asnId?: string;
  lines: CreateInboundShipmentLineDto[];
}
