import { Component, inject, OnInit } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { InvoicesService } from './services/invoices.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { IInvoiceResponse } from './interfaces/invoices.interface';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { CATEGORIES } from './constants/categories';
import { IProject } from './interfaces/project.interface';

@Component({
  selector: 'app-invoices',
  standalone: true,
  imports: [ListTableComponent, TableComponent],
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
      header: 'Total',
      value: 'total',
    },
    {
      header: 'Fecha',
      value: 'date',
    },
    {
      header: 'Acciones',
      value: 'actions',
      options: ['download', 'edit', 'delete'],
    },
  ];

  ngOnInit() {
    // Cargar proyectos primero para que estén disponibles
    this.loadProjects();
  }

  loadProjects() {
    this.agentService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        console.log('Proyectos cargados:', projects);
        // Una vez cargados los proyectos, cargar las facturas
        this.getInvoices();
      },
      error: (error) => {
        console.error('Error al cargar proyectos:', error);
        // Si hay error, cargar las facturas de todas formas
        this.getInvoices();
      },
    });
  }

  getInvoices() {
    this.agentService.getInvoices().subscribe((res) => {
      console.log('Respuesta completa del API:', res);
      this.invoices = this.formatResponse(res);
    });
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
    // Obtener categorías para mapear claves a nombres
    const categories = CATEGORIES;
    const projectList = this.projects;

    return res.map((invoice) => {
      // Verificar la estructura de los datos
      let invoiceData: any = {};

      try {
        if (invoice.data) {
          // Si los datos vienen como string JSON, los parseamos
          if (typeof invoice.data === 'string') {
            try {
              invoiceData = JSON.parse(invoice.data);
              console.log('Datos parseados del JSON:', invoiceData);
            } catch (parseError) {
              console.error('Error al parsear JSON:', parseError);
            }
          }
          // Si los datos ya vienen como objeto, los usamos directamente
          else if (typeof invoice.data === 'object') {
            invoiceData = invoice.data;
            console.log('Datos obtenidos como objeto:', invoiceData);
          }
        }
      } catch (error) {
        console.error('Error general al procesar datos:', error);
      }

      // Buscar la categoría por su clave
      const categoryObj = categories.find((c) => c.key === invoice.category);
      const categoryName = categoryObj ? categoryObj.name : 'No disponible';

      // Buscar el proyecto por su ID
      const projectObj = projectList.find((p) => p._id === invoice.proyect);
      const projectName = projectObj
        ? projectObj.name
        : invoice.proyect || 'No disponible';

      // Acceder a datos con el formato original
      const razonSocial = invoiceData.razonSocial || 'No disponible';
      const direccionEmisor = invoiceData.direccionEmisor || 'No disponible';
      const rucEmisor = invoiceData.rucEmisor || 'No disponible';
      const tipoComprobante = invoiceData.tipoComprobante || 'No disponible';
      const fechaEmision = invoiceData.fechaEmision || 'No disponible';
      const moneda = invoiceData.moneda || '';
      const montoTotal = invoiceData.montoTotal || invoice.total || 0;

      return {
        ...invoice,
        proyect: projectName, // Usamos el nombre del proyecto en lugar del ID
        proyectId: invoice.proyect, // Conservamos el ID en otra propiedad
        category: categoryName,
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
      };
    });
  }

  editInvoice(id: string) {
    this.router.navigate(['/invoices/edit', id]);
  }

  gotToAddInvoice() {
    this.router.navigate(['/invoices/add']);
  }

  clickOptions(option: string, _id: string) {
    if (option === 'delete') {
      this.deleteInvoice(_id);
    }
    if (option === 'edit') {
      this.editInvoice(_id);
    }
    if (option === 'download') {
      this.downloadInvoice(_id);
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
}
