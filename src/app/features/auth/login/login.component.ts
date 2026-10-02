import { Component, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { ButtonModule } from 'primeng/button';
import { CheckboxModule } from 'primeng/checkbox';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { AuthService, MobileOnlyRoleError } from '../../../core/auth/auth.service';
import { applyDocumentLanguage } from '../../../core/i18n/translate.initializer';
import { getApiErrorMessage } from '../../../core/utils/api-error.util';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule, TranslateModule,
    InputTextModule, PasswordModule, ButtonModule, CheckboxModule,
    MessageModule, ProgressSpinnerModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fb = inject(FormBuilder);
  private translate = inject(TranslateService);

  loading = signal(false);
  errorMsg = signal<string | null>(null);
  currentLang = signal('en');
  private mobileOnlyDenied = false;
  year = new Date().getFullYear();

  loginForm = this.fb.group({
    usernameOrEmail: ['', [Validators.required]],
    password: ['', [Validators.required]],
    remember: [false],
  });

  constructor() {
    const saved =
      (typeof localStorage !== 'undefined' && localStorage.getItem('wms_lang')) || 'en';
    this.currentLang.set(saved);
    applyDocumentLanguage(saved);
    if (this.route.snapshot.queryParamMap.get('mobileOnly') === '1') {
      this.mobileOnlyDenied = true;
      this.errorMsg.set(this.translate.instant('AUTH.MOBILE_ONLY_ACCOUNT'));
    }
  }

  setLang(lang: string): void {
    this.currentLang.set(lang);
    this.translate.use(lang).subscribe(() => {
      applyDocumentLanguage(lang);
      if (this.mobileOnlyDenied) this.errorMsg.set(this.translate.instant('AUTH.MOBILE_ONLY_ACCOUNT'));
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('wms_lang', lang);
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMsg.set(null);
    this.mobileOnlyDenied = false;

    const { usernameOrEmail, password, remember } = this.loginForm.value;

    this.authService.login(usernameOrEmail!, password!, 'string', !!remember).subscribe({
      next: () => {
        this.loading.set(false);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl?.startsWith('/') && !returnUrl.startsWith('//') ? returnUrl : '/dashboard');
      },
      error: (err: HttpErrorResponse | MobileOnlyRoleError) => {
        this.loading.set(false);
        if (err instanceof MobileOnlyRoleError) {
          this.mobileOnlyDenied = true;
          this.errorMsg.set(this.translate.instant('AUTH.MOBILE_ONLY_ACCOUNT'));
        } else if (err.status === 401) {
          this.errorMsg.set(this.translate.instant('AUTH.INVALID_CREDENTIALS'));
        } else {
          this.errorMsg.set(
            getApiErrorMessage(err, this.translate.instant('AUTH.LOGIN_FAILED'))
          );
        }
      }
    });
  }
}
