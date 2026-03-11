import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IUser, IUserResponse, IRole, IClient } from '../../../interfaces/user.interface';
import { UserStateService } from '../../../services/user-state.service';
import { environment } from '../../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AdminUsersService {
  private apiUrl = `${environment.api}/user`;

  constructor(
    private http: HttpClient,
    private userStateService: UserStateService
  ) {}

  private getHeaders(): HttpHeaders {
    const token = this.userStateService.getToken();
    if (!token) {
      console.error('No hay token disponible');
      throw new Error('No hay token de autenticación disponible');
    }

    console.log('Token utilizado:', token);

    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    });
  }

  getUser(id: string): Observable<IUserResponse> {
    return this.http
      .get<IUserResponse>(`${this.apiUrl}/${id}`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  getUsers(): Observable<IUserResponse[]> {
    const headers = this.getHeaders();
    let url = this.apiUrl;
    
    if (!this.userStateService.isSuperAdmin()) {
      const companyId = this.userStateService.getUser()?.companyId;
      if (!companyId) throw new Error('No se encontró companyId');
      url = `${this.apiUrl}/${companyId}`;
    }

    return this.http
      .get<IUserResponse[]>(url, {
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

    // Ensure we use the proper clientId mapping, either from the user being created or the currentUser.
    let targetClientId = user.companyId;
    if (!targetClientId && currentUser) {
      const uc = currentUser as IUserResponse & { clientId?: string | { _id: string }; client?: { _id: string } };
      if (typeof uc.clientId === 'string') {
        targetClientId = uc.clientId;
      } else if (uc.clientId && typeof uc.clientId === 'object' && '_id' in uc.clientId) {
        targetClientId = uc.clientId._id;
      } else if (uc.client?._id) {
        targetClientId = uc.client._id;
      } else {
        targetClientId = uc.companyId;
      }
    }

    const userData = {
      ...user,
      clientId: targetClientId,
      // Fallback in case backend logic needs it
      companyId: targetClientId,
      // Agregar password por defecto si no existe
      password: (user as any).password || 'Temporal123',
    };

    console.log('Datos del usuario a crear:', userData);
    console.log('Usuario actual:', currentUser);

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
      .patch<IUserResponse>(`${this.apiUrl}/${id}`, user, {
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
      .delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  getRoles(): Observable<IRole[]> {
    return this.http
      .get<IRole[]>(`${environment.api}/role`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap((response) => console.log('Roles cargados:', response)),
        catchError((error: any) => this.handleError(error))
      );
  }

  getClients(): Observable<IClient[]> {
    return this.http
      .get<IClient[]>(`${environment.api}/client`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap((response) => console.log('Empresas cargadas:', response)),
        catchError((error: any) => this.handleError(error))
      );
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'Ha ocurrido un error';

    console.error('Error completo:', error);

    if (error.error instanceof ErrorEvent) {
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Manejar errores específicos del backend
      if (error.status === 400 && error.error?.message) {
        if (Array.isArray(error.error.message)) {
          errorMessage = error.error.message.join(', ');
        } else {
          errorMessage = error.error.message;
        }
      } else if (error.status === 401) {
        errorMessage = 'No autorizado. Verifica tu sesión.';
      } else if (error.status === 403) {
        errorMessage = 'No tienes permisos para realizar esta acción.';
      } else {
        errorMessage = `Código: ${error.status}, Mensaje: ${error.error?.message || error.statusText
          }`;
      }

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
