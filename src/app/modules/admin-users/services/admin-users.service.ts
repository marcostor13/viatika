import { Injectable } from '@angular/core';
import {
  HttpClient,
  HttpErrorResponse,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { IUser, IUserResponse, IRole, IClient, IUserPermissions } from '../../../interfaces/user.interface';
import { UserStateService } from '../../../services/user-state.service';
import { environment } from '../../../../environments/environment';
import { IPaginatedResult } from '../../../interfaces/paginated-result.interface';

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
      .get<IUserResponse>(`${this.apiUrl}/details/${id}`, {
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
      url = `${this.apiUrl}/client/${companyId}`;
    }
    return this.http.get<IUserResponse[]>(url, { headers }).pipe(catchError((error: any) => this.handleError(error)));
  }

  getUsersPaginated(opts: { page?: number; limit?: number; search?: string; status?: string; roleName?: string } = {}): Observable<IPaginatedResult<IUserResponse>> {
    const headers = this.getHeaders();
    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) throw new Error('No se encontró companyId');
    let params = new HttpParams()
      .set('page', String(opts.page ?? 1))
      .set('limit', String(opts.limit ?? 20));
    if (opts.search) params = params.set('search', opts.search);
    if (opts.status) params = params.set('status', opts.status);
    if (opts.roleName) params = params.set('roleName', opts.roleName);
    return this.http
      .get<IPaginatedResult<IUserResponse>>(`${this.apiUrl}/client/${companyId}`, { headers, params })
      .pipe(catchError((error: any) => this.handleError(error)));
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

  updatePermissions(id: string, permissions: IUserPermissions): Observable<IUserResponse> {
    return this.http
      .patch<IUserResponse>(`${this.apiUrl}/${id}/permissions`, permissions, {
        headers: this.getHeaders(),
      })
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  deleteUser(id: string): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/${id}`, { headers: this.getHeaders() })
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  resetPassword(id: string): Observable<{ temporaryPassword: string }> {
    return this.http
      .post<{ temporaryPassword: string }>(`${this.apiUrl}/${id}/reset-password`, {}, {
        headers: this.getHeaders(),
      })
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  bulkImportUsers(formData: FormData): Observable<{ created: number; skipped: string[]; errors: string[] }> {
    const token = this.userStateService.getToken();
    return this.http
      .post<{ created: number; skipped: string[]; errors: string[] }>(
        `${this.apiUrl}/bulk-import`,
        formData,
        { headers: new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` }) }
      )
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  downloadUserTemplate(): Observable<{ file: string; filename: string }> {
    return this.http
      .get<{ file: string; filename: string }>(`${this.apiUrl}/bulk-import/template`, {
        headers: this.getHeaders(),
      })
      .pipe(catchError((error: any) => this.handleError(error)));
  }

  getRoles(): Observable<IRole[]> {
    const endpoint = this.userStateService.isSuperAdmin()
      ? `${environment.api}/role`
      : `${environment.api}/role/for-admin`;
    return this.http
      .get<IRole[]>(endpoint, {
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
