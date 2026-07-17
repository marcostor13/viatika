import { Component, inject, signal, computed, OnInit, EnvironmentInjector, runInInjectionContext } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { NotificationService } from '../../../services/notification.service';
import { InvoicesService } from '../services/invoices.service';
import { ExpenseReportsService } from '../../../services/expense-reports.service';
import { AdvanceService } from '../../../services/advance.service';
import { UserStateService } from '../../../services/user-state.service';
import { ExpenseService } from '../../../services/expense.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UploadService } from '../../../services/upload.service';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { IProject } from '../interfaces/project.interface';
import { ICategory } from '../interfaces/category.interface';
import { ICategoryGroup } from '../../categorias/interfaces/category-group.interface';
import {
  InvoiceStatus,
  SunatValidationInfo,
  ExpenseType,
  ICreateDeclaracionJuradaPayload,
  IDeclaracionJuradaResponse,
} from '../interfaces/invoices.interface';
import type { RendicionExportService } from '../../../services/rendicion-export.service';
import { ButtonComponent } from '../../../design-system/button/button.component';
import { ProjectSelectComponent } from '../../../design-system/project-select/project-select.component';
import { WorkerSelectComponent, WorkerOption } from '../../../design-system/worker-select/worker-select.component';
import { PlacesAutocompleteDirective, PlaceResult } from '../../../directives/places-autocomplete.directive';
import { CompanyConfigService } from '../../../services/company-config.service';
import { CategoryGroupService } from '../../../services/category-group.service';
import { PERU_LOCATIONS, Departamento } from '../../../constants/peru-locations';
import { AccountingConfigService } from '../../../services/accounting-config.service';
import { ICurrencyConfig } from '../../../interfaces/accounting-config.interface';

function findDepartamento(label: string): Departamento | undefined {
  return PERU_LOCATIONS.find(d => d.label === label);
}

declare const google: any;

