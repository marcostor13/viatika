import { Component, inject, OnDestroy } from '@angular/core';
import { Router, RouterOutlet, NavigationEnd } from '@angular/router';
import { SidebarComponent } from '../../components/sidebar/sidebar.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [RouterOutlet, SidebarComponent],
  templateUrl: './main.component.html',
  styleUrl: './main.component.scss',
})
export class MainComponent implements OnDestroy {
  private router = inject(Router);
  private routerSubscription!: Subscription;
  currentPath = '';

  constructor() {
    this.detectPath();
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  detectPath() {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentPath = event.url;
      }
    });
  }

  getPageTitle(): string {
    const path = this.currentPath;

    if (path.includes('/invoices')) {
      return 'Facturas';
    } else if (path.includes('/invoice-approval')) {
      return 'Aprobación de Facturas';
    } else if (path.includes('/admin-users')) {
      return 'Usuarios Admin';
    } else if (path.includes('/consolidated-invoices')) {
      return 'Consolidado de Facturas';
    } else if (path.includes('/categories')) {
      return 'Categorías';
    } else if (path.includes('/projects')) {
      return 'Proyectos';
    }

    return 'Panel de Control';
  }
}
