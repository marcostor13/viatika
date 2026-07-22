import { Injectable, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';

/**
 * Inicializa los plugins nativos de Capacitor. No hace nada en web:
 * todas las llamadas se guardan tras `isNativePlatform()`.
 */
@Injectable({ providedIn: 'root' })
export class NativeInitService {
  private location = inject(Location);

  async init(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Barra de estado: iconos oscuros sobre header claro.
    try {
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setOverlaysWebView({ overlay: false });
    } catch {
      // StatusBar no disponible (ej. algunos emuladores): ignorar.
    }

    // El teclado empuja el contenido en vez de taparlo.
    try {
      await Keyboard.setResizeMode({ mode: KeyboardResize.Native });
    } catch {
      /* plugin de teclado no disponible */
    }

    // Botón físico "atrás": retrocede en el historial; si no hay, sale.
    App.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack) {
        this.location.back();
      } else {
        App.exitApp();
      }
    });

    // Ocultar el splash una vez que Angular ya pintó.
    try {
      await SplashScreen.hide();
    } catch {
      /* splash ya oculto */
    }
  }
}