@Component({
  selector: 'app-add-invoice',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, ButtonComponent, ProjectSelectComponent, WorkerSelectComponent, PlacesAutocompleteDirective],
  templateUrl: './add-invoice.component.html',
  styleUrl: './add-invoice.component.scss',
})
export default class AddInvoiceComponent implements OnInit {
  private invoiceService = inject(InvoicesService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private expenseReportsService = inject(ExpenseReportsService);
  private advanceService = inject(AdvanceService);
  private userStateService = inject(UserStateService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private uploadService = inject(UploadService);
  private companyConfigService = inject(CompanyConfigService);
  private expenseService = inject(ExpenseService);
  private categoryGroupService = inject(CategoryGroupService);
  private envInjector = inject(EnvironmentInjector);
  private accountingConfigService = inject(AccountingConfigService);

  /** Monedas soportadas por la empresa (Configuración → Plan de Cuentas y Bancos). Solo aplica a facturas. */
  currencyOptions = signal<ICurrencyConfig[]>([{ code: 'PEN', symbol: 'S/', contanetCode: '01', decimals: 2, approvalThresholdL1: 500 }]);

  form!: FormGroup;
  id: string = this.route.snapshot.params['id'];
  categories: ICategory[] = [];
  /** Perfiles de categoría (category-groups). Cada proyecto referencia uno y de él se derivan sus categorías. */
  categoryGroups: ICategoryGroup[] = [];
  proyects: IProject[] = [];
  /** Trabajadores del cliente, para el selector de colaborador por fila de la planilla. */
  workers: WorkerOption[] = [];
  previewImage: SafeUrl | null = null;
  selectedFile!: File;
  originalInvoice: any = null;
  sunatValidation: SunatValidationInfo | null = null;
  isSunatValidating = signal(false);
  rendicionId: string | null = null;
  isDirectaMode = false;
  /** True cuando la rendición asociada es directa (report.isDirecta), aunque no venga `mode=directa` en la URL. */
  isDirectaReport = signal<boolean>(false);
  fromContabilidad = false;

  expenseType = signal<ExpenseType>('factura');
  /** Sub-tipo para otros_gastos: TK | BV | RC | DJ | OT */
  otrosSubTipo = signal<string>('DJ');
  /** Sub-tipos que llevan documento físico con RUC/serie/correlativo. */
  otrosSubTipoMuestraDocumento = computed(() =>
    ['TK', 'BV', 'RC'].includes(this.otrosSubTipo())
  );
  rendicionBudget = signal<number>(0);
  rendicionSpent = signal<number>(0);
  rendicionSettlementDiff = signal<number | null>(null);
  rendicionAvailable = computed(() => {
    const diff = this.rendicionSettlementDiff();
    if (diff !== null) return diff;
    return this.rendicionBudget() - this.rendicionSpent();
  });
  percentage = signal(0);
  rucLookupLoading = signal(false);
  fetchedRazonSocial = signal<string | null>(null);
  rucNotFound = signal(false);
  mobilityDailyLimit: number | null = null;
  readonly departamentos = PERU_LOCATIONS;
  isLoading = signal(false);
  readonly todayIso = new Date().toISOString().split('T')[0];
  showPostOcrReview = signal(false);
  postOcrInvoiceId = signal<string | null>(null);
  private postOcrBaseInvoice: any = null;
  ocrTotalAmount = signal<number>(0);
  isEditingOcrAmount = signal(false);
  editedOcrTotal = signal<number | null>(null);

  // --- Escaneo OCR del comprobante de caja (autorellena el formulario) ---
  isScanningVoucher = signal(false);
  cashVoucherFileUrl: string | null = null;
  cashVoucherFileName: string | null = null;
  private cashVoucherMimeType: string | undefined;

  get ocrAmountWasEdited(): boolean {
    const edited = this.editedOcrTotal();
    return edited !== null && edited !== this.ocrTotalAmount();
  }

  startEditOcrAmount() {
    if (!this.isEditingOcrAmount()) {
      this.editedOcrTotal.set(this.ocrTotalAmount());
    }
    this.isEditingOcrAmount.set(true);
  }

  confirmEditOcrAmount() {
    this.isEditingOcrAmount.set(false);
  }

  // --- Edición de monto en modo edición de factura existente ---
  editingInvoiceAmount = signal(false);
  editedInvoiceTotal = signal<number | null>(null);

  get invoiceAmountWasEdited(): boolean {
    const edited = this.editedInvoiceTotal();
    if (edited === null) return false;
    return edited !== parseFloat(String(this.originalInvoice?.total ?? 0));
  }

  startEditInvoiceAmount() {
    if (!this.editingInvoiceAmount()) {
      this.editedInvoiceTotal.set(parseFloat(String(this.originalInvoice?.total ?? 0)));
    }
    this.editingInvoiceAmount.set(true);
  }

  confirmEditInvoiceAmount() {
    this.editingInvoiceAmount.set(false);
  }

  private notifyCategoryLimitWarning(response: { categoryLimitWarning?: string; categoryLimitPercent?: number } | null | undefined): void {
    if (!response?.categoryLimitWarning) return;
    const pct = typeof response.categoryLimitPercent === 'number'
      ? ` (${response.categoryLimitPercent.toFixed(2)}%)`
      : '';
    this.notificationService.show(`${response.categoryLimitWarning}${pct}`, 'warning');
  }

  /** Tras crear/actualizar gasto: vuelve según el contexto y rol. */
  private navigateAfterExpenseSave(): void {
    if (this.fromContabilidad) {
      this.router.navigate(['/rendiciones'], { queryParams: { tab: 'directas' } });
      return;
    }
    if (this.isDirectaMode) {
      // Auto-enviar a contabilidad después de guardar en modo directa
      this.expenseService.submitMyDirectExpenses().subscribe({
        next: () => { this.router.navigate(['/mis-rendiciones'], { queryParams: { tab: 'directas' } }); },
        error: () => { this.router.navigate(['/mis-rendiciones'], { queryParams: { tab: 'directas' } }); },
      });
    } else if (this.rendicionId) {
      this.router.navigate(['/mis-rendiciones', this.rendicionId, 'detalle']);
    } else {
      this.router.navigate(['/invoices']);
    }
  }

  private guardRendiciones() {
    if (this.id) return; // edición: siempre permitida
    if (!this.userStateService.isColaborador()) return;
    if (this.rendicionId) return;
    // Modo directa: colaborador con permiso puede subir sin rendición
    if (this.isDirectaMode && this.userStateService.canCreateRendicion()) return;

    const user = this.userStateService.getUser();
    const userId = user?._id;
    const clientId = user?.companyId;
    if (!userId || !clientId) return;

    this.expenseReportsService.findAllByUser(userId, clientId).subscribe({
      next: (reports) => {
        if (reports.length === 0) {
          this.notificationService.show(
            'Necesitas tener una rendición asignada para subir facturas.',
            'error'
          );
          this.router.navigate(['/invoices']);
        }
      },
    });
  }

  constructor() {
    this.initForm();
  }

  private looksLikeJson(value: string): boolean {
    const trimmed = (value || '').trim();
    return trimmed.startsWith('{') || trimmed.startsWith('[');
  }

  private isPdfFile(file: File | null | undefined): boolean {
    if (!file) return false;
    const mimeType = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    return mimeType.includes('pdf') || name.endsWith('.pdf');
  }

  private formatDateForInput(dateValue: any): string {
    if (!dateValue) return '';

    let date: Date;

    if (typeof dateValue === 'string') {
      const dateStr = dateValue.trim();

      if (dateStr.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        const parts = dateStr.split(/[-\/]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      } else if (dateStr.match(/^\d{4}[-\/]\d{2}[-\/]\d{2}$/)) {
        date = new Date(dateStr);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida:', dateValue);
      return '';
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatDateForBackend(dateValue: string): string {
    if (!dateValue) return '';

    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateValue.split('-');
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day}/${month}/${year}`;
    }

    if (dateValue.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
      return dateValue.replace(/-/g, '/');
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida para backend:', dateValue);
      return dateValue;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${day}/${month}/${year}`;
  }

  ngOnInit() {
    this.companyConfigService.companyConfig$.subscribe(config => {
      this.mobilityDailyLimit = config?.limits?.movilidadDiario ?? null;
    });
    this.rendicionId = this.route.snapshot.queryParamMap.get('rendicionId');
    this.isDirectaMode = this.route.snapshot.queryParamMap.get('mode') === 'directa';
    this.fromContabilidad = this.route.snapshot.queryParamMap.get('from') === 'contabilidad' || this.userStateService.isContabilidad();
    this.guardRendiciones();
    this.loadCategories();
    this.loadCategoryGroups();
    this.loadProjects();
    this.loadClientUsers();
    this.loadCurrencyOptions();
    // Al cambiar de proyecto, si la categoría elegida no pertenece a su perfil, se limpia.
    this.form.get('proyectId')?.valueChanges.subscribe(() => {
      const allowed = this.allowedCategoryIds();
      const selected = this.form.get('categoryId')?.value;
      if (allowed && selected && !allowed.has(String(selected))) {
        this.form.get('categoryId')?.setValue('');
      }
      // Reevalúa la categoría DJ autoseleccionada según el perfil del nuevo proyecto.
      this.autoSelectDjCategories();
    });
    this.route.queryParamMap.subscribe(params => {
      this.rendicionId = params.get('rendicionId');
      this.isDirectaMode = params.get('mode') === 'directa';
      this.fromContabilidad = params.get('from') === 'contabilidad' || this.userStateService.isContabilidad();
      const tipo = params.get('tipo') as ExpenseType | null;
      if (tipo) {
        this.setExpenseType(tipo);
      } else {
        this.syncTopValidators();
      }
      if (this.rendicionId) {
        this.loadRendicionProject();
      }
    });

    if (this.id) {
      this.form.get('file')?.clearValidators();
      this.form.get('file')?.updateValueAndValidity();

      this.invoiceService.getInvoiceById(this.id).subscribe({
        next: (res) => {
          this.originalInvoice = res;
          const type = ((res as any).expenseType as ExpenseType) || 'factura';
          this.expenseType.set(type);
          this.form.get('file')?.clearValidators();
          this.form.get('file')?.updateValueAndValidity();
          this.form.get('proyectId')?.disable();

          let dataObj: any = {};
          if (res.data) {
            try {
              dataObj =
                typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            } catch {}
          }

          let fecha = '';
          if (dataObj.fechaEmision) {
            fecha = this.formatDateForInput(dataObj.fechaEmision);
          } else if (res.date) {
            fecha = this.formatDateForInput(res.date);
          } else if ((res as any).fechaEmision) {
            fecha = this.formatDateForInput((res as any).fechaEmision);
          }

          const baseValues: any = {
            proyectId: res.proyectId?._id || res.proyectId || '',
            categoryId: res.categoryId?._id || res.categoryId || '',
            comentario: (res as any).comentario || dataObj.comentario || '',
          };

          if (type === 'factura') {
            this.fetchedRazonSocial.set(dataObj.razonSocial || null);
            this.editingInvoiceAmount.set(false);
            this.editedInvoiceTotal.set(null);
            this.form.patchValue({
              ...baseValues,
              fechaEmision: fecha,
              rucEmisor: dataObj.rucEmisor || '',
              serie: dataObj.serie || '',
              correlativo: dataObj.correlativo || '',
              moneda: (res as any).moneda || dataObj.moneda || 'PEN',
              placaVehiculo: (res as any).placaVehiculo || dataObj.placaVehiculo || '',
            });
          } else if (type === 'otros_gastos') {
            let description = '';
            if (typeof res.data === 'string' && !this.looksLikeJson(res.data)) {
              description = res.data;
            } else if (dataObj?.payload !== undefined) {
              if (typeof dataObj.payload === 'string') {
                try {
                  const parsed = JSON.parse(dataObj.payload);
                  description = parsed?.description || parsed?.descripcion || dataObj.payload;
                } catch {
                  description = dataObj.payload;
                }
              } else if (dataObj.payload && typeof dataObj.payload === 'object') {
                description = dataObj.payload.description || dataObj.payload.descripcion || '';
              }
            } else {
              description = dataObj.description || dataObj.descripcion || '';
            }
            if (!description && typeof (res as any).description === 'string') {
              description = (res as any).description;
            }
            const persistedSubTipo = (res as any).subTipo || dataObj.subTipo;
            if (persistedSubTipo) {
              this.otrosSubTipo.set(persistedSubTipo);
            }
            if (dataObj.rucEmisor) {
              this.fetchedRazonSocial.set(dataObj.razonSocialEmisor || null);
            }
            this.form.patchValue({
              ...baseValues,
              description,
              totalOtros: res.total ?? 0,
              declaracionJurada: true,
              rucEmisor: dataObj.rucEmisor || '',
              serie: dataObj.serie || '',
              correlativo: dataObj.correlativo || '',
            });
          } else if (type === 'recibo_caja') {
            this.form.patchValue({
              ...baseValues,
              receiptRazonSocial: dataObj.razonSocial || '',
              receiptRuc: dataObj.ruc || '',
              receiptNumeroDocumento: dataObj.numeroDocumento || '',
              receiptConcepto: dataObj.concepto || '',
              receiptFecha: fecha,
              receiptMonto: res.total ?? 0,
            });
          } else if (type === 'comprobante_caja') {
            let voucherPayload: any = dataObj;
            if (dataObj?.payload) {
              try {
                voucherPayload =
                  typeof dataObj.payload === 'string'
                    ? JSON.parse(dataObj.payload)
                    : dataObj.payload;
              } catch {
                voucherPayload = {};
              }
            }
            this.form.patchValue({
              ...baseValues,
              voucherEntregadoA: voucherPayload.entregadoA || '',
              voucherDireccion: voucherPayload.direccion || '',
              voucherConcepto: voucherPayload.concepto || '',
              voucherFecha: fecha,
              voucherMonto: res.total ?? voucherPayload.monto ?? 0,
            });
          } else if (type === 'planilla_movilidad') {
            this.form.patchValue(baseValues);
            const rows: any[] = (res as any).mobilityRows || dataObj.rows || [];
            this.mobilityRowsArray.clear();
            for (const row of rows) {
              const rowRequired = this.isDirectaContext() ? [Validators.required] : [];
              const group = this.fb.group({
                fecha: [row.fecha || '', Validators.required],
                total: [row.total ?? null, [Validators.required, Validators.min(0)]],
                proyectId: [row.proyectId || '', rowRequired],
                categoryId: [row.categoryId || '', rowRequired],
                colaboradorEsTercero: [!!(row.colaboradorId && String(row.colaboradorId) !== this.currentUserId)],
                colaboradorId: [row.colaboradorId && String(row.colaboradorId) !== this.currentUserId ? String(row.colaboradorId) : ''],
                clienteProveedor: [row.clienteProveedor || '', Validators.required],
                origen: [row.origen || '', Validators.required],
                origenLat: [row.origenCoords?.lat ?? null],
                origenLng: [row.origenCoords?.lng ?? null],
                origenDepartamento: [row.origenDepartamento || ''],
                origenProvincia: [row.origenProvincia || ''],
                origenDistrito: [row.origenDistrito || ''],
                destino: [row.destino || '', Validators.required],
                destinoLat: [row.destinoCoords?.lat ?? null],
                destinoLng: [row.destinoCoords?.lng ?? null],
                destinoDepartamento: [row.destinoDepartamento || ''],
                destinoProvincia: [row.destinoProvincia || ''],
                destinoDistrito: [row.destinoDistrito || ''],
                distanciaKm: [row.distanciaKm ?? null],
                gestion: [row.gestion || '', Validators.required],
              });
              this.mobilityRowsArray.push(group);
              this.wireRowCategoryReset(group);
            }
          }
        },
        error: (error) => {
          console.error('Error al cargar la factura:', error);
          this.notificationService.show(
            'Error al cargar la factura: ' +
              (error.message || 'Intente nuevamente'),
            'error'
          );
        },
      });
    } else {
      this.form.get('file')?.setValidators([Validators.required]);
      this.form.get('file')?.updateValueAndValidity();
    }
  }

  loadRendicionProject() {
    if (!this.rendicionId) return;
    this.expenseReportsService.findOne(this.rendicionId).subscribe({
      next: (report) => {
        const isDirecta = !!(report as any)?.isDirecta;
        this.isDirectaReport.set(isDirecta);
        if (report && report.projectId) {
          const pId = typeof report.projectId === 'string' ? report.projectId : (report.projectId as any)._id;
          this.form.patchValue({ proyectId: pId });
          // En rendición directa el colaborador puede cambiar el proyecto por gasto
          if (!isDirecta) {
            this.form.get('proyectId')?.disable();
          }
        }
        // El flag directa puede llegar después de que el usuario ya agregó filas:
        // re-sincroniza validadores del proyecto (superior y por fila).
        this.syncMobilityRowValidators();
        const expenses = Array.isArray(report?.expenseIds) ? report.expenseIds : [];
        const spent = expenses.reduce(
          (sum: number, exp: any) => sum + (parseFloat(exp?.total) || 0),
          0,
        );
        this.rendicionSpent.set(spent);
        const settlement = (report as any)?.settlement;
        if (settlement && settlement.difference !== undefined && settlement.difference !== null) {
          this.rendicionSettlementDiff.set(Number(settlement.difference) || 0);
        } else {
          this.rendicionSettlementDiff.set(null);
        }
        this.loadRendicionAdvances();
      },
      error: (err) => console.error('Error loading report project', err)
    });
  }

  private loadRendicionAdvances() {
    if (!this.rendicionId) return;
    this.advanceService.findMy().subscribe({
      next: (advances) => {
        const totalAnticipado = advances
          .filter((a) => {
            const rid = typeof a.expenseReportId === 'object'
              ? (a.expenseReportId as any)?._id
              : a.expenseReportId;
            return rid === this.rendicionId
              && ['approved', 'partially_paid', 'paid', 'settled'].includes(a.status);
          })
          // Presupuesto = lo realmente pagado (paidAmount); 'approved' sin pago aporta 0.
          .reduce((sum, a) => sum + (a.status === 'approved' ? 0 : Number(a.paidAmount ?? a.amount) || 0), 0);
        this.rendicionBudget.set(totalAnticipado);
      },
      error: (err) => console.error('Error loading advances', err),
    });
  }

  loadCategories() {
    this.invoiceService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        this.autoSelectDjCategories();
      },
      error: (error) => {},
    });
  }

  loadCategoryGroups() {
    this.categoryGroupService.getAll().subscribe({
      next: (groups) => {
        this.categoryGroups = groups ?? [];
        this.autoSelectDjCategories();
      },
      error: () => {},
    });
  }

  loadProjects() {
    this.invoiceService.getProjects().subscribe({
      next: (projects) => {
        this.proyects = projects;
        this.autoSelectDjCategories();
      },
    });
  }

  loadClientUsers() {
    this.invoiceService.getClientUsers().subscribe({
      next: (users) => {
        this.workers = (users ?? []).map((u) => ({
          _id: String(u._id),
          name: u.name,
          email: u.email,
          dni: u.dni,
        }));
      },
      error: () => {},
    });
  }

  /** Resuelve el clientId activo con el mismo fallback que el resto de la app (companyId no siempre viene poblado). */
  private resolveCompanyId(): string {
    const u = this.userStateService.getUser() as Record<string, unknown> | null;
    if (!u) return '';
    return (
      (u['companyId'] as string) ||
      ((u['client'] as { _id?: string })?._id ?? '') ||
      ((u['clientId'] as { _id?: string })?._id ?? '') ||
      (typeof u['clientId'] === 'string' ? (u['clientId'] as string) : '') ||
      ''
    );
  }

  /** Monedas configuradas por la empresa; si no hay config guardada, se queda con el default PEN. */
  loadCurrencyOptions() {
    const clientId = this.resolveCompanyId();
    if (!clientId) return;
    this.accountingConfigService.getCurrencies(clientId).subscribe({
      next: (config) => {
        if (config?.supportedCurrencies?.length) {
          this.currencyOptions.set(config.supportedCurrencies);
        }
      },
      error: () => {},
    });
  }

  /** Usuario actual (quien rinde): id por defecto de cada fila. */
  get currentUserId(): string {
    return String(this.userStateService.getUser()?._id || '');
  }

  /** Nombre del usuario actual (quien rinde): se muestra por defecto en cada fila. */
  get currentUserName(): string {
    const u = this.userStateService.getUser();
    return (u?.name || u?.email || '').trim();
  }

  /** Resuelve id + nombre del colaborador de una fila a partir de sus valores de formulario. */
  private resolveRowColaborador(r: any): { colaboradorId: string; colaboradorNombre: string } {
    if (r?.colaboradorEsTercero && r?.colaboradorId) {
      const w = this.workers.find((x) => x._id === String(r.colaboradorId));
      return {
        colaboradorId: String(r.colaboradorId),
        colaboradorNombre: w?.name?.trim() || w?.email || '',
      };
    }
    return { colaboradorId: this.currentUserId, colaboradorNombre: this.currentUserName };
  }

  /** True si alguna fila está marcada como tercero pero sin trabajador seleccionado. */
  private hasMobilityTerceroSinColaborador(): boolean {
    return this.mobilityRowsArray.controls.some(
      (c) => !!c.get('colaboradorEsTercero')?.value && !c.get('colaboradorId')?.value
    );
  }

  /** Error inline del colaborador en una fila (tercero marcado, sin selección, tocado). */
  isRowColaboradorInvalid(index: number): boolean {
    const row = this.mobilityRowsArray.at(index);
    if (!row) return false;
    const esTercero = !!row.get('colaboradorEsTercero')?.value;
    const ctrl = row.get('colaboradorId');
    return esTercero && !ctrl?.value && !!ctrl?.touched;
  }

  /** Al alternar el check de tercero: limpia la selección si se desmarca. */
  onColaboradorTerceroToggle(index: number): void {
    const row = this.mobilityRowsArray.at(index);
    if (!row) return;
    const esTercero = !!row.get('colaboradorEsTercero')?.value;
    const projCtrl = row.get('colaboradorId');
    if (!esTercero) {
      projCtrl?.setValue('');
    }
    projCtrl?.updateValueAndValidity({ emitEvent: false });
  }

  /**
   * IDs de categoría permitidas por el perfil (category-group) del proyecto `projId`,
   * o `null` cuando no aplica filtro (sin proyecto, proyecto sin perfil, o perfil sin
   * categorías) — en cuyo caso se muestran todas.
   */
  private allowedCategoryIdsFor(projId: string | null | undefined): Set<string> | null {
    if (!projId) return null;
    const project = this.proyects.find((p) => String(p._id) === String(projId));
    const groupId = project?.categoryGroupId;
    if (!groupId) return null;
    const group = this.categoryGroups.find((g) => String(g._id) === String(groupId));
    const ids = (group?.categoryIds ?? []).map(String);
    if (!ids.length) return null;
    return new Set(ids);
  }

  /** IDs de categoría permitidas por el perfil del proyecto del gasto (selector superior). */
  private allowedCategoryIds(): Set<string> | null {
    return this.allowedCategoryIdsFor(this.form.get('proyectId')?.value);
  }

  /**
   * Filtra `categories` por un set permitido, manteniendo visible la categoría ya
   * seleccionada aunque no pertenezca al perfil (p. ej. al editar un gasto creado
   * antes de asignar el perfil). Con `allowed === null` no aplica filtro.
   */
  private filterCategoriesByAllowed(allowed: Set<string> | null, selected: any): ICategory[] {
    if (!allowed) return this.categories;
    return this.categories.filter(
      (c) => allowed.has(String(c._id)) || String(c._id) === String(selected)
    );
  }

  /** Categorías visibles en el selector superior: filtradas por el perfil del proyecto del gasto. */
  get filteredCategories(): ICategory[] {
    return this.filterCategoriesByAllowed(this.allowedCategoryIds(), this.form.get('categoryId')?.value);
  }

  /**
   * Categorías visibles para una fila de la planilla (Rendiciones Directas): filtradas
   * por el perfil del proyecto elegido en esa misma fila, de modo que la categoría
   * siempre corresponda al proyecto seleccionado en la fila.
   */
  getRowCategories(index: number): ICategory[] {
    const row = this.mobilityRowsArray.at(index);
    const allowed = this.allowedCategoryIdsFor(row?.get('proyectId')?.value);
    return this.filterCategoriesByAllowed(allowed, row?.get('categoryId')?.value);
  }

  lookupRazonSocial(ruc: string) {
    if (!ruc || ruc.replace(/\D/g, '').length !== 11) return;
    this.rucLookupLoading.set(true);
    this.fetchedRazonSocial.set(null);
    this.rucNotFound.set(false);
    this.invoiceService.getRucInfo(ruc).subscribe({
      next: (res) => {
        this.fetchedRazonSocial.set(res.razonSocial);
        this.rucNotFound.set(!res.razonSocial);
        this.rucLookupLoading.set(false);
      },
      error: () => {
        this.rucNotFound.set(true);
        this.rucLookupLoading.set(false);
      },
    });
  }

  initForm() {
    this.form = this.fb.group({
      proyectId: ['', Validators.required],
      categoryId: ['', Validators.required],
      file: [''],
      fechaEmision: [''],
      rucEmisor: [''],
      serie: [''],
      correlativo: [''],
      moneda: ['PEN'],
      comentario: [''],
      placaVehiculo: [''],
      // Otros gastos
      totalOtros: [null],
      description: [''],
      declaracionJurada: [false],
      declaracionJuradaFirmante: [''],
      // Declaración Jurada — viaje al exterior + filas manuales
      djDestino: [''],
      djPais: [''],
      djLugarFirma: [''],
      djMoneda: ['US$'],
      djAlimentacionCategoryId: [''],
      djMovilidadCategoryId: [''],
      djAlimentacionRows: this.fb.array([]),
      djMovilidadRows: this.fb.array([]),
      // Recibo de caja
      receiptRazonSocial: [''],
      receiptRuc: [''],
      receiptNumeroDocumento: [''],
      receiptConcepto: [''],
      receiptFecha: [''],
      receiptMonto: [null],
      // Comprobante de caja
      voucherEntregadoA: [''],
      voucherDireccion: [''],
      voucherConcepto: [''],
      voucherFecha: [''],
      voucherMonto: [null],
      // Planilla de movilidad
      mobilityRows: this.fb.array([]),
    });
  }

  get mobilityRowsArray(): FormArray {
    return this.form.get('mobilityRows') as FormArray;
  }

  // --- Declaración Jurada: filas manuales de Alimentación / Movilidad ---
  savedDeclaracionJurada = signal<IDeclaracionJuradaResponse | null>(null);

  /**
   * Categorías DJ autoseleccionadas según el perfil del proyecto. Cuando hay una
   * categoría marcada (`djType`) el selector manual se oculta y se muestra en modo
   * lectura; cuando no la hay, se deja el selector como respaldo.
   */
  djAlimentacionAuto = signal<ICategory | null>(null);
  djMovilidadAuto = signal<ICategory | null>(null);

  /**
   * DJ (viaje al exterior): autoselecciona las categorías de Alimentación y Movilidad
   * a partir de las categorías del perfil del proyecto marcadas con `djType`.
   * El match se hace con el proyecto (proyecto → perfil → categorías). Idempotente:
   * se puede invocar tras cada carga de datos o cambio de proyecto/sub-tipo.
   */
  private autoSelectDjCategories(): void {
    if (this.expenseType() !== 'otros_gastos' || this.otrosSubTipo() !== 'DJ') return;
    const allowed = this.allowedCategoryIds();
    // Match ESTRICTO por perfil del centro de costo (proyecto): se busca solo entre las
    // categorías del perfil, nunca en todo el cliente. Cada perfil (COM/PROY/ADM) tiene
    // su propia categoría DJ; sin perfil no se autoselecciona.
    const scoped = allowed
      ? this.categories.filter((c) => allowed.has(String(c._id)))
      : [];
    // Autoselecciona solo si el perfil tiene EXACTAMENTE una categoría del rubro; con 0
    // (no configurada) o 2+ (ambigua) se deja el selector manual del perfil.
    const uniquePick = (rubro: 'alimentacion' | 'movilidad'): ICategory | null => {
      const matches = scoped.filter((c) => c.djType === rubro);
      return matches.length === 1 ? matches[0] : null;
    };
    const alimentacion = uniquePick('alimentacion');
    const movilidad = uniquePick('movilidad');

    this.djAlimentacionAuto.set(alimentacion);
    this.djMovilidadAuto.set(movilidad);

    // Fija la categoría marcada del proyecto; si el perfil no tiene una, limpia el
    // control para que el selector de respaldo arranque en blanco (sin arrastrar el
    // valor de un proyecto anterior).
    const aliValue = alimentacion?._id ?? '';
    const aliCtrl = this.form.get('djAlimentacionCategoryId');
    if (aliCtrl && aliCtrl.value !== aliValue) aliCtrl.setValue(aliValue);

    const movValue = movilidad?._id ?? '';
    const movCtrl = this.form.get('djMovilidadCategoryId');
    if (movCtrl && movCtrl.value !== movValue) movCtrl.setValue(movValue);
  }

  /** Cambia el sub-tipo de "Otros gastos" y reevalúa la autoselección DJ. */
  selectOtrosSubTipo(code: string): void {
    this.otrosSubTipo.set(code);
    this.autoSelectDjCategories();
  }

  get djAlimentacionRowsArray(): FormArray {
    return this.form.get('djAlimentacionRows') as FormArray;
  }

  get djMovilidadRowsArray(): FormArray {
    return this.form.get('djMovilidadRows') as FormArray;
  }

  private djRowsArray(rubro: 'alimentacion' | 'movilidad'): FormArray {
    return rubro === 'alimentacion' ? this.djAlimentacionRowsArray : this.djMovilidadRowsArray;
  }

  addDjRow(rubro: 'alimentacion' | 'movilidad'): void {
    this.djRowsArray(rubro).push(this.fb.group({
      fecha: ['', Validators.required],
      monto: [null, [Validators.required, Validators.min(0.01)]],
    }));
  }

  removeDjRow(rubro: 'alimentacion' | 'movilidad', index: number): void {
    this.djRowsArray(rubro).removeAt(index);
  }

  getDjRowsTotal(rubro: 'alimentacion' | 'movilidad'): number {
    return this.djRowsArray(rubro).controls.reduce(
      (sum, ctrl) => sum + (ctrl.get('monto')?.value || 0),
      0
    );
  }

  get djTotal(): number {
    return this.getDjRowsTotal('alimentacion') + this.getDjRowsTotal('movilidad');
  }

  setExpenseType(type: ExpenseType) {
    this.expenseType.set(type);
    // Limpiar archivo al cambiar de tipo para evitar adjuntos cruzados
    this.selectedFile = undefined as any;
    this.previewImage = null;
    if (type === 'factura') {
      this.form.get('file')?.setValidators([Validators.required]);
    } else {
      this.form.get('file')?.clearValidators();
    }
    this.form.get('file')?.updateValueAndValidity();
    this.syncTopValidators();
  }

  /**
   * En Rendiciones Directas la planilla de movilidad lleva el proyecto en cada fila
   * (no a nivel de gasto), por lo que el selector de proyecto superior se oculta y
   * deja de ser obligatorio. En el resto de casos sí es requerido.
   */
  /** Contexto directa: por query param (`mode=directa`) o por el flag de la rendición asociada. */
  isDirectaContext(): boolean {
    return this.isDirectaMode || this.isDirectaReport();
  }

  isDirectaPlanilla(): boolean {
    return this.isDirectaContext() && this.expenseType() === 'planilla_movilidad';
  }

  /**
   * Declaración Jurada (otros gastos, sub-tipo DJ): la categoría no se elige a mano,
   * se autoasigna por proyecto, por lo que el selector superior de categoría se oculta.
   */
  isDj(): boolean {
    return this.expenseType() === 'otros_gastos' && this.otrosSubTipo() === 'DJ';
  }

  /**
   * Sincroniza los validadores del selector superior. En planilla directa el proyecto
   * y la categoría viven en cada fila, por lo que ambos selectores superiores se ocultan
   * y dejan de ser obligatorios; en el resto de casos son requeridos.
   */
  private syncTopValidators(): void {
    const optional = this.isDirectaPlanilla();
    for (const name of ['proyectId', 'categoryId']) {
      const ctrl = this.form.get(name);
      if (!ctrl || ctrl.disabled) continue;
      ctrl.setValidators(optional ? [] : [Validators.required]);
      ctrl.updateValueAndValidity({ emitEvent: false });
    }
  }

  /** Sincroniza validadores de proyecto y categoría (selector superior + por fila) según el contexto directa. */
  private syncMobilityRowValidators(): void {
    this.syncTopValidators();
    const rowRequired = this.isDirectaContext();
    for (const ctrl of this.mobilityRowsArray.controls) {
      for (const name of ['proyectId', 'categoryId']) {
        const c = ctrl.get(name);
        if (!c) continue;
        c.setValidators(rowRequired ? [Validators.required] : []);
        c.updateValueAndValidity({ emitEvent: false });
      }
    }
  }

  addMobilityRow() {
    const rowRequired = this.isDirectaContext() ? [Validators.required] : [];
    const group = this.fb.group({
      fecha: ['', Validators.required],
      total: [null, [Validators.required, Validators.min(0)]],
      proyectId: ['', rowRequired],
      categoryId: ['', rowRequired],
      colaboradorEsTercero: [false],
      colaboradorId: [''],
      clienteProveedor: ['', Validators.required],
      origen: ['', Validators.required],
      origenLat: [null],
      origenLng: [null],
      origenDepartamento: [''],
      origenProvincia: [''],
      origenDistrito: [''],
      destino: ['', Validators.required],
      destinoLat: [null],
      destinoLng: [null],
      destinoDepartamento: [''],
      destinoProvincia: [''],
      destinoDistrito: [''],
      distanciaKm: [null],
      gestion: ['', Validators.required],
    });
    this.mobilityRowsArray.push(group);
    this.wireRowCategoryReset(group);
  }

  /** Suscripciones por fila que limpian la categoría cuando cambia el proyecto de la fila. */
  private rowCategorySubs = new WeakMap<FormGroup, Subscription>();

  /**
   * Al cambiar el proyecto de una fila, limpia su categoría si dejó de pertenecer al
   * perfil del nuevo proyecto, para que la categoría corresponda siempre al proyecto
   * seleccionado en esa fila (Rendiciones Directas).
   */
  private wireRowCategoryReset(group: FormGroup): void {
    const sub = group.get('proyectId')!.valueChanges.subscribe((projId) => {
      const allowed = this.allowedCategoryIdsFor(projId);
      const selected = group.get('categoryId')?.value;
      if (allowed && selected && !allowed.has(String(selected))) {
        group.get('categoryId')?.setValue('');
      }
    });
    this.rowCategorySubs.set(group, sub);
  }

  onOrigenSelected(result: PlaceResult, index: number) {
    const { dep, prov, dist } = this.resolveLocation(result);
    const row = this.mobilityRowsArray.at(index);
    // Patch dep first; options for prov/dist depend on dep being set
    row.patchValue({
      origen: result.address,
      origenLat: result.lat,
      origenLng: result.lng,
      origenDepartamento: dep,
      origenProvincia: '',
      origenDistrito: '',
    });
    if (dep && prov) {
      // Defer until Angular renders province options for the new dep
      setTimeout(() => {
        row.patchValue({ origenProvincia: prov, origenDistrito: '' });
        if (dist) {
          // Defer until Angular renders district options for the new prov
          setTimeout(() => {
            row.patchValue({ origenDistrito: dist });
          });
        }
      });
    }
    this.calculateDistance(index);
  }

  onDestinoSelected(result: PlaceResult, index: number) {
    const { dep, prov, dist } = this.resolveLocation(result);
    const row = this.mobilityRowsArray.at(index);
    row.patchValue({
      destino: result.address,
      destinoLat: result.lat,
      destinoLng: result.lng,
      destinoDepartamento: dep,
      destinoProvincia: '',
      destinoDistrito: '',
    });
    if (dep && prov) {
      setTimeout(() => {
        row.patchValue({ destinoProvincia: prov, destinoDistrito: '' });
        if (dist) {
          setTimeout(() => {
            row.patchValue({ destinoDistrito: dist });
          });
        }
      });
    }
    this.calculateDistance(index);
  }

  private resolveLocation(result: PlaceResult): { dep: string; prov: string; dist: string } {
    let dep = this.matchDepartamento(result.departamento);

    // formattedAddress fallback: when addressComponents lack administrative_area_level_1
    // (common for POIs/establishments in Google's new Places API)
    if (!dep && result.formattedAddress) {
      const parts = result.formattedAddress
        .split(',')
        .map(p => p.trim().replace(/\s+\d{4,6}$/, '').trim())
        .filter(p => p && p !== 'Perú' && p !== 'Peru');
      // Scan from end to start — broader geo info appears at the end in Peru
      for (let j = parts.length - 1; j >= 0; j--) {
        dep = this.matchDepartamento(parts[j]);
        if (dep) break;
      }
    }

    if (!dep) return { dep: '', prov: '', dist: '' };

    let prov = this.matchProvincia(dep, result.provincia);
    let dist = '';

    if (prov && result.distrito) {
      dist = this.matchDistrito(dep, prov, result.distrito);
    }

    if (result.distrito && (!prov || !dist)) {
      const match = this.findDistritoInDepartamento(dep, result.distrito);
      if (match) {
        prov = match.prov;
        dist = match.dist;
      }
    }

    if (!prov) {
      const depData = findDepartamento(dep);
      if (depData && depData.provincias.length === 1) {
        prov = depData.provincias[0].label;
      } else if (result.provincia) {
        prov = this.matchProvincia(dep, result.provincia);
      } else {
        const provMatch = depData?.provincias.find(p =>
          this.normalizeStr(p.label) === this.normalizeStr(dep)
        );
        if (provMatch) prov = provMatch.label;
      }
    }

    // Fallback: si Google no entregó un distrito reconocible (p. ej. lo devolvió
    // como `locality` igual a la provincia —Callao, Lima— o simplemente no vino),
    // lo deducimos del texto de la dirección, acotado a la provincia ya resuelta.
    if (prov && !dist) {
      dist = this.matchDistritoFromText(dep, prov, result.address);
    }

    return { dep, prov, dist };
  }

  /**
   * Deduce el distrito a partir del texto de la dirección ("..., Surco, Perú" →
   * "Santiago de Surco"; "..., Callao" → "Callao"), buscando solo entre los
   * distritos de la provincia resuelta. Ignora el primer segmento (la calle) y
   * el país para minimizar falsos positivos por calles homónimas.
   */
  private matchDistritoFromText(depLabel: string, provLabel: string, text: string): string {
    if (!text) return '';
    const dep = findDepartamento(depLabel);
    const prov = dep?.provincias.find(p => p.label === provLabel);
    if (!prov) return '';

    const segments = text
      .split(',')
      .map(s => this.normalizeStr(s).replace(/\d+/g, '').trim())
      .filter(s => s && s !== 'peru')
      .slice(1);
    if (!segments.length) return '';

    const matches = (dn: string, seg: string): boolean => {
      if (dn === seg) return true;
      if (Math.min(dn.length, seg.length) < 4) return false; // evita ruido de pocas letras
      return dn.includes(seg) || seg.includes(dn);
    };

    // Preferimos la etiqueta más larga (más específica) ante varios candidatos.
    const sorted = [...prov.distritos].sort((a, b) => b.label.length - a.label.length);
    for (const seg of segments) {
      const found = sorted.find(d => matches(this.normalizeStr(d.label), seg));
      if (found) return found.label;
    }
    return '';
  }

  private findDistritoInDepartamento(depLabel: string, distLabel: string): { prov: string; dist: string } | null {
    if (!distLabel) return null;
    const dep = findDepartamento(depLabel);
    if (!dep) return null;
    const n = this.normalizeStr(distLabel);
    for (const prov of dep.provincias) {
      const found = prov.distritos.find(d => {
        const dn = this.normalizeStr(d.label);
        return dn === n || n.includes(dn) || dn.includes(n);
      });
      if (found) return { prov: prov.label, dist: found.label };
    }
    return null;
  }

  private normalizeStr(str: string): string {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }

  private matchDepartamento(label?: string): string {
    if (!label) return '';
    const n = this.normalizeStr(label);
    const found = PERU_LOCATIONS.find(d => {
      const dn = this.normalizeStr(d.label);
      return dn === n || n.includes(dn) || dn.includes(n);
    });
    return found?.label || '';
  }

  private matchProvincia(depLabel: string, provLabel?: string): string {
    if (!provLabel) return '';
    const dep = findDepartamento(depLabel);
    if (!dep) return '';
    const n = this.normalizeStr(provLabel);
    const found = dep.provincias.find(p => {
      const pn = this.normalizeStr(p.label);
      return pn === n || n.includes(pn) || pn.includes(n);
    });
    return found?.label || '';
  }

  private matchDistrito(depLabel: string, provLabel: string, distLabel?: string): string {
    if (!distLabel) return '';
    const dep = findDepartamento(depLabel);
    if (!dep) return '';
    const prov = dep.provincias.find(p => this.normalizeStr(p.label) === this.normalizeStr(provLabel));
    if (!prov) return '';
    const n = this.normalizeStr(distLabel);
    const dist = prov.distritos.find(d => {
      const dn = this.normalizeStr(d.label);
      return dn === n || n.includes(dn) || dn.includes(n);
    });
    return dist?.label || '';
  }

  private calculateDistance(index: number) {
    const row = this.mobilityRowsArray.at(index);
    const oLat = row.get('origenLat')?.value;
    const oLng = row.get('origenLng')?.value;
    const dLat = row.get('destinoLat')?.value;
    const dLng = row.get('destinoLng')?.value;

    if (oLat != null && oLng != null && dLat != null && dLng != null && typeof google !== 'undefined') {
      const from = new google.maps.LatLng(oLat, oLng);
      const to = new google.maps.LatLng(dLat, dLng);
      const meters = google.maps.geometry.spherical.computeDistanceBetween(from, to);
      row.patchValue({ distanciaKm: Math.round(meters / 100) / 10 });
    }
  }

  removeMobilityRow(index: number) {
    const group = this.mobilityRowsArray.at(index) as FormGroup;
    this.rowCategorySubs.get(group)?.unsubscribe();
    this.rowCategorySubs.delete(group);
    this.mobilityRowsArray.removeAt(index);
  }

  onOrigenDepartamentoChange(i: number) {
    this.mobilityRowsArray.at(i).patchValue({ origenProvincia: '', origenDistrito: '' });
  }

  onOrigenProvinciaChange(i: number) {
    this.mobilityRowsArray.at(i).patchValue({ origenDistrito: '' });
  }

  onDestinoDepartamentoChange(i: number) {
    this.mobilityRowsArray.at(i).patchValue({ destinoProvincia: '', destinoDistrito: '' });
  }

  onDestinoProvinciaChange(i: number) {
    this.mobilityRowsArray.at(i).patchValue({ destinoDistrito: '' });
  }

  getProvinciasOrigen(i: number) {
    const dep = this.mobilityRowsArray.at(i).get('origenDepartamento')?.value;
    return findDepartamento(dep)?.provincias ?? [];
  }

  getDistritosOrigen(i: number) {
    const row = this.mobilityRowsArray.at(i);
    const dep = row.get('origenDepartamento')?.value;
    const prov = row.get('origenProvincia')?.value;
    return findDepartamento(dep)?.provincias.find(p => p.label === prov)?.distritos ?? [];
  }

  getProvinciasDestino(i: number) {
    const dep = this.mobilityRowsArray.at(i).get('destinoDepartamento')?.value;
    return findDepartamento(dep)?.provincias ?? [];
  }

  getDistritosDestino(i: number) {
    const row = this.mobilityRowsArray.at(i);
    const dep = row.get('destinoDepartamento')?.value;
    const prov = row.get('destinoProvincia')?.value;
    return findDepartamento(dep)?.provincias.find(p => p.label === prov)?.distritos ?? [];
  }

  getMobilityTotal(): number {
    return this.mobilityRowsArray.controls.reduce((sum, ctrl) => {
      return sum + (ctrl.get('total')?.value || 0);
    }, 0);
  }

  getMobilityDateTotal(date: string): number {
    if (!date) return 0;
    return this.mobilityRowsArray.controls.reduce((sum, ctrl) => {
      return ctrl.get('fecha')?.value === date ? sum + (ctrl.get('total')?.value || 0) : sum;
    }, 0);
  }

  isMobilityRowDateOverLimit(index: number): boolean {
    if (!this.mobilityDailyLimit) return false;
    const date = this.mobilityRowsArray.at(index).get('fecha')?.value;
    if (!date) return false;
    return this.getMobilityDateTotal(date) > this.mobilityDailyLimit;
  }

  hasAnyMobilityLimitExceeded(): boolean {
    if (!this.mobilityDailyLimit) return false;
    const dates = new Set(
      this.mobilityRowsArray.controls
        .map(c => c.get('fecha')?.value)
        .filter(Boolean)
    );
    return [...dates].some(d => this.getMobilityDateTotal(d) > this.mobilityDailyLimit!);
  }

  isFormValid(): boolean {
    const proyectOk = (() => {
      const c = this.form.get('proyectId');
      return c?.disabled || c?.valid === true;
    })();
    switch (this.expenseType()) {
      case 'planilla_movilidad': {
        // En planilla directa la categoría vive en cada fila (cubierta por mobilityRowsArray.valid).
        const categoryOk = this.isDirectaPlanilla() || this.form.get('categoryId')?.valid === true;
        return (
          proyectOk &&
          categoryOk &&
          this.mobilityRowsArray.length > 0 &&
          this.mobilityRowsArray.valid &&
          !this.hasAnyMobilityLimitExceeded()
        );
      }
      case 'otros_gastos': {
        const sub = this.otrosSubTipo();
        const isDJ = sub === 'DJ';
        if (isDJ) {
          if (!!this.id) return true;
          const alimentacionRows = this.djAlimentacionRowsArray;
          const movilidadRows = this.djMovilidadRowsArray;
          const hasRows = alimentacionRows.length > 0 || movilidadRows.length > 0;
          const alimentacionOk = alimentacionRows.length === 0
            || (alimentacionRows.valid && !!this.form.get('djAlimentacionCategoryId')?.value);
          const movilidadOk = movilidadRows.length === 0
            || (movilidadRows.valid && !!this.form.get('djMovilidadCategoryId')?.value);
          return (
            proyectOk &&
            !!this.form.get('declaracionJurada')?.value &&
            hasRows &&
            alimentacionOk &&
            movilidadOk
          );
        }
        const isBV = sub === 'BV';
        const rucEmisorOk = !!(this.form.get('rucEmisor')?.value || '').toString().trim();
        const bvDocOk = !isBV || (
          rucEmisorOk &&
          !!(this.form.get('serie')?.value || '').toString().trim() &&
          !!(this.form.get('correlativo')?.value || '').toString().trim()
        );
        // RUC Emisor obligatorio para TK, BV y RC (todos los sub-tipos con documento físico)
        const rucOk = !this.otrosSubTipoMuestraDocumento() || rucEmisorOk;
        return (
          proyectOk &&
          this.form.get('categoryId')?.valid === true &&
          (this.form.get('totalOtros')?.value > 0) &&
          // El adjunto es obligatorio al crear (todos los sub-tipos, salvo DJ)
          (!!this.id || !!this.selectedFile) &&
          bvDocOk &&
          rucOk
        );
      }
      case 'recibo_caja':
        return (
          proyectOk &&
          this.form.get('categoryId')?.valid === true &&
          (!!this.id || !!this.selectedFile) &&
          !!(this.form.get('receiptFecha')?.value || '').trim() &&
          !!(this.form.get('receiptConcepto')?.value || '').trim() &&
          (this.form.get('receiptMonto')?.value > 0)
        );
      case 'comprobante_caja':
        return (
          proyectOk &&
          this.form.get('categoryId')?.valid === true &&
          !!(this.form.get('voucherEntregadoA')?.value || '').trim() &&
          !!(this.form.get('voucherConcepto')?.value || '').trim() &&
          (this.form.get('voucherMonto')?.value > 0)
        );
      default:
        return this.form.valid;
    }
  }

  saveCashReceipt() {
    const fecha = this.form.get('receiptFecha')?.value;
    const concepto = (this.form.get('receiptConcepto')?.value || '').trim();
    const monto = Number(this.form.get('receiptMonto')?.value || 0);
    if (!this.selectedFile) {
      this.notificationService.show('Debes adjuntar el archivo del recibo', 'error');
      return;
    }
    if (!fecha || !concepto || monto <= 0) {
      this.notificationService.show('Completa los campos obligatorios del recibo', 'error');
      return;
    }

    this.isLoading.set(true);
    const { downloadUrl$ } = this.uploadService.uploadFile(this.selectedFile, environment.storagePath);
    downloadUrl$.subscribe({
      next: (url) => {
        const payload = {
          proyectId: this.form.get('proyectId')?.value,
          categoryId: this.form.get('categoryId')?.value,
          expenseReportId: this.rendicionId || undefined,
          total: monto,
          fechaEmision: fecha,
          imageUrl: url,
          data: JSON.stringify({
            razonSocial: this.form.get('receiptRazonSocial')?.value || '',
            ruc: this.form.get('receiptRuc')?.value || '',
            numeroDocumento: this.form.get('receiptNumeroDocumento')?.value || '',
            concepto,
          }),
        };
        this.invoiceService.createCashReceipt(payload).subscribe({
          next: (res) => {
            this.isLoading.set(false);
            this.notificationService.show('Recibo de caja guardado correctamente', 'success');
            this.notifyCategoryLimitWarning(res);
            this.navigateAfterExpenseSave();
          },
          error: (error) => {
            this.isLoading.set(false);
            this.notificationService.show(
              'Error al guardar recibo: ' + (error.error?.message || error.message),
              'error'
            );
          },
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        this.notificationService.show('Error al subir el archivo: ' + err.message, 'error');
      },
    });
  }

  /**
   * Comprobante de caja: al seleccionar un archivo (imagen/PDF) se sube a S3 y se
   * escanea con OCR para autorellenar los campos del formulario. Los campos
   * quedan editables y el archivo se guarda como documento del comprobante.
   */
  onCashVoucherFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || !input.files[0]) return;
    const file = input.files[0];
    this.selectedFile = file;
    this.cashVoucherFileName = file.name;
    this.cashVoucherMimeType = file.type;

    this.isScanningVoucher.set(true);
    const { downloadUrl$ } = this.uploadService.uploadFile(file, environment.storagePath);
    downloadUrl$.subscribe({
      next: (url) => {
        this.cashVoucherFileUrl = url;
        this.invoiceService
          .scanCashVoucher({ url, mimeType: this.cashVoucherMimeType })
          .subscribe({
            next: (data) => {
              this.isScanningVoucher.set(false);
              this.applyCashVoucherScan(data);
              this.notificationService.show(
                'Datos extraidos del comprobante. Revisa y corrige si es necesario.',
                'success'
              );
            },
            error: (error) => {
              // El archivo ya quedó subido; solo falló el OCR. Se permite carga manual.
              this.isScanningVoucher.set(false);
              this.notificationService.show(
                'No se pudieron extraer los datos automaticamente. Completa los campos manualmente. ' +
                  (error.error?.message || error.message || ''),
                'warning'
              );
            },
          });
      },
      error: (err) => {
        this.isScanningVoucher.set(false);
        this.cashVoucherFileUrl = null;
        this.cashVoucherFileName = null;
        this.notificationService.show('Error al subir el archivo: ' + err.message, 'error');
      },
    });
  }

  /** Vuelca los datos extraídos por OCR a los campos del comprobante de caja. */
  private applyCashVoucherScan(data: {
    entregadoA?: string;
    fecha?: string;
    direccion?: string;
    concepto?: string;
    monto?: number;
  }): void {
    const patch: any = {};
    if (data.entregadoA) patch.voucherEntregadoA = data.entregadoA;
    if (data.direccion) patch.voucherDireccion = data.direccion;
    if (data.concepto) patch.voucherConcepto = data.concepto;
    if (data.fecha) {
      const iso = this.formatDateForInput(data.fecha);
      if (iso) patch.voucherFecha = iso;
    }
    if (typeof data.monto === 'number' && data.monto > 0) patch.voucherMonto = data.monto;
    this.form.patchValue(patch);
  }

  /** Quita el archivo escaneado del comprobante de caja. */
  removeCashVoucherFile(): void {
    this.selectedFile = null as any;
    this.cashVoucherFileUrl = null;
    this.cashVoucherFileName = null;
    this.cashVoucherMimeType = undefined;
  }

  saveCashVoucher() {
    const entregadoA = (this.form.get('voucherEntregadoA')?.value || '').trim();
    const direccion = (this.form.get('voucherDireccion')?.value || '').trim();
    const concepto = (this.form.get('voucherConcepto')?.value || '').trim();
    const fecha = this.form.get('voucherFecha')?.value || '';
    const monto = Number(this.form.get('voucherMonto')?.value || 0);
    if (!entregadoA || !concepto || monto <= 0) {
      this.notificationService.show(
        'Completa los campos obligatorios del comprobante de caja',
        'error'
      );
      return;
    }

    this.isLoading.set(true);
    const payload = {
      proyectId: this.form.get('proyectId')?.value,
      categoryId: this.form.get('categoryId')?.value,
      expenseReportId: this.rendicionId || undefined,
      total: monto,
      fechaEmision: fecha || undefined,
      imageUrl: this.cashVoucherFileUrl || undefined,
      data: JSON.stringify({
        entregadoA,
        direccion,
        concepto,
        monto,
      }),
    };
    this.invoiceService.createCashVoucher(payload).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.notificationService.show('Comprobante de caja guardado correctamente', 'success');
        this.notifyCategoryLimitWarning(res);
        this.navigateAfterExpenseSave();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.show(
          'Error al guardar comprobante: ' + (error.error?.message || error.message),
          'error'
        );
      },
    });
  }

  saveMobilitySheet() {
    if (this.mobilityRowsArray.length === 0) {
      this.notificationService.show('Debes agregar al menos una fila', 'error');
      return;
    }
    const proyectCtrl = this.form.get('proyectId');
    const proyectOk = !!(proyectCtrl?.disabled || proyectCtrl?.valid);
    // En planilla directa proyecto y categoría viven en cada fila; el selector superior se omite.
    const categoryOk = this.isDirectaPlanilla() || !!this.form.get('categoryId')?.valid;
    if (!proyectOk || !categoryOk) {
      this.notificationService.show('Completa los campos requeridos', 'error');
      return;
    }
    if (this.isDirectaContext()) {
      const allRowsComplete = this.mobilityRowsArray.controls.every(
        (c) => !!c.get('proyectId')?.value && !!c.get('categoryId')?.value
      );
      if (!allRowsComplete) {
        this.mobilityRowsArray.markAllAsTouched();
        this.notificationService.show('Selecciona el proyecto y la categoría de cada fila', 'error');
        return;
      }
    }
    if (this.hasMobilityTerceroSinColaborador()) {
      this.mobilityRowsArray.markAllAsTouched();
      this.notificationService.show('Selecciona el trabajador en las filas marcadas como tercero', 'error');
      return;
    }
    if (this.hasAnyMobilityLimitExceeded()) {
      this.notificationService.show(
        `El total diario supera el límite configurado de S/ ${this.mobilityDailyLimit?.toFixed(2)}`,
        'error'
      );
      return;
    }
    this.isLoading.set(true);

    const doSave = (imageUrl?: string) => {
      const rows = this.mobilityRowsArray.value.map((r: any) => ({
        fecha: r.fecha,
        total: r.total,
        ...(r.proyectId ? { proyectId: r.proyectId } : {}),
        ...(r.categoryId ? { categoryId: r.categoryId } : {}),
        ...this.resolveRowColaborador(r),
        clienteProveedor: r.clienteProveedor,
        origen: r.origen,
        origenDepartamento: r.origenDepartamento,
        origenProvincia: r.origenProvincia,
        origenDistrito: r.origenDistrito,
        ...(r.origenLat != null && r.origenLng != null
          ? { origenCoords: { lat: r.origenLat, lng: r.origenLng } }
          : {}),
        destino: r.destino,
        destinoDepartamento: r.destinoDepartamento,
        destinoProvincia: r.destinoProvincia,
        destinoDistrito: r.destinoDistrito,
        ...(r.destinoLat != null && r.destinoLng != null
          ? { destinoCoords: { lat: r.destinoLat, lng: r.destinoLng } }
          : {}),
        ...(r.distanciaKm != null ? { distanciaKm: r.distanciaKm } : {}),
        gestion: r.gestion,
      }));
      // En modo directa el proyecto y la categoría viven en cada fila; los del gasto se toman de la primera.
      const expenseProjectId = this.isDirectaContext()
        ? (rows[0]?.proyectId || '')
        : this.form.get('proyectId')?.value;
      const expenseCategoryId = this.isDirectaContext()
        ? (rows[0]?.categoryId || '')
        : this.form.get('categoryId')?.value;
      const payload = {
        proyectId: expenseProjectId,
        categoryId: expenseCategoryId,
        expenseReportId: this.rendicionId || undefined,
        mobilityRows: rows,
        imageUrl,
      };
      this.invoiceService.createMobilitySheet(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.notificationService.show('Planilla guardada correctamente', 'success');
          this.notifyCategoryLimitWarning(res);
          this.navigateAfterExpenseSave();
        },
        error: (error) => {
          this.isLoading.set(false);
          this.notificationService.show(
            'Error al guardar la planilla: ' + (error.error?.message || error.message),
            'error'
          );
        },
      });
    };

    if (this.selectedFile) {
      const { downloadUrl$ } = this.uploadService.uploadFile(this.selectedFile, environment.storagePath);
      downloadUrl$.subscribe({
        next: (url) => doSave(url),
        error: (err) => {
          this.isLoading.set(false);
          this.notificationService.show('Error al subir el adjunto: ' + err.message, 'error');
        },
      });
    } else {
      doSave();
    }
  }

  saveOtherExpense() {
    const total = this.form.get('totalOtros')?.value;
    const description = this.form.get('description')?.value;
    const subTipo = this.otrosSubTipo();

    const proyectCtrl = this.form.get('proyectId');
    const proyectOk = !!(proyectCtrl?.disabled || proyectCtrl?.valid);
    if (!proyectOk || !this.form.get('categoryId')?.valid) {
      this.notificationService.show('Completa los campos requeridos', 'error');
      return;
    }

    if (!total || total <= 0) {
      this.notificationService.show('Ingresa un monto válido', 'error');
      return;
    }

    // El adjunto es obligatorio para todos los sub-tipos de otros gastos (salvo DJ, que tiene su propio flujo)
    if (!this.selectedFile) {
      this.notificationService.show('Debes adjuntar el comprobante', 'error');
      return;
    }

    const muestraDoc = this.otrosSubTipoMuestraDocumento();
    // RUC Emisor obligatorio para TK, BV y RC
    if (muestraDoc && !(this.form.get('rucEmisor')?.value || '').toString().trim()) {
      this.notificationService.show('Debes ingresar el RUC del emisor', 'error');
      return;
    }

    this.isLoading.set(true);

    const serie = muestraDoc ? (this.form.get('serie')?.value || '').toString().trim() : '';
    const correlativo = muestraDoc ? (this.form.get('correlativo')?.value || '').toString().trim() : '';
    const rucEmisor = muestraDoc ? (this.form.get('rucEmisor')?.value || '').toString().trim() : '';

    const proceed = (imageUrl?: string) => {
      const payload: any = {
        proyectId: this.form.get('proyectId')?.value,
        categoryId: this.form.get('categoryId')?.value,
        expenseReportId: this.rendicionId || undefined,
        total,
        data: description,
        subTipo,
        imageUrl,
        ...(serie ? { serie } : {}),
        ...(correlativo ? { correlativo } : {}),
        ...(rucEmisor ? { rucEmisor } : {}),
      };
      this.invoiceService.createOtherExpense(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.notificationService.show('Gasto guardado correctamente', 'success');
          this.notifyCategoryLimitWarning(res);
          this.navigateAfterExpenseSave();
        },
        error: (error) => {
          this.isLoading.set(false);
          this.notificationService.show(
            'Error al guardar el gasto: ' + (error.error?.message || error.message),
            'error'
          );
        },
      });
    };

    if (this.selectedFile) {
      const { downloadUrl$ } = this.uploadService.uploadFile(this.selectedFile, environment.storagePath);
      downloadUrl$.subscribe({
        next: (url) => proceed(url),
        error: (err) => {
          this.isLoading.set(false);
          this.notificationService.show('Error al subir el adjunto: ' + err.message, 'error');
        },
      });
    } else {
      proceed();
    }
  }

  /** Declaración Jurada: adjunto opcional, filas manuales de Alimentación/Movilidad. */
  saveDeclaracionJurada(): void {
    const proyectId = this.form.get('proyectId')?.value;
    if (!proyectId) {
      this.notificationService.show('Completa los campos requeridos', 'error');
      return;
    }
    const currentUser = this.userStateService.getUser();
    if (!currentUser?.signature) {
      this.notificationService.show(
        'Debes registrar tu firma digital antes de enviar una Declaracion Jurada. Ve a Mi Firma en el menu.',
        'error'
      );
      return;
    }
    if (!this.form.get('declaracionJurada')?.value) {
      this.notificationService.show('Debes aceptar y firmar la declaración jurada', 'error');
      return;
    }

    const alimentacionRows = this.djAlimentacionRowsArray.getRawValue();
    const movilidadRows = this.djMovilidadRowsArray.getRawValue();
    if (alimentacionRows.length === 0 && movilidadRows.length === 0) {
      this.notificationService.show('Ingresa al menos un gasto de Alimentación o Movilidad', 'error');
      return;
    }
    if (alimentacionRows.length > 0 && !this.form.get('djAlimentacionCategoryId')?.value) {
      this.notificationService.show('Selecciona la categoría de Alimentación', 'error');
      return;
    }
    if (movilidadRows.length > 0 && !this.form.get('djMovilidadCategoryId')?.value) {
      this.notificationService.show('Selecciona la categoría de Movilidad', 'error');
      return;
    }
    if (!this.djAlimentacionRowsArray.valid || !this.djMovilidadRowsArray.valid) {
      this.notificationService.show('Completa fecha y monto en todas las filas', 'error');
      return;
    }

    this.isLoading.set(true);

    const proceed = (imageUrl?: string) => {
      const payload: ICreateDeclaracionJuradaPayload = {
        proyectId,
        expenseReportId: this.rendicionId || undefined,
        moneda: this.form.get('djMoneda')?.value || 'US$',
        destino: (this.form.get('djDestino')?.value || '').trim() || undefined,
        pais: (this.form.get('djPais')?.value || '').trim() || undefined,
        lugarFirma: (this.form.get('djLugarFirma')?.value || '').trim() || undefined,
        imageUrl,
        ...(alimentacionRows.length > 0 && {
          alimentacion: {
            categoryId: this.form.get('djAlimentacionCategoryId')?.value,
            rows: alimentacionRows,
          },
        }),
        ...(movilidadRows.length > 0 && {
          movilidad: {
            categoryId: this.form.get('djMovilidadCategoryId')?.value,
            rows: movilidadRows,
          },
        }),
      };
      this.invoiceService.createDeclaracionJurada(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.savedDeclaracionJurada.set(res);
          this.notificationService.show(
            'Declaración jurada guardada correctamente. Ya puedes descargar el PDF.',
            'success'
          );
        },
        error: (error) => {
          this.isLoading.set(false);
          this.notificationService.show(
            'Error al guardar la declaración jurada: ' + (error.error?.message || error.message),
            'error'
          );
        },
      });
    };

    if (this.selectedFile) {
      const { downloadUrl$ } = this.uploadService.uploadFile(this.selectedFile, environment.storagePath);
      downloadUrl$.subscribe({
        next: (url) => proceed(url),
        error: (err) => {
          this.isLoading.set(false);
          this.notificationService.show('Error al subir el adjunto: ' + err.message, 'error');
        },
      });
    } else {
      proceed();
    }
  }

  async downloadDeclaracionJuradaPdf(): Promise<void> {
    try {
      const currentUser = this.userStateService.getUser();
      const { RendicionExportService } = await import('../../../services/rendicion-export.service');
      const exportService = runInInjectionContext(this.envInjector, () => inject(RendicionExportService));
      await exportService.exportDeclaracionJuradaExteriorToPdf({
        fileBaseName: `declaracion-jurada-${Date.now()}`,
        colaborador: currentUser?.name || '',
        colaboradorDni: (currentUser as any)?.dni,
        ciudadDestino: this.form.get('djDestino')?.value || undefined,
        pais: this.form.get('djPais')?.value || undefined,
        moneda: this.form.get('djMoneda')?.value || 'US$',
        alimentacionRows: this.djAlimentacionRowsArray.getRawValue(),
        movilidadRows: this.djMovilidadRowsArray.getRawValue(),
        ciudadFirma: this.form.get('djLugarFirma')?.value || undefined,
        fechaFirma: new Date().toISOString(),
        signature: currentUser?.signature,
      });
    } catch (err: any) {
      this.notificationService.show('Error al generar el PDF: ' + err.message, 'error');
    }
  }

  saveOrUpdate() {
    if (this.id) {
      this.update();
      return;
    }
    switch (this.expenseType()) {
      case 'planilla_movilidad':
        this.saveMobilitySheet();
        break;
      case 'otros_gastos':
        if (this.otrosSubTipo() === 'DJ') {
          this.saveDeclaracionJurada();
        } else {
          this.saveOtherExpense();
        }
        break;
      case 'recibo_caja':
        this.saveCashReceipt();
        break;
      case 'comprobante_caja':
        this.saveCashVoucher();
        break;
      default:
        if (!this.selectedFile) {
          this.notificationService.show('Debes seleccionar un archivo de factura', 'error');
          return;
        }
        this.isLoading.set(true);
        const isPdf = this.isPdfFile(this.selectedFile);
        if (isPdf) {
          this.uploadPdfDirectly();
        } else {
          this.uploadFile();
        }
    }
  }

  update() {
    if (!this.originalInvoice) return;
    if (!this.isFormValid()) {
      this.notificationService.show('Completa los campos requeridos', 'error');
      return;
    }

    const formValue = this.form.getRawValue();
    const type = this.expenseType();

    let previousData: any = {};
    const currentData = this.originalInvoice.data || '';
    if (currentData) {
      try {
        previousData =
          typeof currentData === 'string' ? JSON.parse(currentData) : currentData;
      } catch {}
    }

    const payload: any = {
      proyectId: formValue.proyectId,
      categoryId: formValue.categoryId,
      status: this.originalInvoice.status,
      comentario: (formValue.comentario || '').trim() || undefined,
    };

    if (type === 'factura') {
      const fetched = this.fetchedRazonSocial();
      const razonSocial = fetched !== null ? fetched : (this.rucNotFound() ? 'No Reconocida' : undefined);
      const currentTotal = parseFloat(String(this.originalInvoice.total)) || 0;
      const finalTotal = this.invoiceAmountWasEdited ? this.editedInvoiceTotal()! : currentTotal;
      const dataObj = {
        ...previousData,
        rucEmisor: formValue.rucEmisor,
        serie: formValue.serie,
        correlativo: formValue.correlativo,
        fechaEmision: this.formatDateForBackend(formValue.fechaEmision),
        ...(razonSocial !== undefined ? { razonSocial } : {}),
        ...(this.invoiceAmountWasEdited ? { amountEdited: true, originalOcrTotal: currentTotal } : {}),
      };
      payload.data = JSON.stringify(dataObj);
      payload.fechaEmision = formValue.fechaEmision;
      payload.total = finalTotal;
      payload.moneda = formValue.moneda || 'PEN';
      payload.placaVehiculo = (formValue.placaVehiculo || '').trim() || undefined;
    } else if (type === 'otros_gastos') {
      const description = (formValue.description || '').trim();
      payload.description = description;
      payload.total = Number(formValue.totalOtros) || 0;
      const muestraDoc = this.otrosSubTipoMuestraDocumento();
      const { serie: _s, correlativo: _c, rucEmisor: _r, ...prevWithoutDoc } = previousData || {};
      const dataObj = {
        ...prevWithoutDoc,
        description,
        ...(muestraDoc ? {
          serie: (formValue.serie || '').trim() || undefined,
          correlativo: (formValue.correlativo || '').trim() || undefined,
          rucEmisor: (formValue.rucEmisor || '').trim() || undefined,
        } : {}),
      };
      payload.data = JSON.stringify(dataObj);
    } else if (type === 'recibo_caja') {
      const dataObj = {
        ...previousData,
        razonSocial: formValue.receiptRazonSocial || '',
        ruc: formValue.receiptRuc || '',
        numeroDocumento: formValue.receiptNumeroDocumento || '',
        concepto: (formValue.receiptConcepto || '').trim(),
      };
      payload.data = JSON.stringify(dataObj);
      payload.fechaEmision = formValue.receiptFecha;
      payload.total = Number(formValue.receiptMonto) || 0;
    } else if (type === 'comprobante_caja') {
      const monto = Number(formValue.voucherMonto) || 0;

      let previousPayload: any = {};
      if (previousData?.payload) {
        try {
          previousPayload =
            typeof previousData.payload === 'string'
              ? JSON.parse(previousData.payload)
              : previousData.payload;
        } catch {
          previousPayload = {};
        }
      } else {
        previousPayload = { ...previousData };
        delete previousPayload.type;
      }

      const newPayload = {
        ...previousPayload,
        entregadoA: (formValue.voucherEntregadoA || '').trim(),
        direccion: (formValue.voucherDireccion || '').trim(),
        concepto: (formValue.voucherConcepto || '').trim(),
        monto,
      };

      const dataObj = {
        type: 'comprobante_caja',
        payload: JSON.stringify(newPayload),
      };
      payload.data = JSON.stringify(dataObj);
      payload.description = JSON.stringify(newPayload);
      payload.fechaEmision = formValue.voucherFecha || undefined;
      payload.total = monto;
    } else if (type === 'planilla_movilidad') {
      if (this.hasMobilityTerceroSinColaborador()) {
        this.mobilityRowsArray.markAllAsTouched();
        this.notificationService.show('Selecciona el trabajador en las filas marcadas como tercero', 'error');
        return;
      }
      const rows = this.mobilityRowsArray.value.map((r: any) => ({
        fecha: r.fecha,
        total: r.total,
        ...(r.proyectId ? { proyectId: r.proyectId } : {}),
        ...(r.categoryId ? { categoryId: r.categoryId } : {}),
        ...this.resolveRowColaborador(r),
        clienteProveedor: r.clienteProveedor,
        origen: r.origen,
        origenDepartamento: r.origenDepartamento,
        origenProvincia: r.origenProvincia,
        origenDistrito: r.origenDistrito,
        ...(r.origenLat != null && r.origenLng != null
          ? { origenCoords: { lat: r.origenLat, lng: r.origenLng } }
          : {}),
        destino: r.destino,
        destinoDepartamento: r.destinoDepartamento,
        destinoProvincia: r.destinoProvincia,
        destinoDistrito: r.destinoDistrito,
        ...(r.destinoLat != null && r.destinoLng != null
          ? { destinoCoords: { lat: r.destinoLat, lng: r.destinoLng } }
          : {}),
        ...(r.distanciaKm != null ? { distanciaKm: r.distanciaKm } : {}),
        gestion: r.gestion,
      }));
      payload.mobilityRows = rows;
      // En modo directa el proyecto y la categoría del gasto se toman de la primera fila.
      if (this.isDirectaContext() && rows[0]?.proyectId) {
        payload.proyectId = rows[0].proyectId;
      }
      if (this.isDirectaContext() && rows[0]?.categoryId) {
        payload.categoryId = rows[0].categoryId;
      }
    }

    this.isLoading.set(true);

    this.invoiceService.updateInvoice(this.id, payload).subscribe({
      next: () => {
        if (type === 'factura' && this.shouldValidateWithSunat(formValue)) {
          this.validateWithSunatData(formValue);
        } else {
          this.isLoading.set(false);
          this.notificationService.show('Gasto actualizado correctamente', 'success');
          this.navigateAfterExpenseSave();
        }
      },
      error: (error: any) => {
        this.isLoading.set(false);
        console.error('Error al actualizar:', error);
        const msg = error?.error?.message || error?.message || 'Intente nuevamente';
        this.notificationService.show('Error al actualizar: ' + msg, 'error');
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      const isImage = this.selectedFile.type.startsWith('image/');
      if (isImage) {
        this.previewImage = this.sanitizer.bypassSecurityTrustUrl(
          URL.createObjectURL(this.selectedFile)
        );
      } else {
        this.previewImage = null;
      }
      this.form.patchValue({ file: this.selectedFile });
    }
  }

  uploadFile() {
    this.percentage.set(10);
    const { uploadProgress$, downloadUrl$ } = this.uploadService.uploadFile(
      this.selectedFile,
      environment.storagePath
    );
    uploadProgress$.subscribe((progress) => {
      if (progress === 0) {
        progress = 10;
      }
      this.percentage.set(Math.round(progress));
    });
    downloadUrl$.subscribe({
      next: (url) => {
        this.form.patchValue({ file: url });
        this.save();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.show(
          'Error al subir el archivo: ' + error.message,
          'error'
        );
      },
    });
  }

  private uploadPdfDirectly() {
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('proyectId', this.form.get('proyectId')?.value);
    formData.append('categoryId', this.form.get('categoryId')?.value);
    formData.append('status', 'pending');
    if (this.rendicionId) {
      formData.append('expenseReportId', this.rendicionId);
    }

    this.percentage.set(10);
    this.invoiceService.analyzePdf(formData).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res && res._id) {
          let dataObj: any = {};
          if (res.data) {
            try {
              dataObj = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            } catch {}
          }
          if (dataObj?.rucEmisor || dataObj?.fechaEmision || dataObj?.serie || dataObj?.correlativo || dataObj?.comentario) {
            this.form.patchValue({
              rucEmisor: dataObj.rucEmisor || '',
              fechaEmision: this.formatDateForInput(dataObj.fechaEmision),
              serie: dataObj.serie || '',
              correlativo: dataObj.correlativo || '',
              moneda: dataObj.moneda || 'PEN',
              comentario: dataObj.comentario || '',
              placaVehiculo: dataObj.placaVehiculo || '',
            });
            this.postOcrInvoiceId.set(res._id);
            this.postOcrBaseInvoice = res;
            this.ocrTotalAmount.set(parseFloat(String(res.total)) || 0);
            this.isEditingOcrAmount.set(false);
            this.editedOcrTotal.set(null);
            this.showPostOcrReview.set(true);
            this.notificationService.show(
              'Revisa y confirma los datos extraidos por OCR antes de guardar.',
              'warning'
            );
          } else {
            this.notificationService.show('Factura PDF analizada correctamente', 'success');
            this.navigateAfterExpenseSave();
          }
        } else {
          this.notificationService.show('Factura PDF analizada correctamente', 'success');
          this.navigateAfterExpenseSave();
        }
      },
      error: (error) => {
        this.isLoading.set(false);
      },
    });
  }

  save() {
    if (this.form.valid) {
      const payload = {
        categoryId: this.form.get('categoryId')?.value,
        proyectId: this.form.get('proyectId')?.value,
        imageUrl: this.form.get('file')?.value,
        status: 'pending' as InvoiceStatus,
        expenseReportId: this.rendicionId
      };

      this.invoiceService.analyzeInvoice(payload).subscribe({
        next: (res) => {
          if (res && res._id) {
            let dataObj: any = {};
            if (res.data) {
              try {
                dataObj =
                  typeof res.data === 'string'
                    ? JSON.parse(res.data)
                    : res.data;
              } catch {}
            }

            if (
              dataObj?.rucEmisor ||
              dataObj?.fechaEmision ||
              dataObj?.serie ||
              dataObj?.correlativo ||
              dataObj?.comentario
            ) {
              this.form.patchValue({
                rucEmisor: dataObj.rucEmisor || '',
                fechaEmision: this.formatDateForInput(dataObj.fechaEmision),
                serie: dataObj.serie || '',
                correlativo: dataObj.correlativo || '',
                moneda: dataObj.moneda || 'PEN',
                comentario: dataObj.comentario || '',
                placaVehiculo: dataObj.placaVehiculo || '',
              });
              this.postOcrInvoiceId.set(res._id);
              this.postOcrBaseInvoice = res;
              this.ocrTotalAmount.set(parseFloat(String(res.total)) || 0);
              this.isEditingOcrAmount.set(false);
              this.editedOcrTotal.set(null);
              this.showPostOcrReview.set(true);
              this.isLoading.set(false);
              this.notificationService.show(
                'Revisa y confirma los datos extraidos por OCR antes de guardar.',
                'warning'
              );
            } else {
              this.isLoading.set(false);
              this.notificationService.show(
                'Factura subida correctamente',
                'success'
              );
              this.notifyCategoryLimitWarning(res);
              this.navigateAfterExpenseSave();
            }
          } else {
            this.isLoading.set(false);
            this.notificationService.show(
              'Factura subida correctamente',
              'success'
            );
            this.notifyCategoryLimitWarning(res);
            this.navigateAfterExpenseSave();
          }
        },
        error: (error) => {
          this.isLoading.set(false);
        },
      });
    } else {
      this.isLoading.set(false);
      this.notificationService.show(
        'Por favor complete todos los campos requeridos',
        'error'
      );
    }
  }

  confirmPostOcrReview() {
    const invoiceId = this.postOcrInvoiceId();
    if (!invoiceId || !this.postOcrBaseInvoice) return;
    const comentario = (this.form.get('comentario')?.value || '').trim();
    if (!comentario) {
      this.notificationService.show('El campo Comentario es obligatorio.', 'error');
      return;
    }
    const formValue = this.form.value;
    let baseData: any = {};
    try {
      baseData =
        typeof this.postOcrBaseInvoice.data === 'string'
          ? JSON.parse(this.postOcrBaseInvoice.data || '{}')
          : this.postOcrBaseInvoice.data || {};
    } catch {
      baseData = {};
    }
    const fetched = this.fetchedRazonSocial();
    const razonSocialOcr = fetched !== null ? fetched : (this.rucNotFound() ? 'No Reconocida' : undefined);
    const finalTotal = this.ocrAmountWasEdited
      ? this.editedOcrTotal()!
      : (parseFloat(String(this.postOcrBaseInvoice.total)) || 0);
    const dataObj = {
      ...baseData,
      rucEmisor: formValue.rucEmisor || '',
      fechaEmision: this.formatDateForBackend(formValue.fechaEmision || ''),
      serie: formValue.serie || '',
      correlativo: formValue.correlativo || '',
      comentario,
      placaVehiculo: (formValue.placaVehiculo || '').trim() || undefined,
      ...(razonSocialOcr !== undefined ? { razonSocial: razonSocialOcr } : {}),
      ...(this.ocrAmountWasEdited ? { amountEdited: true, originalOcrTotal: this.ocrTotalAmount() } : {}),
    };
    const updatePayload = {
      proyectId: this.postOcrBaseInvoice.proyectId,
      categoryId: this.postOcrBaseInvoice.categoryId,
      total: finalTotal,
      moneda: formValue.moneda || 'PEN',
      data: JSON.stringify(dataObj),
      fechaEmision: dataObj.fechaEmision,
      status: this.postOcrBaseInvoice.status,
      comentario,
      placaVehiculo: dataObj.placaVehiculo,
    };

    this.isLoading.set(true);
    this.invoiceService.updateInvoice(invoiceId, updatePayload).subscribe({
      next: () => {
        if (this.shouldValidateWithSunat(formValue)) {
          this.id = invoiceId;
          this.originalInvoice = this.postOcrBaseInvoice;
          this.validateWithSunatData(formValue);
        } else {
          this.isLoading.set(false);
          this.notificationService.show('Factura guardada correctamente', 'success');
          this.notifyCategoryLimitWarning(this.postOcrBaseInvoice);
          this.navigateAfterExpenseSave();
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.show(
          'Error al guardar datos OCR: ' + (error.error?.message || error.message),
          'error'
        );
      },
    });
  }

  openInvoice() {
    if (this.previewImage) {
      window.open(this.previewImage as string, '_blank');
    }
  }

  back() {
    this.navigateAfterExpenseSave();
  }

  get categoryId() {
    return this.form.get('categoryId');
  }

  get proyectId() {
    return this.form.get('proyectId');
  }

  get imageUrl() {
    return this.form.get('file');
  }

  get serie() {
    return this.form.get('serie');
  }

  get correlativo() {
    return this.form.get('correlativo');
  }

  getButtonLabel(): string {
    if (this.id) {
      if (this.isSunatValidating()) return 'Validando con SUNAT...';
      if (this.isLoading()) return 'Actualizando...';
      return 'Actualizar factura';
    }
    if (this.isLoading()) return 'Guardando...';
    switch (this.expenseType()) {
      case 'planilla_movilidad': return 'Guardar Planilla';
      case 'otros_gastos': return 'Guardar Gasto';
      case 'recibo_caja': return 'Guardar Recibo de Caja';
      case 'comprobante_caja': return 'Guardar Comprobante de Caja';
      default: return 'Subir factura';
    }
  }

  private shouldValidateWithSunat(formValue: any): boolean {
    return !!(
      formValue.rucEmisor &&
      formValue.serie &&
      formValue.correlativo &&
      formValue.fechaEmision
    );
  }

  private validateWithSunat() {
    this.isSunatValidating.set(true);

    const clientId =
      this.originalInvoice?.clientId?._id || this.originalInvoice?.clientId;

    if (!clientId) {
      this.isSunatValidating.set(false);
      this.isLoading.set(false);
      this.notificationService.show(
        'No se pudo obtener el ID de la empresa para validar con SUNAT',
        'error'
      );
      this.navigateAfterExpenseSave();
      return;
    }

    this.invoiceService.getSunatValidation(this.id, clientId).subscribe({
      next: (validationResult: SunatValidationInfo) => {
        this.isSunatValidating.set(false);
        this.isLoading.set(false);
        this.sunatValidation = validationResult;

        this.showSunatValidationResult(validationResult);

        this.navigateAfterExpenseSave();
      },
      error: (error) => {
        this.isSunatValidating.set(false);
        this.isLoading.set(false);
        console.error('Error al validar con SUNAT:', error);

        this.notificationService.show(
          'Factura actualizada correctamente, pero hubo un error al validar con SUNAT',
          'error'
        );
        this.navigateAfterExpenseSave();
      },
    });
  }

  private showSunatValidationResult(validation: SunatValidationInfo) {
    let message = '';
    let type: 'success' | 'error' = 'success';

    if (validation.sunatValidation) {
      switch (validation.sunatValidation.status) {
        case 'VALIDO_ACEPTADO':
          message = 'Factura Válida y emitida a la empresa';
          type = 'success';
          break;
        case 'VALIDO_NO_PERTENECE':
          message = 'El comprobante no fue emitido a esta empresa. Verifica el RUC emisor.';
          type = 'error';
          break;
        case 'NO_ENCONTRADO':
          message = 'Comprobante no encontrado en SUNAT';
          type = 'error';
          break;
        case 'ERROR_SUNAT':
          message = 'Error en el servicio de sunat';
          type = 'error';
          break;
        default:
          message =
            'Resultado de validación SUNAT: ' +
            validation.sunatValidation.message;
          type = 'error';
      }
    } else {
      message = 'No se pudo obtener información de validación SUNAT';
      type = 'error';
    }

    this.notificationService.show(message, type);
  }

  private getTipoComprobanteFromData(): string {
    if (this.originalInvoice?.data) {
      try {
        const dataObj =
          typeof this.originalInvoice.data === 'string'
            ? JSON.parse(this.originalInvoice.data)
            : this.originalInvoice.data;
        return dataObj.tipoComprobante || 'Factura';
      } catch {
        return 'Factura';
      }
    }
    return 'Factura';
  }

  private validateWithSunatData(formValue: any) {
    this.isSunatValidating.set(true);

    const validationData = {
      rucEmisor: formValue.rucEmisor,
      serie: formValue.serie,
      correlativo: formValue.correlativo,
      fechaEmision: this.formatDateForBackend(formValue.fechaEmision),
      montoTotal:
        this.originalInvoice?.total || this.originalInvoice?.montoTotal || 0,
      clientId:
        this.originalInvoice?.clientId || this.originalInvoice?.companyId,
      tipoComprobante: this.getTipoComprobanteFromData(),
    };

    this.invoiceService
      .validateWithSunatData(this.id, validationData)
      .subscribe({
        next: (response) => {
          this.isSunatValidating.set(false);
          this.isLoading.set(false);

          let message = '';
          let type: 'success' | 'error' = 'success';

          switch (response.status) {
            case 'VALIDO_ACEPTADO':
              message = 'Factura Válida y emitida a la empresa';
              type = 'success';
              break;
            case 'VALIDO_NO_PERTENECE':
              message = 'El comprobante no fue emitido a esta empresa. Verifica el RUC emisor.';
              type = 'error';
              break;
            case 'NO_ENCONTRADO':
              message = 'Comprobante no encontrado en SUNAT';
              type = 'error';
              break;
            case 'ERROR_SUNAT':
              message = 'Error en el servicio de sunat';
              type = 'error';
              break;
            case 'SUNAT_CONFIG_NOT_FOUND':
              message = 'No se encontró configuración SUNAT para esta empresa';
              type = 'error';
              break;
            default:
              message =
                'Resultado de validación SUNAT: ' +
                (response.details?.message || 'Estado desconocido');
              type = 'error';
          }

          this.notificationService.show(message, type);
          this.navigateAfterExpenseSave();
        },
        error: (error) => {
          this.isSunatValidating.set(false);
          this.isLoading.set(false);
          console.error('Error al validar con SUNAT:', error);
          this.notificationService.show(
            'Factura actualizada correctamente, pero hubo un error al validar con SUNAT',
            'error'
          );
          this.navigateAfterExpenseSave();
        },
      });
  }
}
