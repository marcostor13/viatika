import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseReportsService } from '../../services/expense-reports.service';
import { UserStateService } from '../../services/user-state.service';
import { IExpenseReport } from '../../interfaces/expense-report.interface';
import { RouterModule } from '@angular/router';
import { CreateRendicionModalComponent } from '../admin-users/user-details/create-rendicion-modal/create-rendicion-modal.component';
import { SolicitudViaticosModalComponent } from './solicitud-viaticos-modal/solicitud-viaticos-modal.component';
import { AdvanceService } from '../../services/advance.service';
import {
  IAdvance,
  ADVANCE_STATUS_LABELS,
  ADVANCE_STATUS_COLORS,
} from '../../interfaces/advance.interface';

@Component({
  selector: 'app-mis-rendiciones',
  standalone: true,
  imports: [CommonModule, RouterModule, CreateRendicionModalComponent, SolicitudViaticosModalComponent],
  templateUrl: './mis-rendiciones.component.html',
  styleUrls: ['./mis-rendiciones.component.scss']
})
export class MisRendicionesComponent implements OnInit {
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);
  private advanceService = inject(AdvanceService);

  expenseReports: IExpenseReport[] = [];
  myAdvances: IAdvance[] = [];
  isLoading = true;
  showCreateModal = false;
  showViaticosModal = false;
  /** Solicitud rechazada que se edita en el modal (Fase 3). */
  advanceForResubmit: IAdvance | null = null;
  showGuidelines = signal(false);

  readonly ADVANCE_STATUS_LABELS = ADVANCE_STATUS_LABELS;
  readonly ADVANCE_STATUS_COLORS = ADVANCE_STATUS_COLORS;

  toggleGuidelines() {
    this.showGuidelines.update(v => !v);
  }

  get currentUserId(): string {
    return (this.userStateService.getUser() as any)?._id ?? '';
  }

  ngOnInit(): void {
    this.loadMyReports();
    this.loadMyAdvances();
  }

  loadMyAdvances() {
    const user = this.userStateService.getUser() as Record<string, unknown> | null;
    const clientId =
      (user?.['companyId'] as string) ||
      ((user?.['client'] as { _id?: string })?._id ?? '') ||
      ((user?.['clientId'] as { _id?: string })?._id ?? '') ||
      (typeof user?.['clientId'] === 'string' ? (user['clientId'] as string) : '');
    if (!user?.['_id'] || !clientId) return;
    this.advanceService.findMy().subscribe({
      next: (list) => {
        this.myAdvances = list ?? [];
      },
      error: () => {
        this.myAdvances = [];
      },
    });
  }

  loadMyReports() {
    this.isLoading = true;
    const user = this.userStateService.getUser() as any;

    if (user && user._id) {
      const clientId = user.companyId || (user.client?._id) || (user.clientId?._id) || user.clientId;

      if (clientId) {
        this.expenseReportsService.findAllByUser(user._id, clientId).subscribe({
          next: (reports) => {
            this.expenseReports = reports;
            this.isLoading = false;
          },
          error: (err) => {
            console.error('Error loading reports', err);
            this.isLoading = false;
          }
        });
      } else {
        console.warn('No clientId found for user');
        this.isLoading = false;
      }
    } else {
      this.isLoading = false;
    }
  }

  openCreateModal() {
    this.showCreateModal = true;
  }

  openViaticosModal() {
    this.advanceForResubmit = null;
    this.showViaticosModal = true;
  }

  openResubmitAdvance(advance: IAdvance) {
    this.advanceForResubmit = advance;
    this.showViaticosModal = true;
  }

  onViaticosModalClosed(success: boolean) {
    this.showViaticosModal = false;
    this.advanceForResubmit = null;
    if (success) {
      this.loadMyAdvances();
    }
  }

  advanceProjectLabel(adv: IAdvance): string {
    const p = adv.projectId;
    if (p && typeof p === 'object' && 'name' in p) {
      const code = (p as { code?: string }).code ?? '—';
      return `[${code} — ${(p as { name: string }).name}]`;
    }
    return 'Centro de costo';
  }

  onModalClose(success: boolean) {
    this.showCreateModal = false;
    if (success) {
      this.loadMyReports();
    }
  }
}
