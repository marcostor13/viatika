# Modo Offline (Android / iOS)

Permite crear comprobantes sin conexión y subirlos automáticamente al recuperar red.
Aplica a Android y iOS: el plugin nativo es una dependencia npm, así que al generar
iOS (`npx cap add ios` + `npx cap sync ios`) queda incluido sin cambios extra.

## Cómo funciona

1. **Detección de conexión** — `ConnectivityService` usa `@capacitor/network` en nativo
   (fiable en Android/iOS) y cae a `navigator.onLine` + eventos `online`/`offline` en web.
   Expone `online()` / `offline()` como signals.
2. **Cola persistente** — `OfflineQueueService` guarda cada documento pendiente en
   IndexedDB (`viatika-offline` → store `uploads`), incluyendo el adjunto como `Blob`.
   IndexedDB funciona igual en web y en el WebView de Capacitor y sobrevive cierres de app.
3. **Sincronización** — `OfflineSyncService` drena la cola al arrancar y cada vez que
   vuelve la conexión (via `effect` sobre `online()`). Por cada job: sube el adjunto a
   S3 (presigned URL), inyecta la `imageUrl` y llama al endpoint de creación. Reintenta
   hasta 5 veces; luego descarta el documento y avisa.
4. **UI** — `OfflineBannerComponent` (montado en `AppComponent`) muestra un aviso flotante
   cuando no hay conexión o quedan pendientes, con botón "Sincronizar ahora".

## Documentos soportados

Todos los tipos de comprobante de `add-invoice`:

| Tipo offline        | Endpoint al sincronizar        |
|---------------------|--------------------------------|
| `factura` (imagen)  | `POST /expense/analyze-image`  |
| `factura_pdf`       | `POST /expense/analize-pdf` (FormData) |
| `cash_receipt`      | `POST /expense/cash-receipt`   |
| `cash_voucher`      | `POST /expense/cash-voucher`   |
| `mobility_sheet`    | `POST /expense/mobility-sheet` |
| `other_expense`     | `POST /expense/other-expense`  |
| `declaracion_jurada`| `POST /expense/declaracion-jurada` |

El análisis IA/OCR no corre offline: la factura se crea (y el backend la analiza) al
sincronizar. No se muestra el paso de revisión post-OCR para documentos encolados.

## Archivos

- `src/app/services/connectivity.service.ts`
- `src/app/services/offline-queue.service.ts`
- `src/app/services/offline-sync.service.ts`
- `src/app/components/offline-banner/offline-banner.component.ts`
- Integración: `src/app/app.component.ts`, `src/app/modules/invoices/add-invoice/add-invoice.component.ts`

## Puesta en marcha

```bash
npm install            # instala @capacitor/network (ya en package.json)
npm run build
npx cap sync android   # registra el plugin en Android
# iOS: npx cap add ios && npx cap sync ios
```

## Limitación conocida

El alcance es **solo cola de subida**: la lectura de datos (listas de proyectos y
categorías que alimentan los selectores del formulario) sigue requiriendo red. En un
arranque en frío sin conexión esos selectores estarán vacíos. Para que la creación
offline sea plenamente usable conviene, como siguiente paso, cachear proyectos y
categorías (p. ej. en IndexedDB/Preferences) y servirlos al formulario cuando `offline()`.
