import { Component, inject, OnInit } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { FileDownloadComponent } from '../../components/file-download/file-download.component';
import { InvoicesService } from './services/invoices.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import {
  IInvoiceResponse,
  InvoiceStatus,
  SunatValidationInfo,
} from './interfaces/invoices.interface';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { IProject } from './interfaces/project.interface';
import { UserStateService } from '../../services/user-state.service';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [ListTableComponent, TableComponent, FileDownloadComponent],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss',
})
export default class InvoicesComponent implements OnInit {
  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);

  invoices: IInvoiceResponse[] = [];
  projects: IProject[] = [];

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
      header: 'SUNAT',
      value: 'sunatStatus',
    },
    {
      header: 'Acciones',
      value: 'actions',
      options: ['download', 'edit', 'delete', 'sunat-info'],
    },
  ];

  exportFileType: 'excel' | 'pdf' = 'excel';
  exportColumns = [
    { header: 'Proyecto', field: 'proyect' },
    { header: 'Categoría', field: 'category' },
    { header: 'Razón Social', field: 'provider' },
    { header: 'RUC', field: 'ruc' },
    { header: 'Dirección', field: 'address' },
    { header: 'Tipo', field: 'tipo' },
    { header: 'Total', field: 'total' },
    { header: 'Fecha', field: 'date' },
    { header: 'Estado', field: 'status' },
    { header: 'SUNAT', field: 'sunatStatus' },
  ];

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    const companyId = this.userStateService.getUser()?.companyId;
    if (companyId) {
      this.agentService.getProjects(companyId).subscribe({
        next: (projects) => {
          this.projects = projects;
          this.getInvoices();
        },
        error: (error) => {
          this.getInvoices();
        },
      });
    } else {
      this.getInvoices();
    }
  }

  getInvoices() {
    const companyId = this.userStateService.getUser()?.companyId;
    if (companyId) {
      this.agentService.getInvoices(companyId).subscribe((res) => {
        this.invoices = this.formatResponse(res);
      });
    } else {
      this.getInvoices();
    }
  }

  downloadInvoice(_id: string) {
    const url = this.invoices.find((invoice) => invoice._id === _id)?.file;
    if (url) {
      window.open(url, '_blank');
    } else {
      this.notificationService.show('No se pudo descargar la factura', 'error');
    }
  }

  formatResponse(res: IInvoiceResponse[]): IInvoiceResponse[] {
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

      const razonSocial = invoiceData.razonSocial || 'No disponible';
      const direccionEmisor = invoiceData.direccionEmisor || 'No disponible';
      const rucEmisor = invoiceData.rucEmisor || 'No disponible';
      const tipoComprobante = invoiceData.tipoComprobante || 'No disponible';
      const fechaEmision = invoiceData.fechaEmision || 'No disponible';
      const moneda = invoiceData.moneda || '';
      const montoTotal = invoiceData.montoTotal || invoice.total || 0;
      const serie = invoiceData.serie || 'No disponible';
      const correlativo = invoiceData.correlativo || 'No disponible';

      // Información de validación SUNAT
      const sunatValidation = invoiceData.sunatValidation;
      const sunatStatus = this.formatSunatStatus(
        invoice.status || 'pending',
        sunatValidation
      );

      return {
        ...invoice,
        proyect: invoice.proyectId?.name || 'No disponible',
        category: invoice.categoryId?.name || 'No disponible',
        ruc: rucEmisor,
        tipo: tipoComprobante,
        createdAt: new Date(invoice.createdAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        total: moneda ? `${moneda} ${montoTotal}` : montoTotal.toString(),
        address: direccionEmisor,
        provider: razonSocial,
        date: fechaEmision,
        status: invoice.status || 'pending',
        serie,
        correlativo,
        sunatStatus,
      };
    });
  }

  capitalizeFirstLetter(text: string): string {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  }

  formatSunatStatus(
    status: string,
    sunatValidation?: any
  ): { text: string; icon: string; color: string } {
    switch (status) {
      case 'sunat_valid':
        return { text: 'Válido', icon: 'check', color: 'green' };
      case 'sunat_valid_not_ours':
        return {
          text: 'Válido (No pertenece)',
          icon: 'warning',
          color: 'yellow',
        };
      case 'sunat_not_found':
        return { text: 'No encontrado', icon: 'x', color: 'red' };
      case 'sunat_error':
        return { text: 'Error SUNAT', icon: 'x', color: 'red' };
      default:
        return { text: 'Sin validar', icon: 'question', color: 'gray' };
    }
  }

  editInvoice(id: string) {
    this.router.navigate(['/invoices/edit', id]);
  }

  gotToAddInvoice() {
    this.router.navigate(['/invoices/add']);
  }

  clickOptions(option: string, id: string) {
    switch (option) {
      case 'edit':
        this.router.navigate(['/invoices/edit', id]);
        break;
      case 'delete':
        this.confirmationService.show('¿Desea eliminar esta factura?', () => {
          this.deleteInvoice(id);
        });
        break;
      case 'download':
        this.downloadInvoice(id);
        break;
      case 'sunat-info':
        this.showSunatInfo(id);
        break;
    }
  }

  showSunatInfo(id: string) {
    const companyId = this.userStateService.getUser()?.companyId;
    if (companyId) {
      this.agentService.getSunatValidation(id, companyId).subscribe({
        next: (validationInfo: SunatValidationInfo) => {
          this.displaySunatValidationInfo(validationInfo);
        },
        error: (error) => {
          this.notificationService.show(
            'Error al obtener información de SUNAT',
            'error'
          );
          console.error('Error fetching SUNAT validation:', error);
        },
      });
    }
  }

  displaySunatValidationInfo(info: SunatValidationInfo) {
    const statusMessage = this.formatSunatStatus(info.status);

    // Usar la notificación existente para mostrar información básica
    let shortMessage = `${statusMessage.text} - ${info.message}`;

    if (info.extractedData && info.extractedData.rucEmisor) {
      shortMessage += ` | RUC: ${info.extractedData.rucEmisor}`;
    }

    // Determinar el tipo de notificación basado en el estado - solo success o error
    const isError =
      info.status === 'sunat_error' ||
      info.status === 'sunat_not_found' ||
      info.status === 'sunat_valid_not_ours';

    this.notificationService.show(shortMessage, isError ? 'error' : 'success');

    // Para detalles completos, mantener el alert temporal
    // TODO: Se puede reemplazar con un modal personalizado más adelante
    if (info.sunatValidation?.details) {
      console.log('Detalles completos de SUNAT:', info);
    }
  }

  approveInvoice(id: string) {
    const companyId = this.userStateService.getUser()?.companyId || '';
    const payload = {
      status: 'approved' as InvoiceStatus,
    };

    this.agentService.approveInvoice(id, companyId, payload).subscribe({
      next: () => {
        this.notificationService.show(
          'Factura aprobada correctamente',
          'success'
        );
        this.getInvoices();
      },
      error: () => {
        this.notificationService.show('Error al aprobar la factura', 'error');
      },
    });
  }

  rejectInvoice(id: string, reason: string) {
    const companyId = this.userStateService.getUser()?.companyId || '';
    const payload = {
      status: 'rejected' as InvoiceStatus,
      reason: reason,
    };

    this.agentService.rejectInvoice(id, companyId, payload).subscribe({
      next: () => {
        this.notificationService.show(
          'Factura rechazada correctamente',
          'success'
        );
        this.getInvoices();
      },
      error: () => {
        this.notificationService.show('Error al rechazar la factura', 'error');
      },
    });
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

  exportInvoices(fileType: 'excel' | 'pdf'): void {
    this.exportFileType = fileType;
    setTimeout(() => {
      const exportComponent = document.getElementById('export-invoices');
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
