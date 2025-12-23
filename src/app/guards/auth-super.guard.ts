import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { UserStateService } from '../services/user-state.service';

@Injectable({ providedIn: 'root' })
export class AuthSuperGuard implements CanActivate {
    constructor(private userState: UserStateService, private router: Router) { }

    canActivate(): boolean {
        const user = this.userState.getUser();

        if (!this.userState.isAuthenticated()) {
            this.router.navigate(['/login']);
            return false;
        }

        const role = user?.role?.name;

        if (role !== 'Super') {
            this.router.navigate(['/login']);
            return false;
        }

        return true;
    }
}


