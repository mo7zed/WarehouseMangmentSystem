import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppLayoutComponent } from './layout/app-layout/app-layout.component';

export const routes: Routes = [
  // Redirect root to dashboard
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

  // Auth routes (no layout)
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'forgot-password',
    loadComponent: () =>
      import('./features/auth/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent,
      ),
  },

  // Protected routes with layout
  {
    path: '',
    component: AppLayoutComponent,
    canActivate: [authGuard],
    canActivateChild: [authGuard],
    children: [
      { path: 'profile', loadComponent: () => import('./features/auth/profile/profile.component').then(m => m.ProfileComponent) },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then(
            (m) => m.DashboardComponent,
          ),
      },
      {
        path: 'inventory',
        loadChildren: () =>
          import('./features/inventory/inventory.routes').then(
            (m) => m.inventoryRoutes,
          ),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'receiving',
        loadChildren: () =>
          import('./features/receiving/receiving.routes').then(
            (m) => m.receivingRoutes,
          ),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager', 'receiving_clerk'] },
      },
      {
        path: 'orders',
        loadChildren: () =>
          import('./features/orders/orders.routes').then((m) => m.ordersRoutes),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager', 'picker'] },
      },
      {
        path: 'shipping',
        loadChildren: () =>
          import('./features/shipping/shipping.routes').then(
            (m) => m.shippingRoutes,
          ),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager', 'shipping_clerk'] },
      },
      {
        path: 'returns',
        loadChildren: () =>
          import('./features/returns/returns.routes').then(
            (m) => m.returnsRoutes,
          ),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'reports',
        loadChildren: () =>
          import('./features/reports/reports.routes').then(
            (m) => m.reportsRoutes,
          ),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager', 'analyst'] },
      },
      {
        path: 'labor',
        loadChildren: () =>
          import('./features/labor/labor.routes').then((m) => m.laborRoutes),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'settings',
        loadChildren: () =>
          import('./features/settings/settings.routes').then(
            (m) => m.settingsRoutes,
          ),
        canActivate: [roleGuard],
        data: { roles: ['admin', 'manager'] },
      },
      {
        path: 'admin',
        loadChildren: () =>
          import('./features/admin/admin.routes').then((m) => m.adminRoutes),
        canActivate: [roleGuard],
        data: { roles: ['admin'] },
      },
    ],
  },

  // Wildcard route — redirect to dashboard
  { path: '**', redirectTo: 'dashboard' },
];
