# Reglas de Aprobación de Viáticos por Centro de Costo — Análisis de Factibilidad

> **Fecha:** 14/07/2026
> **Alcance del análisis:** repositorio **frontend** (Angular 19) `viatika`. El backend (API NestJS) **no** forma parte de este repositorio; cuando una regla depende de él se indica explícitamente.
> **Objetivo:** analizar las reglas de negocio propuestas para el flujo de aprobación de solicitudes y rendiciones de viáticos, contrastarlas con lo que ya existe en el sistema y detallar qué está implementado y qué falta.

---

## 1. Reglas de negocio propuestas (enunciado ordenado)

Estas son las reglas que se deben soportar, reorganizadas para mayor claridad.

### 1.1 Asignación de centros de costo al colaborador
- Cada colaborador tiene asignados **N centros de costo**.
- Entre esos centros, **uno es el principal (primario)**.

### 1.2 Aprobadores por centro de costo
- Cada centro de costo tiene asignados **N aprobadores**, organizados por **niveles**: nivel 1 (N1), nivel 2 (N2), nivel 3 (N3), etc.

### 1.3 Flujo de aprobación de la **SOLICITUD** de viáticos

**Caso A — El centro de costo seleccionado SÍ está asignado al colaborador:**
1. Aprobador **N2** del centro de costo **seleccionado**.
2. **Contabilidad**.

**Caso B — El centro de costo seleccionado NO está asignado al colaborador:**
1. Aprobador **N2** del centro de costo **principal (primario)** del colaborador.
2. Aprobador **N2** del centro de costo **seleccionado**.

> _(Nota: en el Caso B, según lo enunciado, no interviene Contabilidad en la etapa de solicitud.)_

### 1.4 Flujo de aprobación de la **RENDICIÓN** y documentos
Aplica tanto a rendiciones de viáticos como a **rendiciones directas**.

**Caso A — El centro de costo de la rendición SÍ está asignado al colaborador:**
1. Aprobador **N1** del centro de costo **principal**.
2. Aprobador **N2** del centro de costo **principal**.
3. **Contabilidad**.

**Caso B — El centro de costo de la rendición NO está asignado al colaborador:**
1. Aprobador **N1** del centro de costo **principal**.
2. Aprobador **N2** del centro de costo **principal**.
3. Aprobador **N2** del centro de costo **seleccionado**.
4. **Contabilidad**.

### 1.5 Regla de escalamiento por auto-aprobación
- Si el colaborador que crea la solicitud/rendición es **también uno de los aprobadores** de la cadena, **sus aprobaciones se escalan un nivel**:
  - N1 → N2
  - N2 → N3
  - (según corresponda)
- Es decir, el aprobador que coincide con el solicitante se **salta** y su lugar lo toma el aprobador del nivel inmediatamente superior de ese centro de costo.

### 1.6 Los niveles son ranuras (slots) EXPLÍCITAS, no posicionales
- Cada nivel (N1, N2, N3, …) es un **campo específico y nombrado** en el centro de costo. **No** se asume que "el primer aprobador de la lista es N1 y el segundo es N2".
- Un nivel puede estar **vacío**. Si un centro de costo **no tiene N1**, las aprobaciones que correspondían a N1 **se saltan y pasan directo a N2** (el siguiente nivel que sí exista).
- ⚠️ **Importante:** que N1 esté vacío **NO** significa que N2 "se convierta en N1". N2 sigue siendo N2; simplemente el paso N1 no existe y se omite. La numeración de niveles es **fija por identidad**, no por posición ni por reordenamiento.
- Corolario para el motor de ruteo: al construir la cadena (reglas 1.3 y 1.4) se debe **buscar el aprobador del nivel solicitado por su identidad** (N1 del principal, N2 del principal, N2 del seleccionado, etc.). Si ese nivel no está definido en el centro correspondiente, ese paso se **omite** sin desplazar la numeración de los demás.

