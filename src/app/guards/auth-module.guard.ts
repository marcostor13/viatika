import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStateService } from '../services/user-state.service';

export function authModuleGuard(module: string, bypassForAdmin = false): CanActivateFn {
  return () => {
    const userState = inject(UserStateService);
    const router = inject(Router);

    if (!userState.isAuthenticated()) {
      return router.createUrlTree(['/login']);
    }

    if (bypassForAdmin && userState.isAdmin()) {
      return true;
    }

    if (userState.hasModulePermission(module)) {
      return true;
    }

    if (userState.isColaborador()) return router.createUrlTree(['/inicio']);
    if (userState.isAdmin()) return router.createUrlTree(['/consolidated-invoices']);
    return router.createUrlTree(['/clients-admin']);
  };
}
