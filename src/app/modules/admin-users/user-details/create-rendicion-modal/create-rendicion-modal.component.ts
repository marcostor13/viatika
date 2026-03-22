import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ExpenseReportsService } from '../../../../services/expense-reports.service';
import { NotificationService } from '../../../../services/notification.service';
import { UserStateService } from '../../../../services/user-state.service';
import { ICreateExpenseReport } from '../../../../interfaces/expense-report.interface';
import { InvoicesService } from '../../../../modules/invoices/services/invoices.service';
import { IProject } from '../../../../modules/invoices/interfaces/project.interface';

@Component({
  selector: 'app-create-rendicion-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-rendicion-modal.component.html',
  styleUrls: ['./create-rendicion-modal.component.scss']
})
export class CreateRendicionModalComponent {
  @Input() isOpen = false;
  @Input() collaboratorId: string = '';
  @Output() close = new EventEmitter<boolean>();
  
  private fb = inject(FormBuilder);
  private expenseReportsService = inject(ExpenseReportsService);
  private notificationService = inject(NotificationService);
  private userStateService = inject(UserStateService);
  private invoicesService = inject(InvoicesService);

  projects: IProject[] = [];

  form: FormGroup = this.fb.group({
    title: ['', Validators.required],
    description: [''],
    budget: [0, [Validators.required, Validators.min(0)]],
    projectId: ['', Validators.required]
  });

  ngOnInit() {
    this.loadProjects();
  }

  loadProjects() {
    const user = this.userStateService.getUser() as any;
    if (user) {
      const clientId = user.companyId || (user.client?._id) || (user.clientId?._id) || user.clientId;
      if (clientId) {
        this.invoicesService.getProjects(clientId).subscribe({
          next: (data) => this.projects = data,
          error: (err) => console.error('Error loading projects', err)
        });
      } else {
        console.warn('No clientId found to load projects');
      }
    }
  }

  closeModal(success: boolean = false) {
    this.form.reset({ budget: 0, title: '', description: '', projectId: '' });
    this.close.emit(success);
  }

  onSubmit() {
    if (this.form.invalid) {
      this.notificationService.show('Por favor completa todos los campos requeridos', 'error');
      return;
    }

    const currentUser = this.userStateService.getUser() as any;
    if (!currentUser) {
      this.notificationService.show('Error con la sesión actual', 'error');
      return;
    }

    const clientId = currentUser.companyId || (currentUser.client?._id) || (currentUser.clientId?._id) || currentUser.clientId;
    if (!clientId) {
      this.notificationService.show('No se pudo identificar la empresa asociada a tu usuario', 'error');
      return;
    }

    const payload: ICreateExpenseReport = {
      ...this.form.value,
      userId: this.collaboratorId,
      clientId: clientId
    };

    this.expenseReportsService.create(payload).subscribe({
      next: () => {
        this.notificationService.show('Rendición creada exitosamente', 'success');
        this.closeModal(true);
      },
      error: (err) => {
        console.error('Error creating rendicion', err);
        this.notificationService.show('Ocurrió un error al crear la rendición', 'error');
      }
    });
  }
}
