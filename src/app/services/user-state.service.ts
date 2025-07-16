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
}
