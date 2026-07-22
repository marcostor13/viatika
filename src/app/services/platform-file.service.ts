import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
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