### 1.7 El flujo de CAJA CHICA también requiere aprobación
- La aprobación por niveles (según las reglas de rendición 1.4) **aplica también a la rendición de caja chica**.
- Esto es un **cambio** respecto al comportamiento histórico documentado, donde la caja chica acumulaba gastos **sin aprobación intermedia** (ver sección 2 y el alcance funcional original: _"Sin Aprobación Intermedia … no requieren aprobación individual del coordinador"_).

---

## 2. Cómo funciona hoy el sistema (estado actual)

### 2.1 Modelo de Centro de Costo (`IProject`)
Archivo: `src/app/modules/invoices/interfaces/project.interface.ts`

El "centro de costo" es la entidad **Project**. Sus campos actuales son:

| Campo | Uso |
|---|---|
| `name`, `code`, `isActive`, `description` | Identificación básica |
| `lineaNegocioId` / `lineaNegocio` | Línea de negocio (referencia única) |
| `categoryGroupId` / `categoryGroup` | **Perfil de categoría** (una sola referencia) |
| `cuentaAnalitica9x`, `cuentaDestino6x`, `centroCosto`, `subCentroCosto`, `area`, `esAdministrativo` | Mapeo contable (asientos Contanet) |

> ❌ **No existe** ningún campo de aprobadores. No hay `approvers`, `aprobadores`, `level`, `nivel`, ni referencia a usuarios. El formulario (`centros-de-costo/form/`) y la carga masiva (`bulk-import/`) tampoco los manejan.

### 2.2 Asignación de centros de costo a usuarios
Archivos: `src/app/interfaces/user.interface.ts`, `src/app/modules/admin-users/user-permissions/`

> ⚠️ **Aclaración importante — tres entidades que se confunden:**
> - **Categoría** (`ICategory`): rubro de gasto (Alimentación, Hospedaje…).
> - **Perfil de categoría** (`ICategoryGroup`): paquete con nombre de varias categorías.
> - **Centro de costo** (`IProject`): el proyecto; apunta a **un** perfil vía `categoryGroupId`.
>
> La relación es `Centro de costo → un perfil de categoría → N categorías`.

**Lo que SÍ se asigna en los permisos del colaborador** (`user-permissions.component.ts`, lo que se construye y persiste en `save()`): `modules`, `canApproveL1`, `canApproveL2`, `canBackdateViaticos` y **`categoryIds`** (categorías, seleccionables en bloque por perfil como atajo). ➡️ **Se asignan categorías/perfiles, NO centros de costo.**

**Sobre la idea de "asignar centros de costo en los permisos":**
- `IUserPermissions` **sí** declara el campo `categoryProfileIds` con el comentario _"Perfiles de categoría asignados (deriva centros de costo y categorías visibles)"_. Existe, por tanto, una **intención de diseño** de derivar los centros visibles a partir de los perfiles asignados al colaborador.
- **Pero ese campo NO está cableado:** el UI de permisos ni lo lee ni lo guarda (solo maneja `categoryIds`), y un grep en todo el frontend confirma que `categoryProfileIds` solo aparece en la declaración de la interfaz. La derivación perfil→centro no se ejecuta.
- En la práctica, al crear una solicitud (`mis-rendiciones/solicitud-viaticos/`), el colaborador **elige el centro de costo entre TODOS los centros activos de la empresa** (`getProjects(clientId)` filtrando solo `isActive`), no entre un subconjunto asignado a él.

**Aun si se activara `categoryProfileIds`, quedarían dos brechas frente a la regla 1:**
1. Se asignan **perfiles**, no centros; y como varios centros pueden compartir el mismo perfil (`centro → un perfil`), un perfil **no identifica un centro concreto** → la derivación sería ambigua (muchos-a-uno).
2. No existe en ninguna parte el concepto de **centro principal / primario**.

**Otros datos del modelo de usuario:**
- `IUser` / `IUserResponse` **no tienen** ningún campo `projectIds` / `centrosDeCosto` ni marca de centro **principal**.
- El único vínculo tipo "aprobador" en el usuario es **`coordinatorId`**: un **único** coordinador, usado solo para **notificaciones/ruteo** de la solicitud. No es una cadena de niveles ni depende del centro.

