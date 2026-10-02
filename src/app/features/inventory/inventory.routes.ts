import { Routes } from '@angular/router';

export const inventoryRoutes: Routes = [
  {
    path: '',
    redirectTo: 'stock', pathMatch: 'full',
    title: 'Inventory — Tachyon WMS'
  },
  {
    path: 'stock',
    loadComponent: () => import('./inventory-list/inventory-list.component').then(m => m.InventoryListComponent),
    title: 'Stock Overview — Tachyon WMS'
  },
  {
    path: 'items',
    loadComponent: () => import('./catalog-list/catalog-list.component').then(m => m.CatalogListComponent),
    title: 'catalog Items — Tachyon WMS'
  },
  {
    path: 'bins',
    loadComponent: () => import('./bin-tree/bin-tree.component').then(m => m.BinTreeComponent),
    title: 'Bin Management — Tachyon WMS'
  },
  {
    path: 'cycle-counts',
    loadComponent: () => import('./cycle-count/cycle-count.component').then(m => m.CycleCountComponent),
    title: 'Cycle Counting — Tachyon WMS'
  },
  {
    path: 'replenishment',
    loadComponent: () => import('./replenishment/replenishment.component').then(m => m.ReplenishmentComponent),
    title: 'Replenishment — Tachyon WMS'
  },
];
