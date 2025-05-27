import { Component, signal, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

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

  constructor(private router: Router) { }

  redirect(role: string) {
    if (role === 'ADMIN2') {
      this.router.navigate(['/consolidated-invoices']);
    } else {
      this.router.navigate(['/invoices']);
    }
  }

  login() {
    if (this.email() && this.password()) {
      this.authService.login(this.email(), this.password()).subscribe((res) => {
        this.userStateService.setUser(res);
        this.notificationService.show('Bienvenid@ ' + res.firstName, 'success');
        this.redirect(res.role);
      });
    }
  }


  // login() {
  //   this.loading.set(true);
  //   this.error.set('');
  //   this.authService.login(this.email(), this.password()).subscribe({
  //     next: (res) => {
  //       localStorage.setItem('token', res.data.token);

  //       this.userStateService.setUser({
  //         ...res.data.user,
  //         access_token: res.data.token,
  //       });

  //       if (res.data.user.role === 'ADMIN2') {
  //         this.router.navigate(['/consolidated-invoices']);
  //       } else {
  //         this.router.navigate(['/invoices']).then(() => { });
  //       }
  //       this.loading.set(false);
  //     },
  //     error: (err) => {
  //       this.notificationService.show('Credenciales incorrectas', 'error');
  //       this.loading.set(false);
  //     },
  //   });
  // }
}
