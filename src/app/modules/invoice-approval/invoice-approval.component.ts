import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FileDownloadComponent } from '../../components/file-download/file-download.component';
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
import { UserStateService } from '../../services/user-state.service';
import { DataComponent } from '../../components/data/data.component';

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
  imports: [CommonModule, FormsModule, DataComponent, FileDownloadComponent],
  templateUrl: './invoice-approval.component.html',
  styleUrl: './invoice-approval.component.scss',
})
export class InvoiceApprovalComponent implements OnInit {
  private agentService = inject(InvoicesService);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);

  rejectionReason = signal('');
  selectedInvoiceId = signal('');
  showRejectionModal = signal(false);
  categories: ICategory[] = [];
  projects: IProject[] = [];
  invoices: IInvoice[] = [];
  allInvoices = signal<IInvoice[]>([]);
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
  filterStatus = signal(''); // Por defecto mostrar todas las facturas

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
    const approved = invoices.filter(
      (inv) => inv.status === 'approved' || inv.status === 'APPROVED'
    ).length;
    const rejected = invoices.filter(
      (inv) => inv.status === 'rejected' || inv.status === 'REJECTED'
    ).length;
    const pending = invoices.length - approved - rejected; // Todas las demás son pendientes
    const total = invoices.length;

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

    // Cargar todas las facturas sin filtros para estadísticas
    this.agentService.getInvoices().subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const firstItem = res[0];
          if ('categoryId' in firstItem && 'data' in firstItem) {
            const formattedInvoices = this.formatResponse(res);
            this.allInvoices.set(formattedInvoices);
          }
        } else {
          this.allInvoices.set([]);
        }

        // Después de cargar todas las facturas, cargar las filtradas
        this.loadFilteredInvoices();
      },
      error: (error) => {
        this.allInvoices.set([]);
        this.loadFilteredInvoices();
      },
    });
  }

  private loadFilteredInvoices() {
    this.agentService.getInvoices(this.filters()).subscribe({
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
    if (!res || !Array.isArray(res)) {
      return [];
    }
    return res.map((invoice, index) => {
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

      const categoryName = invoice.categoryId?.name || 'No disponible';
      const projectName = invoice.proyectId?.name || 'No disponible';
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
        createdAt: invoice.createdAt
          ? new Date(invoice.createdAt).toLocaleDateString('es-ES', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          : 'No disponible',
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

  clickOptions(event: { option: string; _id: string }) {
    const { option, _id } = event;
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
    const invoice = this.invoices.find((inv) => inv._id === id);
    if (!invoice) {
      this.notificationService.show('Factura no encontrada', 'error');
      return;
    }

    if (invoice.status === 'approved' || invoice.status === 'APPROVED') {
      this.notificationService.show(
        'Esta factura ya ha sido aprobada',
        'error'
      );
      return;
    }

    if (invoice.status === 'rejected' || invoice.status === 'REJECTED') {
      this.notificationService.show(
        'Esta factura ya ha sido rechazada',
        'error'
      );
      return;
    }

    this.confirmationService.confirm({
      title: 'Confirmar aprobación',
      message: '¿Está seguro que desea aprobar esta factura?',
      accept: () => {
        this.approveInvoice(id);
      },
    });
  }

  approveInvoice(id: string) {
    const payload: ApprovalPayload = {
      status: 'approved',
    };

    this.agentService.approveInvoice(id, payload).subscribe({
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
    const invoice = this.invoices.find((inv) => inv._id === id);
    if (!invoice) {
      this.notificationService.show('Factura no encontrada', 'error');
      return;
    }

    if (invoice.status === 'approved' || invoice.status === 'APPROVED') {
      this.notificationService.show(
        'Esta factura ya ha sido aprobada',
        'error'
      );
      return;
    }

    if (invoice.status === 'rejected' || invoice.status === 'REJECTED') {
      this.notificationService.show(
        'Esta factura ya ha sido rechazada',
        'error'
      );
      return;
    }

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

    this.agentService.rejectInvoice(id, payload).subscribe({
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
    this.agentService.getCategories().subscribe({
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
    this.agentService.getProjects().subscribe({
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
      case 'sunat_valid':
        return 'Válido SUNAT';
      case 'sunat_valid_not_ours':
        return 'Válido - No Pertenece';
      case 'sunat_not_found':
        return 'No Encontrado SUNAT';
      case 'sunat_error':
        return 'Error SUNAT';
      default:
        return status; // Mostrar el estado original si no coincide con ningún caso
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
    this.filterStatus.set('');
    this.getInvoices();
  }

  private debugStats() {
    const invoices = this.allInvoices();
    const statusCounts = invoices.reduce((acc, inv) => {
      const status = inv.status || 'undefined';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
