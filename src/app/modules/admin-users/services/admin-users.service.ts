import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { IRoleResponse, IUser, IUserResponse } from '../../../interfaces/user.interface';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.api}/user`;

  getUser(id: string): Observable<IUserResponse> {
    return this.http.get<IUserResponse>(`${this.apiUrl}/${id}`);
  }

  getUsers(): Observable<IUserResponse[]> {
    return this.http.get<IUserResponse[]>(this.apiUrl);
  }

  createUser(user: IUser): Observable<IUserResponse> {
    return this.http.post<IUserResponse>(this.apiUrl, user)
  }

  updateUser(id: string, user: Partial<IUser>): Observable<IUserResponse> {
    return this.http.patch<IUserResponse>(`${this.apiUrl}/${id}`, user)
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`)
  }

  getRoles(): Observable<IRoleResponse[]> {
    return this.http.get<IRoleResponse[]>(`${environment.api}/role/with-super-admin`)
  }

}
