import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { applyDocumentLanguage } from '../../core/i18n/translate.initializer';
import { ButtonModule } from 'primeng/button';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { BadgeModule } from 'primeng/badge';
import { AvatarModule } from 'primeng/avatar';
import { AuthService } from '../../core/auth/auth.service';
import { LayoutService } from '../../core/services/layout.service';
import { RealtimeNotificationService } from '../../core/realtime/realtime-notification.service';
import { WarehouseContextService } from '../../core/warehouse/warehouse-context.service';
import { FormsModule } from '@angular/forms';
import { DropdownModule } from 'primeng/dropdown';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [
    CommonModule, RouterLink, TranslateModule,
    ButtonModule, OverlayPanelModule, BadgeModule, AvatarModule, FormsModule, DropdownModule,
  ],
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss'
})
export class TopbarComponent implements OnInit {
  private authService = inject(AuthService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private layout = inject(LayoutService);
  private realtimeNotifications = inject(RealtimeNotificationService);
  private warehouseContext = inject(WarehouseContextService);

  user = this.authService.currentUser;
  currentLang = signal<string>('en');

  readonly notifCount = this.realtimeNotifications.unreadCount;
  readonly notifications = this.realtimeNotifications.notifications;
  readonly realtimeConnected = this.realtimeNotifications.isConnected;
  readonly warehouses = this.warehouseContext.warehouses;
  readonly selectedWarehouseId = this.warehouseContext.selectedWarehouseId;


  greeting(): string {
    const h = new Date().getHours();
    if (h < 12) return this.translate.instant('TOPBAR.GOOD_MORNING');
    if (h < 17) return this.translate.instant('TOPBAR.GOOD_AFTERNOON');
    return this.translate.instant('TOPBAR.GOOD_EVENING');
  }

  languageFlag(): string {
    return this.currentLang() === 'en' ? '\u{1F1F8}\u{1F1E6}' : '\u{1F1EC}\u{1F1E7}';
  }

  languageLabel(): string {
    return this.currentLang() === 'en'
      ? '\u0627\u0644\u0639\u0631\u0628\u064A\u0629'
      : 'English';
  }

  userInitials(): string {
    const name = this.user()?.name ?? 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  }

  ngOnInit(): void {
    const saved =
      (typeof localStorage !== 'undefined' && localStorage.getItem('wms_lang')) ||
      this.translate.currentLang ||
      'en';
    this.currentLang.set(saved);
    this.warehouseContext.initialize();
    void this.realtimeNotifications.start();
  }

  toggleLanguage(): void {
    const newLang = this.currentLang() === 'en' ? 'ar' : 'en';
    this.currentLang.set(newLang);
    this.translate.use(newLang).subscribe(() => {
      applyDocumentLanguage(newLang);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wms_lang', newLang);
      }

    });
  }

  toggleMobileMenu(): void {
    this.layout.toggleMobileMenu();
  }

  markAllRead(): void {
    this.realtimeNotifications.markAllRead();
  }

  selectWarehouse(warehouseId: string): void {
    this.warehouseContext.selectWarehouse(warehouseId);
  }
  goToProfile(userMenu: { hide(): void }): void {
  userMenu.hide();
  this.router.navigate(['/profile']);
}

changePassword(userMenu: { hide(): void }): void {
  userMenu.hide();

  this.router.navigate(['/profile'], { fragment: 'password' });
}

logout(userMenu: { hide(): void }): void {
  userMenu.hide();
  this.authService.logout();
}
}
