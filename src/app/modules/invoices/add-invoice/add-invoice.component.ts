import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
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
import { UserStateService } from '../../../services/user-state.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UploadService } from '../../../services/upload.service';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { IProject } from '../interfaces/project.interface';
import { ICategory } from '../interfaces/category.interface';
import {
  InvoiceStatus,
  SunatValidationInfo,
  ExpenseType,
} from '../interfaces/invoices.interface';
import { ButtonComponent } from '../../../design-system/button/button.component';
import { PlacesAutocompleteDirective, PlaceResult } from '../../../directives/places-autocomplete.directive';
import { CompanyConfigService } from '../../../services/company-config.service';
import { PERU_LOCATIONS, Departamento } from '../../../constants/peru-locations';

function findDepartamento(label: string): Departamento | undefined {
  return PERU_LOCATIONS.find(d => d.label === label);
}

declare const google: any;

@Component({
  selector: 'app-add-invoice',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule, ButtonComponent, PlacesAutocompleteDirective],
  templateUrl: './add-invoice.component.html',
  styleUrl: './add-invoice.component.scss',
})
export default class AddInvoiceComponent implements OnInit {
  private invoiceService = inject(InvoicesService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private uploadService = inject(UploadService);
  private companyConfigService = inject(CompanyConfigService);

  form!: FormGroup;
  id: string = this.route.snapshot.params['id'];
  categories: ICategory[] = [];
  proyects: IProject[] = [];
  previewImage: SafeUrl | null = null;
  selectedFile!: File;
  originalInvoice: any = null;
  sunatValidation: SunatValidationInfo | null = null;
  isSunatValidating = signal(false);
  rendicionId: string | null = null;

  expenseType = signal<ExpenseType>('factura');
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

  private notifyCategoryLimitWarning(response: { categoryLimitWarning?: string; categoryLimitPercent?: number } | null | undefined): void {
    if (!response?.categoryLimitWarning) return;
    const pct = typeof response.categoryLimitPercent === 'number'
      ? ` (${response.categoryLimitPercent.toFixed(2)}%)`
      : '';
    this.notificationService.show(`${response.categoryLimitWarning}${pct}`, 'warning');
  }

  /** Tras crear/actualizar gasto: vuelve al detalle de rendición o al listado de facturas. */
  private navigateAfterExpenseSave(): void {
    if (this.rendicionId) {
      this.router.navigate(['/mis-rendiciones', this.rendicionId, 'detalle']);
    } else {
      this.router.navigate(['/invoices']);
    }
  }

  private guardRendiciones() {
    if (this.id) return; // edición: siempre permitida
    if (!this.userStateService.isColaborador()) return;
    // Desde detalle de rendición siempre hay contexto; no redirigir a /invoices
    if (this.rendicionId) return;

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
    this.guardRendiciones();
    this.loadCategories();
    this.loadProjects();
    this.route.queryParamMap.subscribe(params => {
      this.rendicionId = params.get('rendicionId');
      const tipo = params.get('tipo') as ExpenseType | null;
      if (tipo) {
        this.setExpenseType(tipo);
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
            this.form.patchValue({
              ...baseValues,
              fechaEmision: fecha,
              rucEmisor: dataObj.rucEmisor || '',
              serie: dataObj.serie || '',
              correlativo: dataObj.correlativo || '',
              placaVehiculo: (res as any).placaVehiculo || dataObj.placaVehiculo || '',
            });
          } else if (type === 'otros_gastos') {
            const description =
              typeof res.data === 'string' && !this.looksLikeJson(res.data)
                ? res.data
                : dataObj.description || dataObj.descripcion || '';
            this.form.patchValue({
              ...baseValues,
              description,
              totalOtros: res.total ?? 0,
              declaracionJurada: true,
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
            this.form.patchValue({
              ...baseValues,
              voucherEntregadoA: dataObj.entregadoA || '',
              voucherDireccion: dataObj.direccion || '',
              voucherConcepto: dataObj.concepto || '',
              voucherFecha: fecha,
              voucherMonto: res.total ?? dataObj.monto ?? 0,
            });
          } else if (type === 'planilla_movilidad') {
            this.form.patchValue(baseValues);
            const rows: any[] = (res as any).mobilityRows || dataObj.rows || [];
            this.mobilityRowsArray.clear();
            for (const row of rows) {
              this.mobilityRowsArray.push(this.fb.group({
                fecha: [row.fecha || '', Validators.required],
                total: [row.total ?? null, [Validators.required, Validators.min(0)]],
                clienteProveedor: [row.clienteProveedor || ''],
                origen: [row.origen || '', Validators.required],
                origenLat: [row.origenCoords?.lat ?? null],
                origenLng: [row.origenCoords?.lng ?? null],
                origenDepartamento: [row.origenDepartamento || '', Validators.required],
                origenProvincia: [row.origenProvincia || '', Validators.required],
                origenDistrito: [row.origenDistrito || '', Validators.required],
                destino: [row.destino || '', Validators.required],
                destinoLat: [row.destinoCoords?.lat ?? null],
                destinoLng: [row.destinoCoords?.lng ?? null],
                destinoDepartamento: [row.destinoDepartamento || '', Validators.required],
                destinoProvincia: [row.destinoProvincia || '', Validators.required],
                destinoDistrito: [row.destinoDistrito || '', Validators.required],
                distanciaKm: [row.distanciaKm ?? null],
                gestion: [row.gestion || ''],
              }));
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
        if (report && report.projectId) {
          const pId = typeof report.projectId === 'string' ? report.projectId : report.projectId._id;
          this.form.patchValue({ proyectId: pId });
          this.form.get('proyectId')?.disable();
        }
      },
      error: (err) => console.error('Error loading report project', err)
    });
  }

  loadCategories() {
    this.invoiceService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {},
    });
  }

  loadProjects() {
    this.invoiceService.getProjects().subscribe({
      next: (projects) => {
        this.proyects = projects;
      },
    });
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
      comentario: [''],
      placaVehiculo: [''],
      // Otros gastos
      totalOtros: [null],
      description: [''],
      declaracionJurada: [false],
      declaracionJuradaFirmante: [''],
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
  }

  addMobilityRow() {
    this.mobilityRowsArray.push(this.fb.group({
      fecha: ['', Validators.required],
      total: [null, [Validators.required, Validators.min(0)]],
      clienteProveedor: [''],
      origen: ['', Validators.required],
      origenLat: [null],
      origenLng: [null],
      origenDepartamento: ['', Validators.required],
      origenProvincia: ['', Validators.required],
      origenDistrito: ['', Validators.required],
      destino: ['', Validators.required],
      destinoLat: [null],
      destinoLng: [null],
      destinoDepartamento: ['', Validators.required],
      destinoProvincia: ['', Validators.required],
      destinoDistrito: ['', Validators.required],
      distanciaKm: [null],
      gestion: [''],
    }));
  }

  onOrigenSelected(result: PlaceResult, index: number) {
    const { dep, prov, dist } = this.resolveLocation(result);
    this.mobilityRowsArray.at(index).patchValue({
      origen: result.address,
      origenLat: result.lat,
      origenLng: result.lng,
      origenDepartamento: dep,
      origenProvincia: prov,
      origenDistrito: dist,
    });
    this.calculateDistance(index);
  }

  onDestinoSelected(result: PlaceResult, index: number) {
    const { dep, prov, dist } = this.resolveLocation(result);
    this.mobilityRowsArray.at(index).patchValue({
      destino: result.address,
      destinoLat: result.lat,
      destinoLng: result.lng,
      destinoDepartamento: dep,
      destinoProvincia: prov,
      destinoDistrito: dist,
    });
    this.calculateDistance(index);
  }

  private resolveLocation(result: PlaceResult): { dep: string; prov: string; dist: string } {
    const dep = this.matchDepartamento(result.departamento);
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

    return { dep, prov, dist };
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
      case 'planilla_movilidad':
        return (
          proyectOk &&
          this.form.get('categoryId')?.valid === true &&
          this.mobilityRowsArray.length > 0 &&
          this.mobilityRowsArray.valid &&
          !this.hasAnyMobilityLimitExceeded()
        );
      case 'otros_gastos':
        return (
          proyectOk &&
          this.form.get('categoryId')?.valid === true &&
          (!!this.id || !!this.form.get('declaracionJurada')?.value) &&
          (this.form.get('totalOtros')?.value > 0)
        );
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
    if (!proyectOk || !this.form.get('categoryId')?.valid) {
      this.notificationService.show('Completa los campos requeridos', 'error');
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
      const payload = {
        proyectId: this.form.get('proyectId')?.value,
        categoryId: this.form.get('categoryId')?.value,
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
    const declaracionJurada = this.form.get('declaracionJurada')?.value;
    const total = this.form.get('totalOtros')?.value;
    const description = this.form.get('description')?.value;

    const proyectCtrl = this.form.get('proyectId');
    const proyectOk = !!(proyectCtrl?.disabled || proyectCtrl?.valid);
    if (!proyectOk || !this.form.get('categoryId')?.valid) {
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
    if (!declaracionJurada) {
      this.notificationService.show('Debes aceptar y firmar la declaración jurada', 'error');
      return;
    }
    const firmante = (currentUser?.name || '').trim();
    if (!total || total <= 0) {
      this.notificationService.show('Ingresa un monto válido', 'error');
      return;
    }

    this.isLoading.set(true);

    const proceed = (imageUrl?: string) => {
      const payload = {
        proyectId: this.form.get('proyectId')?.value,
        categoryId: this.form.get('categoryId')?.value,
        expenseReportId: this.rendicionId || undefined,
        total,
        data: description,
        declaracionJurada: true as const,
        declaracionJuradaFirmante: firmante,
        imageUrl,
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
        this.saveOtherExpense();
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
      const dataObj = {
        ...previousData,
        rucEmisor: formValue.rucEmisor,
        serie: formValue.serie,
        correlativo: formValue.correlativo,
        fechaEmision: this.formatDateForBackend(formValue.fechaEmision),
        ...(razonSocial !== undefined ? { razonSocial } : {}),
      };
      payload.data = JSON.stringify(dataObj);
      payload.fechaEmision = formValue.fechaEmision;
      payload.total = this.originalInvoice.total;
      payload.placaVehiculo = (formValue.placaVehiculo || '').trim() || undefined;
    } else if (type === 'otros_gastos') {
      payload.description = (formValue.description || '').trim();
      payload.total = Number(formValue.totalOtros) || 0;
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
      const dataObj = {
        ...previousData,
        entregadoA: (formValue.voucherEntregadoA || '').trim(),
        direccion: (formValue.voucherDireccion || '').trim(),
        concepto: (formValue.voucherConcepto || '').trim(),
        monto,
      };
      payload.data = JSON.stringify(dataObj);
      payload.fechaEmision = formValue.voucherFecha || undefined;
      payload.total = monto;
    } else if (type === 'planilla_movilidad') {
      const rows = this.mobilityRowsArray.value.map((r: any) => ({
        fecha: r.fecha,
        total: r.total,
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
              comentario: dataObj.comentario || '',
              placaVehiculo: dataObj.placaVehiculo || '',
            });
            this.postOcrInvoiceId.set(res._id);
            this.postOcrBaseInvoice = res;
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
                comentario: dataObj.comentario || '',
                placaVehiculo: dataObj.placaVehiculo || '',
              });
              this.postOcrInvoiceId.set(res._id);
              this.postOcrBaseInvoice = res;
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
    const dataObj = {
      ...baseData,
      rucEmisor: formValue.rucEmisor || '',
      fechaEmision: this.formatDateForBackend(formValue.fechaEmision || ''),
      serie: formValue.serie || '',
      correlativo: formValue.correlativo || '',
      comentario,
      placaVehiculo: (formValue.placaVehiculo || '').trim() || undefined,
      ...(razonSocialOcr !== undefined ? { razonSocial: razonSocialOcr } : {}),
    };
    const updatePayload = {
      proyectId: this.postOcrBaseInvoice.proyectId,
      categoryId: this.postOcrBaseInvoice.categoryId,
      total: this.postOcrBaseInvoice.total,
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
