import {
  Component,
  OnInit,
  AfterViewInit,
  ElementRef,
  ViewChild,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InvoicesService } from '../../invoices/services/invoices.service';
import { IInvoiceResponse } from '../../invoices/interfaces/invoices.interface';
import { IProject } from '../../invoices/interfaces/project.interface';
import { ICategory } from '../../invoices/interfaces/category.interface';
import { UserStateService } from '../../../services/user-state.service';
import { ExpenseService } from '../../../services/expense.service';
import { forkJoin } from 'rxjs';

declare var Chart: any;

interface CollaboratorExpense {
  id: string;
  name: string;
  expenses: { [key: string]: number };
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
  private userStateService = inject(UserStateService);
  private expenseService = inject(ExpenseService);
  private cdr = inject(ChangeDetectorRef);

  invoices: IInvoiceResponse[] = [];
  projects: IProject[] = [];
  categories: ICategory[] = [];
  expenses: any[] = [];
  filteredExpenses: any[] = [];

  showCollaboratorsSection = true;
  showProjectsSection = true;
  showCategoriesSection = true;
  showSummarySection = true;

  projectMap: Map<string, string> = new Map();
  categoryMap: Map<string, string> = new Map();

  dateFrom: string = this.getDefaultStartDate();
  dateTo: string = this.getDefaultEndDate();

  projectsChart: any = null;
  categoriesChart: any = null;
  collaboratorsChart: any = null;

  chartLibraryLoaded = false;
  dataLoaded = false;

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

  filterProject: string = '';
  filterCategory: string = '';

  ngOnInit() {
    this.loadData();
    this.loadChartLibrary();
  }

  ngAfterViewInit() {
    this.tryRenderCharts();
  }

  private tryRenderCharts() {
    if (
      this.chartLibraryLoaded &&
      this.dataLoaded &&
      this.projectsChartRef &&
      this.categoriesChartRef &&
      this.collaboratorsChartRef
    ) {
      this.updateCharts();
    }
  }

  getDefaultStartDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 5);
    date.setDate(1);
    return this.formatDateForInput(date);
  }

  getDefaultEndDate(): string {
    return this.formatDateForInput(new Date());
  }

  formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  loadChartLibrary() {
    if (typeof Chart !== 'undefined') {
      this.chartLibraryLoaded = true;
      this.tryRenderCharts();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = () => {
      this.chartLibraryLoaded = true;
      this.tryRenderCharts();
    };
    document.body.appendChild(script);
  }

  loadData() {
    const companyId = this.userStateService.getUser()?.companyId;
    forkJoin([
      this.invoicesService.getProjects(),
      companyId ? this.invoicesService.getCategories(companyId) : [],
      companyId
        ? this.expenseService.getExpenses(companyId, {
            dateFrom: this.dateFrom,
            dateTo: this.dateTo,
            projectId: this.filterProject,
            categoryId: this.filterCategory,
          })
        : [],
    ]).subscribe({
      next: ([projects, categories, expenses]) => {
        this.projects = projects;
        this.categories = categories;
        this.expenses = expenses;
        this.projectMap.clear();
        this.projects.forEach((project) => {
          if (project._id) {
            this.projectMap.set(project._id, project.name);
          }
        });
        this.categoryMap.clear();
        this.categories.forEach((category) => {
          if (category._id) {
            this.categoryMap.set(category._id, category.name);
          }
        });
        this.updateFilteredExpenses();
        this.dataLoaded = true;
        this.cdr.detectChanges();
        this.tryRenderCharts();
      },
      error: (error) => {
        console.error('Error al cargar datos', error);
        this.dataLoaded = true;
      },
    });
  }

  onFilterChange() {
    this.updateFilteredExpenses();
    this.updateCharts();
  }

  updateCharts() {
    if (!this.chartLibraryLoaded || typeof Chart === 'undefined') {
      return;
    }
    if (
      !this.projectsChartRef ||
      !this.categoriesChartRef ||
      !this.collaboratorsChartRef
    ) {
      return;
    }
    this.createProjectsChart();
    this.createCategoriesChart();
    this.createCollaboratorsChart();
  }

  updateFilteredExpenses() {
    const dateFrom = this.dateFrom ? new Date(this.dateFrom) : null;
    const dateTo = this.dateTo ? new Date(this.dateTo) : null;
    if (dateTo) dateTo.setHours(23, 59, 59, 999);
    this.filteredExpenses = this.expenses.filter((expense) => {
      if (!expense.fechaEmision) return false;
      const expenseDate = new Date(expense.fechaEmision);
      const isAfterFrom = dateFrom ? expenseDate >= dateFrom : true;
      const isBeforeTo = dateTo ? expenseDate <= dateTo : true;
      return isAfterFrom && isBeforeTo;
    });
  }

  getFilteredInvoices(): any[] {
    return this.filteredExpenses;
  }

  getProjectId(expense: any): string {
    if (expense.proyectId && typeof expense.proyectId === 'object') {
      return expense.proyectId._id || '';
    }
    return expense.proyectId || '';
  }

  getCategoryId(expense: any): string {
    if (expense.categoryId && typeof expense.categoryId === 'object') {
      return expense.categoryId._id || '';
    }
    return expense.categoryId || '';
  }

  getProjectName(projectId: string): string {
    const projectName = this.projectMap.get(projectId);

    if (!projectName && projectId) {
      const project = this.projects.find((p) => p._id === projectId);
      if (project) {
        this.projectMap.set(projectId, project.name);
        return project.name;
      }
    }

    return projectName || projectId || 'Proyecto desconocido';
  }

  getCategoryName(categoryId: string): string {
    const categoryName = this.categoryMap.get(categoryId);

    if (!categoryName && categoryId) {
      const category = this.categories.find((c) => c._id === categoryId);
      if (category) {
        this.categoryMap.set(categoryId, category.name);
        return category.name;
      }
    }

    return categoryName || categoryId || 'Categoría desconocida';
  }

  getTotalByProject(projectId: string): number {
    return this.getFilteredInvoices()
      .filter((expense) => this.getProjectId(expense) === projectId)
      .reduce((sum, expense) => {
        const total =
          typeof expense.total === 'string'
            ? parseFloat(expense.total)
            : expense.total || 0;
        return sum + total;
      }, 0);
  }

  getTotalByCategory(categoryId: string): number {
    return this.getFilteredInvoices()
      .filter((expense) => this.getCategoryId(expense) === categoryId)
      .reduce((sum, expense) => {
        const total =
          typeof expense.total === 'string'
            ? parseFloat(expense.total)
            : expense.total || 0;
        return sum + total;
      }, 0);
  }

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

    const filteredExpenses = this.getFilteredInvoices();

    if (filteredExpenses.length === 0) {
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

    filteredExpenses.forEach((expense) => {
      const projectId = this.getProjectId(expense);
      if (projectId) {
        const currentTotal = projectTotals.get(projectId) || 0;
        const expenseTotal =
          typeof expense.total === 'string'
            ? parseFloat(expense.total)
            : expense.total || 0;
        projectTotals.set(projectId, currentTotal + expenseTotal);
      }
    });

    for (const [id, total] of projectTotals.entries()) {
      if (total === 0) {
        projectTotals.delete(id);
      }
    }

    const labels = Array.from(projectTotals.keys()).map((id) =>
      this.getProjectName(id)
    );

    const data = Array.from(projectTotals.values());

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

    const filteredExpenses = this.getFilteredInvoices();

    if (filteredExpenses.length === 0) {
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

    filteredExpenses.forEach((expense) => {
      const categoryId = this.getCategoryId(expense);
      if (categoryId) {
        const currentTotal = categoryTotals.get(categoryId) || 0;
        const expenseTotal =
          typeof expense.total === 'string'
            ? parseFloat(expense.total)
            : expense.total || 0;
        categoryTotals.set(categoryId, currentTotal + expenseTotal);
      }
    });

    for (const [id, total] of categoryTotals.entries()) {
      if (total === 0) {
        categoryTotals.delete(id);
      }
    }

    const labels = Array.from(categoryTotals.keys()).map((id) =>
      this.getCategoryName(id)
    );

    const data = Array.from(categoryTotals.values());

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

    const filteredExpenses = this.getFilteredInvoices();

    if (filteredExpenses.length === 0) {
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

    const months = this.getMonthsInRange();

    const collaboratorsData = this.getCollaboratorsData(
      filteredExpenses,
      months
    );

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

  getMonthsInRange(): string[] {
    const months: string[] = [];
    const dateFrom = new Date(this.dateFrom);
    const dateTo = new Date(this.dateTo);

    const currentDate = new Date(dateFrom);

    currentDate.setDate(1);

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

  getCollaboratorsData(
    expenses: any[],
    months: string[]
  ): CollaboratorExpense[] {
    const collaboratorsMap: Map<string, CollaboratorExpense> = new Map();

    const getCollaboratorId = (expense: any): string => {
      let userId = '';

      if (expense.data && typeof expense.data === 'object') {
        userId = (expense.data as any).userId || '';
      }

      return userId || expense.proyectId || 'unknown';
    };

    const getCollaboratorName = (expense: any): string => {
      let userName = '';

      if (expense.data && typeof expense.data === 'object') {
        userName = (expense.data as any).userName || '';
      }

      return (
        userName ||
        expense.projectName ||
        this.getProjectName(expense.proyectId) ||
        'Colaborador desconocido'
      );
    };

    expenses.forEach((expense) => {
      const collaboratorId = getCollaboratorId(expense);
      const expenseDate = new Date(expense.fechaEmision);
      const monthKey = `${expenseDate.getFullYear()}-${String(
        expenseDate.getMonth() + 1
      ).padStart(2, '0')}`;

      if (!months.includes(monthKey)) {
        return;
      }

      if (!collaboratorsMap.has(collaboratorId)) {
        const collaboratorExpense: CollaboratorExpense = {
          id: collaboratorId,
          name: getCollaboratorName(expense),
          expenses: {},
          color: '',
        };

        months.forEach((month) => {
          collaboratorExpense.expenses[month] = 0;
        });

        collaboratorsMap.set(collaboratorId, collaboratorExpense);
      }

      const total =
        typeof expense.total === 'string'
          ? parseFloat(expense.total)
          : expense.total || 0;

      const collaborator = collaboratorsMap.get(collaboratorId)!;
      collaborator.expenses[monthKey] =
        (collaborator.expenses[monthKey] || 0) + total;
    });

    const result = Array.from(collaboratorsMap.values());

    result.slice(0, 10).forEach((collaborator, index) => {
      collaborator.color = this.chartColors[index % this.chartColors.length];
    });

    return result;
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
    }).format(value);
  }

  getProjectIdsWithExpenses(): string[] {
    const filteredExpenses = this.getFilteredInvoices();
    const projectIdsWithExpenses = new Set<string>();
    filteredExpenses.forEach((expense) => {
      const projectId = this.getProjectId(expense);
      if (projectId && this.getTotalByProject(projectId) > 0) {
        projectIdsWithExpenses.add(projectId);
      }
    });
    return Array.from(projectIdsWithExpenses);
  }

  getCategoryIdsWithExpenses(): string[] {
    const filteredExpenses = this.getFilteredInvoices();
    const categoryIdsWithExpenses = new Set<string>();
    filteredExpenses.forEach((expense) => {
      const categoryId = this.getCategoryId(expense);
      if (categoryId && this.getTotalByCategory(categoryId) > 0) {
        categoryIdsWithExpenses.add(categoryId);
      }
    });
    return Array.from(categoryIdsWithExpenses);
  }

  getTotalExpenses(): number {
    const filteredExpenses = this.getFilteredInvoices();

    return filteredExpenses.reduce((total, expense) => {
      const expenseTotal =
        typeof expense.total === 'string'
          ? parseFloat(expense.total)
          : expense.total || 0;
      return total + expenseTotal;
    }, 0);
  }

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
  }
}
