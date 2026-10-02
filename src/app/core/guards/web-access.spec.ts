import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { authGuard } from './auth.guard';
import { routes } from '../../app.routes';

describe('Web access for mobile roles', () => {
  for (const role of ['Operator', 'Supervisor', 'ReturnsSpecialist']) {
    it('blocks an already authenticated ' + role + ' session before loading any web page', () => {
      const auth = {
        isAuthenticated: () => true,
        isMobileOnlyRole: () => true,
        clearSession: jasmine.createSpy('clearSession'),
      };
      TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
      const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, { url: '/profile' } as RouterStateSnapshot));
      expect(TestBed.inject(Router).serializeUrl(result as any)).toBe('/login?mobileOnly=1');
      expect(auth.clearSession).toHaveBeenCalledOnceWith(false);
    });
  }
  it('guards all protected child routes and removes mobile roles from module access', () => {
    const protectedRoot = routes.find(route => route.children);
    expect(protectedRoot?.canActivateChild).toContain(authGuard);
    for (const route of protectedRoot?.children ?? []) {
      expect(route.data?.['roles'] ?? []).not.toContain('supervisor');
      expect(route.data?.['roles'] ?? []).not.toContain('operator');
      expect(route.data?.['roles'] ?? []).not.toContain('returnsspecialist');
    }
  });
});
