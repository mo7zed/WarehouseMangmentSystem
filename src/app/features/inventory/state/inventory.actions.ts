import { createActionGroup, emptyProps, props } from '@ngrx/store';
import type { InventoryRecordView } from './inventory.state';

export const InventoryActions = createActionGroup({
  source: 'Inventory',
  events: {
    'Load Records': emptyProps(),
    'Load Records Success': props<{ items: InventoryRecordView[] }>(),
    'Load Records Failure': props<{ error: string }>(),
    'Refresh Records': emptyProps(),
  },
});
