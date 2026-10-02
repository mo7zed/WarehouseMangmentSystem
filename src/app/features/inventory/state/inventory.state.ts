import { createFeature, createReducer, createSelector, on } from '@ngrx/store';
import { InventoryRecord } from '../../../core/models/inventory.model';
import { InventoryActions } from './inventory.actions';

export interface InventoryRecordView extends InventoryRecord {
  binName: string;
}

export interface InventoryState {
  items: InventoryRecordView[];
  loading: boolean;
  error: string | null;
}

const initialState: InventoryState = {
  items: [],
  loading: false,
  error: null,
};

export const inventoryFeature = createFeature({
  name: 'inventory',
  reducer: createReducer(
    initialState,
    on(InventoryActions.loadRecords, state => ({ ...state, items: [], loading: true, error: null })),
    on(InventoryActions.refreshRecords, state => ({ ...state, loading: true, error: null })),
    on(InventoryActions.loadRecordsSuccess, (state, { items }) => ({ ...state, items, loading: false })),
    on(InventoryActions.loadRecordsFailure, (state, { error }) => ({ ...state, items: [], loading: false, error })),
  ),
});

export const selectInventoryRecordCount = createSelector(inventoryFeature.selectItems, items => items.length);
export const selectInventoryStatusOptions = createSelector(inventoryFeature.selectItems, items =>
  [...new Set(items.map(item => item.status))].map(status => ({ label: status, value: status })),
);
export const selectInventoryBinOptions = createSelector(inventoryFeature.selectItems, items =>
  [...new Set(items.map(item => item.binName))].sort().map(binName => ({ label: binName, value: binName })),
);
