import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { PlatformFileService } from './platform-file.service';

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

/** Período tributario grabado en las columnas Ejercicio/Periodo del archivo. */
export interface IAccountingEntryTaxPeriod {
  id: string;
  year: number;
  month: number;
  code: string;
  label: string;
}

export interface IAccountingEntryStatus {
  tipo: AsientoTipo;
  status: AccountingEntriesStatus;
  filename?: string;
  /** URL firmada de S3, válida por pocos minutos. Solo presente si hay un archivo listo. */
  url?: string;
  asientosCount?: number;
  /** Cuántos documentos (comprobantes) contiene el archivo disponible. */
  documentsCount?: number;
  cuadreErrors?: ICuadreError[];
  /** Avisos de configuración (ej. categoría sin cuenta 9X) detectados al generar. */
  warnings?: string[];
  errorMessage?: string;
  /** La rendición cambió después de generar el archivo (no lo invalida: es un lote). */
  stale?: boolean;
  completedAt?: string;
  /** Período tributario con el que se generó el archivo disponible. */
  taxPeriod?: IAccountingEntryTaxPeriod;
  /** No se puede generar NI descargar ahora (hoy: período tributario cerrado). */
  blocked?: boolean;
  /** Motivo del bloqueo, para mostrar al usuario. */
  blockedReason?: string;
}

/**
 * Documento (comprobante) de la rendición visto desde los asientos contables.
 * Alimenta el cuadro de selección previo a generar y el indicador de la
 * columna Opciones del detalle de la rendición.
 */
export interface IAccountingDocument {
  expenseId: string;
  expenseType: string;
  /** Sigla corta: FT, BV, TK, PM, CC, H, RD, DJ, OT, SC. */
  sigla: string;
  /** "Codigo Tipo Document" de Contanet (01, 03, 12, 66, 94, 00). */
  codTipDoc: string;
  tipoLabel: string;
  numero: string;
  ruc?: string;
  proveedor?: string;
  fecha?: string;
  moneda: string;
  total: number;
  categoria?: string;
  /** Tipos de asiento a los que aporta líneas este documento. */
  tipos: AsientoTipo[];
  contabilizado: boolean;
  contabilizadoAt?: string;
  contabilizadoByName?: string;
  contabilizadoPeriodo?: string;
}

@Injectable({ providedIn: 'root' })
export class AccountingEntriesService {
  private http = inject(HttpClient);
  private platformFile = inject(PlatformFileService);
  private url = `${environment.api}/accounting-entries`;

  /** Estado actual de los asientos (no dispara generación). Usar para pintar la UI y para polling. */
  getStatus(
    reportId: string,
    tipos?: AsientoTipo[],
    periodId?: string
  ): Observable<{ files: IAccountingEntryStatus[] }> {
    let params = new HttpParams();
    if (tipos?.length) params = params.set('tipos', tipos.join(','));
    if (periodId) params = params.set('periodId', periodId);
    return this.http.get<{ files: IAccountingEntryStatus[] }>(
      `${this.url}/${reportId}`,
      { params }
    );
  }

  /** Documentos de la rendición con su estado de contabilización. */
  getDocuments(reportId: string): Observable<{ documents: IAccountingDocument[] }> {
    return this.http.get<{ documents: IAccountingDocument[] }>(
      `${this.url}/${reportId}/documents`
    );
  }

  /**
   * Descontabiliza documentos: vuelven al pool de pendientes y se incluirán en
   * la próxima generación de asientos.
   */
  uncountDocuments(
    reportId: string,
    expenseIds: string[]
  ): Observable<{ updated: number }> {
    return this.http.patch<{ updated: number }>(
      `${this.url}/${reportId}/documents/uncount`,
      { expenseIds }
    );
  }

  /**
   * Dispara la generación en segundo plano. Responde de inmediato con el estado
   * resultante. `expenseIds` acota el archivo a los documentos elegidos; sin él
   * el backend toma todos los pendientes de contabilizar.
   */
  triggerGenerate(
    reportId: string,
    tipos?: AsientoTipo[],
    force = false,
    periodId?: string,
    expenseIds?: string[]
  ): Observable<{ files: IAccountingEntryStatus[] }> {
    let params = new HttpParams();
    if (tipos?.length) params = params.set('tipos', tipos.join(','));
    if (force) params = params.set('force', 'true');
    if (periodId) params = params.set('periodId', periodId);
    return this.http.post<{ files: IAccountingEntryStatus[] }>(
      `${this.url}/${reportId}/generate`,
      { expenseIds: expenseIds ?? [] },
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
    void this.platformFile.saveFromUrl(url, filename);
  }

  /**
   * Descarga un archivo listo. Las URLs firmadas expiran a los pocos minutos
   * (ver `getPresignedDownloadUrl` en el backend), así que primero se pide
   * una fresca en vez de reutilizar la que ya estaba en pantalla — si el
   * usuario dejó el modal abierto un rato, la URL cacheada podría haber vencido.
   */
  download(
    reportId: string,
    file: IAccountingEntryStatus,
    periodId?: string
  ): void {
    if (!file.url) return;
    this.getStatus(reportId, [file.tipo], periodId).subscribe({
      next: (res) => {
        const fresh = res?.files?.[0];
        if (fresh?.url) this.triggerDownload(fresh.url, fresh.filename);
        else this.triggerDownload(file.url!, file.filename);
      },
      error: () => this.triggerDownload(file.url!, file.filename),
    });
  }
}