> ❌ La regla 1 sigue siendo un **faltante funcional**. Se reutiliza el andamiaje de perfiles↔categorías y el campo reservado `categoryProfileIds`, pero falta: (a) asignar **centros de costo** al colaborador y (b) marcar el **principal**.

### 2.3 Modelo de niveles de aprobación (actual)
Archivos: `user.interface.ts`, `user-state.service.ts`, `advance.interface.ts`

- Los niveles hoy son **permisos a nivel de usuario**, globales y **desacoplados del centro de costo**:
  - `IUserPermissions.canApproveL1: boolean`
  - `IUserPermissions.canApproveL2: boolean`
  - ❌ **No existe** `canApproveL3` ni ningún nivel 3.
- Defaults por rol (`create-user.component.ts`): Colaborador = ninguno; Coordinador = L1; Contabilidad = L1+L2; Administrador = ninguno.
- La solicitud/anticipo (`IAdvance`) lleva `approvalLevel`, `requiredLevels` y `approvalHistory`, pero **`requiredLevels` es una propiedad fija de la solicitud, no se deriva del centro de costo**.
- El **enrutamiento** (quién es el siguiente aprobador) lo resuelve el **backend** a partir de `coordinatorId` + los flags de rol, no a partir de aprobadores del centro de costo.

### 2.4 Flujo de aprobación actual — SOLICITUD de viáticos
Archivos: `viaticos/viaticos-detail/`, `services/advance.service.ts`, `services/expense-reports.service.ts`

Cadena real hoy (2 niveles fijos):

```
Colaborador crea la solicitud
        │  (notifica al coordinador — coordinatorId del usuario)
        ▼
Coordinador  ──►  approve-l1   (estado: pending_l1 → pending_l2)
        ▼
Aprobador L2 ──►  approve-l2   (estado: pending_l2 → viatico_approved)
        ▼
Contabilidad ──►  registra pago / desembolso
```

Endpoints: `PATCH .../viatico/approve-l1`, `.../viatico/approve-l2`, `.../viatico/reject`.
Estados: `pending_l1`, `pending_l2`, `viatico_approved`, `partially_paid`, `paid`, `settled`, `rejected`, `returned`.

> El aprobador se determina por el **coordinador único del colaborador** y por los **flags de rol**, **no** por los aprobadores N2 del centro de costo seleccionado o principal.

> **Nota técnica:** conviven **dos modelos** para la solicitud de viáticos — el legacy `Advance` (`advance.service.ts`) y el unificado `ExpenseReport` con `type='viatico'` (`expense-reports.service.ts`). Ambos usan el mismo esquema fijo de 2 niveles (`approve-l1`/`approve-l2`). En la narrativa del código, **L1 = Coordinador** y **L2 = Contabilidad** (que además registra el pago/depósito).

### 2.5 Flujo de aprobación actual — RENDICIÓN (y rendiciones directas)
Archivos: `mis-rendiciones/rendicion-detail/`, `services/expense-reports.service.ts`

Cadena real hoy:

```
Colaborador registra gastos y "Envía"  (estado: open → submitted)
        ▼
Coordinador aprueba gastos (canApproveL1) / batch-approve-coord
        ▼
Rendición pasa a "En contabilidad"  (submitted → pending_accounting)
        ▼
Contabilidad revisa, liquida y cierra  (→ approved → settled → closed)
```

> El "equipo" que ve cada coordinador lo delimita el backend por `coordinatorId`. Es **un coordinador** + **Contabilidad**, no una cadena N1→N2 por centro de costo, y **no hay N3**.

