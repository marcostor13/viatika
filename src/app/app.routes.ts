import { Routes } from '@angular/router';
import InvoicesComponent from './modules/invoices/invoices.component';
import AddInvoiceComponent from './modules/invoices/add-invoice/add-invoice.component';
import { AuthColaboradorGuard } from './guards/auth-colaborador.guard';
import { AuthAdmin2Guard } from './guards/auth-admin2.guard';
import { MainComponent } from './layouts/main/main.component';
import AdminUsersComponent from './modules/admin-users/admin-users.component';
import { InvoiceApprovalComponent } from './modules/invoice-approval/invoice-approval.component';

export const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    children: [
      {
        path: '',
        redirectTo: '/invoices', // Por defecto redirige a facturas para colaboradores
        pathMatch: 'full',
      },
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
        path: 'invoice-approval',
        component: InvoiceApprovalComponent,
        canActivate: [AuthAdmin2Guard],
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
        path: 'consolidated-invoices/add-category',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-category/add-category.component'
          ).then((m) => m.AddCategoryComponent),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'consolidated-invoices/edit-category/:id',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-category/add-category.component'
          ).then((m) => m.AddCategoryComponent),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'consolidated-invoices/add-project',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-project/add-project.component'
          ).then((m) => m.AddProjectComponent),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'consolidated-invoices/edit-project/:id',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-project/add-project.component'
          ).then((m) => m.AddProjectComponent),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'admin-users',
        component: AdminUsersComponent,
        canActivate: [AuthAdmin2Guard],
      },
    ],
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
