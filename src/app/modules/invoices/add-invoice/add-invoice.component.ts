import { Component, inject, signal, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { NotificationService } from '../../../services/notification.service';
import { InvoicesService } from '../services/invoices.service';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { UploadService } from '../../../services/upload.service';
import { environment } from '../../../../environments/environment';
import { CommonModule } from '@angular/common';
import { IProject } from '../interfaces/project.interface';
import { ICategory } from '../interfaces/category.interface';
import { InvoiceStatus } from '../interfaces/invoices.interface';

@Component({
  selector: 'app-add-invoice',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule, CommonModule],
  templateUrl: './add-invoice.component.html',
  styleUrl: './add-invoice.component.scss',
})
export default class AddInvoiceComponent implements OnInit {
  private invoiceService = inject(InvoicesService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);
  private uploadService = inject(UploadService);

  form!: FormGroup;
  id: string = this.route.snapshot.params['id'];
  categories: ICategory[] = [];
  proyects: IProject[] = [];
  previewImage: SafeUrl | null = null;
  selectedFile!: File;
  originalInvoice: any = null;

  percentage = signal(0);
  isLoading = signal(false);

  constructor() {
    this.initForm();
  }

  private formatDateForInput(dateValue: any): string {
    if (!dateValue) return '';

    let date: Date;

    if (typeof dateValue === 'string') {
      const dateStr = dateValue.trim();

      if (dateStr.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        const parts = dateStr.split(/[-\/]/);
        const day = parts[0];
        const month = parts[1];
        const year = parts[2];
        date = new Date(`${year}-${month}-${day}`);
      } else {
        date = new Date(dateStr);
      }
    } else {
      date = new Date(dateValue);
    }

    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida:', dateValue);
      return '';
    }