> **Aprobación por comprobante:** en la rendición, la aprobación es **por cada gasto/comprobante** (no solo del reporte global), mediante los endpoints `invoice/:id/approve-coord` (Coordinador) y `invoice/:id/approve-cont` (Contabilidad), más los `batch-approve-coord` / `batch-approve-collab`. El reporte guarda `coordinatorApprovedBy/At`, `contabilidadApprovedBy/At` y `rejectedByRole: 'coordinador' | 'contabilidad'`. Las **rendiciones directas** siguen esta misma cadena `open → submitted → pending_accounting → approved` (no usan los estados `pending_l1/pending_l2` de la solicitud).

### 2.6 Flujo actual — CAJA CHICA
Archivos: `mis-rendiciones/nueva-caja-chica/`, `rendiciones-caja-chica/`, `interfaces/caja-chica-report.interface.ts`, `interfaces/petty-cash.interface.ts`

- El **reporte de caja chica** tiene solo dos estados: **`draft | finalized`**. **No hay cadena de aprobación**: ni coordinador, ni N1/N2, ni Contabilidad como paso aprobatorio de los gastos.
- La **caja/fondo** (`petty-cash`) tiene su propio ciclo `pending_funding | active | closed`, que es el **fondeo por Contabilidad**, no la aprobación de los gastos.
- Coincide con el alcance funcional original: los gastos de caja chica _"se acumulan directamente; **no requieren aprobación individual del coordinador**"_.

> ❌ Hoy la caja chica **no pasa por aprobación**. La regla 1.7 exige añadirle la misma cadena por niveles de la rendición → es un cambio nuevo.

### 2.7 Niveles explícitos y regla de auto-aprobación (escalamiento)
> ❌ **No existe** ninguna lógica de "si el creador es aprobador, escalar N1→N2 / N2→N3", ni de **niveles como ranuras explícitas** (N1/N2/N3 nombrados, con omisión de niveles vacíos sin renumerar). No podría existir porque hoy no hay aprobadores por nivel en el centro de costo: solo hay dos flags posicionales globales (`canApproveL1`/`canApproveL2`) en el usuario.

---

## 3. Contraste regla por regla: ¿implementado o faltante?

| # | Regla de negocio | Estado | Detalle |
|---|---|---|---|
| 1.1 | Colaborador con N centros de costo, uno principal | ❌ **Falta** | En permisos se asignan **categorías/perfiles** (`categoryIds`), no centros de costo. Existe el campo reservado `categoryProfileIds` ("deriva centros…") pero **sin cablear**; hoy el colaborador elige de todos los centros activos y no hay "principal". |
| 1.2 | Centro de costo con N aprobadores por nivel (N1, N2, N3…) | ❌ **Falta** | `IProject` no tiene aprobadores. Los niveles hoy son flags globales del usuario (solo L1/L2). |
| 1.3-A | Solicitud (centro asignado): N2 seleccionado → Contabilidad | ⚠️ **Parcial** | Existe una cadena de 2 pasos + Contabilidad, pero el aprobador sale de `coordinatorId`/rol, no del N2 del centro. |
| 1.3-B | Solicitud (centro no asignado): N2 principal → N2 seleccionado | ❌ **Falta** | No hay noción de "asignado vs no asignado", ni de centro principal, ni ruteo por aprobadores del centro. |
| 1.4-A | Rendición (centro asignado): N1 ppal → N2 ppal → Contabilidad | ⚠️ **Parcial** | Existe cadena Coordinador → Contabilidad, pero de nuevo por `coordinatorId`/rol, no por N1/N2 del centro principal. |
| 1.4-B | Rendición (no asignado): N1 ppal → N2 ppal → N2 seleccionado → Contabilidad | ❌ **Falta** | Requiere hasta 4 pasos dinámicos según centro; hoy la cadena es fija. |
| 1.5 | Escalamiento si el creador es aprobador (N1→N2, N2→N3) | ❌ **Falta** | No existe; depende de tener aprobadores por nivel en el centro. |
| 1.6 | Niveles como ranuras explícitas; nivel vacío se omite sin renumerar (N1 vacío ⇒ va directo a N2, N2 NO pasa a ser N1) | ❌ **Falta** | Hoy solo hay dos flags posicionales globales (`canApproveL1/L2`); no hay ranuras nombradas por centro ni lógica de omisión sin renumerar. |
| 1.7 | Caja chica también requiere aprobación por niveles | ❌ **Falta** | La caja chica hoy es `draft → finalized` sin aprobación; hay que añadirle la cadena de la rendición (1.4). |

