import { Routes } from '@angular/router';
import InvoicesComponent from './modules/invoices/invoices.component';
import AddInvoiceComponent from './modules/invoices/add-invoice/add-invoice.component';
import { AuthColaboradorGuard } from './guards/auth-colaborador.guard';
import { AuthAdmin2Guard } from './guards/auth-admin2.guard';
import { AuthSuperGuard } from './guards/auth-super.guard';
import { AuthTesoreroGuard } from './guards/auth-tesorero.guard';
import { defaultRedirectGuard } from './guards/default-redirect.guard';
import { authModuleGuard } from './guards/auth-module.guard';
import { MainComponent } from './layouts/main/main.component';
import AdminUsersComponent from './modules/admin-users/admin-users.component';
import { InvoiceApprovalComponent } from './modules/invoice-approval/invoice-approval.component';
import { CreateUserComponent } from './modules/admin-users/create-user/create-user.component';
import { ConfiguracionComponent } from './modules/configuracion/configuracion.component';
import { ClientOnboardingComponent } from './modules/super-admin/client-onboarding/client-onboarding.component';
import { ClientsAdminComponent } from './modules/clients-admin/clients-admin.component';

export const routes: Routes = [
  {
    path: '',
    component: MainComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        canActivate: [defaultRedirectGuard],
        loadComponent: () =>
          import('./layouts/main/main.component').then((m) => m.MainComponent),
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
        path: 'invoices/:id/details',
        loadComponent: () =>
          import('./modules/invoices/invoice-detail/invoice-detail.component').then(
            (m) => m.InvoiceDetailComponent
          ),
        canActivate: [AuthColaboradorGuard],
      },
      {
        path: 'invoice-approval',
        component: InvoiceApprovalComponent,
        canActivate: [authModuleGuard('invoice-approval')],
      },
      {
        path: 'consolidated-invoices',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/consolidated-invoices.component'
          ).then((m) => m.ConsolidatedInvoicesComponent),
        canActivate: [authModuleGuard('consolidated-invoices')],
      },
      {
        path: 'notificaciones',
        loadComponent: () =>
          import(
            './modules/notifications/notification-list.component'
          ).then((m) => m.NotificationListComponent),
      },
      {
        path: 'consolidated-invoices/add-category',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-category/add-category.component'
          ).then((m) => m.AddCategoryComponent),
        canActivate: [authModuleGuard('consolidated-invoices', true)],
      },
      {
        path: 'consolidated-invoices/edit-category/:id',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-category/add-category.component'
          ).then((m) => m.AddCategoryComponent),
        canActivate: [authModuleGuard('consolidated-invoices', true)],
      },
      {
        path: 'consolidated-invoices/add-project',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-project/add-project.component'
          ).then((m) => m.AddProjectComponent),
        canActivate: [authModuleGuard('consolidated-invoices', true)],
      },
      {
        path: 'consolidated-invoices/edit-project/:id',
        loadComponent: () =>
          import(
            './modules/consolidated-invoices/add-project/add-project.component'
          ).then((m) => m.AddProjectComponent),
        canActivate: [authModuleGuard('consolidated-invoices', true)],
      },
      {
        path: 'admin-users',
        component: AdminUsersComponent,
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'admin-users/create-user',
        component: CreateUserComponent,
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'admin-users/create-user/:id',
        component: CreateUserComponent,
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'admin-users/:id/details',
        loadComponent: () =>
          import('./modules/admin-users/user-details/user-details.component').then(
            (m) => m.UserDetailsComponent
          ),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'admin-users/:id/permisos',
        loadComponent: () =>
          import('./modules/admin-users/user-permissions/user-permissions.component').then(
            (m) => m.UserPermissionsComponent
          ),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./modules/configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent
          ),
        canActivate: [authModuleGuard('configuracion')],
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./modules/clients/clients.component').then(
            (m) => m.ClientsComponent
          ),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'clients-admin',
        component: ClientsAdminComponent,
        canActivate: [AuthSuperGuard],
      },
      {
        path: 'inicio',
        loadComponent: () =>
          import('./modules/inicio/inicio.component').then(
            (m) => m.InicioComponent
          ),
        canActivate: [AuthColaboradorGuard],
      },
      {
        path: 'mis-rendiciones',
        loadComponent: () =>
          import('./modules/mis-rendiciones/mis-rendiciones.component').then(
            (m) => m.MisRendicionesComponent
          ),
      },
      {
        path: 'mis-rendiciones/:id/detalle',
        loadComponent: () =>
          import('./modules/mis-rendiciones/rendicion-detail/rendicion-detail.component').then(
            (m) => m.RendicionDetailComponent
          ),
      },
      {
        path: 'mi-firma',
        loadComponent: () =>
          import('./modules/firma-digital/firma-digital.component').then(
            (m) => m.FirmaDigitalComponent
          ),
      },
      {
        path: 'tesoreria',
        loadComponent: () =>
          import('./modules/tesoreria/tesoreria.component').then(
            (m) => m.TesoreriaComponent
          ),
        canActivate: [AuthTesoreroGuard],
      },
      {
        path: 'centros-de-costo',
        loadComponent: () =>
          import('./modules/centros-de-costo/centros-de-costo.component').then(
            (m) => m.CentrosDeCostoComponent
          ),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'categorias',
        loadComponent: () =>
          import('./modules/categorias/categorias.component').then(
            (m) => m.CategoriasComponent
          ),
        canActivate: [AuthAdmin2Guard],
      },
      {
        path: 'audit-log',
        loadComponent: () =>
          import('./modules/audit-log/audit-log.component').then(
            (m) => m.AuditLogComponent
          ),
        canActivate: [authModuleGuard('audit-log', true)],
      },
    ],
  },
  {
    path: 'super/client-onboarding',
    component: ClientOnboardingComponent,
    canActivate: [AuthSuperGuard],
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
