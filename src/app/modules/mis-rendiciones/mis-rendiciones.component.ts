import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ExpenseReportsService } from '../../services/expense-reports.service';
import { UserStateService } from '../../services/user-state.service';
import { IExpenseReport } from '../../interfaces/expense-report.interface';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-mis-rendiciones',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './mis-rendiciones.component.html',
  styleUrls: ['./mis-rendiciones.component.scss']
})
export class MisRendicionesComponent implements OnInit {
  private expenseReportsService = inject(ExpenseReportsService);
  private userStateService = inject(UserStateService);

  expenseReports: IExpenseReport[] = [];
  isLoading = true;

  ngOnInit(): void {
    this.loadMyReports();
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
}