**Leyenda:** ✅ Implementado · ⚠️ Parcial (existe algo reutilizable) · ❌ Falta

---

## 4. Veredicto de factibilidad

**Es factible, pero es un cambio estructural de mediana-alta magnitud**, no un ajuste menor. La arquitectura actual asume un modelo **fijo de 2 niveles ligado al usuario** (`coordinatorId` + flags `canApproveL1/L2`), mientras que las reglas propuestas exigen un modelo **dinámico de N niveles ligado al centro de costo**, con ruteo que depende de:
- si el centro es asignado o no,
- cuál es el centro principal del colaborador,
- y si el propio solicitante es aprobador (escalamiento).

La mayor parte del trabajo real —el motor de enrutamiento de aprobaciones— vive en el **backend**, que no está en este repositorio. El frontend aporta la configuración (asignar aprobadores al centro, asignar centros al usuario y marcar el principal) y la visualización de la cadena/paso actual.

**Riesgo principal:** la lógica de niveles hoy está esparcida en varios componentes (`viaticos-detail`, `rendicion-detail`, `tesoreria`, `inicio`, `dashboard`) usando `canApproveL1/L2`. Al pasar a aprobadores dinámicos por centro habrá que refactorizar todas esas comprobaciones para preguntar "¿soy YO el aprobador del paso actual de ESTA solicitud?" en lugar de "¿tengo el permiso L1/L2?".

---

## 5. Qué falta implementar (plan de trabajo)

### 5.1 Backend (fuera de este repo — imprescindible)
1. **Modelo de aprobadores en el centro de costo con RANURAS EXPLÍCITAS por nivel** (regla 1.6). Recomendado un mapa nivel→aprobadores en lugar de una lista posicional, p. ej.:
   ```
   Project.approvers: { "1": [userId...], "2": [userId...], "3": [userId...] }
   // o: Project.approvers: [{ level: number, userIds: string[] }]
   ```
   Clave: el **nivel es la identidad**; un nivel puede faltar y **no** se renumera.
