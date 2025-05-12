import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { UserStateService } from '../services/user-state.service';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../services/notification.service';
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const userStateService = inject(UserStateService);
  const router = inject(Router);
  const notificationService = inject(NotificationService);
  return next(req).pipe(
    catchError((error) => {
      if (error.status === 401) {
        console.log('error', error);
        userStateService.clearUser();
        router.navigate(['/login']);
      }
      console.log('error', error);
      notificationService.show(error.error.message, 'error');
      return throwError(() => error);
    })
  );
};
