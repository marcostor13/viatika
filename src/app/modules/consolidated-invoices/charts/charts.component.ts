import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { IInvoiceResponse } from '../../invoices/interfaces/invoices.interface';
import { IProject } from '../../invoices/interfaces/project.interface';
import { ICategory } from '../../invoices/interfaces/category.interface';

// Importación condicional para evitar errores
declare var Chart: any;

// Interfaz para gastos por colaborador
interface CollaboratorExpense {
  id: string;
  name: string;
  expenses: { [key: string]: number }; // Mapeo de meses a cantidades
  color: string;
}

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './charts.component.html',
  styleUrls: ['./charts.component.scss'],
})
export class ChartsComponent implements OnInit, AfterViewInit {
  @ViewChild('projectsChart') projectsChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('categoriesChart')
  categoriesChartRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('collaboratorsChart')
  collaboratorsChartRef!: ElementRef<HTMLCanvasElement>;

  private invoicesService = inject(InvoicesService);

  invoices: IInvoiceResponse[] = [];
  projects: IProject[] = [];
  categories: ICategory[] = [];

  // Estado para control del accordion
  showCollaboratorsSection = true;
  showProjectsSection = true;
  showCategoriesSection = true;
  showSummarySection = true;

  // Mapas para asociar IDs con nombres
  projectMap: Map<string, string> = new Map();
  categoryMap: Map<string, string> = new Map();

  // Reemplazar los filtros de mes/año por rangos de fecha
  dateFrom: string = this.getDefaultStartDate();
  dateTo: string = this.getDefaultEndDate();

  // Referencias a los gráficos
  projectsChart: any = null;
  categoriesChart: any = null;
  collaboratorsChart: any = null;

  // Para controlar la carga de la librería
  chartLibraryLoaded = false;
  dataLoaded = false;

  // Colores para los gráficos
  chartColors = [
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40',
    '#8AC926',
    '#1982C4',
    '#FF595E',
    '#6A4C93',
    '#79C99E',
    '#C973FF',
    '#FFAA73',
    '#73B8FF',
    '#FF73A6',
  ];

  ngOnInit() {
    this.loadData();
    this.loadChartLibrary();
  }

  loadData() {
    // Cargar proyectos y categorías antes que las facturas para tener los nombres listos
    this.getProjects();
    this.getCategories();
    // Después de cargar proyectos y categorías, cargar facturas
    setTimeout(() => {
      this.getInvoices();
    }, 300);
  }

  ngAfterViewInit() {
    // Iniciar un temporizador para verificar si todo está listo para renderizar
    this.checkAndRenderCharts();
  }

  checkAndRenderCharts() {
    // Verificar si los datos y la librería están listos
    if (
      this.chartLibraryLoaded &&
      this.dataLoaded &&
      this.projectsChartRef &&
      this.categoriesChartRef
    ) {
      this.updateCharts();
    } else {
      // Volver a intentar en 500ms
      setTimeout(() => this.checkAndRenderCharts(), 500);
    }
  }

