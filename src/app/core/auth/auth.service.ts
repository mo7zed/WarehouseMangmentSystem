import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { jwtDecode } from 'jwt-decode';
import { Observable, throwError } from 'rxjs';
import { catchError, finalize, shareReplay, tap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { AuthResponse, JwtPayload, LoginRequest, RefreshTokenRequest, UserProfile } from '../models/auth.model';
import { SKIP_AUTH, SKIP_REFRESH } from '../interceptors/auth-http-context';

const TOKEN_KEY = 'wms_token';
const REFRESH_TOKEN_KEY = 'wms_refresh_token';
const USER_KEY = 'wms_user';
const ACCESS_TOKEN_EXPIRES_KEY = 'wms_access_token_expires_at';
const REFRESH_TOKEN_EXPIRES_KEY = 'wms_refresh_token_expires_at';
const ROLE_CLAIM = 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role';

export class MobileOnlyRoleError extends Error {
  constructor() { super('This account is for the mobile app. Please sign in on your phone.'); }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = environment.apiUrl;
  private refreshRequest$: Observable<AuthResponse> | null = null;

  private get storage(): Storage | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem(TOKEN_KEY) ? localStorage : sessionStorage;
  }

  private _currentUser = signal<UserProfile | null>(this.loadUser());
  private _isAuthenticated = signal<boolean>(this.hasValidAccessToken());

  readonly currentUser = computed(() => this._currentUser());
  readonly isAuthenticated = computed(() => this._isAuthenticated());
  readonly userRole = computed(() => this._currentUser()?.role ?? '');
  readonly userPermissions = computed(() => this._currentUser()?.permissions ?? []);

  login(usernameOrEmail: string, password: string, captchaToken = 'string', remember = false): Observable<AuthResponse> {
    const body: LoginRequest = { usernameOrEmail, password, captchaToken };

    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, body, {
      context: new HttpContext().set(SKIP_AUTH, true).set(SKIP_REFRESH, true),
    }).pipe(
      tap(res => {
        this.clearSession(false);
        this.handleAuthSuccess(res, remember);
      }),
    );
  }

  refreshAccessToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken || this.isRefreshTokenExpired()) {
      return throwError(() => new Error('Your session has expired. Please log in again.'));
    }

    // A page can issue multiple API calls at once. Reuse the in-flight refresh so
    // a rotated refresh token is never submitted more than once.
    if (!this.refreshRequest$) {
      const body: RefreshTokenRequest = { refreshToken };
      this.refreshRequest$ = this.http.post<AuthResponse>(`${this.apiUrl}/auth/refresh`, body, {
        context: new HttpContext().set(SKIP_AUTH, true).set(SKIP_REFRESH, true),
      }).pipe(
        tap(res => this.handleAuthSuccess(res)),
        finalize(() => this.refreshRequest$ = null),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    }

    return this.refreshRequest$;
  }

  logout(): void {
    const refreshToken = this.getRefreshToken();

    if (!refreshToken) {
      this.clearSession();
      return;
    }

    this.http.post<void>(`${this.apiUrl}/auth/logout`, { refreshToken }, {
      context: new HttpContext().set(SKIP_REFRESH, true),
    }).pipe(
      catchError(() => throwError(() => new Error('Logout request failed.'))),
    ).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession(),
    });
  }

  clearSession(navigateToLogin = true): void {
    if (isPlatformBrowser(this.platformId)) {
      for (const storage of [localStorage, sessionStorage]) {
        for (const key of [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_KEY, ACCESS_TOKEN_EXPIRES_KEY, REFRESH_TOKEN_EXPIRES_KEY]) storage.removeItem(key);
      }
    }
    this._currentUser.set(null);
    this._isAuthenticated.set(false);

    if (navigateToLogin) {
      this.router.navigate(['/login']);
    }
  }

  getToken(): string | null {
    return this.storage?.getItem(TOKEN_KEY) ?? null;
  }

  getRefreshToken(): string | null {
    return this.storage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  }

  getCurrentUser(): UserProfile | null {
    return this._currentUser();
  }

  isAccessTokenExpired(): boolean {
    const token = this.getToken();
    return !token || this.isJwtExpired(token);
  }

  hasPermission(permission: string): boolean {
    const permissions = this.userPermissions();
    const alternate = permission.includes(':')
      ? permission.replaceAll(':', '.')
      : permission.replaceAll('.', ':');

    return permissions.includes(permission) || permissions.includes(alternate);
  }

  hasRole(roles: string[]): boolean {
    const userRole = this.userRole().toLowerCase();
    return roles.map(role => this.normalizeRole(role)).includes(userRole);
  }

  isMobileOnlyRole(role = this.userRole()): boolean {
    return ['operator', 'worker', 'supervisor', 'returnsspecialist'].includes(this.normalizeRole(role));
  }

  private handleAuthSuccess(res: AuthResponse, remember?: boolean): void {
    const user = this.buildUserFromToken(res.accessToken);
    if (this.isMobileOnlyRole(user.role)) {
      this.clearSession(false);
      throw new MobileOnlyRoleError();
    }
    const storage = remember === undefined ? this.storage : isPlatformBrowser(this.platformId) ? (remember ? localStorage : sessionStorage) : null;

    storage?.setItem(TOKEN_KEY, res.accessToken);
    storage?.setItem(REFRESH_TOKEN_KEY, res.refreshToken);
    storage?.setItem(ACCESS_TOKEN_EXPIRES_KEY, res.accessTokenExpiresAtUtc);
    storage?.setItem(REFRESH_TOKEN_EXPIRES_KEY, res.refreshTokenExpiresAtUtc);
    storage?.setItem(USER_KEY, JSON.stringify(user));
    this._currentUser.set(user);
    this._isAuthenticated.set(true);
  }

  private loadUser(): UserProfile | null {
    try {
      const raw = this.storage?.getItem(USER_KEY);
      if (raw) {
        const user = JSON.parse(raw) as UserProfile;
        return {
          ...user,
          role: this.normalizeRole(user.role),
        };
      }

      const token = this.getToken();
      return token ? this.buildUserFromToken(token) : null;
    } catch {
      return null;
    }
  }

  private hasValidAccessToken(): boolean {
    const token = this.getToken();
    return token ? !this.isJwtExpired(token) : false;
  }

  private isRefreshTokenExpired(): boolean {
    const expiresAt = this.storage?.getItem(REFRESH_TOKEN_EXPIRES_KEY);
    return expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false;
  }

  private isJwtExpired(token: string): boolean {
    try {
      const payload = jwtDecode<JwtPayload>(token);
      return payload.exp * 1000 <= Date.now();
    } catch {
      return true;
    }
  }

  private buildUserFromToken(token: string): UserProfile {
    const payload = jwtDecode<JwtPayload>(token);
    const rawRole = String(payload[ROLE_CLAIM] ?? payload.role ?? '');
    const permissions = payload.permission ?? payload.permissions ?? [];

    return {
      id: payload.sub,
      username: payload.username ?? payload.email,
      email: payload.email,
      name: payload.full_name ?? payload.username ?? payload.email,
      role: this.normalizeRole(rawRole),
      permissions: Array.isArray(permissions) ? permissions : [permissions],
    };
  }

  private normalizeRole(role: string): string {
    const normalized = role.replace(/[\s_-]+/g, '').toLowerCase();

    if (normalized === 'systemadministrator' || normalized === 'administrator') {
      return 'admin';
    }

    if (normalized === 'manager' || normalized === 'manger' || normalized === 'warehousemanager') {
      return 'manager';
    }

    return normalized;
  }
}
