import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.datalia.viatika',
  appName: 'Viatika',
  webDir: 'dist/gastos/browser',
  // Origen https://localhost dentro del WebView: evita mixed-content y cookies inseguras.
  server: { androidScheme: 'https' },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#ffffff',
      showSpinner: false,
    },
    Keyboard: {
      resizeOnFullScreen: true,
    },
  },
};

export default config;
