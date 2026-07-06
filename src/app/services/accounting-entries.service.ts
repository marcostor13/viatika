import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type AsientoTipo =
  | 'solicitud'
  | 'compra'
  | 'aplicacion'
  | 'devolucion'
  | 'reembolso';

export type AccountingEntriesStatus = 'none' | 'processing' | 'ready' | 'error';

export interface ICuadreError {
  relacionado: number;
  totalDebe: number;
  totalHaber: number;
  diferencia: number;
  /** Fila de Excel (1-indexed) de la primera/última línea de este asiento en el .xlsx generado. */
  filaInicio?: number;
  filaFin?: number;
  /** Descripción legible del comprobante/anticipo (razón social + serie-número, o glosa). */
  documento?: string;
}

export interface IAccountingEntryStatus {
  tipo: AsientoTipo;
  status: AccountingEntriesStatus;
  filename?: string;
  /** URL firmada de S3, válida por pocos minutos. Solo presente si hay un archivo listo. */
  url?: string;
  asientosCount?: number;
  cuadreErrors?: ICuadreError[];
  /** Avisos de configuración (ej. categoría sin cuenta 9X) detectados al generar. */
  warnings?: string[];
  errorMessage?: string;
  /** El archivo listo ya no refleja el estado actual de la rendición. */
  stale?: boolean;
  completedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountingEntriesService {
  private http = inject(HttpClient);
  private url = `${environment.api}/accounting-entries`;

  /** Estado actual de los asientos (no dispara generación). Usar para pintar la UI y para polling. */
  getStatus(
    reportId: string,
    tipos?: AsientoTipo[]
  ): Observable<{ files: IAccountingEntryStatus[] }> {
    let params = new HttpParams();
    if (tipos?.length) params = params.set('tipos', tipos.join(','));
    return this.http.get<{ files: IAccountingEntryStatus[] }>(
      `${this.url}/${reportId}`,
      { params }
    );
  }

  /** Dispara la generación en segundo plano. Responde de inmediato con el estado resultante. */
  triggerGenerate(
    reportId: string,
    tipos?: AsientoTipo[],
    force = false
  ): Observable<{ files: IAccountingEntryStatus[] }> {
    let params = new HttpParams();
    if (tipos?.length) params = params.set('tipos', tipos.join(','));
    if (force) params = params.set('force', 'true');
    return this.http.post<{ files: IAccountingEntryStatus[] }>(
      `${this.url}/${reportId}/generate`,
      null,
      { params }
    );
  }

  /**
   * Descarga un archivo forzando el guardado (S3 responde con
   * Content-Disposition: attachment). Se usa un <a> sintético en vez de
   * `window.open` porque no abre pestaña nueva y no dispara el bloqueador
   * de pop-ups, incluso si la URL se obtuvo justo antes vía una llamada async.
   */
  private triggerDownload(url: string, filename?: string): void {
    const a = document.createElement('a');
    a.href = url;
    if (filename) a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  /**
   * Descarga un archivo listo. Las URLs firmadas expiran a los pocos minutos
   * (ver `getPresignedDownloadUrl` en el backend), así que primero se pide
   * una fresca en vez de reutilizar la que ya estaba en pantalla — si el
   * usuario dejó el modal abierto un rato, la URL cacheada podría haber vencido.
   */
  download(reportId: string, file: IAccountingEntryStatus): void {
    if (!file.url) return;
    this.getStatus(reportId, [file.tipo]).subscribe({
      next: (res) => {
        const fresh = res?.files?.[0];
        if (fresh?.url) this.triggerDownload(fresh.url, fresh.filename);
        else this.triggerDownload(file.url!, file.filename);
      },
      error: () => this.triggerDownload(file.url!, file.filename),
    });
  }
}
