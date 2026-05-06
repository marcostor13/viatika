# Avance por etapas — Viátika

**Referencia:** [PlanDesarrolloPorFases.md](./PlanDesarrolloPorFases.md) · [Funcionalidades.md](./Funcionalidades.md)

**Contraste código vs alcance (Fase 1):** [ContrasteFase1-AlcanceVsCodigo.md](./ContrasteFase1-AlcanceVsCodigo.md)

**Cómo usar:** Marcá con `[x]` lo terminado y `[ ]` lo pendiente. Actualizá la línea **Avance** de cada fase y la tabla resumen (porcentajes son manuales). Los ítems `[x]` pueden tener **deuda** respecto al PDF; el contraste lo detalla.

---

## Resumen por fase

| Fase | Nombre | Ítems listos | Total ítems | % |
|:----:|--------|:------------:|:-----------:|:-:|
| 1 | Configuración inicial | 4 | 6 | ~67% |
| 2 | Solicitud de viáticos | 2 | 2 | 100% |
| 3 | Aprobación de viáticos | 2 | 2 | 100% |
| 4 | Pago tesorería | 2 | 2 | 100% |
| 5 | Ingreso y validación de gastos | 0 | 11 | 0% |
| 6 | Reembolsos | 0 | 5 | 0% |
| 7 | Devolución de saldos | 0 | 4 | 0% |
| 8 | Cierre definitivo | 0 | 4 | 0% |
| 9 | Reembolso directo | 0 | 3 | 0% |
| 10 | Caja chica | 0 | 3 | 0% |
| T | Transversal / soporte | 0 | 6 | 0% |

**Total ítems:** 48 · **Avance global:** 10 / 48 → **~21%**

---

## Fase 1 — Configuración inicial

**Avance:** 4 / 6 → **~67%** (varios puntos del PDF siguen pendientes — ver contraste)

- [x] 1.1 CRUD centros de costo + unicidad de código *(pendiente respecto al doc: campo “nombre cliente” dedicado y formato de selector `[Código - Proyecto - Cliente]`)*
- [ ] 1.2 Carga masiva Excel centros de costo + duplicados + errores
- [x] 1.3 CRUD categorías + límites en datos *(pendiente: bloqueo por tope y alerta 90% al registrar gastos, según doc / Fase 5)*
- [ ] 1.4 Carga masiva usuarios + duplicados + primer login
- [x] 1.5 Gestión usuarios web + permisos por módulo *(pendiente respecto al doc: Excel masivo, coordinador, tipo contrato, filtros área/cargo/contrato)*
- [x] 1.6 Firma digital en perfil *(pendiente respecto al doc: carga archivo PNG/JPG 500KB y **guard** que bloquee lo transaccional sin firma)*

---

## Fase 2 — Solicitud de viáticos

**Avance:** 2 / 2 → **100%** *(formulario colaborador + correo/log backend; coordinador asignable en alta/edición usuario tipo Colaborador)*

- [x] Formulario solicitud (lugar, fechas, centro de costo, detalle categorías, totales) *(modal `app-solicitud-viaticos-modal`: Mis rendiciones + «Solicitar más viáticos» en detalle; Places si hay API key en `environment`; selector `[Código - Proyecto]` + cliente cuando el API lo devuelve)*
- [x] Notificación al coordinador al enviar + log de envío *(plantilla correo + `coordinatorNotification` en anticipo; requiere `coordinatorId` en el colaborador)*

---

## Fase 3 — Aprobación de viáticos

**Avance:** 2 / 2 → **100%** *(notificación contabilidad: usuarios Administrador del cliente + módulo `tesoreria`; urgencia si fecha inicio viaje es hoy o mañana; compromiso en campo `committedAdvanceTotal` del centro de costo hasta registrar pago)*

- [x] Rechazo con observación + notificación + re-edición con historial *(mín. 10 caracteres en `RejectAdvanceDto`; correo `viatico-rechazo-colaborador`; `PATCH /advance/:id/resubmit`; historial con acción `resubmitted`; UI Mis rendiciones + modal + tesorería “Historial”)*
- [x] Aprobación + notificación contabilidad (urgente si aplica) + compromiso presupuestal *(correo `viatico-aprobacion-contabilidad`; `committedAdvanceTotal` en proyecto; liberación al `register-payment`)*

