import {
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdvanceService } from '../../../services/advance.service';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { NotificationService } from '../../../services/notification.service';
import { UserStateService } from '../../../services/user-state.service';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { CategoriaService } from '../../../services/categoria.service';
import { CategoryGroupService } from '../../../services/category-group.service';
import { SaldoService } from '../../../services/saldo.service';
import { ISaldo } from '../../../interfaces/saldo.interface';
import {
  PlacesAutocompleteDirective,
  PlaceResult,
} from '../../../directives/places-autocomplete.directive';
import { ProjectSelectComponent } from '../../../design-system/project-select/project-select.component';
import { IProject } from '../../invoices/interfaces/project.interface';
import { ICategory } from '../../invoices/interfaces/category.interface';
import { ICategoryGroup } from '../../categorias/interfaces/category-group.interface';
import {
  ICreateAdvancePayload,
  IAdvanceLinePayload,
  IAdvance,
} from '../../../interfaces/advance.interface';
import { ICreateViaticoPayload } from '../../../interfaces/expense-report.interface';
import {
  coerceViaticoLineNumber,
  computeViaticoLineTotal,
  optionalViaticoLineNumber,
  validateViaticoLineFields,
} from '../viatico-line.util';

@Component({
  selector: 'app-solicitud-viaticos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    PlacesAutocompleteDirective,
    ProjectSelectComponent,
  ],
  templateUrl: './solicitud-viaticos.component.html',
})
export class SolicitudViaticosComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private advanceService = inject(AdvanceService);
  private expenseReportsService = inject(ExpenseReportsService);
  private notifications = inject(NotificationService);
  private userState = inject(UserStateService);
  private invoicesService = inject(InvoicesService);
  private categoriaService = inject(CategoriaService);
  private categoryGroupService = inject(CategoryGroupService);
  private saldoService = inject(SaldoService);

  submitting = signal(false);

  // Saldos de viáticos del mismo centro de costo (bolsa).
  saldos = signal<ISaldo[]>([]);
  loadingSaldos = signal<boolean>(false);
  selectedSaldoIds = signal<Set<string>>(new Set());

  selectedSaldoTotal = computed(() =>
    this.saldos()
      .filter(s => this.selectedSaldoIds().has(s._id))
      .reduce((sum, s) => sum + (Number(s.amount) || 0), 0)
  );

  /** Solo se ofrece la bolsa de saldos en solicitudes nuevas (no reenvío ni saldo heredado por query). */
  get canUseSaldoBag(): boolean {
    return !this.isResubmit && !this.hasPendingBalance;
  }
  loading = signal(false);
  projects = signal<IProject[]>([]);
  categories = signal<ICategory[]>([]);
  /** Perfiles de categoría (category-groups). El centro de costo referencia uno y de él se derivan sus categorías. */
  categoryGroups = signal<ICategoryGroup[]>([]);
  /** ID del centro de costo elegido; espeja el control `projectId` para alimentar los computeds. */
  selectedProjectId = signal<string>('');
  advanceToResubmit = signal<IAdvance | null>(null);

  /**
   * IDs de categoría permitidas por el perfil del centro de costo elegido, o
   * `null` cuando no aplica filtro (sin proyecto, proyecto sin perfil, o perfil
   * sin categorías) — en cuyo caso se muestran todas.
   */
  private allowedCategoryIdSet = computed<Set<string> | null>(() => {
    const pid = this.selectedProjectId();
    if (!pid) return null;
    const project = this.projects().find((p) => String(p._id) === String(pid));
    const groupId = project?.categoryGroupId;
    if (!groupId) return null;
    const group = this.categoryGroups().find((g) => String(g._id) === String(groupId));
    const ids = (group?.categoryIds ?? []).map(String);
    if (!ids.length) return null;
    return new Set(ids);
  });

  /** Categorías del perfil del proyecto (lista base compartida por todas las líneas). */
  private perfilCategories = computed<ICategory[]>(() => {
    const allowed = this.allowedCategoryIdSet();
    if (!allowed) return this.categories();
    return this.categories().filter((c) => allowed.has(String(c._id)));
  });

  private selectedLat: number | undefined;
  private selectedLng: number | undefined;

  /** ID de la rendición de origen cuando se traslada saldo pendiente. */
  pendingBalanceFromReportId = signal<string | null>(null);
  /** Monto del saldo pendiente trasladado desde la rendición de origen. */
  pendingBalanceAmount = signal<number>(0);

  form = this.fb.group({
    place: ['', Validators.required],
    startDate: ['', Validators.required],
    endDate: ['', Validators.required],
    projectId: ['', Validators.required],
    observations: [''],
    lines: this.fb.array([this.createLineGroup()]),
  });

  get isResubmit(): boolean {
    return !!this.route.snapshot.paramMap.get('id');
  }

  get hasPendingBalance(): boolean {
    return !!this.pendingBalanceFromReportId() && this.pendingBalanceAmount() > 0;
  }

  get pageTitle(): string {
    const adv = this.advanceToResubmit();
    if (adv) return `Corregir solicitud · v${adv.solicitudVersion ?? 1}`;
    return this.hasPendingBalance
      ? 'Nueva solicitud de viáticos (con saldo pendiente)'
      : 'Nueva solicitud de viáticos';
  }

  /** Total de las líneas del formulario (monto adicional). */
  totalGeneral(): number {
    let sum = 0;
    for (let i = 0; i < this.lines.length; i++) {
      sum += this.lineTotal(this.lines.at(i) as FormGroup);
    }
    return Math.round(sum * 100) / 100;
  }

  /** Total del anticipo = saldo pendiente + líneas adicionales. */
  totalAnticipo(): number {
    return Math.round((this.pendingBalanceAmount() + this.totalGeneral()) * 100) / 100;
  }

  ngOnInit(): void {
    // Espeja el centro de costo elegido y, al cambiarlo, limpia las categorías
    // de línea que no pertenezcan a su perfil. (En restauración se actualiza el
    // signal sin emitir, por lo que esto no borra las líneas precargadas.)
    this.form.get('projectId')?.valueChanges.subscribe((pid) => {
      this.selectedProjectId.set(pid ?? '');
      this.clearInvalidLineCategories();
      this.loadEligibleSaldos(pid ?? '');
    });

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadAdvanceForResubmit(id);
    } else {
      const qp = this.route.snapshot.queryParamMap;
      const fromReport = qp.get('pendingBalanceFromReportId');
      const amount = parseFloat(qp.get('pendingBalanceAmount') ?? '0');
      if (fromReport && amount > 0) {
        this.pendingBalanceFromReportId.set(fromReport);
        this.pendingBalanceAmount.set(amount);
      }
      this.loadCatalogues();
    }
  }

  /** Carga los saldos de viáticos elegibles (mismo centro de costo) y limpia la selección. */
  private loadEligibleSaldos(projectId: string): void {
    this.selectedSaldoIds.set(new Set());
    if (!this.canUseSaldoBag || !projectId) {
      this.saldos.set([]);
      return;
    }
    this.loadingSaldos.set(true);
    this.saldoService.getEligible('viatico', projectId).subscribe({
      next: rows => {
        this.saldos.set(rows ?? []);
        this.loadingSaldos.set(false);
      },
      error: () => {
        this.saldos.set([]);
        this.loadingSaldos.set(false);
      },
    });
  }

  isSaldoSelected(id: string): boolean {
    return this.selectedSaldoIds().has(id);
  }

  /** Gestión / motivo del saldo, o su origen (rendición / N° operación). */
  saldoDescripcion(s: ISaldo): string {
    if (s.concepto?.trim()) return s.concepto.trim();
    const r = s.sourceReportId;
    if (r && typeof r !== 'string') return r.codigo || r.title || '';
    if (s.type === 'pago' && s.deposit?.operationNumber) return `Op. ${s.deposit.operationNumber}`;
    return '';
  }

  toggleSaldo(id: string): void {
    const next = new Set(this.selectedSaldoIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedSaldoIds.set(next);
  }

  private loadAdvanceForResubmit(id: string): void {
    this.loading.set(true);
    this.advanceService.findOne(id).subscribe({
      next: (adv) => {
        this.advanceToResubmit.set(adv);
        this.bootstrapFromAdvance(adv);
        this.loading.set(false);
      },
      error: () => {
        this.notifications.show('No se pudo cargar la solicitud', 'error');
        this.loading.set(false);
        this.router.navigate(['/mis-rendiciones']);
      },
    });
  }

  private loadCatalogues(): void {
    const clientId = this.resolveCompanyId();
    if (!clientId) return;
    this.invoicesService.getProjects(clientId).subscribe({
      next: (list) => this.projects.set((list || []).filter((p) => p.isActive !== false)),
      error: () => this.projects.set([]),
    });
    this.categoriaService.getAllFlat().subscribe({
      next: (res) => this.categories.set((res || []).filter((c) => c.isActive !== false)),
      error: () => this.categories.set([]),
    });
    this.categoryGroupService.getAll().subscribe({
      next: (groups) => this.categoryGroups.set(groups ?? []),
      error: () => this.categoryGroups.set([]),
    });
  }

  private bootstrapFromAdvance(adv: IAdvance): void {
    while (this.lines.length) this.lines.removeAt(0);

    for (const ln of adv.lines?.length ? adv.lines : []) {
      const g = this.createLineGroup();
      g.patchValue({
        categoryId: this.categoryIdFromLine(ln),
        detalle: ln.detalle ?? '',
        importe: ln.importe,
        peopleCount: ln.peopleCount,
        glpPerDay: ln.glpPerDay,
        days: ln.days,
      });
      this.lines.push(g);
    }
    if (!this.lines.length) this.lines.push(this.createLineGroup());

    const pid =
      typeof adv.projectId === 'object' && adv.projectId
        ? adv.projectId._id
        : String(adv.projectId ?? '');

    this.form.patchValue({
      place: adv.place ?? '',
      startDate: this.ymdFromDate(adv.startDate),
      endDate: this.ymdFromDate(adv.endDate),
      observations: adv.observations ?? '',
    });
    // Sin emitir: evita que el listener de `projectId` borre las categorías
    // de las líneas que acabamos de restaurar.
    this.form.get('projectId')?.setValue(pid, { emitEvent: false });
    this.selectedProjectId.set(pid);

    this.loadCatalogues();
  }

  private ymdFromDate(value: string | undefined): string {
    if (!value) return '';
    return String(value).length >= 10 ? String(value).slice(0, 10) : String(value);
  }

  private categoryIdFromLine(line: { categoryId: unknown }): string {
    const c = line.categoryId;
    if (c && typeof c === 'object' && '_id' in (c as object)) {
      return String((c as { _id: string })._id);
    }
    return String(c ?? '');
  }

  private resolveCompanyId(): string {
    const u = this.userState.getUser() as Record<string, unknown> | null;
    if (!u) return '';
    return (
      (u['companyId'] as string) ||
      ((u['client'] as { _id?: string })?._id ?? '') ||
      ((u['clientId'] as { _id?: string })?._id ?? '') ||
      (typeof u['clientId'] === 'string' ? (u['clientId'] as string) : '') ||
      ''
    );
  }

  createLineGroup(): FormGroup {
    return this.fb.group({
      categoryId: ['', Validators.required],
      detalle: [''],
      importe: [null, [Validators.min(0)]],
      peopleCount: [null],
      glpPerDay: [null],
      days: [null, [Validators.min(0)]],
    });
  }

  get lines(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  lineTotal(ctrl: FormGroup): number {
    const v = ctrl.value;
    return computeViaticoLineTotal(
      Number(v.importe),
      Number(v.glpPerDay),
      Number(v.days),
      Number(v.peopleCount)
    );
  }

  /**
   * Categorías visibles en una línea: las del perfil del proyecto, más la propia
   * categoría ya elegida (para no ocultar selecciones previas al corregir/reenviar).
   */
  categoriesForLine(ctrl: FormGroup): ICategory[] {
    const base = this.perfilCategories();
    const selected = ctrl.get('categoryId')?.value;
    if (!selected || base.some((c) => String(c._id) === String(selected))) {
      return base;
    }
    const own = this.categories().find((c) => String(c._id) === String(selected));
    return own ? [...base, own] : base;
  }

  /** Limpia las categorías de línea que no pertenezcan al perfil del proyecto actual. */
  private clearInvalidLineCategories(): void {
    const allowed = this.allowedCategoryIdSet();
    if (!allowed) return;
    for (let i = 0; i < this.lines.length; i++) {
      const ctrl = this.lines.at(i).get('categoryId');
      const val = ctrl?.value;
      if (val && !allowed.has(String(val))) ctrl?.setValue('');
    }
  }

  addLine(): void {
    this.lines.push(this.createLineGroup());
  }

  removeLine(index: number): void {
    if (this.lines.length <= 1) return;
    this.lines.removeAt(index);
  }

  onPlaceSelected(ev: PlaceResult): void {
    this.form.patchValue({ place: ev.address });
    this.selectedLat = ev.lat;
    this.selectedLng = ev.lng;
  }

  goBack(): void {
    const fromReport = this.pendingBalanceFromReportId();
    if (fromReport) {
      this.router.navigate(['/mis-rendiciones', fromReport, 'detalle']);
    } else {
      this.router.navigate(['/mis-rendiciones']);
    }
  }

  private normalizeLineNumericFields(): void {
    for (let i = 0; i < this.lines.length; i++) {
      const g = this.lines.at(i) as FormGroup;
      const v = g.value;
      g.patchValue(
        {
          importe: optionalViaticoLineNumber(v.importe),
          peopleCount: optionalViaticoLineNumber(v.peopleCount),
          glpPerDay: optionalViaticoLineNumber(v.glpPerDay),
          days: optionalViaticoLineNumber(v.days),
        },
        { emitEvent: false }
      );
    }
    this.form.updateValueAndValidity();
  }

  submit(): void {
    this.normalizeLineNumericFields();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notifications.show('Complete los campos obligatorios', 'error');
      return;
    }

    for (let i = 0; i < this.lines.length; i++) {
      const lineError = validateViaticoLineFields(
        (this.lines.at(i) as FormGroup).value
      );
      if (lineError) {
        this.form.markAllAsTouched();
        this.notifications.show(lineError, 'error');
        return;
      }
    }

    const startStr = this.form.value.startDate as string;
    const endStr = this.form.value.endDate as string;
    const start = this.parseLocalDate(startStr);
    const end = this.parseLocalDate(endStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (end < start) {
      this.notifications.show('La fecha fin debe ser mayor o igual a la fecha inicio', 'error');
      return;
    }

    if (start < today) {
      const obs = (this.form.value.observations || '').trim();
      if (obs.length < 10) {
        this.notifications.show(
          'Para fechas de inicio pasadas, las observaciones deben tener al menos 10 caracteres.',
          'error'
        );
        return;
      }
    }

    const place = (this.form.value.place || '').trim();
    const linesPayload: IAdvanceLinePayload[] = [];

    for (let i = 0; i < this.lines.length; i++) {
      const g = this.lines.at(i) as FormGroup;
      const v = g.value;
      linesPayload.push({
        categoryId: v.categoryId,
        detalle: (v.detalle || '').trim() || undefined,
        importe: Number(v.importe),
        peopleCount: Number(v.peopleCount),
        glpPerDay: Number(v.glpPerDay),
        days: Number(v.days),
        lineTotal: this.lineTotal(g),
      });
    }

    const linesTotal = this.totalGeneral();
    const fromReportId = this.pendingBalanceFromReportId();
    const pendingAmt = this.pendingBalanceAmount();
    const hasPending = !!(fromReportId && pendingAmt > 0);

    this.submitting.set(true);
    const adv = this.advanceToResubmit();

    if (adv) {
      // Resubmit of a legacy Advance (old system)
      const legacyPayload: ICreateAdvancePayload = {
        amount: hasPending ? this.totalAnticipo() : linesTotal,
        description: `Viático: ${place} (${startStr} → ${endStr})`,
        place,
        ...(this.selectedLat != null && { lat: this.selectedLat }),
        ...(this.selectedLng != null && { lng: this.selectedLng }),
        startDate: `${startStr}T12:00:00.000Z`,
        endDate: `${endStr}T12:00:00.000Z`,
        projectId: this.form.value.projectId as string,
        lines: linesPayload,
        observations: (this.form.value.observations || '').trim() || undefined,
        ...(hasPending && {
          pendingBalanceFromReportId: fromReportId!,
          pendingBalanceAmount: pendingAmt,
          additionalAmount: linesTotal,
        }),
      };
      this.advanceService.resubmit(adv._id, legacyPayload).subscribe({
        next: () => this.onSubmitSuccess(true),
        error: (e) => this.onSubmitError(e),
      });
      return;
    }

    // Saldos de la bolsa: prefinancian el viático. El total de las líneas debe ser
    // MAYOR al saldo (el saldo cubre su parte y contabilidad deposita la diferencia).
    const saldoIds = Array.from(this.selectedSaldoIds());
    if (this.canUseSaldoBag && saldoIds.length > 0) {
      const saldoTotal = this.selectedSaldoTotal();
      if (linesTotal - saldoTotal <= 0.01) {
        this.submitting.set(false);
        this.notifications.show(
          `El total de las líneas (S/ ${linesTotal.toFixed(2)}) debe ser mayor al saldo seleccionado (S/ ${saldoTotal.toFixed(2)}). El saldo cubre su parte y contabilidad deposita la diferencia.`,
          'error'
        );
        return;
      }
    }

    // New unified viatico (ExpenseReport type='viatico')
    const viaticoPayload: ICreateViaticoPayload = {
      amount: hasPending ? this.totalAnticipo() : linesTotal,
      place,
      ...(this.selectedLat != null && { lat: this.selectedLat }),
      ...(this.selectedLng != null && { lng: this.selectedLng }),
      startDate: `${startStr}T12:00:00.000Z`,
      endDate: `${endStr}T12:00:00.000Z`,
      projectId: this.form.value.projectId as string,
      lines: linesPayload,
      observations: (this.form.value.observations || '').trim() || undefined,
      ...(hasPending && {
        pendingBalanceFromReportId: fromReportId!,
        pendingBalanceAmount: pendingAmt,
        additionalAmount: linesTotal,
      }),
      ...(this.canUseSaldoBag && saldoIds.length > 0 && { saldoIds }),
    };
    this.expenseReportsService.createViatico(viaticoPayload).subscribe({
      next: () => this.onSubmitSuccess(false),
      error: (e) => this.onSubmitError(e),
    });

  }

  private onSubmitSuccess(isResubmit: boolean): void {
    const msg = isResubmit
      ? 'Solicitud corregida y reenviada correctamente'
      : 'Solicitud de viáticos enviada correctamente';
    this.notifications.show(msg, 'success');
    this.submitting.set(false);
    this.saldoService.refreshTotal();
    const fromReport = this.pendingBalanceFromReportId();
    if (fromReport) {
      this.router.navigate(['/mis-rendiciones', fromReport, 'detalle']);
    } else {
      this.router.navigate(['/mis-rendiciones'], { queryParams: { tab: 'viaticos' } });
    }
  }

  private onSubmitError(e: any): void {
    const raw = e?.error?.message;
    const msg = Array.isArray(raw) ? raw.join(', ') : raw || 'Error al enviar la solicitud';
    this.notifications.show(msg, 'error');
    this.submitting.set(false);
  }

  private parseLocalDate(ymd: string): Date {
    const [y, m, d] = ymd.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setHours(0, 0, 0, 0);
    return dt;
  }

  projectLabel(p: IProject): string {
    return p.code ? `${p.code} — ${p.name}` : p.name;
  }
}