    return date.toISOString().slice(0, 10);
  }

  ngOnInit() {
    this.loadCategories();
    this.loadProjects();

    if (this.id) {
      this.invoiceService
        .getInvoiceById(this.id)
        .subscribe((res) => {
          this.originalInvoice = res;
          let dataObj: any = {};
          if (res.data) {
            try {
              dataObj =
                typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
            } catch { }
          }

          let fecha = '';

          if (dataObj.fechaEmision) {
            fecha = this.formatDateForInput(dataObj.fechaEmision);
          } else if (res.date) {
            fecha = this.formatDateForInput(res.date);
          } else if ((res as any).fechaEmision) {
            fecha = this.formatDateForInput((res as any).fechaEmision);
          }

          this.form.patchValue({
            ...res,
            fechaEmision: fecha,
            rucEmisor: dataObj.rucEmisor || '',
            serie: dataObj.serie || '',
            correlativo: dataObj.correlativo || '',
            proyectId: res.proyectId?._id || res.proyectId || '',
            categoryId: res.categoryId?._id || res.categoryId || '',
          });
        });
    }
  }

  loadCategories() {
    this.invoiceService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => { },
    });
  }

  loadProjects() {
    this.invoiceService.getProjects().subscribe({
      next: (projects) => {
        this.proyects = projects;
      }
    });

  }

  initForm() {
    this.form = this.fb.group({
      proyectId: ['', Validators.required],
      categoryId: ['', Validators.required],
      file: ['', Validators.required],
      fechaEmision: [''],
      rucEmisor: [''],
      serie: [''],
      correlativo: [''],
    });
  }

  saveOrUpdate() {
    if (this.id) {
      this.update();
    } else {
      if (!this.selectedFile) {
        this.notificationService.show(
          'Debes seleccionar un archivo de factura',
          'error'
        );
        return;
      }
      this.isLoading.set(true);
      this.uploadFile();
    }
  }

  update() {
    if (this.form.valid && this.originalInvoice) {
      const formValue = this.form.value;
      let dataObj: any = {};
      const currentData = this.originalInvoice.data || '';
      if (currentData) {
        try {
          dataObj =
            typeof currentData === 'string'
              ? JSON.parse(currentData)
              : currentData;
        } catch { }
      }
      dataObj.rucEmisor = formValue.rucEmisor;
      dataObj.fechaEmision = formValue.fechaEmision;
      dataObj.serie = formValue.serie;
      dataObj.correlativo = formValue.correlativo;
      const {
        file,
        fechaEmision,
        _id,
        createdAt,
        updatedAt,
        __v,
        createdBy,
        approvedBy,
        rejectedBy,
        rejectionReason,
        statusDate,
        ...rest
      } = this.originalInvoice;
      const payload = {
        ...rest,
        proyectId: formValue.proyectId,
        categoryId: formValue.categoryId,
        fechaEmision: formValue.fechaEmision,
        data: JSON.stringify(dataObj),
      };
      this.invoiceService.updateInvoice(this.id, payload).subscribe({
        next: () => {
          this.notificationService.show(
            'Factura actualizada correctamente',
            'success'
          );
          this.router.navigate(['/invoices']);
        },
        error: (error: any) => {
          this.notificationService.show(
            'Error al actualizar la factura: ' +
            (error.message || 'Intente nuevamente'),
            'error'
          );
        },
      });
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      this.previewImage = this.sanitizer.bypassSecurityTrustUrl(
        URL.createObjectURL(this.selectedFile)
      );
      this.form.patchValue({ file: this.selectedFile });
    }
  }

  uploadFile() {
    this.percentage.set(10);
    const { uploadProgress$, downloadUrl$ } = this.uploadService.uploadFile(
      this.selectedFile,
      environment.storagePath
    );
    uploadProgress$.subscribe((progress) => {
      if (progress === 0) {
        progress = 10;
      }
      this.percentage.set(Math.round(progress));
    });
    downloadUrl$.subscribe({
      next: (url) => {
        this.form.patchValue({ file: url });
        this.save();
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.show(
          'Error al subir el archivo: ' + error.message,
          'error'
        );
      },
    });
  }

  save() {
    if (this.form.valid) {
      const payload = {
        categoryId: this.form.get('categoryId')?.value,
        proyectId: this.form.get('proyectId')?.value,
        imageUrl: this.form.get('file')?.value,
        status: 'pending' as InvoiceStatus,
      };

      this.invoiceService.analyzeInvoice(payload).subscribe({
        next: (res) => {
          if (res && res._id) {
            let dataObj: any = {};
            if (res.data) {
              try {
                dataObj =
                  typeof res.data === 'string'
                    ? JSON.parse(res.data)
                    : res.data;
              } catch { }
            }

            if (dataObj.fechaEmision) {
              const updatePayload = {
                ...res,
                fechaEmision: dataObj.fechaEmision,
                data: JSON.stringify(dataObj),
              };

              this.invoiceService
                .updateInvoice(res._id, updatePayload)
                .subscribe({
                  next: () => {
                    this.isLoading.set(false);
                    this.notificationService.show(
                      'Factura subida correctamente',
                      'success'
                    );
                    this.router.navigate(['/invoices']);
                  },
                  error: (updateError) => {
                    console.warn(
                      'Error al actualizar fechaEmision:',
                      updateError
                    );
                    this.isLoading.set(false);
                    this.notificationService.show(
                      'Factura subida correctamente',
                      'success'
                    );
                    this.router.navigate(['/invoices']);
                  },
                });
            } else {
              this.isLoading.set(false);
              this.notificationService.show(
                'Factura subida correctamente',
                'success'
              );
              this.router.navigate(['/invoices']);
            }
          } else {
            this.isLoading.set(false);
            this.notificationService.show(
              'Factura subida correctamente',
              'success'
            );
            this.router.navigate(['/invoices']);
          }
        },
        error: (error) => {
          this.isLoading.set(false);
          const errorMessage =
            error.error?.message || error.message || 'Intente nuevamente';

          if (error.status === 409) {
            this.notificationService.show(errorMessage, 'error');
          } else {
            this.notificationService.show(
              'Error al analizar la factura: ' + errorMessage,
              'error'
            );
          }
        },
      });
    } else {
      this.isLoading.set(false);
      this.notificationService.show(
        'Por favor complete todos los campos requeridos',
        'error'
      );
    }
  }

  openInvoice() {
    if (this.previewImage) {
      window.open(this.previewImage as string, '_blank');
    }
  }

  back() {
    this.router.navigate(['/invoices']);
  }

  get categoryId() {
    return this.form.get('categoryId');
  }

  get proyectId() {
    return this.form.get('proyectId');
  }

  get imageUrl() {
    return this.form.get('file');
  }

  get serie() {
    return this.form.get('serie');
  }

  get correlativo() {
    return this.form.get('correlativo');
  }
}
