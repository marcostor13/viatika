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
      this._user.set(JSON.parse(user));
    }
  }

  setUser(user: IUserResponse) {
    this._user.set(user);
    localStorage.setItem(USER_LOCALSTORAGE_KEY, JSON.stringify(user));
  }

  getUser() {
    return this._user();
  }

  clearUser() {
    this._user.set(null);
  }

  logout() {
    this.clearUser();
    localStorage.removeItem(USER_LOCALSTORAGE_KEY);
  }

  loginAsColaborador(email: string, password: string = '') {
    // Simulación: solo permite el rol COLABORADOR
    const user = {
      _id: '1',
      email,
      name: 'Colaborador',
      access_token: 'fake-token',
      clientId: {},
      roleId: {
        _id: 'colab',
        name: 'COLABORADOR',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    };
    this.setUser(user as any);
  }

  isAuthenticated() {
    return !!this._user();
  }

  isColaborador() {
    return this._user()?.role === 'COLABORADOR' || 'PROVIDER';
  }
}
