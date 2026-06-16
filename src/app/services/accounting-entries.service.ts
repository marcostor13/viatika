import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { UserStateService } from './user-state.service';

export type AsientoTipo =
  | 'solicitud'
  | 'compra'
  | 'aplicacion'
  | 'devolucion'
  | 'reembolso';

export interface ICuadreError {
  relacionado: number;
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
}

export interface IGeneratedFile {
  filename: string;
  base64: string;
  tipo: AsientoTipo;
  asientosCount: number;
  cuadreErrors: ICuadreError[];
}

@Injectable({ providedIn: 'root' })
export class AccountingEntriesService {
  private http = inject(HttpClient);
  private userState = inject(UserStateService);
  private url = `${environment.api}/accounting-entries`;

  /** Genera los archivos de asientos de una rendición. */
  generate(
    reportId: string,
    tipos?: AsientoTipo[]
  ): Observable<{ files: IGeneratedFile[] }> {
    const query = tipos?.length ? `?tipos=${tipos.join(',')}` : '';
    const clientId =
      (this.userState.getUser() as { companyId?: string })?.companyId || '';
    // Se incluye el clientId en la ruta (convención del app); el backend igual
    // prioriza el clientId del JWT.
    const path = clientId
      ? `${this.url}/${reportId}/${clientId}`
      : `${this.url}/${reportId}`;
    return this.http.get<{ files: IGeneratedFile[] }>(`${path}${query}`);
  }

  /** Dispara la descarga en el navegador de un archivo base64 (.xlsx). */
  downloadBase64(file: IGeneratedFile): void {
    const bytes = atob(file.base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buffer[i] = bytes.charCodeAt(i);
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}