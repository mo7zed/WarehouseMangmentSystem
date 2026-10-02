import { APP_INITIALIZER } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

const LANG_KEY = 'wms_lang';

export function applyDocumentLanguage(lang: string): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.body.dir = document.documentElement.dir;
}

export function initTranslateFactory(translate: TranslateService): () => Promise<unknown> {
  return () => {
    const lang =
      (typeof localStorage !== 'undefined' && localStorage.getItem(LANG_KEY)) || 'en';

    translate.setDefaultLang('en');
    applyDocumentLanguage(lang);

    // Skip HTTP translation load during SSR prerender (no asset server).
    if (typeof window === 'undefined') {
      return Promise.resolve();
    }

    return firstValueFrom(translate.use(lang));
  };
}

export const provideTranslateInitializer = {
  provide: APP_INITIALIZER,
  useFactory: initTranslateFactory,
  deps: [TranslateService],
  multi: true,
};
