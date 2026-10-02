import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export function labelKey(value: string): string {
 return 'UI.' + value.replace(/([a-z])([A-Z])/g, '$1_$2').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}
export function translateLabel(translate: TranslateService, value: string): string {
 const key = labelKey(value);
 const translated: unknown = translate.instant(key);
 return typeof translated === 'string' && translated !== key ? translated : value;
}
@Pipe({ name: 'uiLabel', standalone: true, pure: false })
export class UiLabelPipe implements PipeTransform {
 private translate = inject(TranslateService);
 transform(value: string | number | null | undefined): string {
  return value == null ? '—' : translateLabel(this.translate, String(value));
 }
}
@Pipe({ name: 'uiOptions', standalone: true, pure: false })
export class UiOptionsPipe implements PipeTransform {
 private translate = inject(TranslateService);
 private previous: unknown;
 private language = '';
 private result: unknown[] = [];
 transform<T extends { label: string }>(options: T[]): T[] {
  if (options !== this.previous || this.language !== this.translate.currentLang) {
   this.previous = options; this.language = this.translate.currentLang;
   this.result = options.map(option => ({ ...option, label: translateLabel(this.translate, option.label) }));
  }
  return this.result as T[];
 }
}
