import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { AuthService, MobileOnlyRoleError } from './auth.service';
import { jwtInterceptor } from '../interceptors/jwt.interceptor';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { environment } from '../../../environments/environment';

const keys = ['wms_token', 'wms_refresh_token', 'wms_user', 'wms_access_token_expires_at', 'wms_refresh_token_expires_at'];
function response(role = 'admin', expired = false) {
  const payload = { sub: 'test-user', email: 'test@example.invalid', role, exp: Math.floor(Date.now() / 1000) + (expired ? -60 : 3600) };
  return { accessToken: btoa('{}') + '.' + btoa(JSON.stringify(payload)) + '.test',
    refreshToken: 'test-refresh', accessTokenExpiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
    refreshTokenExpiresAtUtc: new Date(Date.now() + 86400000).toISOString() };
}
describe('Authentication regression tests', () => {
  let auth: AuthService;
  let http: HttpClient;
  let controller: HttpTestingController;
  const clean = () => keys.forEach(key => { localStorage.removeItem(key); sessionStorage.removeItem(key); });
  beforeEach(() => {
    clean();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: { navigate: jasmine.createSpy('navigate') } }, MessageService,
    ] });
    auth = TestBed.inject(AuthService); http = TestBed.inject(HttpClient); controller = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { controller.verify(); clean(); });
  function login(role: string, remember = false, expired = false) {
    auth.login('test-user', 'test-password', '', remember).subscribe();
    controller.expectOne(environment.apiUrl + '/auth/login').flush(response(role, expired));
  }
  for (const role of ['receiving_clerk', 'shipping_clerk']) {
    it('matches normalized ' + role + ' route roles', () => {
      login(role);
      expect(auth.hasRole([role])).toBeTrue();
      expect(auth.hasRole(['admin'])).toBeFalse();
    });
  }
  for (const role of ['Operator', 'Supervisor', 'ReturnsSpecialist']) {
    it('rejects the mobile-only role ' + role + ' without saving its token', () => {
      let failure: unknown;
      auth.login('test-user', 'test-password').subscribe({ error: error => failure = error });
      controller.expectOne(environment.apiUrl + '/auth/login').flush(response(role));
      expect(failure instanceof MobileOnlyRoleError).toBeTrue();
      expect(auth.isAuthenticated()).toBeFalse();
      expect(auth.getToken()).toBeNull();
      expect(localStorage.getItem('wms_token')).toBeNull();
      expect(sessionStorage.getItem('wms_token')).toBeNull();
    });
  }
  it('uses session storage when remember me is off', () => {
    login('admin');
    expect(sessionStorage.getItem('wms_token')).not.toBeNull();
    expect(localStorage.getItem('wms_token')).toBeNull();
  });
  it('uses persistent storage only when remember me is on, and clears it on logout', () => {
    login('admin', true);
    expect(localStorage.getItem('wms_token')).not.toBeNull();
    auth.clearSession(false);
    expect(localStorage.getItem('wms_token')).toBeNull();
    expect(auth.isAuthenticated()).toBeFalse();
  });
  it('shares one refresh request across simultaneous callers', () => {
    login('admin');
    let completed = 0;
    auth.refreshAccessToken().subscribe(() => completed++);
    auth.refreshAccessToken().subscribe(() => completed++);
    controller.expectOne(environment.apiUrl + '/auth/refresh').flush(response());
    expect(completed).toBe(2);
  });
  it('keeps the session when a business request fails after refreshing an expired token', () => {
    login('admin', false, true);
    let status = 0;
    http.get(environment.apiUrl + '/orders').subscribe({ error: error => status = error.status });
    controller.expectOne(environment.apiUrl + '/auth/refresh').flush(response());
    controller.expectOne(environment.apiUrl + '/orders').flush({ message: 'Invalid order' }, { status: 400, statusText: 'Bad Request' });
    expect(status).toBe(400);
    expect(auth.isAuthenticated()).toBeTrue();
  });
  it('keeps the session when the request retried after a 401 returns a business error', () => {
    login('admin');
    http.get(environment.apiUrl + '/orders').subscribe({ error: () => undefined });
    controller.expectOne(environment.apiUrl + '/orders').flush({}, { status: 401, statusText: 'Unauthorized' });
    controller.expectOne(environment.apiUrl + '/auth/refresh').flush(response());
    controller.expectOne(environment.apiUrl + '/orders').flush({}, { status: 422, statusText: 'Unprocessable Entity' });
    expect(auth.isAuthenticated()).toBeTrue();
  });
  it('never attaches the API token to third-party URLs', () => {
    login('admin');
    http.get('https://example.invalid/assets').subscribe();
    const request = controller.expectOne('https://example.invalid/assets');
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });
});
