import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { FileDownloadComponent } from '../../components/file-download/file-download.component';
import { ChartsComponent } from './charts/charts.component';
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
  selector: 'app-consolidated-invoices',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DataComponent,
    FileDownloadComponent,
    ChartsComponent,
  ],
  templateUrl: './consolidated-invoices.component.html',
  styleUrl: './consolidated-invoices.component.scss',
})
export class ConsolidatedInvoicesComponent implements OnInit {
  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);

  rejectionReason = signal('');
  selectedInvoiceId = signal('');
  showRejectionModal = signal(false);
  showCategories = signal(true);
  showProjects = signal(true);
  categories: ICategory[] = [];
  projects: IProject[] = [];
  invoices: IInvoice[] = [];
  userInvoices: IInvoice[] = [];
  loading = false;

  projectsWithInvoiceCount: { id: string; name: string; count: number }[] = [];

  headers: IHeaderList[] = [
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
      header: 'Dirección',
      value: 'address',
    },
    {
      header: 'Tipo',
      value: 'tipo',
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
      header: 'Fecha',
      value: 'date',
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
  filterStatus = signal('');

  exportFileType: 'excel' | 'pdf' = 'excel';
  exportColumns = [
    { header: 'Proyecto', field: 'proyect' },
    { header: 'Categoría', field: 'category' },
    { header: 'Razón Social', field: 'provider' },
    { header: 'RUC', field: 'ruc' },
    { header: 'Dirección', field: 'address' },
    { header: 'Tipo', field: 'tipo' },
    { header: 'Serie', field: 'serie' },
    { header: 'Correlativo', field: 'correlativo' },
    { header: 'Total', field: 'total' },
    { header: 'Fecha', field: 'date' },
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

  ngOnInit() {
    this.getProjects();
    const categories$ = this.getCategories();
    if (categories$) {
      categories$.subscribe({
        next: () => {
          this.getInvoices();
        },
        error: (error) => {
          this.notificationService.show(
            'Error al cargar las categorías: ' + error.message,
            'error'
          );
        },
      });
    }
  }

  toggleCategoriesSection() {
    this.showCategories.update((value) => !value);
  }

  toggleProjectsSection() {
    this.showProjects.update((value) => !value);
  }

  goToAddCategory(event: Event) {
    event.stopPropagation();
    this.router.navigate(['/consolidated-invoices/add-category']);
  }

  goToAddProject(event: Event) {
    event.stopPropagation();
    this.router.navigate(['/consolidated-invoices/add-project']);
  }

  editCategory(id: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/consolidated-invoices/edit-category', id]);
  }

  deleteCategory(id: string, event: Event) {
    event.stopPropagation();
    this.confirmationService.confirm({
      title: 'Confirmar eliminación',
      message: '¿Está seguro que desea eliminar esta categoría?',
      accept: () => {
        this.agentService.deleteCategory(id).subscribe({
          next: () => {
            this.categories = this.categories?.filter(
              (category) => category._id !== id
            );
            const categories$ = this.getCategories();
            if (categories$) {
              categories$.subscribe();
            }
            this.notificationService.show(
              'Categoría eliminada correctamente',
              'success'
            );
          },
          error: (error) => {
            this.notificationService.show(
              'Error al eliminar la categoría: ' + error.message,
              'error'
            );
          },
        });
      },
    });
  }

  editProject(id: string, event: Event) {
    event.stopPropagation();
    this.router.navigate(['/consolidated-invoices/edit-project', id]);
  }

  deleteProject(id: string, event: Event) {
    event.stopPropagation();
    this.confirmationService.confirm({
      title: 'Confirmar eliminación',
      message: '¿Está seguro que desea eliminar este proyecto?',
      accept: () => {
        this.agentService.deleteProject(id).subscribe({
          next: () => {
            this.notificationService.show(
              'Proyecto eliminado correctamente',
              'success'
            );
            this.getProjects();
          },
          error: (error) => {
            this.notificationService.show(
              'Error al eliminar el proyecto: ' + error.message,
              'error'
            );
          },
        });
      },
    });
  }

  getInvoices() {
    this.loading = true;

    this.agentService.getInvoices(this.filters()).subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const firstItem = res[0];
          if ('categoryId' in firstItem && 'data' in firstItem) {
            this.invoices = this.formatResponse(res);
            this.calculateProjectsWithInvoiceCount();
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
          this.calculateProjectsWithInvoiceCount();
        }
        this.loading = false;

        // Las facturas del usuario se obtienen automáticamente según la empresa
        this.userInvoices = this.invoices;
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
            } catch (parseError) { }
          } else if (typeof invoice.data === 'object') {
            invoiceData = invoice.data;
          }
        }
      } catch (error) { }

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

  capitalizeFirstLetter(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  editInvoice(id: string) {
    this.router.navigate(['/invoices/edit', id]);
  }

  gotToAddInvoice() {
    this.router.navigate(['/invoices/add']);
  }

  clickOptions(event: { option: string, _id: string }) {
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

  deleteInvoice(id: string) {
    this.agentService.deleteInvoice(id).subscribe({
      next: () => {
        this.notificationService.show(
          'Factura eliminada correctamente',
          'success'
        );
        this.getInvoices();
      },
      error: () => {
        this.notificationService.show('Error al eliminar la factura', 'error');
      },
    });
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
    const payload: ApprovalPayload = {
      status: 'approved',
    };

    this.agentService.approveInvoice(id, payload).subscribe({
      next: () => {
        this.notificationService.show(
          'Factura aprobada correctamente',
          'success'
        );
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
        payload
      )
      .subscribe({
        next: () => {
          this.notificationService.show(
            'Factura rechazada correctamente',
            'success'
          );
          this.closeRejectionModal();
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
    return this.agentService.getCategories().pipe(
      tap({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {
          this.notificationService.show(
            'Error al cargar las categorías: ' + error.message,
            'error'
          );
        },
      })
    );
  }

  getProjects() {
    this.agentService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        this.calculateProjectsWithInvoiceCount();
      },
      error: (error) => {
        this.notificationService.show(
          'Error al cargar los proyectos: ' + error.message,
          'error'
        );
      },
    });
  }

  calculateProjectsWithInvoiceCount() {
    const projectCountMap = new Map<
      string,
      { id: string; name: string; count: number }
    >();

    this.projects.forEach((project) => {
      if (project._id) {
        projectCountMap.set(project._id, {
          id: project._id,
          name: project.name,
          count: 0,
        });
      }
    });

    this.invoices.forEach((invoice) => {
      let projectId = '';
      const pId = invoice.proyectId as any;
      if (pId && typeof pId === 'object' && '_id' in pId) {
        projectId = pId._id || '';
      } else {
        projectId = pId || '';
      }
      const projectName = invoice.proyect;

      if (projectId) {
        if (projectCountMap.has(projectId)) {
          const projectData = projectCountMap.get(projectId)!;
          projectData.count += 1;
          projectCountMap.set(projectId, projectData);
        } else {
          projectCountMap.set(projectId, {
            id: projectId,
            name: projectName,
            count: 1,
          });
        }
      }
    });

    this.projectsWithInvoiceCount = Array.from(projectCountMap.values());
  }

  getStatusName(status?: InvoiceStatus): string {
    if (!status) return 'Pendiente';

    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'approved':
        return 'Aprobada';
      case 'rejected':
        return 'Rechazada';
      default:
        return 'Desconocido';
    }
  }

  exportInvoices(fileType: 'excel' | 'pdf'): void {
    this.exportFileType = fileType;
    setTimeout(() => {
      const exportComponent = document.getElementById(
        'export-consolidated-invoices'
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
}
