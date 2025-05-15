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
  const objectHeaders = Object.fromEntries(currentHeaders.keys().map(key => [key, currentHeaders.get(key)]));
  if (user) {
    req = req.clone({
      setHeaders: {
        ...objectHeaders,
        Authorization: `Bearer ${user.access_token}`
      }
    });
  }
  const methods = ['GET', 'PATCH', 'DELETE'];
  if (methods.includes(req.method) && user?.clientId?._id) {
    req = req.clone({ url: `${req.url}/${user.clientId._id}` });
  }
  if (req.method === 'POST' && user?.clientId?._id) {

    if (req.body instanceof FormData) {
      req.body.append('clientId', user.clientId._id);
    } else {
      const body = req.body || {};
      req = req.clone({
        body: {
          ...body,
          clientId: user.clientId._id
        }
      });
    }

  }
  return next(req).pipe(
    finalize(() => loaderService.hide())
  );
};
