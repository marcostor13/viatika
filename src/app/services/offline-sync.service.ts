import { Injectable, inject, signal, effect, untracked } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { ConnectivityService } from './connectivity.service';
import {
  OfflineQueueService,
  OfflineJob,
  OfflineDocType,
} from './offline-queue.service';
import { UploadService } from './upload.service';
import { InvoicesService } from '../modules/invoices/services/invoices.service';
import { NotificationService } from './notification.service';
import { environment } from '../../environments/environment';

/** Reintentos antes de descartar un documento como fallo permanente. */
const MAX_ATTEMPTS = 5;

/**
 * Motor de sincronización diferida. Encola documentos creados sin conexión y los
 * sube cuando vuelve la red: por cada job sube el adjunto a S3 (presigned URL),
 * inyecta la `imageUrl` resultante en el payload y llama al endpoint de creación
 * correspondiente. Reacciona automáticamente al recuperar conexión.
 */
@Injectable({ providedIn: 'root' })
export class OfflineSyncService {
  private connectivity = inject(ConnectivityService);
  private queue = inject(OfflineQueueService);
  private upload = inject(UploadService);
  private invoices = inject(InvoicesService);
  private notification = inject(NotificationService);

  /** `true` mientras se está drenando la cola. */
  readonly syncing = signal(false);
  /** Documentos pendientes (reactivo). */
  readonly pending = this.queue.count;

  constructor() {
    // Drena la cola al arrancar y cada vez que se recupera la conexión. El efecto
    // solo depende de `online()`; `sync()` corre en `untracked` para no rastrear
    // `syncing` (evita un bucle de reejecución).
    effect(() => {
      if (this.connectivity.online()) {
        untracked(() => void this.sync());
      }
    });
  }

  /** Guarda un documento en la cola local para subirlo al reconectar. */
  async enqueue(input: {
    type: OfflineDocType;
    payload: any;
    file?: File | null;
    label?: string;
  }): Promise<void> {
    const job: OfflineJob = {
      id: this.newId(),
      type: input.type,
      payload: input.payload,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending',
      label: input.label,
    };
    if (input.file) {
      job.fileBlob = input.file;
      job.fileName = input.file.name;
      job.fileType = input.file.type;
    }
    await this.queue.add(job);
  }

  /** Sube todos los documentos pendientes. Seguro de llamar en cualquier momento. */
  async sync(): Promise<void> {
    if (this.syncing()) return;
    if (this.connectivity.isOffline()) return;

    this.syncing.set(true);
    let ok = 0;
    let failedPermanent = 0;
    try {
      const jobs = await this.queue.getAll();
      for (const job of jobs) {
        if (this.connectivity.isOffline()) break;
        try {
          await this.process(job);
          await this.queue.remove(job.id);
          ok++;
        } catch (e: any) {
          job.attempts++;
          job.status = 'error';
          job.lastError = e?.error?.message || e?.message || String(e);
          if (job.attempts >= MAX_ATTEMPTS) {
            await this.queue.remove(job.id);
            failedPermanent++;
          } else {
            await this.queue.put(job);
          }
        }
      }
    } finally {
      this.syncing.set(false);
    }

    if (ok > 0) {
      this.notification.show(
        `${ok} documento(s) pendiente(s) se subieron correctamente.`,
        'success'
      );
    }
    if (failedPermanent > 0) {
      this.notification.show(
        `${failedPermanent} documento(s) no se pudieron subir tras varios intentos y fueron descartados.`,
        'error'
      );
    }
  }

  private async process(job: OfflineJob): Promise<void> {
    // Factura PDF: el backend recibe el archivo directo (FormData) y lo analiza;
    // no se pre-sube a S3.
    if (job.type === 'factura_pdf') {
      const fd = new FormData();
      fd.append('file', this.toFile(job));
      if (job.payload?.proyectId) fd.append('proyectId', job.payload.proyectId);
      if (job.payload?.categoryId) fd.append('categoryId', job.payload.categoryId);
      fd.append('status', job.payload?.status || 'pending');
      if (job.payload?.expenseReportId) {
        fd.append('expenseReportId', job.payload.expenseReportId);
      }
      await firstValueFrom(this.invoices.analyzePdf(fd));
      return;
    }

    const payload = { ...job.payload };
    if (job.fileBlob) {
      const { downloadUrl$ } = this.upload.uploadFile(
        this.toFile(job),
        environment.storagePath
      );
      payload.imageUrl = await firstValueFrom(downloadUrl$);
    }

    await firstValueFrom(this.dispatch(job.type, payload));
  }

  private toFile(job: OfflineJob): File {
    return new File([job.fileBlob as Blob], job.fileName || 'archivo', {
      type: job.fileType || 'application/octet-stream',
    });
  }

  private dispatch(type: OfflineDocType, payload: any): Observable<unknown> {
    switch (type) {
      case 'factura':
        return this.invoices.analyzeInvoice(payload);
      case 'cash_receipt':
        return this.invoices.createCashReceipt(payload);
      case 'cash_voucher':
        return this.invoices.createCashVoucher(payload);
      case 'mobility_sheet':
        return this.invoices.createMobilitySheet(payload);
      case 'other_expense':
        return this.invoices.createOtherExpense(payload);
      case 'declaracion_jurada':
        return this.invoices.createDeclaracionJurada(payload);
      default:
        throw new Error('Tipo de documento offline no soportado: ' + type);
    }
  }

  private newId(): string {
    try {
      return crypto.randomUUID();
    } catch {
      return `job-${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    }
  }
}
