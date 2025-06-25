import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { FileDownloadComponent } from '../../components/file-download/file-download.component';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { InvoicesService } from '../invoices/services/invoices.service';
import {
  IInvoiceResponse,
  ApprovalPayload,
  InvoiceStatus,
} from '../invoices/interfaces/invoices.interface';
import { ICategory } from '../invoices/interfaces/category.interface';
import { IProject } from '../invoices/interfaces/project.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { tap } from 'rxjs/operators';
import { UserStateService } from '../../services/user-state.service';

interface IInvoice {
  _id?: string;
  proyect: string;
  proyectId?: string | IProject;
  category: string;
  categoryKey?: string;
  file: string;
  createdAt: string;
  updatedAt: string;
  total: string | number;
  userId?: string;

  ruc?: string;
  tipo?: string;
  address?: string;
  provider?: string;
  date?: string;

  rucEmisor?: string;
  tipoComprobante?: string;
  serie?: string;
  correlativo?: string;
  fechaEmision?: string;
  moneda?: string;
  montoTotal?: number;
  razonSocial?: string;
  direccionEmisor?: string;

  status?: InvoiceStatus;
  statusDate?: string;
  approvedBy?: string;
  rejectedBy?: string;
  rejectionReason?: string;
}

@Component({
  selector: 'app-invoice-approval',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableComponent,
    ListTableComponent,
    FileDownloadComponent,
  ],
  templateUrl: './invoice-approval.component.html',
  styleUrl: './invoice-approval.component.scss',
})
export class InvoiceApprovalComponent implements OnInit {
  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);

  rejectionReason = signal('');
  selectedInvoiceId = signal('');
  showRejectionModal = signal(false);
  categories: ICategory[] = [];
  projects: IProject[] = [];
  invoices: IInvoice[] = [];
  allInvoices = signal<IInvoice[]>([]); // Para estadísticas sin filtrar - ahora es un signal
  loading = false;

  headers: IHeaderList[] = [
    {
      header: 'Fecha',
      value: 'date',
    },
    {
      header: 'Proyecto',
      value: 'proyect',
    },
    {
      header: 'Categoría',
      value: 'category',
    },
    {
      header: 'Razón Social',
      value: 'provider',
    },
    {
      header: 'RUC',
      value: 'ruc',
    },
    {
      header: 'Serie',
      value: 'serie',
    },
    {
      header: 'Correlativo',
      value: 'correlativo',
    },
    {
      header: 'Total',
      value: 'total',
    },
    {
      header: 'Estado',
      value: 'status',
    },
    {
      header: 'Acciones',
      value: 'actions',
      options: ['download', 'approve', 'reject'],
    },
  ];

  filterProject = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterCategory = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');
  filterStatus = signal('pending'); // Por defecto mostrar solo pendientes

  exportFileType: 'excel' | 'pdf' = 'excel';
  exportColumns = [
    { header: 'Fecha', field: 'date' },
    { header: 'Proyecto', field: 'proyect' },
    { header: 'Categoría', field: 'category' },
    { header: 'Razón Social', field: 'provider' },
    { header: 'RUC', field: 'ruc' },
    { header: 'Serie', field: 'serie' },
    { header: 'Correlativo', field: 'correlativo' },
    { header: 'Total', field: 'total' },
    { header: 'Estado', field: 'status' },
  ];

  filters = computed(() => ({
    projectId: this.filterProject(),
    categoryId: this.filterCategory(),
    status: this.filterStatus(),
    dateFrom: this.filterDateFrom(),
    dateTo: this.filterDateTo(),
    amountMin: this.filterAmountMin(),
    amountMax: this.filterAmountMax(),
  }));

  // Estadísticas calculadas (siempre sobre todas las facturas, no filtradas)
  stats = computed(() => {
    const invoices = this.allInvoices();
    const pending = invoices.filter(
      (inv) =>
        inv.status === 'pending' || inv.status === 'PENDING' || !inv.status
    ).length;
    const approved = invoices.filter(
      (inv) => inv.status === 'approved' || inv.status === 'APPROVED'
    ).length;
    const rejected = invoices.filter(
      (inv) => inv.status === 'rejected' || inv.status === 'REJECTED'
    ).length;
    const total = invoices.length;

    console.log('Calculando estadísticas:', {
      total,
      pending,
      approved,
      rejected,
      allInvoicesLength: invoices.length,
      statuses: invoices.map((inv) => inv.status),
    });

    return { pending, approved, rejected, total };
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.getProjects();
    this.getCategories();
    this.getInvoices();
  }

  getInvoices() {
    this.loading = true;
    const user = this.userStateService.getUser();
    const companyId = user?.companyId;
    if (!companyId) {
      this.notificationService.show(
        'No se encontró companyId en el usuario',
        'error'
      );
      this.loading = false;
      return;
    }

    // Cargar todas las facturas sin filtros para estadísticas
    this.agentService.getInvoices(companyId, {}).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const firstItem = res[0];
          if ('categoryId' in firstItem && 'data' in firstItem) {
            const formattedInvoices = this.formatResponse(res);
            this.allInvoices.set(formattedInvoices);
            console.log(
              'Facturas cargadas para estadísticas:',
              formattedInvoices.length
            );
            console.log(
              'Estados encontrados:',
              formattedInvoices.map((inv) => inv.status)
            );
            this.debugStats();
          }
        } else {
          this.allInvoices.set([]);
        }

        // Después de cargar todas las facturas, cargar las filtradas
        this.loadFilteredInvoices(companyId);
      },
      error: (error) => {
        console.error('Error cargando todas las facturas:', error);
        this.allInvoices.set([]);
        this.loadFilteredInvoices(companyId);
      },
    });
  }

  private loadFilteredInvoices(companyId: string) {
    this.agentService.getInvoices(companyId, this.filters()).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const firstItem = res[0];
          if ('categoryId' in firstItem && 'data' in firstItem) {
            this.invoices = this.formatResponse(res);
          } else {
            const anyItem = firstItem as any;
            if (anyItem.key && anyItem.name) {
              this.notificationService.show(
                'Error: Los datos recibidos no son facturas',
                'error'
              );
            }
          }
        } else {
          this.invoices = [];
        }
        this.loading = false;
      },
      error: (error) => {
        this.invoices = [];
        this.loading = false;
        this.notificationService.show(
          'Error al cargar las facturas: ' + error.message,
          'error'
        );
      },
    });
  }

  formatResponse(res: IInvoiceResponse[]) {
    return res.map((invoice) => {
      let invoiceData: any = {};

      try {
        if (invoice.data) {
          if (typeof invoice.data === 'string') {
            try {
              invoiceData = JSON.parse(invoice.data);
            } catch (parseError) {}
          } else if (typeof invoice.data === 'object') {
            invoiceData = invoice.data;
          }
        }
      } catch (error) {}

      const categoryName = invoice.categoryId.name || 'No disponible';
      const projectName = invoice.proyectId.name || 'No disponible';
      const razonSocial = invoiceData.razonSocial || 'No disponible';
      const direccionEmisor = invoiceData.direccionEmisor || 'No disponible';
      const rucEmisor = invoiceData.rucEmisor || 'No disponible';
      const tipoComprobante = invoiceData.tipoComprobante || 'No disponible';
      const fechaEmision = invoiceData.fechaEmision || 'No disponible';
      const moneda = invoiceData.moneda || '';
      const montoTotal = invoiceData.montoTotal || invoice.total || 0;
      const serie = invoiceData.serie || 'No disponible';
      const correlativo = invoiceData.correlativo || 'No disponible';

      const formattedTotal = moneda
        ? `${moneda} ${montoTotal}`
        : montoTotal.toString();

      const processedInvoice = {
        _id: invoice._id,
        proyect: projectName,
        proyectId: invoice.proyectId,
        category: categoryName,
        categoryKey: invoice.category,
        file: invoice.file,
        data: invoice.data,
        createdAt: new Date(invoice.createdAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        updatedAt: invoice.updatedAt,
        total: formattedTotal,

        status: invoice.status || 'pending',
        statusDate: invoice.statusDate,
        approvedBy: invoice.approvedBy,
        rejectedBy: invoice.rejectedBy,
        rejectionReason: invoice.rejectionReason,

        ruc: rucEmisor,
        rucEmisor: rucEmisor,
        tipo: tipoComprobante,
        tipoComprobante: tipoComprobante,
        address: direccionEmisor,
        direccionEmisor: direccionEmisor,
        provider: razonSocial,
        razonSocial: razonSocial,
        date: fechaEmision,
        fechaEmision: fechaEmision,
        moneda: moneda,
        montoTotal: montoTotal,
        serie: serie,
        correlativo: correlativo,
      };

      return processedInvoice;
    });
  }

  clickOptions(option: string, _id: string) {
    switch (option) {
      case 'download':
        this.downloadInvoice(_id);
        break;
      case 'approve':
        this.confirmApproveInvoice(_id);
        break;
      case 'reject':
        this.openRejectionModal(_id);
        break;
    }
  }

  downloadInvoice(id: string) {
    const url = this.invoices.find((invoice) => invoice._id === id)?.file;
    if (url) {
      window.open(url, '_blank');
    } else {
      this.notificationService.show('No se pudo descargar la factura', 'error');
    }
  }

  confirmApproveInvoice(id: string) {
    this.confirmationService.confirm({
      title: 'Confirmar aprobación',
      message: '¿Está seguro que desea aprobar esta factura?',
      accept: () => {
        this.approveInvoice(id);
      },
    });
  }

  approveInvoice(id: string) {
    const companyId = this.userStateService.getUser()?.companyId || '';
    const payload: ApprovalPayload = {
      status: 'approved',
    };

    this.agentService.approveInvoice(id, companyId, payload).subscribe({
      next: () => {
        this.notificationService.show(
          'Factura aprobada correctamente',
          'success'
        );
        // Recargar datos para actualizar estadísticas
        this.getInvoices();
      },
      error: (error) => {
        this.notificationService.show(
          'Error al aprobar la factura: ' + error.message,
          'error'
        );
      },
    });
  }

  openRejectionModal(id: string) {
    this.selectedInvoiceId.set(id);
    this.rejectionReason.set('');
    this.showRejectionModal.set(true);
  }

  closeRejectionModal() {
    this.showRejectionModal.set(false);
  }

  submitRejection() {
    if (!this.rejectionReason()) {
      this.notificationService.show(
        'Debe ingresar un motivo de rechazo',
        'error'
      );
      return;
    }

    const id = this.selectedInvoiceId();
    const payload: ApprovalPayload = {
      status: 'rejected',
      reason: this.rejectionReason(),
    };

    this.agentService
      .rejectInvoice(
        id,
        this.userStateService.getUser()?.companyId || '',
        payload
      )
      .subscribe({
        next: () => {
          this.notificationService.show(
            'Factura rechazada correctamente',
            'success'
          );
          this.closeRejectionModal();
          // Recargar datos para actualizar estadísticas
          this.getInvoices();
        },
        error: (error) => {
          this.notificationService.show(
            'Error al rechazar la factura: ' + error.message,
            'error'
          );
        },
      });
  }

  get filteredInvoices() {
    return this.invoices;
  }

  getCategories() {
    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) {
      this.notificationService.show(
        'No se encontró companyId en el usuario',
        'error'
      );
      return;
    }
    this.agentService.getCategories(companyId).subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {
        this.notificationService.show(
          'Error al cargar las categorías: ' + error.message,
          'error'
        );
      },
    });
  }

  getProjects() {
    const companyId = this.userStateService.getUser()?.companyId;
    if (!companyId) {
      this.notificationService.show(
        'No se encontró companyId en el usuario',
        'error'
      );
      return;
    }
    this.agentService.getProjects(companyId).subscribe({
      next: (projects) => {
        this.projects = projects;
      },
      error: (error) => {
        this.notificationService.show(
          'Error al cargar los proyectos: ' + error.message,
          'error'
        );
      },
    });
  }

  getStatusName(status?: InvoiceStatus): string {
    if (!status) return 'Pendiente';

    switch (status) {
      case 'pending':
      case 'PENDING':
        return 'Pendiente';
      case 'approved':
      case 'APPROVED':
        return 'Aprobada';
      case 'rejected':
      case 'REJECTED':
        return 'Rechazada';
      default:
        return 'Desconocido';
    }
  }

  exportInvoices(fileType: 'excel' | 'pdf'): void {
    this.exportFileType = fileType;
    setTimeout(() => {
      const exportComponent = document.getElementById(
        'export-invoice-approval'
      );
      if (
        exportComponent &&
        typeof (exportComponent as any).downloadFile === 'function'
      ) {
        (exportComponent as any).downloadFile();
      } else {
        console.error(
          'Componente de descarga no encontrado o método no disponible'
        );
      }
    }, 100);
  }

  clearFilters() {
    this.filterProject.set('');
    this.filterDateFrom.set('');
    this.filterDateTo.set('');
    this.filterCategory.set('');
    this.filterAmountMin.set('');
    this.filterAmountMax.set('');
    this.filterStatus.set('pending');
    this.getInvoices();
  }

  private debugStats() {
    console.log('=== DEBUG STATS ===');
    const invoices = this.allInvoices();
    console.log('Total facturas:', invoices.length);

    const statusCounts = invoices.reduce((acc, inv) => {
      const status = inv.status || 'undefined';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log('Conteo por estado:', statusCounts);
    console.log('Stats calculados:', this.stats());
    console.log('==================');
  }
}