  // Obtener fecha predeterminada de inicio (primer día del mes actual)
  getDefaultStartDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 5); // 6 meses atrás para tener suficientes datos
    date.setDate(1);
    return this.formatDateForInput(date);
  }

  // Obtener fecha predeterminada de fin (día actual)
  getDefaultEndDate(): string {
    return this.formatDateForInput(new Date());
  }

  // Formatear fecha para input type="date"
  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadChartLibrary() {
    // Cargar Chart.js de forma segura
    if (typeof Chart !== 'undefined') {
      this.chartLibraryLoaded = true;
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
      this.chartLibraryLoaded = true;
      this.checkAndRenderCharts();
    };
    document.body.appendChild(script);
  }

  getInvoices() {
    this.invoicesService.getInvoices().subscribe({
      next: (invoices) => {
        this.invoices = invoices;
        console.log('Facturas cargadas:', this.invoices.length);
        this.dataLoaded = true;
        this.checkAndRenderCharts();
      },
      error: (error) => {
        console.error('Error al obtener facturas', error);
        this.dataLoaded = true; // Aunque haya error, marcamos como cargado para no bloquear
      },
    });
  }

  getProjects() {
    this.invoicesService.getProjects().subscribe({
      next: (projects) => {
        this.projects = projects;
        console.log('Proyectos cargados:', this.projects.length);

        // Crear mapa de ID a nombre
        this.projectMap.clear();
        this.projects.forEach((project) => {
          if (project._id) {
            this.projectMap.set(project._id, project.name);
          }
        });
      },
      error: (error) => {
        console.error('Error al obtener proyectos', error);
      },
    });
  }

  getCategories() {
    this.invoicesService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
        console.log('Categorías cargadas:', this.categories.length);

        // Crear mapa de ID a nombre
        this.categoryMap.clear();
        this.categories.forEach((category) => {
          if (category._id) {
            this.categoryMap.set(category._id, category.name);
          }
        });
      },
      error: (error) => {
        console.error('Error al obtener categorías', error);
      },
    });
  }

  updateCharts() {
    // Asegurarse de que la librería está cargada
    if (!this.chartLibraryLoaded || typeof Chart === 'undefined') {
      console.log('Chart.js no está cargado aún, reintentando en 500ms');
      setTimeout(() => this.updateCharts(), 500);
      return;
    }

    // Asegurarse de que los elementos DOM estén disponibles
    if (!this.projectsChartRef || !this.categoriesChartRef) {
      console.log('Referencias a canvas no disponibles, reintentando en 500ms');
      setTimeout(() => this.updateCharts(), 500);
      return;
    }

    // Ahora podemos crear los gráficos con seguridad
    this.createProjectsChart();
    this.createCategoriesChart();
    this.createCollaboratorsChart();
  }

  onFilterChange() {
    this.updateCharts();
  }

  // Filtra las facturas según el rango de fechas seleccionado
  getFilteredInvoices(): IInvoiceResponse[] {
    // Si no hay facturas, devolver un array vacío
    if (!this.invoices || this.invoices.length === 0) {
      return [];
    }

    const dateFrom = this.dateFrom ? new Date(this.dateFrom) : null;
    const dateTo = this.dateTo ? new Date(this.dateTo) : null;

    if (dateTo) {
      // Ajustar la fecha final para incluir todo el día
      dateTo.setHours(23, 59, 59, 999);
    }

    return this.invoices.filter((invoice) => {
      const invoiceDate = new Date(invoice.updatedAt);

      const isAfterFrom = dateFrom ? invoiceDate >= dateFrom : true;
      const isBeforeTo = dateTo ? invoiceDate <= dateTo : true;

      return isAfterFrom && isBeforeTo;
    });
  }

  // Obtener la proyectId de la factura
  getProjectId(invoice: IInvoiceResponse): string {
    // En este caso, usamos proyect como el identificador del proyecto
    return invoice.proyect || '';
  }

  // Obtener nombre del proyecto por su ID
  getProjectName(projectId: string): string {
    // Usar el mapa para obtener el nombre directamente
    const projectName = this.projectMap.get(projectId);

    // Si no se encuentra en el mapa, buscar en projects
    if (!projectName && projectId) {
      const project = this.projects.find((p) => p._id === projectId);
      if (project) {
        // Actualizar el mapa para futuras consultas
        this.projectMap.set(projectId, project.name);
        return project.name;
      }
    }

    return projectName || projectId || 'Proyecto desconocido';
  }

  // Obtener nombre de la categoría por su ID
  getCategoryName(categoryId: string): string {
    // Usar el mapa para obtener el nombre directamente
    const categoryName = this.categoryMap.get(categoryId);

    // Si no se encuentra en el mapa, buscar en categories
    if (!categoryName && categoryId) {
      const category = this.categories.find((c) => c._id === categoryId);
      if (category) {
        // Actualizar el mapa para futuras consultas
        this.categoryMap.set(categoryId, category.name);
        return category.name;
      }
    }

    return categoryName || categoryId || 'Categoría desconocida';
  }

  // Calcula el total de gastos por proyecto
  getTotalByProject(projectId: string): number {
    return this.getFilteredInvoices()
      .filter((invoice) => this.getProjectId(invoice) === projectId)
      .reduce((sum, invoice) => {
        // Convertir a número si es string
        const total =
          typeof invoice.total === 'string'
            ? parseFloat(invoice.total)
            : invoice.total || 0;
        return sum + total;
      }, 0);
  }

  // Calcula el total de gastos por categoría
  getTotalByCategory(categoryId: string): number {
    return this.getFilteredInvoices()
      .filter((invoice) => invoice.category === categoryId)
      .reduce((sum, invoice) => {
        // Convertir a número si es string
        const total =
          typeof invoice.total === 'string'
            ? parseFloat(invoice.total)
            : invoice.total || 0;
        return sum + total;
      }, 0);
  }

  // Gastos por proyecto
  createProjectsChart() {
    if (
      !this.projectsChartRef ||
      !this.chartLibraryLoaded ||
      typeof Chart === 'undefined'
    ) {
      console.log(
        'No se puede crear el gráfico de proyectos, faltan dependencias'
      );
      return;
    }

    if (this.projectsChart) {
      this.projectsChart.destroy();
    }

    const filteredInvoices = this.getFilteredInvoices();

    // Si no hay facturas filtradas, mostrar gráfico vacío
    if (filteredInvoices.length === 0) {
      this.projectsChart = new Chart(this.projectsChartRef.nativeElement, {
        type: 'pie',
        data: {
          labels: ['Sin datos'],
          datasets: [
            {
              data: [1],
              backgroundColor: ['#e2e2e2'],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Gastos por Proyecto',
            },
          },
        },
      });
      return;
    }

    const projectTotals = new Map<string, number>();

    // Sumar los montos por proyecto
    filteredInvoices.forEach((invoice) => {
      const projectId = this.getProjectId(invoice);
      if (projectId) {
        const currentTotal = projectTotals.get(projectId) || 0;
        const invoiceTotal =
          typeof invoice.total === 'string'
            ? parseFloat(invoice.total)
            : invoice.total || 0;
        projectTotals.set(projectId, currentTotal + invoiceTotal);
      }
    });

    // Eliminar proyectos sin gastos
    for (const [id, total] of projectTotals.entries()) {
      if (total === 0) {
        projectTotals.delete(id);
      }
    }

    // Preparar datos para el gráfico con nombres reales
    const labels = Array.from(projectTotals.keys()).map((id) =>
      this.getProjectName(id)
    );

    const data = Array.from(projectTotals.values());

    // Crear el gráfico
    this.projectsChart = new Chart(this.projectsChartRef.nativeElement, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: this.chartColors.slice(0, data.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Gastos por Proyecto',
          },
        },
      },
    });
  }

  // Gastos por categoría
  createCategoriesChart() {
    if (
      !this.categoriesChartRef ||
      !this.chartLibraryLoaded ||
      typeof Chart === 'undefined'
    ) {
      console.log(
        'No se puede crear el gráfico de categorías, faltan dependencias'
      );
      return;
    }

    if (this.categoriesChart) {
      this.categoriesChart.destroy();
    }

    const filteredInvoices = this.getFilteredInvoices();

    // Si no hay facturas filtradas, mostrar gráfico vacío
    if (filteredInvoices.length === 0) {
      this.categoriesChart = new Chart(this.categoriesChartRef.nativeElement, {
        type: 'pie',
        data: {
          labels: ['Sin datos'],
          datasets: [
            {
              data: [1],
              backgroundColor: ['#e2e2e2'],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: {
            legend: {
              position: 'right',
            },
            title: {
              display: true,
              text: 'Gastos por Categoría',
            },
          },
        },
      });
      return;
    }

    const categoryTotals = new Map<string, number>();

    // Sumar los montos por categoría
    filteredInvoices.forEach((invoice) => {
      if (invoice.category) {
        const currentTotal = categoryTotals.get(invoice.category) || 0;
        const invoiceTotal =
          typeof invoice.total === 'string'
            ? parseFloat(invoice.total)
            : invoice.total || 0;
        categoryTotals.set(invoice.category, currentTotal + invoiceTotal);
      }
    });

    // Eliminar categorías sin gastos
    for (const [id, total] of categoryTotals.entries()) {
      if (total === 0) {
        categoryTotals.delete(id);
      }
    }

    // Preparar datos para el gráfico con nombres reales
    const labels = Array.from(categoryTotals.keys()).map((id) =>
      this.getCategoryName(id)
    );

    const data = Array.from(categoryTotals.values());

    // Crear el gráfico
    this.categoriesChart = new Chart(this.categoriesChartRef.nativeElement, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [
          {
            data: data,
            backgroundColor: this.chartColors.slice(0, data.length),
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right',
          },
          title: {
            display: true,
            text: 'Gastos por Categoría',
          },
        },
      },
    });
  }

  // Gastos de colaboradores en el tiempo (gráfico de barras)
  createCollaboratorsChart() {
    if (
      !this.collaboratorsChartRef ||
      !this.chartLibraryLoaded ||
      typeof Chart === 'undefined'
    ) {
      console.log(
        'No se puede crear el gráfico de colaboradores, faltan dependencias'
      );
      return;
    }

    if (this.collaboratorsChart) {
      this.collaboratorsChart.destroy();
    }

    const filteredInvoices = this.getFilteredInvoices();

    // Si no hay facturas filtradas, mostrar gráfico vacío
    if (filteredInvoices.length === 0) {
      this.collaboratorsChart = new Chart(
        this.collaboratorsChartRef.nativeElement,
        {
          type: 'bar',
          data: {
            labels: ['Sin datos'],
            datasets: [
              {
                label: 'Sin datos',
                data: [0],
                backgroundColor: '#e2e2e2',
                borderWidth: 1,
              },
            ],
          },
          options: {
            responsive: true,
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Importe (S/)',
                },
              },
              x: {
                title: {
                  display: true,
                  text: 'Mes',
                },
              },
            },
            plugins: {
              title: {
                display: true,
                text: 'Gastos de Colaboradores en el Tiempo',
              },
              legend: {
                position: 'top',
              },
            },
          },
        }
      );
      return;
    }

    // Obtener intervalo de fechas para el eje X
    const months = this.getMonthsInRange();

    // Agrupar por colaborador y mes
    const collaboratorsData = this.getCollaboratorsData(
      filteredInvoices,
      months
    );

    // Preparar datasets para Chart.js
    const datasets = collaboratorsData.map((collaborator, index) => {
      const colorIndex = index % this.chartColors.length;
      return {
        label: collaborator.name,
        data: months.map((month) => collaborator.expenses[month] || 0),
        backgroundColor: this.chartColors[colorIndex],
        borderColor: this.chartColors[colorIndex],
        borderWidth: 1,
      };
    });

    // Crear el gráfico
    this.collaboratorsChart = new Chart(
      this.collaboratorsChartRef.nativeElement,
      {
        type: 'bar',
        data: {
          labels: months.map((month) => this.formatMonthLabel(month)),
          datasets: datasets,
        },
        options: {
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Importe (S/)',
              },
            },
            x: {
              title: {
                display: true,
                text: 'Mes',
              },
            },
          },
          plugins: {
            title: {
              display: true,
              text: 'Gastos de Colaboradores en el Tiempo',
            },
            legend: {
              position: 'top',
            },
          },
        },
      }
    );
  }

  // Obtener los meses dentro del rango de fechas seleccionado
  getMonthsInRange(): string[] {
    const months: string[] = [];
    const dateFrom = new Date(this.dateFrom);
    const dateTo = new Date(this.dateTo);

    // Crear una copia de la fecha inicial para no modificar la original
    const currentDate = new Date(dateFrom);

    // Ajustar al primer día del mes
    currentDate.setDate(1);

    // Añadir cada mes hasta llegar al mes final
    while (currentDate <= dateTo) {
      months.push(
        `${currentDate.getFullYear()}-${String(
          currentDate.getMonth() + 1
        ).padStart(2, '0')}`
      );
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return months;
  }

  // Formatea una etiqueta de mes para mostrar (ej: "2023-01" -> "Ene 2023")
  formatMonthLabel(monthKey: string): string {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);

    const monthNames = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];

    return `${monthNames[date.getMonth()]} ${year}`;
  }

  // Obtener datos de colaboradores agrupados por mes
  getCollaboratorsData(
    invoices: IInvoiceResponse[],
    months: string[]
  ): CollaboratorExpense[] {
    // Mapeo para agrupar por colaborador
    const collaboratorsMap: Map<string, CollaboratorExpense> = new Map();

    // Obtener el ID del colaborador de la factura
    // Nota: Como no tenemos userId directamente en IInvoiceResponse,
    // usamos el ID del proyecto como identificador del colaborador para este ejemplo
    const getCollaboratorId = (invoice: IInvoiceResponse): string => {
      // Podríamos tener userId en los datos (data) de la factura
      let userId = '';

      // Intentar extraer userId de data si existe y es un objeto
      if (invoice.data && typeof invoice.data === 'object') {
        userId = (invoice.data as any).userId || '';
      }

      // Si no hay userId, usamos el ID del proyecto como alternativa
      return userId || invoice.proyect || 'unknown';
    };

    // Obtener el nombre del colaborador
    const getCollaboratorName = (invoice: IInvoiceResponse): string => {
      // Si hay datos de usuario en data, podríamos intentar extraer el nombre
      let userName = '';

      if (invoice.data && typeof invoice.data === 'object') {
        userName = (invoice.data as any).userName || '';
      }

      // Si no hay nombre de usuario, usamos el nombre del proyecto
      return (
        userName ||
        invoice.projectName ||
        this.getProjectName(invoice.proyect) ||
        'Colaborador desconocido'
      );
    };

    // Inicializar estructura para cada colaborador
    invoices.forEach((invoice) => {
      const collaboratorId = getCollaboratorId(invoice);
      const invoiceDate = new Date(invoice.updatedAt);
      const monthKey = `${invoiceDate.getFullYear()}-${String(
        invoiceDate.getMonth() + 1
      ).padStart(2, '0')}`;

      // Si el mes no está en nuestro rango, ignoramos esta factura
      if (!months.includes(monthKey)) {
        return;
      }

      if (!collaboratorsMap.has(collaboratorId)) {
        const collaboratorExpense: CollaboratorExpense = {
          id: collaboratorId,
          name: getCollaboratorName(invoice),
          expenses: {},
          color: '',
        };

        // Inicializar todos los meses con cero
        months.forEach((month) => {
          collaboratorExpense.expenses[month] = 0;
        });

        collaboratorsMap.set(collaboratorId, collaboratorExpense);
      }

      // Sumar el gasto al mes correspondiente
      const total =
        typeof invoice.total === 'string'
          ? parseFloat(invoice.total)
          : invoice.total || 0;

      const collaborator = collaboratorsMap.get(collaboratorId)!;
      collaborator.expenses[monthKey] =
        (collaborator.expenses[monthKey] || 0) + total;
    });

    // Convertir el mapa a un array y asignar colores
    const result = Array.from(collaboratorsMap.values());

    // Asignar colores (limitar a máximo 10 colaboradores para evitar demasiados colores)
    result.slice(0, 10).forEach((collaborator, index) => {
      collaborator.color = this.chartColors[index % this.chartColors.length];
    });

    return result;
  }

  // Formatea el número para mostrar como moneda
  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(value);
  }

  // Obtener los IDs de los proyectos que tienen gastos en el período filtrado
  getProjectIdsWithExpenses(): string[] {
    const filteredInvoices = this.getFilteredInvoices();
    const projectIdsWithExpenses = new Set<string>();

    filteredInvoices.forEach((invoice) => {
      const projectId = this.getProjectId(invoice);
      if (projectId && this.getTotalByProject(projectId) > 0) {
        projectIdsWithExpenses.add(projectId);
      }
    });

    return Array.from(projectIdsWithExpenses);
  }

  // Obtener los IDs de las categorías que tienen gastos en el período filtrado
  getCategoryIdsWithExpenses(): string[] {
    const filteredInvoices = this.getFilteredInvoices();
    const categoryIdsWithExpenses = new Set<string>();

    filteredInvoices.forEach((invoice) => {
      if (invoice.category && this.getTotalByCategory(invoice.category) > 0) {
        categoryIdsWithExpenses.add(invoice.category);
      }
    });

    return Array.from(categoryIdsWithExpenses);
  }

  // Calcular el total general de gastos en el período filtrado
  getTotalExpenses(): number {
    const filteredInvoices = this.getFilteredInvoices();

    return filteredInvoices.reduce((total, invoice) => {
      const invoiceTotal =
        typeof invoice.total === 'string'
          ? parseFloat(invoice.total)
          : invoice.total || 0;
      return total + invoiceTotal;
    }, 0);
  }

  // Métodos para controlar el accordion
  toggleSection(
    section: 'collaborators' | 'projects' | 'categories' | 'summary'
  ) {
    switch (section) {
      case 'collaborators':
        this.showCollaboratorsSection = !this.showCollaboratorsSection;
        if (this.showCollaboratorsSection) this.refreshChart('collaborators');
        break;
      case 'projects':
        this.showProjectsSection = !this.showProjectsSection;
        if (this.showProjectsSection) this.refreshChart('projects');
        break;
      case 'categories':
        this.showCategoriesSection = !this.showCategoriesSection;
        if (this.showCategoriesSection) this.refreshChart('categories');
        break;
      case 'summary':
        this.showSummarySection = !this.showSummarySection;
        break;
    }
  }

  refreshChart(chartType: 'collaborators' | 'projects' | 'categories') {
    // Cuando se expande una sección, necesitamos actualizar el gráfico
    // ya que Chart.js puede no renderizar correctamente en elementos ocultos
    setTimeout(() => {
      switch (chartType) {
        case 'collaborators':
          if (this.collaboratorsChart) {
            this.collaboratorsChart.destroy();
            this.createCollaboratorsChart();
          }
          break;
        case 'projects':
          if (this.projectsChart) {
            this.projectsChart.destroy();
            this.createProjectsChart();
          }
          break;
        case 'categories':
          if (this.categoriesChart) {
            this.categoriesChart.destroy();
            this.createCategoriesChart();
          }
          break;
      }
    }, 50);
  }
}
