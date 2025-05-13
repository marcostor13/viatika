import { Routes } from '@angular/router';
import InvoicesComponent from './modules/invoices/invoices.component';
import AddInvoiceComponent from './modules/invoices/add-invoice/add-invoice.component';
import { LoginComponent } from './modules/login/login.component';
import { inject } from '@angular/core';
import { UserStateService } from './services/user-state.service';
import { AuthColaboradorGuard } from './guards/auth-colaborador.guard';
import { AuthAdmin2Guard } from './guards/auth-admin2.guard';

export const routes: Routes = [
  {
    path: 'invoices',
    component: InvoicesComponent,
    canActivate: [AuthColaboradorGuard],
  },
  {
    path: 'invoices/add',
    component: AddInvoiceComponent,
    canActivate: [AuthColaboradorGuard],
  },
  {
    path: 'invoices/edit/:id',
    component: AddInvoiceComponent,
    canActivate: [AuthColaboradorGuard],
  },
  {
    path: 'consolidated-invoices',
    loadComponent: () =>
      import(
        './modules/consolidated-invoices/consolidated-invoices.component'
      ).then((m) => m.ConsolidatedInvoicesComponent),
    canActivate: [AuthAdmin2Guard],
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./modules/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];
