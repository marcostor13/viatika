import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
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

interface IInvoice {
  _id?: string;
  proyect: string;
  proyectId?: string;
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
  imports: [CommonModule, FormsModule, TableComponent, ListTableComponent],
  templateUrl: './consolidated-invoices.component.html',
  styleUrl: './consolidated-invoices.component.scss',
})
export class ConsolidatedInvoicesComponent implements OnInit {
  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

  private currentUserId = '1';

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

  ngOnInit() {
    this.getProjects();
    this.getCategories().subscribe({
      next: () => {
        this.getInvoices();
      },
      error: (error) => {
        this.getInvoices();
      },
    });
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
            this.categories = this.categories.filter(
              (category) => category._id !== id
            );

            this.notificationService.show(
              'Categoría eliminada correctamente',
              'success'
            );

            this.getCategories().subscribe();
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
    this.agentService.getInvoices().subscribe({
      next: (res) => {
        if (res && res.length > 0) {
          const firstItem = res[0];
          if ('category' in firstItem && 'data' in firstItem) {
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

        if (this.currentUserId) {
          this.userInvoices = this.invoices.filter(
            (invoice) => invoice.userId === this.currentUserId
          );
        }
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
    const categories = this.categories;
    const projectList = this.projects;
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

      const categoryObj = categories.find((c) => c.key === invoice.category);
      const categoryName = categoryObj
        ? categoryObj.name
        : this.capitalizeFirstLetter(invoice.category) || 'No disponible';

      const projectObj = projectList.find((p) => p._id === invoice.proyect);
      const projectName = projectObj
        ? projectObj.name
        : invoice.proyect || 'No disponible';
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
        proyectId: invoice.proyect,
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
      userId: this.currentUserId,
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
      userId: this.currentUserId,
      reason: this.rejectionReason(),
    };

    this.agentService.rejectInvoice(id, payload).subscribe({
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
    return this.invoices.filter((inv) => {
      const matchesProject = this.filterProject()
        ? inv.proyect === this.filterProject()
        : true;
      const matchesCategory = this.filterCategory()
        ? inv.category === this.filterCategory()
        : true;
      const matchesStatus = this.filterStatus()
        ? inv.status === this.filterStatus()
        : true;
      const date = new Date(inv.createdAt.split('/').reverse().join('-'));
      const from = this.filterDateFrom()
        ? new Date(this.filterDateFrom())
        : null;
      const to = this.filterDateTo() ? new Date(this.filterDateTo()) : null;
      const matchesFrom = from ? date >= from : true;
      const matchesTo = to ? date <= to : true;
      const amount =
        parseFloat(inv.total?.toString().replace(/[^\d.]/g, '')) || 0;
      const min = this.filterAmountMin()
        ? parseFloat(this.filterAmountMin())
        : null;
      const max = this.filterAmountMax()
        ? parseFloat(this.filterAmountMax())
        : null;
      const matchesMin = min !== null ? amount >= min : true;
      const matchesMax = max !== null ? amount <= max : true;
      return (
        matchesProject &&
        matchesCategory &&
        matchesStatus &&
        matchesFrom &&
        matchesTo &&
        matchesMin &&
        matchesMax
      );
    });
  }

  getCategories() {
    return this.agentService.getCategories().pipe(
      tap({
        next: (categories) => {
          this.categories = categories;
        },
        error: (error) => {},
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
      const projectId = invoice.proyectId as string;
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
}
