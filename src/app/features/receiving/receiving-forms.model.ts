import { InboundShipmentLine } from './inbound-shipment.model';

export interface CreateAsnLineFormLine {
  itemId: string;
  sku: string;
  itemName: string;
  expectedQuantity: number;
  uomCode: string;
  uomName: string;
  lotNumber: string;
  expirationDate: Date | null;
}

export interface CreateAsnForm {
  supplierId: string;
  supplierName: string;
  expectedArrivalDate: Date | null;
  notes: string;
  lines: CreateAsnLineFormLine[];
}

export interface InboundLineForm extends Omit<InboundShipmentLine, 'id' | 'receivedAt' | 'expirationDate'> { expirationDate: Date | null; }

export interface InboundShipmentForm { asnId: string; lines: InboundLineForm[]; }

export interface PutawayRecommendationForm {
  itemId: string;
  sku: string;
  itemName: string;
  quantity: number;
  uomCode: string;
  uomName: string;
  lotNumber: string;
  expirationDate: Date | null;
}
