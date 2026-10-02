import { TranslateModule } from '@ngx-translate/core';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { TopbarComponent } from '../topbar/topbar.component';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { TranslateService } from '@ngx-translate/core';
import { applyDocumentLanguage } from '../../core/i18n/translate.initializer';
import { LayoutService } from '../../core/services/layout.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [TranslateModule,
    CommonModule,
    RouterOutlet,
    SidebarComponent,
    TopbarComponent,
    ToastModule,
    ConfirmDialogModule,
  ],
  templateUrl: './app-layout.component.html',
  styleUrl: './app-layout.component.scss',
})
export class AppLayoutComponent implements OnInit {
  private translate = inject(TranslateService);
  private layout = inject(LayoutService);
  private destroyRef = inject(DestroyRef);

  isRTL = () => this.translate.currentLang === 'ar';
  mobileMenuOpen = this.layout.mobileMenuOpen;

  closeMobileMenu(): void {
    this.layout.closeMobileMenu();
  }

  ngOnInit() {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => {
      applyDocumentLanguage(event.lang);
    });

    const lang =
      this.translate.currentLang ||
      (typeof localStorage !== 'undefined' && localStorage.getItem('wms_lang')) ||
      'en';
    applyDocumentLanguage(lang);
  }
}
