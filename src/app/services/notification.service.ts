import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  message = new BehaviorSubject('');
  type = new BehaviorSubject<'success' | 'error' | 'warning'>('success');
  visible = new BehaviorSubject(false);

  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  show(
    message: string,
    type: 'success' | 'error' | 'warning' = 'success',
    duration = 5000
  ) {
    this.message.next(message);
    this.type.next(type);
    this.visible.next(true);

    // Se limpia el timer previo para que un toast largo (p. ej. el error de
    // SUNAT) no lo corte un temporizador pendiente de una notificación anterior.
    if (this.hideTimer) clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => this.hide(), duration);
  }

  hide() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.visible.next(false);
  }

  isVisible() {
    return this.visible.asObservable();
  }
}
