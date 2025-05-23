import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IUser, IUserResponse } from '../../../interfaces/user.interface';
import { environment } from '../../../../environments/environment';
import { UserStateService } from '../../../services/user-state.service';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private apiUrl = `${environment.api}/users`;

  constructor(
    private http: HttpClient,
    private userStateService: UserStateService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.userStateService.getToken();
    if (!token) {
      console.error('No hay token disponible');
      return new HttpHeaders({
        'Content-Type': 'application/json',
      });
    }

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getUsers(): Observable<IUserResponse[]> {
    const headers = this.getHeaders();

    return this.http
      .get<IUserResponse[]>(this.apiUrl, {
        headers: headers,
      })
      .pipe(
        tap((response) =>
          console.log('Respuesta del servidor para usuarios:', response)
        ),
        catchError((error: any) => this.handleError(error))
      );
  }

  createUser(user: IUser): Observable<IUserResponse> {
    const currentUser = this.userStateService.getUser();

    const userData = {
      ...user,
      companyId: currentUser?.companyId,
    };

    return this.http
      .post<IUserResponse>(this.apiUrl, userData, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap((response) => console.log('Respuesta al crear usuario:', response)),
        catchError((error: any) => this.handleError(error))
      );
  }

  updateUser(id: string, user: Partial<IUser>): Observable<IUserResponse> {
    return this.http
      .put<IUserResponse>(`${this.apiUrl}/${id}`, user, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap((response) =>
          console.log('Respuesta al actualizar usuario:', response)
        ),
        catchError((error: any) => this.handleError(error))
      );
  }

  deleteUser(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap(() => console.log('Usuario eliminado con éxito')),
        catchError((error: any) => this.handleError(error))
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ha ocurrido un error';

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      errorMessage = `Código: ${error.status}, Mensaje: ${
        error.error?.message || error.statusText
      }`;

      console.error('Detalles del error:', {
        status: error.status,
        statusText: error.statusText,
        error: error.error,
        url: error.url,
        headers: error.headers,
      });
    }

    return throwError(() => new Error(errorMessage));
  }
}
