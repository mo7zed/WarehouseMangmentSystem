# 🚀 TACHYON WMS — Enterprise Warehouse Management System

> A next-generation, enterprise-grade logistics platform built with **Angular 18** & **PrimeNG** for Saudi Arabian businesses and MENA expansion.

## 📋 Quick Links

- [Quick Start](#-quick-start) — Get up and running in 5 minutes
- [Features](#-features) — Complete feature overview
- [Technology Stack](#-technology-stack) — Tech details
- [Setup Guide](./SETUP_GUIDE.md) — Comprehensive setup instructions
- [Implementation Roadmap](./IMPLEMENTATION_ROADMAP.md) — Project status & timeline
- [API Documentation](./SETUP_GUIDE.md#-api-integration) — Endpoint details

## 🎯 Quick Start

### Prerequisites
- Node.js 18+ ([Download](https://nodejs.org/))
- Angular CLI 18 (`npm install -g @angular/cli@18`)
- Git

### Installation (5 minutes)

```bash
# 1. Clone & enter directory
git clone https://github.com/tachyon/wms.git && cd wms

# 2. Install dependencies
npm install

# 3. Configure API endpoint
# Edit src/environments/environment.ts
# Replace 'your-railway-app' with your Railway URL

# 4. Start development server
npm start
# Server runs at http://localhost:4200

# 5. Login with any credentials (mock auth enabled)
```

## ✨ Key Features

| Feature | Status | Details |
|---------|--------|---------|
| **Dashboard** | ✅ Complete | KPIs, charts, alerts, quick actions |
| **Inventory** | 🔄 Scaffolded | Stock management, bin hierarchy, cycle counts |
| **Receiving** | 🔄 Scaffolded | ASN tracking, multi-step receiving wizard |
| **Orders & Picking** | 🔄 Scaffolded | Order management, wave picking, pack verification |
| **Shipping** | 🔄 Scaffolded | Shipment creation, label generation, TMS sync |
| **Returns** | 🔄 Scaffolded | RMA workflow, disposition management |
| **Reports** | 🔄 Scaffolded | Analytics, exports (CSV/Excel), scheduling |
| **Labor** | 🔄 Scaffolded | Task assignment, performance tracking |
| **Settings** | 🔄 Scaffolded | Warehouse config, UOM, integrations |
| **Admin** | 🔄 Scaffolded | RBAC, audit logs, system health |

## 🛠️ Technology Stack

```
Frontend: Angular 18 + RxJS + Signals
UI: PrimeNG 17 + PrimeFlex + PrimeIcons
i18n: ngx-translate (EN/AR with RTL)
HTTP: HttpInterceptors (JWT + Error handling)
State: Angular Signals + Computed
Styling: SCSS + PrimeNG Theme
Build: Angular CLI 18 + SSR support
```

## 📁 Project Structure

See [SETUP_GUIDE.md](./SETUP_GUIDE.md#-project-structure) for complete structure overview.

Key directories:
- `src/app/core/` — Auth, guards, interceptors, services
- `src/app/features/` — 10 business modules (lazy-loaded)
- `src/app/layout/` — Shell components (sidebar, topbar)
- `src/app/shared/` — Directives, pipes, utilities
- `src/assets/i18n/` — Translation files (en.json, ar.json)

## 🚀 Getting Started

### Development

```bash
# Start dev server
npm start

# Run tests
npm test

# Run linting
npm run lint

# Build for dev
npm run build
```

### Production

```bash
# Production build (optimized)
npm run build -- --configuration=production

# Bundle analysis
ng build --stats-json && webpack-bundle-analyzer dist/wms/stats.json

# Serve production build
npm run serve:ssr:wms
```

## 📖 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Installation, API integration, troubleshooting |
| [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md) | Feature status, timelines, development tasks |
| This README | Project overview & quick reference |

## 🔐 Authentication

### Login
- Email: Any format (mock auth)
- Password: Any value (mock auth)

### Production
Replace mock auth in `src/app/core/auth/auth.service.ts` with real API calls:
```typescript
login(email: string, password: string): Observable<AuthResponse> {
  return this.api.post<AuthResponse>('auth/login', { email, password }).pipe(
    tap(res => this.handleAuthSuccess(res))
  );
}
```

## 🌍 Internationalization

### Languages Supported
- **English (EN)** — LTR layout
- **العربية (AR)** — RTL layout

### Change Language
Language toggle in top-right corner automatically:
- Switches all UI text
- Sets document direction (RTL/LTR)
- Updates date/time formats
- Applies RTL styling

### Add Translations
1. Edit `src/assets/i18n/en.json` (English)
2. Edit `src/assets/i18n/ar.json` (Arabic)
3. Use in templates: `{{ 'KEY.PATH' | translate }}`

## 🎯 Role-Based Access Control

### User Roles
- **admin** — Full system access
- **manager** — Module management
- **supervisor** — Team oversight
- **operator** — Task execution

### Permission System
- Feature-level: `inventory.read`, `orders.write`, etc.
- Route-level: Guards check user role against route config
- UI-level: `*hasPermission="'module.action'"` directive

Example:
```html
<button *hasPermission="'inventory.write'">Edit Inventory</button>
<button *hasPermission="'admin.access'">Admin Panel</button>
```

## 📡 API Integration

### Environment Configuration
Update `src/environments/environment.ts`:
```typescript
apiUrl: 'https://your-railway-app.railway.app/api/v1'
```

### Making API Calls
```typescript
// Inject BaseApiService
private api = inject(BaseApiService);

// GET with filters
this.api.get('inventory/items', { page: 1, limit: 20 })

// POST
this.api.post('orders', orderData)

// PUT
this.api.put(`orders/${id}`, updatedData)

// DELETE
this.api.delete(`items/${id}`)
```

All requests automatically include JWT Bearer token.

## 🎨 Theme Customization

### Change PrimeNG Theme
Edit `src/styles.scss`:
```scss
// Current:
@import "primeng/resources/themes/lara-dark-blue/theme.css";

// Available: lara-light-blue, lara-dark-indigo, aura-light-blue, etc.
```

### Update Brand Colors
Edit `:root` CSS variables in `src/styles.scss`:
```scss
--brand-primary: #1E3A5F;        // Deep blue
--brand-accent: #00B4D8;         // Teal
--color-success: #10b981;        // Green
--color-warning: #f59e0b;        // Amber
--color-danger: #ef4444;         // Red
```

## 📊 State Management

Uses **Angular Signals** for reactive state:

```typescript
import { signal, computed } from '@angular/core';

export class InventoryStore {
  private items = signal<Item[]>([]);
  private loading = signal(false);

  readonly items$ = computed(() => this.items());
  readonly loading$ = computed(() => this.loading());

  loadItems() {
    this.loading.set(true);
    this.service.getItems().subscribe({
      next: (data) => {
        this.items.set(data);
        this.loading.set(false);
      }
    });
  }
}
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test
ng test --include='**/my-feature.spec.ts'

# Run with coverage report
ng test --code-coverage
```

## 🚢 Deployment

### Railway
```bash
# 1. Push to GitHub
git push

# 2. Connect to Railway in dashboard
# 3. Railway auto-deploys on push
# 4. Access at https://your-app.railway.app
```

### Docker
```bash
docker build -t tachyon-wms .
docker run -p 8080:80 tachyon-wms
```

## 🐛 Troubleshooting

### "Cannot find module" errors
- Ensure all routes use correct import paths
- Check component exports: `export class MyComponent { }`
- Verify file exists in expected location

### RTL not applying
- Check TranslateService initialization in AppLayout
- Verify `document.documentElement.dir` is set
- Check browser console for errors

### API calls failing (401)
- Verify JWT token in localStorage: `localStorage.getItem('wms_token')`
- Check JWT interceptor is registered in app.config.ts
- Verify Bearer header format: `Authorization: Bearer <token>`

### Build too large
- Use `--build-optimizer` flag
- Enable tree-shaking
- Analyze bundle: `webpack-bundle-analyzer dist/wms/stats.json`

See [SETUP_GUIDE.md](./SETUP_GUIDE.md#-troubleshooting) for more solutions.

## 📚 Additional Resources

- [Angular 18 Documentation](https://angular.io/docs)
- [PrimeNG Components](https://primeng.org/)
- [ngx-translate Guide](https://github.com/ngx-translate/core)
- [RxJS Documentation](https://rxjs.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/)

## 🤝 Contributing

1. Create feature branch: `git checkout -b feature/amazing-feature`
2. Commit changes: `git commit -m 'Add feature'`
3. Push to branch: `git push origin feature/amazing-feature`
4. Open Pull Request

## 📞 Support & Issues

- **GitHub Issues**: Report bugs and request features
- **Email**: support@tachyon.local
- **Documentation**: See SETUP_GUIDE.md and IMPLEMENTATION_ROADMAP.md

## 📄 License

Proprietary © 2026 TACHYON Logistics. All rights reserved.

---

**Status**: Production-Ready Scaffolding ✅  
**Last Updated**: May 31, 2026  
**Next Phase**: Detailed feature implementation  

🚀 Ready to build something amazing!


## Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

## Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
# GitHub Pages

The project is configured for automatic deployment to GitHub Pages. After pushing
the `master` branch to GitHub, open the repository **Settings → Pages** and set
**Source** to **GitHub Actions**. The site will be available at:

https://mo7zed.github.io/WarehouseMangmentSystem/

Build the static frontend locally with `npm run build:pages`. Publish only
`dist/wms/browser`; this configuration does not build a Node.js server or
prerender authenticated pages. Hash-based routes (for example `#/login`) allow
direct links and refreshes on GitHub Pages.

The frontend continues to use the external Railway API configured in
`src/environments/environment.prod.ts`. The API must allow requests from
`https://mo7zed.github.io` through its CORS configuration.
