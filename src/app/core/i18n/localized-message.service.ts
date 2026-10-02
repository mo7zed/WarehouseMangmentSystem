import { Injectable, inject } from '@angular/core';
import { Message, MessageService } from 'primeng/api';
import { TranslateService } from '@ngx-translate/core';
import { translateLabel } from '../../shared/pipes/ui-label.pipe';
@Injectable()
export class LocalizedMessageService extends MessageService {
 private readonly translate = inject(TranslateService);
 override add(message: Message): void {
  super.add({ ...message,
   summary: message.summary ? translateLabel(this.translate, message.summary) : undefined,
   detail: message.detail ? translateLabel(this.translate, message.detail) : undefined,
  });
 }
 override addAll(messages: Message[]): void { messages.forEach(message => this.add(message)); }
}
