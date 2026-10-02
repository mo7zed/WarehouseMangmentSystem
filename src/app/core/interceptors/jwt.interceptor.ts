import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { SKIP_AUTH } from './auth-http-context';
import { environment } from '../../../environments/environment';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH) || !req.url.startsWith(environment.apiUrl + '/')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = authService.getToken();

  if (!token) {
    return next(req);
  }

  // Refresh before sending the request. This makes writes (such as creating a
  // warehouse) use the new token instead of relying on an API-specific 401/403
  // response for an already-expired access token.
  if (authService.isAccessTokenExpired()) {
    return authService.refreshAccessToken().pipe(
      catchError(error => {
        authService.clearSession();
        return throwError(() => error);
      }),
      switchMap(() => next(withAuthorization(req, authService.getToken()))),
    );
  }

  return next(withAuthorization(req, token));
};

function withAuthorization<T extends { clone: (update: { setHeaders: Record<string, string> }) => T }>(
  request: T,
  token: string | null,
): T {
  return token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
}
