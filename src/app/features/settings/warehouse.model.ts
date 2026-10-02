export interface Warehouse {
  id: string;
  code: string;
  name: string;
  address: {
    street: string;
    city: string;
    region: string;
    postalCode: string;
    country: string;
    coordinates: {
      latitude: number;
      longitude: number;
    } | null;
  };
  dimensions: {
    totalAreaM2: number;
    usableAreaM2: number;
    ceilingHeightM: number;
  };
  operationalStatus: 'UnderSetup' | 'Active' | 'Inactive' | 'Maintenance';
  timezone: string;
  zones: WarehouseZone[];
  createdAt: string;
  updatedAt: string;
}

/** Warehouse layout returned by GET /warehouses/{id}. */
export interface WarehouseZone {
  id: string;
  code?: string;
  name?: string;
  aisles?: WarehouseAisle[];
}

export interface WarehouseAisle {
  id: string;
  code?: string;
  racks?: WarehouseRack[];
}

export interface WarehouseRack {
  id: string;
  code?: string;
  shelves?: WarehouseShelf[];
}

export interface WarehouseShelf {
  id: string;
  code?: string;
  level?: number;
}

export interface CreateWarehouseDto {
  code: string;
  name: string;
  street: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  latitude: number;
  longitude: number;
  totalAreaM2: number;
  usableAreaM2: number;
  ceilingHeightM: number;
  timezone: string;
}

export interface UpdateWarehouseDto extends Partial<CreateWarehouseDto> {
  id: string;
}
