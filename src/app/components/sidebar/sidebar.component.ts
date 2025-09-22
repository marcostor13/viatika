import {
  Component,
  inject,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  effect,
} from '@angular/core';
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
export class SidebarComponent implements OnDestroy {
  @Input() sidebarVisible = false;
  @Output() sidebarToggle = new EventEmitter<void>();

  private router = inject(Router);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);
  private companyConfigService = inject(CompanyConfigService);
  private routerSubscription!: Subscription;
  user = this.userStateService.getUser();
  companyConfig: ICompanyConfig | null = null;

  currentPath = '';

  constructor() {
    this.detectPath();
    this.loadCompanyConfig();
    this.loadUser();
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

  navigateToPath(path: string) {
    this.router.navigate([path]);
  }

  isSelected(path: string) {
    return this.currentPath.includes(path);
  }

  toggleSidebar() {
    this.sidebarToggle.emit();
  }

  confirmation() {
    this.confirmationService.show(
      '¿Estás seguro de querer cerrar sesión?',
      () => {
        this.logout();
      }
    );
  }

  isAdmin(): boolean {
    const user = this.userStateService.getUser();
    const role = user?.role?.name;
    return role === 'Admin' || role === 'Super';
  }

  isColaborador(): boolean {
    const user = this.userStateService.getUser();
    const role = user?.role?.name;
    return role === 'User';
  }

  logout() {
    this.authService.logout();
  }

  private loadCompanyConfig() {
    this.companyConfigService.companyConfig$.subscribe((config) => {
      this.companyConfig = config;
    });
  }

  private loadUser() {
    effect(() => {
      this.user = this.userStateService.getUser();
    });
  }
}
