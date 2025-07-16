import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { CompanyConfigService } from '../../services/company-config.service';
import { HttpErrorResponse } from '@angular/common/http';

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

  constructor(private router: Router) {}

  redirect() {
    this.router.navigate(['/']);
  }

  login() {
    if (!this.email() || !this.password()) {
      this.notificationService.show(
        'Por favor ingresa email y contraseña',
        'error'
      );
      return;
    }

    this.loading.set(true);
    this.error.set('');

    this.authService.login(this.email(), this.password()).subscribe((res) => {
      this.userStateService.setUser(res);
      this.companyConfigService.reloadConfigOnAuth();
      this.notificationService.show('Bienvenid@ ' + res.name, 'success');
      this.redirect();
    });
  }
}
