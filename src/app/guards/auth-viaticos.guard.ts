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
      this.userState.canApproveL1();
    if (!allowed) {
      this.router.navigate([this.userState.isColaborador() ? '/mis-rendiciones' : '/login']);
      return false;
    }
    return true;
  }
}
