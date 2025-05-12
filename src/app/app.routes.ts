import { Routes } from '@angular/router';
import InvoicesComponent from './modules/invoices/invoices.component';
import AddInvoiceComponent from './modules/invoices/add-invoice/add-invoice.component';
export const routes: Routes = [
    {
        path: 'invoices',
        component: InvoicesComponent
    },
    {
        path: 'invoices/add',
        component: AddInvoiceComponent
    },
    {
        path: 'invoices/edit/:id',
        component: AddInvoiceComponent
    },
    {
        path: '**',
        redirectTo: 'invoices'
    }
];
