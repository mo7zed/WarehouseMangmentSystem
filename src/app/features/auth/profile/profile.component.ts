import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../../core/auth/auth.service';
@Component({
 selector: 'app-profile', standalone: true, imports: [CommonModule, TranslateModule],
 template: `<div class="page-header"><h1 class="page-title">{{ 'TOPBAR.MY_PROFILE' | translate }}</h1></div>
 <section class="section-card"><div class="section-card-body" style="display:grid;gap:1rem;" *ngIf="user() as profile">
 <div><strong>{{ 'UI.FULL_NAME' | translate }}</strong><p>{{ profile.name }}</p></div>
 <div><strong>{{ 'UI.USERNAME' | translate }}</strong><p>{{ profile.username }}</p></div>
 <div><strong>{{ 'UI.EMAIL' | translate }}</strong><p>{{ profile.email }}</p></div>
 <div><strong>{{ 'UI.ROLE' | translate }}</strong><p>{{ profile.role }}</p></div>
 <div id="password"><h2>{{ 'TOPBAR.CHANGE_PASSWORD' | translate }}</h2><p>{{ 'AUTH.PASSWORD_SUPPORT' | translate }}</p></div>
 </div></section>`,
})
export class ProfileComponent { readonly user = inject(AuthService).currentUser; }
