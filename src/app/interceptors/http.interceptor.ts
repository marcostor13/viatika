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
  const skipCompanyIdEndpoints = [
    '/approve',
    '/reject',
    '/user',
    '/user/',
    '/client',
    '/client/',
    '/sunat-config',
    '/sunat-config/',
    '/config',
    '/logo',
  ];
  const isExcludedEndpoint = excludedEndpoints.some(
    (endpoint) => url.includes(endpoint) || url.endsWith('/api')
  );
  const shouldSkipCompanyId = skipCompanyIdEndpoints.some((endpoint) =>
    url.includes(endpoint)
  );

  if (token) {
    const headers: any = {
      ...objectHeaders,
      Authorization: `Bearer ${token}`,
    };

    // No establecer Content-Type para FormData (subida de archivos)
    if (!(req.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    req = req.clone({
      setHeaders: headers,
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

  if (
    req.method === 'POST' &&
    user?.companyId &&
    !isExcludedEndpoint &&
    !shouldSkipCompanyId
  ) {
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
