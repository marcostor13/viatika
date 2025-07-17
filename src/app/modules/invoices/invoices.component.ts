import { Component, inject, OnInit } from '@angular/core';
import { FileDownloadComponent } from '../../components/file-download/file-download.component';
import { InvoicesService } from './services/invoices.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import {
  IInvoiceResponse,
  InvoiceStatus,
} from './interfaces/invoices.interface';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { IProject } from './interfaces/project.interface';
import { DataComponent } from '../../components/data/data.component';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [DataComponent, FileDownloadComponent],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss',
})
export default class InvoicesComponent implements OnInit {
  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

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
      header: 'Estado Sunat',
      value: 'status',
    },
    {
      header: 'Acciones',
      value: 'actions',
      options: ['download', 'edit', 'delete'],
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
  ];

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    this.agentService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
      },
      complete: () => {
        this.getInvoices();
      },
    });
  }

  getInvoices() {
    this.agentService.getInvoices().subscribe((res) => {
      this.invoices = this.formatResponse(res);
    })
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
            } catch (parseError) { }
          } else if (typeof invoice.data === 'object') {
            invoiceData = invoice.data;
          }
        }
      } catch (error) { }

      const razonSocial = invoiceData.razonSocial || 'No disponible';
      const direccionEmisor = invoiceData.direccionEmisor || 'No disponible';
      const rucEmisor = invoiceData.rucEmisor || 'No disponible';
      const tipoComprobante = invoiceData.tipoComprobante || 'No disponible';
      const fechaEmision = invoiceData.fechaEmision || 'No disponible';
      const moneda = invoiceData.moneda || '';
      const montoTotal = invoiceData.montoTotal || invoice.total || 0;
      const serie = invoiceData.serie || 'No disponible';
      const correlativo = invoiceData.correlativo || 'No disponible';

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
      };
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
      case 'edit':
        this.router.navigate(['/invoices/edit', _id]);
        break;
      case 'delete':
        this.confirmationService.show('¿Desea eliminar esta factura?', () => {
          this.deleteInvoice(_id);
        });
        break;
      case 'download':
        this.downloadInvoice(_id);
        break;
    }
  }

  approveInvoice(id: string) {
    const payload = {
      status: 'approved' as InvoiceStatus,
    };

    this.agentService.approveInvoice(id, payload).subscribe({
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
    const payload = {
      status: 'rejected' as InvoiceStatus,
      reason: reason,
    };

    this.agentService.rejectInvoice(id, payload).subscribe({
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
