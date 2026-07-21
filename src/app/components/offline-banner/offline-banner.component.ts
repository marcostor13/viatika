import { Component, inject, computed } from '@angular/core';
import { ConnectivityService } from '../../services/connectivity.service';
import { OfflineSyncService } from '../../services/offline-sync.service';

/**
 * Aviso flotante de estado offline y documentos pendientes de subir. Se muestra
 * cuando no hay conexión o cuando quedan documentos en cola. Ofrece "Sincronizar
 * ahora" para forzar el drenado cuando ya hay red.
 */
@Component({
  selector: 'app-offline-banner',
  standalone: true,
  template: `
    @if (visible()) {
    <div
      class="fixed bottom-3 inset-x-3 z-[9999] mx-auto max-w-md rounded-lg px-4 py-2 shadow-lg flex items-center gap-3 text-sm"
      [class.bg-amber-500]="!online()"
      [class.text-white]="!online()"
      [class.bg-white]="online()"
      [class.text-slate-700]="online()"
      [class.ring-1]="online()"
      [class.ring-slate-200]="online()"
    >
      @if (!online()) {
      <span class="font-medium">Sin conexión</span>
      } @if (pending() > 0) {
      <span class="flex-1">
        {{ pending() }} documento(s) pendiente(s) de subir
      </span>
      } @else {
      <span class="flex-1">Los cambios se subirán automáticamente</span>
      } @if (online() && pending() > 0) {
      <button
        type="button"
        class="rounded-md bg-blue-600 text-white px-3 py-1 text-xs font-medium disabled:opacity-60"
        [disabled]="syncing()"
        (click)="syncNow()"
      >
        {{ syncing() ? 'Subiendo...' : 'Sincronizar ahora' }}
      </button>
      }
    </div>
    }
  `,
})
export class OfflineBannerComponent {
  private connectivity = inject(ConnectivityService);
  private sync = inject(OfflineSyncService);

  online = this.connectivity.online;
  pending = this.sync.pending;
  syncing = this.sync.syncing;

  visible = computed(() => !this.online() || this.pending() > 0);

  syncNow(): void {
    void this.sync.sync();
  }
}
