import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService, MobileOnlyRoleError } from '../auth/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowWebSession = () => {
    if (!authService.isMobileOnlyRole()) return true;
    authService.clearSession(false);
    return router.createUrlTree(['/login'], { queryParams: { mobileOnly: '1' } });
  };

  if (authService.isAuthenticated()) {
    return allowWebSession();
  }

  return authService.refreshAccessToken().pipe(
    map(() => allowWebSession()),
    catchError(error => {
      if (error instanceof MobileOnlyRoleError) {
        return of(router.createUrlTree(['/login'], { queryParams: { mobileOnly: '1' } }));
      }
      router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
      return of(false);
    }),
  );
};
