import { Injectable, signal, computed } from '@angular/core';
import { Network } from '@capacitor/network';

/**
 * Estado de conectividad de la app, unificado para web y nativo (Capacitor).
 *
 * En nativo usa el plugin `@capacitor/network` (fiable en Android/iOS). En web
 * (o si el plugin no está disponible) cae a `navigator.onLine` + los eventos
 * `online`/`offline` del WebView. El estado se expone como signal para que la UI
 * y el motor de sincronización reaccionen sin polling.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly _online = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  /** `true` cuando hay conexión. */
  readonly online = this._online.asReadonly();
  /** `true` cuando NO hay conexión. */
  readonly offline = computed(() => !this._online());

  private initialized = false;

  constructor() {
    void this.init();
  }

  isOnline(): boolean {
    return this._online();
  }

  isOffline(): boolean {
    return !this._online();
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    this.initialized = true;

    // Fallback web/WebView.
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this._online.set(true));
      window.addEventListener('offline', () => this._online.set(false));
    }

    // Plugin nativo (preferente): estado inicial + escucha de cambios.
    try {
      const status = await Network.getStatus();
      this._online.set(status.connected);
      await Network.addListener('networkStatusChange', (s) =>
        this._online.set(s.connected)
      );
    } catch {
      // Plugin no disponible (p. ej. web sin polyfill): se conserva navigator.onLine.
    }
  }
}
