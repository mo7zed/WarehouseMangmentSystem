import { ApplicationConfig, importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withPreloading, PreloadAllModules, withHashLocation } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { TranslateModule, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import { HttpClient } from '@angular/common/http';
import { MessageService, ConfirmationService } from 'primeng/api';
import { provideEffects } from '@ngrx/effects';
import { provideStore } from '@ngrx/store';
import { provideStoreDevtools } from '@ngrx/store-devtools';
import { routes } from './app.routes';
import { jwtInterceptor } from './core/interceptors/jwt.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { provideTranslateInitializer } from './core/i18n/translate.initializer';
import { environment } from '../environments/environment';
import { InventoryEffects } from './features/inventory/state/inventory.effects';
import { inventoryFeature } from './features/inventory/state/inventory.state';
import { LocalizedMessageService } from './core/i18n/localized-message.service';

export function createTranslateLoader(http: HttpClient) {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideStore({ [inventoryFeature.name]: inventoryFeature.reducer }),
    provideEffects(InventoryEffects),
    ...(environment.production ? [] : [provideStoreDevtools({ maxAge: 25, logOnly: true })]),
    provideRouter(routes, withPreloading(PreloadAllModules), ...(environment.hashRouting ? [withHashLocation()] : [])),
    provideHttpClient(withFetch(), withInterceptors([jwtInterceptor, errorInterceptor])),
    provideAnimationsAsync(),
    provideTranslateInitializer,
    { provide: MessageService, useClass: LocalizedMessageService },
    ConfirmationService,
    importProvidersFrom(
      TranslateModule.forRoot({
        defaultLanguage: 'en',
        loader: {
          provide: TranslateLoader,
          useFactory: createTranslateLoader,
          deps: [HttpClient],
        },
      })
    ),
  ],
};
