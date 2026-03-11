import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { CompanyConfigService } from '../../services/company-config.service';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = signal('');
  password = signal('');
  loading = signal(false);
  error = signal('');
  showPassword = signal(false);

  private userStateService = inject(UserStateService);
  private notificationService = inject(NotificationService);
  private authService = inject(AuthService);
  private companyConfigService = inject(CompanyConfigService);

  constructor(private router: Router) { }

  redirect() {
    if (this.userStateService.isSuperAdmin()) {
      this.router.navigate(['/clients']);
    } else if (this.userStateService.isAdmin()) {
      this.router.navigate(['/invoice-approval']);
    } else {
      this.router.navigate(['/invoices']);
    }
  }

  login() {
    if (this.email() && this.password()) {
      this.loading.set(true);
      this.error.set('');

      this.authService
        .login(this.email(), this.password())
        .pipe(finalize(() => this.loading.set(false)))
        .subscribe((res) => {
          this.userStateService.setUser(res);
          this.companyConfigService.refreshConfig();
          this.notificationService.show('Bienvenid@ ' + res.firstName, 'success');
          this.redirect();
        });
    }
  }
}
