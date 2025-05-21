import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserStateService } from '../services/user-state.service';

@Injectable({ providedIn: 'root' })
export class AuthAdmin2Guard implements CanActivate {
  constructor(private userState: UserStateService, private router: Router) {}

  canActivate(): boolean {
    const user = this.userState.getUser();

    if (!this.userState.isAuthenticated()) {
      this.router.navigate(['/login']);
      return false;
    }

    const role = user?.role || user?.roleId?.name;

    const allowedRoles = ['ADMIN2', 'admin2', 'Admin2', 'admin 2', 'ADMIN'];
    const hasValidRole = role ? allowedRoles.includes(role) : false;

    if (!hasValidRole) {
      this.router.navigate(['/login']);
      return false;
    }
    return true;
  }
}
