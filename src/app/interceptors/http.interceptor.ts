import { HttpInterceptorFn } from '@angular/common/http';
import { UserStateService } from '../services/user-state.service';
import { inject } from '@angular/core';
import { LoaderService } from '../services/loader.service';
import { finalize } from 'rxjs';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const userStateService = inject(UserStateService);
  const loaderService = inject(LoaderService);
  loaderService.show();

  const token = userStateService.getToken();
  const user = userStateService.getUser();

  const currentHeaders = req.headers;
  const objectHeaders = Object.fromEntries(
    currentHeaders.keys().map((key) => [key, currentHeaders.get(key)])
  );

  let url = req.url;

  const excludedEndpoints = ['/auth', '/auth/'];
  const skipCompanyIdEndpoints = ['/approve', '/reject', '/users', '/users/'];
  const isExcludedEndpoint = excludedEndpoints.some(
    (endpoint) => url.includes(endpoint) || url.endsWith('/api')
  );
  const shouldSkipCompanyId = skipCompanyIdEndpoints.some((endpoint) =>
    url.includes(endpoint)
  );

  if (token) {
    req = req.clone({
      setHeaders: {
        ...objectHeaders,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  }

  const methods = ['GET', 'PATCH', 'DELETE'];
  if (
    methods.includes(req.method) &&
    user?.companyId &&
    !isExcludedEndpoint &&
    !shouldSkipCompanyId
  ) {
    if (!url.endsWith(user.companyId)) {
      if (!url.endsWith('/')) {
        url = `${url}/`;
      }
      url = `${url}${user.companyId}`;
      req = req.clone({ url });
    }
  }

  if (req.method === 'POST' && user?.companyId && !isExcludedEndpoint) {
    if (req.body instanceof FormData) {
      req.body.append('companyId', user.companyId);
    } else {
      const body = req.body || {};
      req = req.clone({
        body: {
          ...body,
          companyId: user.companyId,
        },
      });
    }
  }

  return next(req).pipe(finalize(() => loaderService.hide()));
};
