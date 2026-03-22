import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IAuditLog {
  _id: string;
  userId: string;
  userName: string;
  action: string;
  module: string;
  entityId?: string;
  details?: string;
  clientId?: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuditLogService {
  private http = inject(HttpClient);
  private apiUrl = environment.api;

  findAll(limit = 200): Observable<IAuditLog[]> {
    return this.http.get<IAuditLog[]>(`${this.apiUrl}/audit-log?limit=${limit}`);
  }
}
