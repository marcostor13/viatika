import { Injectable, signal } from '@angular/core';
import { IUserResponse } from '../interfaces/user.interface';
import { USER_LOCALSTORAGE_KEY } from '../constants/user-localstorage.constant';

@Injectable({
  providedIn: 'root',
})
export class UserStateService {
  private _user = signal<IUserResponse | null>(null);

  constructor() {
    const user = localStorage.getItem(USER_LOCALSTORAGE_KEY);
    if (user) {
      const parsedUser = JSON.parse(user);
      if (!parsedUser.companyId) {
        parsedUser.companyId = parsedUser.client?._id || 
                               parsedUser.clientId?._id || 
                               parsedUser.clientId || 
                               '';
      }
      this._user.set(parsedUser);
    }
  }

  setUser(user: IUserResponse) {
    const userToSave = { ...user };
    
    // Mapear compatibilidad de companyId desde client o clientId si no existe
    if (!userToSave.companyId) {
      userToSave.companyId = (userToSave as any).client?._id || 
                             (userToSave as any).clientId?._id || 
                             (userToSave as any).clientId || 
                             '';
    }

    this._user.set(userToSave);
    localStorage.setItem(USER_LOCALSTORAGE_KEY, JSON.stringify(userToSave));
    if (user.access_token) {
      localStorage.setItem('token', user.access_token);
    }
  }

  getUser() {
    return this._user();
  }

  getToken(): string | null {
    const user = this._user();
    if (user && user.access_token) {
      return user.access_token;
    }
    return localStorage.getItem('token');
  }

  clearUser() {
    this._user.set(null);
    localStorage.removeItem(USER_LOCALSTORAGE_KEY);
    localStorage.removeItem('token');
  }

  logout() {
    this.clearUser();
  }

  isAuthenticated() {
    return !!this._user();
  }
  getRole(): string {
    const user = this._user();
    if (!user) return '';

    // Handle both string and object role formats
    if (typeof user.role === 'string') {
      return user.role;
    }

    // In many backend responses 'role' is an object with a 'name' property
    const roleObj = user.role as any;
    if (roleObj && roleObj.name) {
      return roleObj.name;
    }

    // Fallback to roleId name if present
    if (user.roleId && (user.roleId as any).name) {
      return (user.roleId as any).name;
    }

    return '';
  }

  isColaborador() {
    const role = this.getRole();
    return role === 'COLABORADOR' || role === 'PROVIDER' || role === 'User';
  }

  isAdmin() {
    const role = this.getRole();
    const adminRoles = ['ADMIN2', 'admin2', 'Admin2', 'admin 2', 'ADMIN', 'Admin'];
    return adminRoles.includes(role);
  }

  isSuperAdmin() {
    const role = this.getRole();
    return role === 'Super' || role === 'SUPER_ADMIN';
  }

  // Helper for both types of admins (used in Guards)
  isAnyAdmin() {
    return this.isAdmin() || this.isSuperAdmin();
  }
}
