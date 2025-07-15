import { Component, inject, OnDestroy } from '@angular/core';
import { Router, NavigationEnd, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ConfirmationService } from '../../services/confirmation.service';
import { UserStateService } from '../../services/user-state.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.scss',
})
export class SidebarComponent implements OnDestroy {
  private router = inject(Router);
  private authService = inject(AuthService);
  private confirmationService = inject(ConfirmationService);
  private userStateService = inject(UserStateService);
  private routerSubscription!: Subscription;
  user = this.userStateService.getUser();

  currentPath = '';
  sidebarVisible = false;

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

  navigateToPath(path: string) {
    this.router.navigate([path]);
  }

  isSelected(path: string) {
    return this.currentPath.includes(path);
  }

  toggleSidebar() {
    this.sidebarVisible = !this.sidebarVisible;
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
}
