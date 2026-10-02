import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { getApiErrorMessage } from '../utils/api-error.util';
import { SKIP_AUTH, SKIP_REFRESH } from './auth-http-context';
import { environment } from '../../../environments/environment';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(environment.apiUrl + '/')) return next(req);
  const messageService = inject(MessageService);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError(error => {
      const status = error?.status ?? 0;

      switch (status) {
        case 401:
          if (req.context.get(SKIP_AUTH)) return throwError(() => error);
          if (req.context.get(SKIP_REFRESH)) {
            authService.clearSession();
            return throwError(() => error);
          }

          return authService.refreshAccessToken().pipe(
            catchError(refreshError => {
              authService.clearSession();
              return throwError(() => refreshError);
            }),
            switchMap(() => {
              const token = authService.getToken();
              const retryContext = req.context.set(SKIP_REFRESH, true);
              const retryReq = req.clone({
                context: retryContext,
                setHeaders: token ? { Authorization: `Bearer ${token}` } : {},
              });

              return next(retryReq).pipe(catchError(retryError => {
                if (retryError.status === 401) authService.clearSession();
                return throwError(() => retryError);
              }));
            }),
          );

        case 403:
          messageService.add({
            severity: 'error',
            summary: 'Access Denied',
            detail: 'You do not have permission to perform this action.',
            life: 5000,
          });
          break;

        case 400:
          messageService.add({
            severity: 'error',
            summary: 'Validation Error',
            detail: getApiErrorMessage(error, 'The request was invalid. Please check your input.'),
            life: 8000,
          });
          break;

        case 422:
          messageService.add({
            severity: 'warn',
            summary: 'Request Cannot Be Completed',
            detail: getApiErrorMessage(error, 'This action is not valid for the current bin status.'),
            life: 8000,
          });
          break;

        case 0:
          messageService.add({
            severity: 'error',
            summary: 'Network Error',
            detail: 'Unable to reach the server. Check your connection and try again.',
            life: 5000,
          });
          break;

        case 500:
        default:
          messageService.add({
            severity: 'error',
            summary: 'Server Error',
            detail: getApiErrorMessage(error, 'An unexpected error occurred. Please try again.'),
            life: 5000,
          });
          console.error('[HTTP Error]', error);
      }

      return throwError(() => error);
    }),
  );
};
