import { Injectable, signal } from '@angular/core';

/** Tipos de documento que se pueden encolar para subida diferida. */
export type OfflineDocType =
  | 'factura'
  | 'factura_pdf'
  | 'cash_receipt'
  | 'cash_voucher'
  | 'mobility_sheet'
  | 'other_expense'
  | 'declaracion_jurada';

export interface OfflineJob {
  id: string;
  type: OfflineDocType;
  /** Payload del create/analyze SIN `imageUrl`; se completa al sincronizar. */
  payload: any;
  /** Bytes del adjunto (si aplica). IndexedDB persiste Blobs directamente. */
  fileBlob?: Blob;
  fileName?: string;
  fileType?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'error';
  /** Etiqueta legible para la UI de pendientes. */
  label?: string;
}

const DB_NAME = 'viatika-offline';
const STORE = 'uploads';
const DB_VERSION = 1;

/**
 * Cola persistente de documentos creados sin conexión. Usa IndexedDB, disponible
 * tanto en web como en el WebView de Capacitor (Android/iOS), y capaz de guardar
 * Blobs sin conversión a base64. Solo persiste y consulta; el drenado lo hace
 * `OfflineSyncService`.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private dbPromise?: Promise<IDBDatabase>;

  /** Número de documentos pendientes de subir (reactivo para la UI). */
  readonly count = signal(0);

  constructor() {
    void this.refreshCount();
  }

  async add(job: OfflineJob): Promise<void> {
    const store = await this.tx('readwrite');
    await this.req(store.add(job));
    await this.refreshCount();
  }

  async put(job: OfflineJob): Promise<void> {
    const store = await this.tx('readwrite');
    await this.req(store.put(job));
    await this.refreshCount();
  }

  async remove(id: string): Promise<void> {
    const store = await this.tx('readwrite');
    await this.req(store.delete(id));
    await this.refreshCount();
  }

  async getAll(): Promise<OfflineJob[]> {
    const store = await this.tx('readonly');
    const all = await this.req<OfflineJob[]>(store.getAll());
    return (all || []).sort((a, b) => a.createdAt - b.createdAt);
  }

  async refreshCount(): Promise<void> {
    try {
      const store = await this.tx('readonly');
      const n = await this.req<number>(store.count());
      this.count.set(n || 0);
    } catch {
      this.count.set(0);
    }
  }

  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    this.dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.dbPromise;
  }

  private async tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    const db = await this.openDb();
    return db.transaction(STORE, mode).objectStore(STORE);
  }

  private req<T = any>(request: IDBRequest): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result as T);
      request.onerror = () => reject(request.error);
    });
  }
}