2. **Asignación de centros al usuario:** `User.assignedCostCenters: [{ projectId, isPrimary }]` (exactamente uno con `isPrimary = true`).
3. **Motor de enrutamiento de aprobaciones** que, al crear una solicitud/rendición/**caja chica**, construya la cadena de pasos según las reglas 1.3, 1.4 y 1.7:
   - determinar asignado vs no asignado,
   - resolver los niveles **por identidad** (N1 del principal, N2 del principal, N2 del seleccionado…) **buscándolos como slots**; si el slot no existe, **omitir ese paso sin desplazar la numeración** (regla 1.6),
   - aplicar el **escalamiento** de la regla 1.5 cuando el creador es aprobador (N1→N2, N2→N3), reutilizando el mismo mecanismo de "buscar el siguiente slot que exista",
   - añadir a Contabilidad donde corresponda.
4. **Persistir la cadena** en la solicitud (lista ordenada de pasos con nivel, centro, aprobador esperado y estado) en lugar del `requiredLevels` numérico fijo.
5. **Validación de autorización** en cada endpoint `approve`: solo puede aprobar el usuario esperado en el paso actual.
6. **Caja chica (regla 1.7):** añadir la cadena de aprobación al reporte de caja chica. Hoy su estado es `draft | finalized`; hay que insertar los estados/pasos de aprobación (N1/N2/Contabilidad) entre el envío y la finalización, reutilizando el mismo motor.

### 5.2 Frontend (este repositorio)
1. **Centros de costo** (`centros-de-costo/form/` + `project.interface.ts` + `bulk-import/`):
   - Añadir UI para asignar **aprobadores por nivel** (N1, N2, N3…) al centro.
   - Extender `IProject` con `approvers`.
2. **Usuarios** (`admin-users/create-user/`, `user-permissions/` + `user.interface.ts`):
   - UI para asignar **N centros de costo** al colaborador y marcar el **principal**.
   - Extender `IUser`/`IUserResponse` con la lista de centros asignados.
3. **Centros de costo — ranuras explícitas** (`centros-de-costo/form/`, regla 1.6):
   - La UI debe permitir dejar un nivel **vacío** (p. ej. definir N2 sin N1) y guardarlo como slot nombrado, no como "primer/segundo aprobador de una lista".
4. **Modelo de niveles:**
   - Introducir **N3** (y N genérico) donde hoy solo hay L1/L2; idealmente reemplazar los flags booleanos por la noción de "aprobador del paso actual".
5. **Selección de centro en la solicitud** (`solicitud-viaticos/`, `solicitud-viaticos-modal/`):
   - Ofrecer/priorizar los centros asignados y distinguir visualmente "asignado vs no asignado" (afecta la cadena resultante).
6. **Caja chica** (`mis-rendiciones/nueva-caja-chica/`, `rendiciones-caja-chica/`, regla 1.7):
   - Añadir la vista de aprobación (pasos y acciones aprobar/rechazar) que hoy no existe; el reporte solo maneja `draft | finalized`.
7. **Visualización de la cadena de aprobación:**
   - En `viaticos-detail/`, `rendicion-detail/` y el detalle de caja chica, mostrar los pasos (N1/N2/N3/Contabilidad), quién aprueba cada uno, el paso actual y el historial; **indicar los niveles omitidos** por slot vacío (regla 1.6).
   - Reemplazar las comprobaciones `canApproveL1/L2` por "¿es este usuario el aprobador del paso pendiente?".
8. **Dashboards** (`inicio/`, `dashboard/`, `tesoreria/`):
   - Ajustar las bandejas de "pendientes por aprobar" para que se basen en la cadena dinámica y no en `coordinatorId` + flags; incluir también las **cajas chicas** pendientes de aprobación.

### 5.3 Piezas reutilizables ya existentes
- Estructura de estados y `approvalHistory` en `IAdvance`/`IExpenseReport` (se puede extender).
- Endpoints `approve-l1` / `approve-l2` y patrón de rechazo con motivo.
- Cadena de 2 pasos + Contabilidad ya montada (sirve de base para generalizar a N pasos).
- Notificaciones por etapa (aprobación/rechazo) ya existentes.

---

## 6. Resumen ejecutivo

- **Lo que YA existe:** un flujo de aprobación **fijo de 2 niveles** (Coordinador L1 → L2 → Contabilidad) para solicitudes y rendiciones, con el aprobador determinado por el **coordinador único** del colaborador (`coordinatorId`) y **permisos de rol** (`canApproveL1/L2`). Estados, historial, rechazos y notificaciones ya están montados.
- **Lo que FALTA (el núcleo de las reglas nuevas):**
  1. Aprobadores **por nivel en el centro de costo** (N1/N2/N3…), como **ranuras explícitas**: un nivel puede faltar y se **omite sin renumerar** (regla 1.6).
  2. **Centros de costo asignados al colaborador** con uno **principal**.
  3. Un **motor de enrutamiento dinámico** que arme la cadena según asignado/no asignado y centro principal (reglas 1.3 y 1.4), buscando cada nivel por identidad.
  4. La regla de **escalamiento por auto-aprobación** (1.5).
  5. Introducir el **nivel 3** (hoy solo hay L1/L2).
  6. Extender la aprobación por niveles a la **caja chica** (regla 1.7), que hoy no tiene aprobación (`draft → finalized`).
- **Factibilidad:** alta a nivel de producto, pero requiere un rediseño del modelo de datos y del motor de aprobación, con el **grueso del esfuerzo en el backend** y una refactorización transversal en el frontend de todas las comprobaciones de nivel.
