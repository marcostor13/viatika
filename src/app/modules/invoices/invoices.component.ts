import { Component, inject } from '@angular/core';
import { ListTableComponent } from '../../components/list-table/list-table.component';
import { TableComponent } from '../../components/table/table.component';
import { InvoicesService } from './services/invoices.service';
import { Router } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { IInvoice, IInvoiceResponse } from './interfaces/invoices.interface';
import { IHeaderList } from '../../interfaces/header-list.interface';
import { CATEGORIES } from './constants/categories';
@Component({
  selector: 'app-invoices',
  imports: [
    ListTableComponent,
    TableComponent
  ],
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss'
})
export default class InvoicesComponent {

  private agentService = inject(InvoicesService);
  private router = inject(Router);
  private notificationService = inject(NotificationService);
  private confirmationService = inject(ConfirmationService);

  invoices: IInvoice[] = [];
  headers: IHeaderList[] = [{
    header: 'Proyecto',
    value: 'proyect'
  }, {
    header: 'Categoría',
    value: 'category'
  }, {
    header: 'RUC',
    value: 'ruc'
  }, {
    header: 'Tipo',
    value: 'tipo'
  }, {
    header: 'Total',
    value: 'total'
  }, {
    header: 'Fecha',
    value: 'createdAt'
  },
  {
    header: 'Acciones',
    value: 'actions',
    options: [
      'edit',
      'delete'
    ]
  }
  ]

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
    const categories = CATEGORIES
    return res.map((invoice) => {
      const data = invoice.data ? JSON.parse(invoice.data) : {};
      console.log(data);
      return {
        ...invoice,
        category: categories.find(c => c.key === invoice.category)?.name || 'No disponible',
        ruc: data.rucEmisor || 'No disponible',
        tipo: data.tipoComprobante || 'No disponible',
        createdAt: new Date(invoice.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' }) || 'No disponible',
        total: `${data.moneda} ${invoice.total}` || 'No disponible'
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
      // this.confirmDelete(_id);
    }
    if (option === 'edit') {
      this.editInvoice(_id);
    }
  }

  deleteInvoice(id: string) {
    console.log('deleteInvoice', id);
  }

}