---

## Fase 4 — Gestión de pago por tesorería

**Avance:** 2 / 2 → **100%**

- [x] Registro comprobante pago → estado Pagado + activación módulo gastos *(backend `register-payment` exige comprobante PDF/JPG/PNG (máx. 10MB), guarda metadata y cambia estado a `paid`; en Mis Rendiciones se muestra “En Progreso - Registrando Gastos” con acceso a “Registrar gastos” en la rendición vinculada)*
- [x] Notificación colaborador + coordinador con PDF y enlace *(correo `viatico-pago-realizado` al colaborador y su coordinador con monto, fecha, referencia y enlace directo al comprobante y a la plataforma)*

---

## Fase 5 — Ingreso y validación de gastos

**Avance:** 0 / 11 → **0%**

- [ ] UI gastos habilitada cuando Pagado + estado rendición en panel
- [ ] Factura: OCR + validación SUNAT + edición post-OCR
- [ ] Planilla movilidad: GPS, correlativo, PDF
- [ ] Recibo de caja (OCR/manual + archivo obligatorio)
- [ ] Comprobante de caja: correlativo, PDF plantilla
- [ ] Reglas plazo ingreso (normal / observado / bloqueo mes)
- [ ] Alertas y bloqueos límite categoría (90% / 100%)
- [ ] Revisión coordinador: listado, aprobar/rechazar, historial
- [ ] Cierre rendición colaborador → envío aprobación final
- [ ] Aprobación final rendición coordinador + rechazo con observación
- [ ] PDF rendición completa + declaración jurada contabilidad

---

## Fase 6 — Reembolsos

**Avance:** 0 / 5 → **0%**

- [ ] Cálculo saldo a favor colaborador + activación flujo
- [ ] Notificación a contabilidad con enlace
- [ ] Registro pago reembolso + comprobante
- [ ] Estado Reembolsado + notificación con PDF a colaborador
- [ ] Documentos disponibles en “Mis documentos”

---

## Fase 7 — Devolución de saldos

**Avance:** 0 / 4 → **0%**

- [ ] Detección saldo a favor empresa + notificación con datos bancarios
- [ ] Carga comprobante por colaborador
- [ ] Validación contabilidad
- [ ] Estado Devolución completada + notificaciones finales

---

## Fase 8 — Cierre definitivo

**Avance:** 0 / 4 → **0%**

- [ ] Botón cierre solo contabilidad + condiciones (aprobada + liquidada)
- [ ] Validaciones pre-cierre (comprobantes, liquidación, observaciones)
- [ ] Estado Cerrado + bloqueo ediciones + logs
- [ ] Firma en PDFs definitivos + marca auditoría

---

## Fase 9 — Reembolso directo

**Avance:** 0 / 3 → **0%**

- [ ] Coordinador: alta reembolso directo (datos + urgencia)
- [ ] Notificaciones colaborador y contabilidad
- [ ] Flujo gastos y posteriores alineado a Fase 5

---

## Fase 10 — Caja chica

**Avance:** 0 / 3 → **0%**

- [ ] Apertura/fondeo mensual + habilitación gastos caja chica por centro
- [ ] Registro gastos sin aprobación por ítem + alertas fondo (sin bloqueo duro)
- [ ] Cierre mensual + PDF resumen + arrastre saldo al mes siguiente

---

## Transversal / soporte

**Avance:** 0 / 6 → **0%**

- [ ] Notificaciones y plantillas correo (§6.4, §7)
- [ ] API SUNAT + OCR con fallback / reintentos
- [ ] Geolocalización y distancias (§6.3)
- [ ] Correlativos + generación PDF (§6.5, §9)
- [ ] Reportes, dashboard, exportación (§8)
- [ ] Reglas de negocio RN aplicadas y probadas (§5)

---

## Notas

- Los porcentajes de la tabla **Resumen** y las líneas **Avance** hay que recalcularlos cuando cambien los checks (ej.: 3 de 6 → 50%).
- **Avance global** = suma de ítems con `[x]` / 48 (o excluí la fila Transversal si preferís medir solo fases 1–10: total 42).
