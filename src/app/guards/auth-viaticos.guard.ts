import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserStateService } from '../services/user-state.service';

@Injectable({ providedIn: 'root' })
export class AuthViaticosGuard implements CanActivate {
  constructor(private userState: UserStateService, private router: Router) {}

  canActivate(): boolean {
    if (!this.userState.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }
    const allowed =
      this.userState.isAdmin() ||
      this.userState.isSuperAdmin() ||
      this.userState.isCoordinador() ||
      this.userState.canApproveL1();
    if (!allowed) {
      const role = this.userState.getRole();
      const fallback = (role === 'Colaborador') ? '/mis-rendiciones'
        : (role === 'Contabilidad') ? '/tesoreria'
        : '/login';
      this.router.navigate([fallback]);
      return false;
    }
    return true;
  }
}
