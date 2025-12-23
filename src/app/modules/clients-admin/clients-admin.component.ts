import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DataComponent } from '../../components/data/data.component';
import { IHeaderList } from '../../interfaces/header-list.interface';

interface IClient {
  _id: string;
  comercialName: string;
  businessName: string;
  businessId: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  createdAt?: string;
}

@Component({
  selector: 'app-clients-admin',
  standalone: true,
  imports: [CommonModule, DataComponent],
  templateUrl: './clients-admin.component.html',
  styleUrl: './clients-admin.component.scss',
})
export class ClientsAdminComponent implements OnInit {
  private http = inject(HttpClient);

  headers: IHeaderList[] = [
    { header: 'Nombre Comercial', value: 'comercialName' },
    { header: 'Razón Social', value: 'businessName' },
    { header: 'RUC', value: 'businessId' },
    { header: 'Email', value: 'email' },
    { header: 'Teléfono', value: 'phone' },
    { header: 'Acciones', value: 'actions', options: ['view'] },
  ];

  clients: IClient[] = [];

  ngOnInit(): void {
    this.loadClients();
  }

  loadClients(): void {
    this.http
      .get<IClient[]>(`${environment.api}/client`)
      .subscribe((clients) => {
        this.clients = clients || [];
      });
  }

  clickOptions(event: { option: string; _id: string }): void {
    // Espacio para futuras acciones (editar cliente, ver detalle, etc.)
    console.log('Client action', event);
  }
}