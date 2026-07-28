import { Injectable } from '@angular/core';
import { Capacitor, CapacitorHttp } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Browser } from '@capacitor/browser';

/**
 * Abstrae la descarga/apertura de archivos entre web y nativo (Capacitor).
 *
 * En web se conserva el comportamiento previo (<a download> / window.open).
 * En Android el patrón `<a download>` no guarda nada: se escribe el blob al
 * sistema de archivos y se ofrece el diálogo nativo de compartir/abrir. Las URLs
 * remotas (S3) se abren en el navegador in-app en vez de una pestaña nueva.
 */
@Injectable({ providedIn: 'root' })
export class PlatformFileService {
  get isNative(): boolean {
    return Capacitor.isNativePlatform();
  }

  /** Guarda un Blob generado en cliente (PDF/Excel/CSV). */
  async saveBlob(blob: Blob, filename: string): Promise<void> {
    if (!this.isNative) {
      this.saveWeb(blob, filename);
      return;
    }
    const base64 = await this.blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    try {
      await Share.share({ title: filename, url: uri });
    } catch {
      // El usuario canceló el diálogo de compartir: no es un error.
    }
  }

  /** Descarga desde una URL remota (ej: presigned S3 con Content-Disposition). */
  async saveFromUrl(url: string, filename?: string): Promise<void> {
    if (!url) return;
    if (!this.isNative) {
      const a = document.createElement('a');
      a.href = url;
      if (filename) a.download = filename;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    // En nativo `a.download` no aplica a orígenes remotos: abrir en navegador in-app.
    await Browser.open({ url });
  }

  /** Abre/visualiza una URL remota (PDF/imagen). */
  async openUrl(url: string): Promise<void> {
    if (!url) return;
    if (!this.isNative) {
      window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    await Browser.open({ url });
  }

  /**
   * Descarga el contenido de una URL remota para procesarlo en cliente (ej.
   * adjuntar comprobantes al PDF completo). Devuelve null si no se pudo.
   *
   * En nativo se usa el HTTP de Capacitor y no `fetch`: el WebView de Android
   * corre en el origen `https://localhost`, que el bucket de S3 no tiene en su
   * configuración CORS, así que un `fetch` se bloquea y el adjunto se pierde.
   * En web se pide `cache: 'no-store'` porque la vista previa `<img>` del
   * comprobante deja en caché una respuesta sin cabeceras CORS y `fetch` la
   * reutiliza y falla — de ahí que el mismo comprobante se adjunte unas veces
   * sí y otras no.
   */
  async fetchBinary(url: string): Promise<Blob | null> {
    if (!url) return null;
    try {
      if (this.isNative) {
        const res = await CapacitorHttp.get({
          url,
          responseType: 'blob',
        });
        if (res.status < 200 || res.status >= 300) return null;
        const contentType =
          this.headerValue(res.headers, 'content-type') || 'application/octet-stream';
        return this.base64ToBlob(String(res.data ?? ''), contentType);
      }
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.blob();
    } catch {
      return null;
    }
  }

  /** Las cabeceras de CapacitorHttp no normalizan mayúsculas entre plataformas. */
  private headerValue(
    headers: Record<string, string> | undefined,
    name: string,
  ): string | undefined {
    if (!headers) return undefined;
    const key = Object.keys(headers).find(
      k => k.toLowerCase() === name.toLowerCase(),
    );
    return key ? headers[key] : undefined;
  }

  private base64ToBlob(base64: string, contentType: string): Blob {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: contentType });
  }

  private saveWeb(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1] ?? '');
      };
      reader.readAsDataURL(blob);
    });
  }
}
