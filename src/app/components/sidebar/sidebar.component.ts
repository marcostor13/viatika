import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { UserStateService } from '../../services/user-state.service';
import { CompanyConfigService } from '../../services/company-config.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ICompanyConfig } from '../../interfaces/company-config.interface';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);
  private companyConfigService = inject(CompanyConfigService);
  private routerSubscription!: Subscription;
  private configSubscription!: Subscription;

  currentPath = '';
  sidebarVisible = false;
  companyConfig: ICompanyConfig | null = null;

  constructor() {
    this.detectPath();
  }

  ngOnInit() {
    this.loadCompanyConfig();
  }

  ngOnDestroy() {
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
    if (this.configSubscription) {
      this.configSubscription.unsubscribe();
    }
  }

  private loadCompanyConfig() {
    this.configSubscription =
      this.companyConfigService.companyConfig$.subscribe((config) => {
        this.companyConfig = config;
      });
  }

  detectPath() {
    this.routerSubscription = this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        this.currentPath = event.url;
      }
    });
  }

  navigateToPath(path: string) {
    this.router.navigate([path]);
  }

  isSelected(path: string) {
    return this.currentPath.includes(path);
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
  }

  // Verificar si el usuario es administrador
  isAdmin(): boolean {
    return this.userStateService.isAdmin();
  }

  isAnyAdmin(): boolean {
    return this.userStateService.isAnyAdmin();
  }

  isSuperAdmin(): boolean {
    return this.userStateService.isSuperAdmin();
  }

  // Verificar si el usuario es colaborador
  isColaborador(): boolean {
    return this.userStateService.isColaborador();
  }

  confirmation() {
    this.confirmationService.show(
      '¿Estás seguro de querer cerrar sesión?',
      () => {
        this.logout();
      }
    );
  }

  logout() {
    this.authService.logout();
  }

  // Obtener el nombre de la empresa
  getCompanyName(): string {
    return this.companyConfig?.name || 'Mi Empresa';
  }

  // Obtener el logo de la empresa
  getCompanyLogo(): string {
    return this.companyConfig?.logo || '';
  }
}
