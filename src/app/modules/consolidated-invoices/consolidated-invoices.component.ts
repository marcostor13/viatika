import { Component, inject, signal, OnInit } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { InvoicesService } from '../invoices/services/invoices.service';
import { IInvoiceResponse } from '../invoices/interfaces/invoices.interface';
import { ICategory } from '../invoices/interfaces/category.interface';
import { IProject } from '../invoices/interfaces/project.interface';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { tap } from 'rxjs/operators';

interface IInvoice {
  _id?: string;
  proyect: string;
  category: string;
  file: string;
  createdAt: string;
  updatedAt: string;
  total: string | number;

  // Propiedades adicionales formateadas
  ruc?: string;
  tipo?: string;
  address?: string;
  provider?: string;
  date?: string;

  // Propiedades originales del JSON
  rucEmisor?: string;
  tipoComprobante?: string;
  serie?: string;
  correlativo?: string;
  fechaEmision?: string;
  moneda?: string;
  montoTotal?: number;
  razonSocial?: string;
  direccionEmisor?: string;
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

  // Propiedades para las secciones desplegables
  showCategories = signal(true);
  showProjects = signal(true);

  // Datos para las tablas
  categories: ICategory[] = [];
  projects: IProject[] = [];

  invoices: IInvoice[] = [];
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
      header: 'Acciones',
      value: 'actions',
      options: ['download'],
    },
  ];

  filterProject = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterCategory = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');

  ngOnInit() {
    // Cargar proyectos independientemente
    this.getProjects();

    // Cargar categorías primero y luego facturas para asegurar que tenemos
    // la información de categorías disponible al procesar las facturas
    this.getCategories().subscribe({
      next: () => {
        this.getInvoices();
      },
      error: (error) => {
        console.error('Error al cargar categorías:', error);
        // Cargar facturas incluso si hay error en categorías
        this.getInvoices();
      },
    });
  }

  // Métodos para toggle de secciones
  toggleCategoriesSection() {
    this.showCategories.update((value) => !value);
  }

  toggleProjectsSection() {
    this.showProjects.update((value) => !value);
  }

  // Navegación a páginas de creación
  goToAddCategory(event: Event) {
    event.stopPropagation(); // Evitar que el click llegue al contenedor y cierre la sección
    this.router.navigate(['/consolidated-invoices/add-category']);
  }

  goToAddProject(event: Event) {
    event.stopPropagation(); // Evitar que el click llegue al contenedor y cierre la sección
    this.router.navigate(['/consolidated-invoices/add-project']);
  }

  // Métodos para edición de categorías
  editCategory(id: string, event: Event) {
    event.stopPropagation(); // Evitar que el click llegue al contenedor y cierre la sección
    this.router.navigate(['/consolidated-invoices/edit-category', id]);
  }

  deleteCategory(id: string, event: Event) {
    event.stopPropagation(); // Evitar que el click llegue al contenedor y cierre la sección
    this.confirmationService.confirm({
      title: 'Confirmar eliminación',
      message: '¿Está seguro que desea eliminar esta categoría?',
      accept: () => {
        this.agentService.deleteCategory(id).subscribe({
          next: () => {
            this.notificationService.show(
              'Categoría eliminada correctamente',
              'success'
            );
            this.getCategories(); // Recargar la lista
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

  // Métodos para edición de proyectos
  editProject(id: string, event: Event) {
    event.stopPropagation(); // Evitar que el click llegue al contenedor y cierre la sección
    this.router.navigate(['/consolidated-invoices/edit-project', id]);
  }

  deleteProject(id: string, event: Event) {
    event.stopPropagation(); // Evitar que el click llegue al contenedor y cierre la sección
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
            this.getProjects(); // Recargar la lista
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
    console.log('------------ INICIANDO OBTENCIÓN DE FACTURAS ------------');
    this.agentService.getInvoices().subscribe({
      next: (res) => {
        console.log(
          'API: Datos completos de FACTURAS recibidos (consolidated-invoices):',
          res
        );

        // Verificar si lo que recibimos son realmente facturas
        if (res && res.length > 0) {
          const firstItem = res[0];
          console.log(
            'API: Primera FACTURA recibida (consolidated-invoices):',
            firstItem
          );

          // Verificar por propiedades características de facturas
          if ('category' in firstItem && 'data' in firstItem) {
            console.log('API: Confirmado que son datos de FACTURAS');
            this.invoices = this.formatResponse(res);
          } else {
            // Verificar si parece categoría (no podemos usar propiedades directamente por el tipado)
            const anyItem = firstItem as any;
            if (anyItem.key && anyItem.name) {
              console.error(
                'ERROR: Los datos recibidos parecen ser categorías, no facturas'
              );
              this.notificationService.show(
                'Error: Los datos recibidos no son facturas',
                'error'
              );
            }
          }
        } else {
          console.log('API: No se recibieron facturas');
          this.invoices = [];
        }
      },
      error: (error) => {
        console.error('Error al cargar facturas:', error);
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
      // Verificar la estructura de los datos
      let invoiceData: any = {};

      try {
        if (invoice.data) {
          // Si los datos vienen como string JSON, los parseamos
          if (typeof invoice.data === 'string') {
            try {
              invoiceData = JSON.parse(invoice.data);
              console.log(
                '%c [CONSOLIDATED-INVOICES] Datos parseados del JSON:',
                'background: #ff9800; color: white; padding: 2px 5px; border-radius: 3px;',
                invoiceData
              );
            } catch (parseError) {
              console.error('Error al parsear JSON:', parseError);
            }
          }
          // Si los datos ya vienen como objeto, los usamos directamente
          else if (typeof invoice.data === 'object') {
            invoiceData = invoice.data;
            console.log(
              '%c [CONSOLIDATED-INVOICES] Datos obtenidos como objeto:',
              'background: #4caf50; color: white; padding: 2px 5px; border-radius: 3px;',
              invoiceData
            );
          }
        }
      } catch (error) {
        console.error('Error general al procesar datos:', error);
      }

      // Buscar la categoría por su clave
      const categoryObj = categories.find((c) => c.key === invoice.category);
      const categoryName = categoryObj
        ? categoryObj.name
        : invoice.category || 'No disponible';

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
      const serie = invoiceData.serie || 'No disponible';
      const correlativo = invoiceData.correlativo || 'No disponible';

      // Formatear el total para mostrar
      const formattedTotal = moneda
        ? `${moneda} ${montoTotal}`
        : montoTotal.toString();

      // Objeto factura procesado con todas las propiedades necesarias
      const processedInvoice = {
        _id: invoice._id,
        proyect: projectName, // Usamos el nombre del proyecto en lugar del ID
        proyectId: invoice.proyect, // Conservamos el ID en otra propiedad por si es necesario
        category: categoryName,
        file: invoice.file,
        data: invoice.data,
        createdAt: new Date(invoice.createdAt).toLocaleDateString('es-ES', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }),
        updatedAt: invoice.updatedAt,
        total: formattedTotal,

        // Propiedades para la visualización en la tabla y originales combinadas
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

      // Log para debugging
      console.log(
        '%c [CONSOLIDATED-INVOICES] Factura procesada:',
        'background: #2196f3; color: white; padding: 2px 5px; border-radius: 3px;',
        processedInvoice
      );

      return processedInvoice;
    });
  }

  editInvoice(id: string) {
    this.router.navigate(['/invoices/edit', id]);
  }

  gotToAddInvoice() {
    this.router.navigate(['/invoices/add']);
  }

  clickOptions(option: string, _id: string) {
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

  downloadInvoice(id: string) {
    const url = this.invoices.find((invoice) => invoice._id === id)?.file;
    if (url) {
      window.open(url, '_blank');
    } else {
      this.notificationService.show('No se pudo descargar la factura', 'error');
    }
  }

  get filteredInvoices() {
    return this.invoices.filter((inv) => {
      const matchesProject = this.filterProject()
        ? inv.proyect
            ?.toLowerCase()
            .includes(this.filterProject().toLowerCase())
        : true;
      const matchesCategory = this.filterCategory()
        ? inv.category === this.filterCategory()
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
        matchesFrom &&
        matchesTo &&
        matchesMin &&
        matchesMax
      );
    });
  }

  // Métodos para obtener datos
  getCategories() {
    return this.agentService.getCategories().pipe(
      tap({
        next: (categories) => {
          this.categories = categories;
          console.log('Categorías cargadas:', categories);
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
      },
      error: (error) => {
        this.notificationService.show(
          'Error al cargar los proyectos: ' + error.message,
          'error'
        );
      },
    });
  }
}
