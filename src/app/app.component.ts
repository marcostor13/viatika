import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmationService } from './services/confirmation.service';
import { Observable } from 'rxjs';
import { LoaderService } from './services/loader.service';
import { NotificationService } from './services/notification.service';
import { ShowService } from './services/show.service';
import { NotificationComponent } from './components/notification/notification.component';
import { ConfirmationComponent } from './components/confirmation/confirmation.component';
import { LoaderComponent } from './components/loader/loader.component';
import { AsyncPipe } from '@angular/common';
import { ShowComponent } from './components/show/show.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NotificationComponent, ConfirmationComponent, LoaderComponent, AsyncPipe, ShowComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {

  isConfirmationVisible = inject(ConfirmationService);

  title = 'Gastos';
  isNotificationVisible!: Observable<Boolean>;

  isLoading!: Observable<Boolean>;
  isShow!: Observable<Boolean>;
  isPreviewVisible!: Observable<Boolean>;
  constructor(
    private loaderService: LoaderService,
    private notificationService: NotificationService,
    private showService: ShowService,
  ) { }

  ngOnInit() {
    this.getNotificationState();
    this.getLoaderState();
    this.getShowState();
  }

  getNotificationState() {
    this.isNotificationVisible = this.notificationService.isVisible();
  }

  getLoaderState() {
    this.isLoading = this.loaderService.loading$
  }

  getShowState() {
    this.isShow = this.showService.show$;
  }
}
