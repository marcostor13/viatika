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

  const excludedEndpoints = ['/users', '/users/', '/auth', '/auth/'];
  const isExcludedEndpoint = excludedEndpoints.some(
    (endpoint) => url.includes(endpoint) || url.endsWith('/api')
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
    user?.clientId?._id &&
    !isExcludedEndpoint
  ) {
    if (!url.endsWith(user.clientId._id)) {
      if (!url.endsWith('/')) {
        url = `${url}/`;
      }
      url = `${url}${user.clientId._id}`;
      req = req.clone({ url });
    }
  }

  if (req.method === 'POST' && user?.clientId?._id && !isExcludedEndpoint) {
    if (req.body instanceof FormData) {
      req.body.append('clientId', user.clientId._id);
    } else {
      const body = req.body || {};
      req = req.clone({
        body: {
          ...body,
          clientId: user.clientId._id,
        },
      });
    }
  }

  return next(req).pipe(finalize(() => loaderService.hide()));
};
