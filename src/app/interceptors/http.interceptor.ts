import { HttpInterceptorFn } from '@angular/common/http';
import { UserStateService } from '../services/user-state.service';
import { inject } from '@angular/core';
import { LoaderService } from '../services/loader.service';
import { finalize } from 'rxjs';

export const httpInterceptor: HttpInterceptorFn = (req, next) => {
  const userStateService = inject(UserStateService);
  const loaderService = inject(LoaderService);
  loaderService.show();
  const user = userStateService.getUser();
  const currentHeaders = req.headers;
  const objectHeaders = Object.fromEntries(
    currentHeaders.keys().map((key) => [key, currentHeaders.get(key)])
  );
  if (user) {
    req = req.clone({
      setHeaders: {
        ...objectHeaders,
        Authorization: `Bearer ${user.access_token}`,
      },
    });
  }

  if (req.url.includes('with-super-admin')) {
    return next(req).pipe(finalize(() => loaderService.hide()));
  }

  const methods = ['GET'];
  if (methods.includes(req.method) && user?.client?._id) {
    req = req.clone({ url: `${req.url}/${user.client._id}` });
  }

  if (
    (req.method === 'DELETE' || req.method === 'PATCH') &&
    user?.client?._id
  ) {
    if (req.url.includes('/category/') || req.url.includes('/project/')) {
      req = req.clone({ url: `${req.url}/${user.client._id}` });
    }
  }
  if (req.method === 'POST' && user?.client?._id) {
    if (req.body instanceof FormData) {
      req.body.append('clientId', user.client._id);
    } else {
      const body = req.body || {};
      req = req.clone({
        body: {
          ...body,
          clientId: user.client._id,
        },
      });
    }
  }
  return next(req).pipe(finalize(() => loaderService.hide()));
};
