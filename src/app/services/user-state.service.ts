import { Injectable, signal } from '@angular/core';
import { IUserResponse } from '../interfaces/user.interface';
import { USER_LOCALSTORAGE_KEY } from '../constants/user-localstorage.constant';

const HUB_TOKEN_KEY = 'hub_token';
const HUB_USER_KEY = 'hub_user_data';

@Injectable({
  providedIn: 'root',
})
export class UserStateService {
  private _user = signal<IUserResponse | null>(null);

  constructor() {
    const raw = localStorage.getItem(USER_LOCALSTORAGE_KEY);
    if (raw) {
      const parsedUser = JSON.parse(raw);
      if (!parsedUser.companyId) {
        // Try to recover companyId from the stored token
        const token = localStorage.getItem('token');
        if (token) {
          try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.clientId) parsedUser.companyId = payload.clientId;
          } catch {}
        }
        if (!parsedUser.companyId) {
          parsedUser.companyId = parsedUser.client?._id ||
                                 parsedUser.clientId?._id ||
                                 parsedUser.clientId ||
                                 '';
        }
      }
      this._user.set(parsedUser);
    }
  }

  setUser(user: IUserResponse) {
    const userToSave = { ...user };

    // JWT payload is the authoritative source for which company is active.
    // This matters for Contabilidad users whose `client` field is null but
    // whose token carries the clientId of the company they selected in the hub.
    if (user.access_token) {
      try {
        const payload = JSON.parse(atob(user.access_token.split('.')[1]));
        if (payload.clientId) {
          userToSave.companyId = payload.clientId;
        }
      } catch {}
    }

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

  /** Save hub token for Contabilidad "go back to hub" */
  saveHubState(user: IUserResponse) {
    localStorage.setItem(HUB_TOKEN_KEY, user.access_token || '');
    localStorage.setItem(HUB_USER_KEY, JSON.stringify(user));
  }

  /** Restore hub token (Contabilidad going back to hub) */
  restoreHubState() {
    const hubUser = localStorage.getItem(HUB_USER_KEY);
    const hubToken = localStorage.getItem(HUB_TOKEN_KEY);
    if (hubUser && hubToken) {
      const parsed = JSON.parse(hubUser);
      this._user.set(parsed);
      localStorage.setItem(USER_LOCALSTORAGE_KEY, hubUser);
      localStorage.setItem('token', hubToken);
    }
  }

  hasHubState(): boolean {
    return !!localStorage.getItem(HUB_TOKEN_KEY);
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
    localStorage.removeItem(HUB_TOKEN_KEY);
    localStorage.removeItem(HUB_USER_KEY);
  }

  logout() {
    this.clearUser();
  }

  isAuthenticated() {
    return !!(this._user() && this.getToken());
  }

  getRole(): string {
    const user = this._user();
    if (!user) return '';
    if (typeof user.role === 'string') return user.role;
    const roleObj = user.role as any;
    if (roleObj && roleObj.name) return roleObj.name;
    if (user.roleId && (user.roleId as any).name) return (user.roleId as any).name;
    return '';
  }

  isColaborador() { return this.getRole() === 'Colaborador'; }
  isAdmin() { return this.getRole() === 'Administrador'; }
  isSuperAdmin() { return this.getRole() === 'Superadministrador'; }
  isContabilidad() { return this.getRole() === 'Contabilidad'; }
  isCoordinador() { return this.getRole() === 'Coordinador'; }

  /** Administrador, Superadministrador, or Contabilidad */
  isAnyAdmin() {
    return this.isAdmin() || this.isSuperAdmin() || this.isContabilidad();
  }

  getPermissions() {
    const user = this._user();
    return user?.permissions ?? { modules: [], canApproveL1: false, canApproveL2: false };
  }

  hasModulePermission(module: string): boolean {
    if (this.isSuperAdmin() || this.isAdmin() || this.isContabilidad()) return true;
    const perms = this.getPermissions();
    return perms.modules?.includes(module) ?? false;
  }

  canApproveL1(): boolean {
    if (this.isSuperAdmin() || this.isAdmin() || this.isCoordinador() || this.isContabilidad()) return true;
    return this.getPermissions().canApproveL1 === true;
  }

  canApproveL2(): boolean {
    if (this.isSuperAdmin() || this.isContabilidad()) return true;
    return this.getPermissions().canApproveL2 === true;
  }

  canAccessTesoreria(): boolean {
    if (this.isSuperAdmin() || this.isContabilidad() || this.isAdmin()) return true;
    const perms = this.getPermissions();
    return perms.modules?.includes('tesoreria') ?? false;
  }

  canAccessPagos(): boolean {
    return this.canAccessTesoreria();
  }

  /** True when Contabilidad has selected a company (companyId is set) */
  isContabilidadInCompany(): boolean {
    if (!this.isContabilidad()) return false;
    const user = this._user();
    return !!(user?.companyId);
  }
}
