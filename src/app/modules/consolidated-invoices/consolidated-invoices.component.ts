import { Component, inject, signal } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { InvoicesService } from '../invoices/services/invoices.service';
import {
  IInvoice,
  IInvoiceResponse,
} from '../invoices/interfaces/invoices.interface';
import { CATEGORIES } from '../invoices/constants/categories';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-consolidated-invoices',
  standalone: true,
  imports: [CommonModule, FormsModule, TableComponent, ListTableComponent],
  templateUrl: './consolidated-invoices.component.html',
  styleUrl: './consolidated-invoices.component.scss',
})
export class ConsolidatedInvoicesComponent {
  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

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
      header: 'RUC',
      value: 'ruc',
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
      value: 'createdAt',
    },
    // {
    //   header: 'Acciones',
    //   value: 'actions',
    //   options: ['edit', 'delete'],
    // },
  ];

  filterProject = signal('');
  filterDateFrom = signal('');
  filterDateTo = signal('');
  filterCategory = signal('');
  filterAmountMin = signal('');
  filterAmountMax = signal('');

  ngOnInit() {
    this.getInvoices();
  }

  getInvoices() {
    this.agentService.getInvoices().subscribe((res) => {
      console.log(res);
      this.invoices = this.formatResponse(res);
    });
  }

  formatResponse(res: IInvoiceResponse[]) {
    const categories = CATEGORIES;
    return res.map((invoice) => {
      const data = invoice.data ? JSON.parse(invoice.data) : {};
      console.log(data);
      return {
        ...invoice,
        category:
          categories.find((c) => c.key === invoice.category)?.name ||
          'No disponible',
        ruc: data.rucEmisor || 'No disponible',
        tipo: data.tipoComprobante || 'No disponible',
        createdAt:
          new Date(invoice.createdAt).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          }) || 'No disponible',
        total: `${data.moneda} ${invoice.total}` || 'No disponible',
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

  // Dashboard: Agrupar y contar facturas por proyecto
  get invoicesByProject() {
    const counts: { [proyect: string]: number } = {};
    for (const inv of this.filteredInvoices) {
      if (inv.proyect) {
        counts[inv.proyect] = (counts[inv.proyect] || 0) + 1;
      }
    }
    return counts;
  }
}
