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
import {
  InvoiceStatus,
  SunatValidationInfo,
} from '../interfaces/invoices.interface';

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
  sunatValidation: SunatValidationInfo | null = null;
  isSunatValidating = signal(false);

  percentage = signal(0);
  isLoading = signal(false);

  constructor() {
    this.initForm();
  }

  private isPdfFile(file: File | null | undefined): boolean {
    if (!file) return false;
    const mimeType = (file.type || '').toLowerCase();
    const name = (file.name || '').toLowerCase();
    return mimeType.includes('pdf') || name.endsWith('.pdf');
  }

  private formatDateForInput(dateValue: any): string {
    if (!dateValue) return '';

    let date: Date;

    if (typeof dateValue === 'string') {
      const dateStr = dateValue.trim();

      if (dateStr.match(/^\d{2}[-\/]\d{2}[-\/]\d{4}$/)) {
        const parts = dateStr.split(/[-\/]/);
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        date = new Date(year, month, day);
      } else if (dateStr.match(/^\d{4}[-\/]\d{2}[-\/]\d{2}$/)) {
        date = new Date(dateStr);
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

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  }

  private formatDateForBackend(dateValue: string): string {
    if (!dateValue) return '';

    if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const parts = dateValue.split('-');
      const year = parts[0];
      const month = parts[1];
      const day = parts[2];
      return `${day}-${month}-${year}`;
    }

    if (dateValue.match(/^\d{2}-\d{2}-\d{4}$/)) {
      return dateValue;
    }

    const date = new Date(dateValue);
    if (isNaN(date.getTime())) {
      console.warn('Fecha inválida para backend:', dateValue);
      return dateValue;
    }

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${day}-${month}-${year}`;
  }

  ngOnInit() {
    this.loadCategories();
    this.loadProjects();

    if (this.id) {
      this.form.get('file')?.clearValidators();
      this.form.get('file')?.updateValueAndValidity();

      this.invoiceService.getInvoiceById(this.id).subscribe({
        next: (res) => {
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

          const formValues = {
            ...res,
            fechaEmision: fecha,
            rucEmisor: dataObj.rucEmisor || '',
            serie: dataObj.serie || '',
            correlativo: dataObj.correlativo || '',
            proyectId: res.proyectId?._id || res.proyectId || '',
            categoryId: res.categoryId?._id || res.categoryId || '',
          };

          this.form.patchValue(formValues);
        },
        error: (error) => {
          console.error('Error al cargar la factura:', error);
          this.notificationService.show(
            'Error al cargar la factura: ' +
            (error.message || 'Intente nuevamente'),
            'error'
          );
        },
      });
    } else {
      this.form.get('file')?.setValidators([Validators.required]);
      this.form.get('file')?.updateValueAndValidity();
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
      },
    });
  }

  initForm() {
    this.form = this.fb.group({
      proyectId: ['', Validators.required],
      categoryId: ['', Validators.required],
      file: [''],
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
      const isPdf = this.isPdfFile(this.selectedFile);
      if (isPdf) {
        this.uploadPdfDirectly();
      } else {
        this.uploadFile();
      }
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
      dataObj.fechaEmision = this.formatDateForBackend(formValue.fechaEmision);
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
        fechaEmision: this.formatDateForBackend(formValue.fechaEmision),
        data: JSON.stringify(dataObj),
      };

      this.isLoading.set(true);

      this.invoiceService.updateInvoice(this.id, payload).subscribe({
        next: (response) => {
          if (this.shouldValidateWithSunat(formValue)) {
            this.validateWithSunat();
          } else {
            this.isLoading.set(false);
            this.notificationService.show(
              'Factura actualizada correctamente',
              'success'
            );
            this.router.navigate(['/invoices']);
          }
        },
        error: (error: any) => {
          this.isLoading.set(false);
          console.error('Error al actualizar:', error);
          this.notificationService.show(
            'Error al actualizar la factura: ' +
            (error.message || 'Intente nuevamente'),
            'error'
          );
        },
      });
    } else {
      if (!this.form.valid) {
        // Formulario inválido
      }
    }
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      console.log(this.selectedFile);
      if (!this.isPdfFile(this.selectedFile)) {
        this.previewImage = this.sanitizer.bypassSecurityTrustUrl(
          URL.createObjectURL(this.selectedFile)
        );
      } else {
        this.previewImage = null;
      }
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

  private uploadPdfDirectly() {
    const formData = new FormData();
    formData.append('file', this.selectedFile);
    formData.append('proyectId', this.form.get('proyectId')?.value);
    formData.append('categoryId', this.form.get('categoryId')?.value);
    formData.append('status', 'pending');

    this.percentage.set(10);
    this.invoiceService.analyzePdf(formData).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.notificationService.show('Factura PDF analizada correctamente', 'success');
        this.router.navigate(['/invoices']);
      },
      error: (error) => {
        this.isLoading.set(false);
        const errorMessage = error.error?.message || error.message || 'Intente nuevamente';
        this.notificationService.show('Error al analizar PDF: ' + errorMessage, 'error');
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
                fechaEmision: this.formatDateForBackend(dataObj.fechaEmision),
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

  private shouldValidateWithSunat(formValue: any): boolean {
    return !!(
      formValue.rucEmisor &&
      formValue.serie &&
      formValue.correlativo &&
      formValue.fechaEmision
    );
  }

  private validateWithSunat() {
    this.isSunatValidating.set(true);

    const clientId =
      this.originalInvoice?.clientId?._id || this.originalInvoice?.clientId;

    if (!clientId) {
      this.isSunatValidating.set(false);
      this.isLoading.set(false);
      this.notificationService.show(
        'No se pudo obtener el ID de la empresa para validar con SUNAT',
        'error'
      );
      this.router.navigate(['/invoices']);
      return;
    }

    this.invoiceService.getSunatValidation(this.id, clientId).subscribe({
      next: (validationResult: SunatValidationInfo) => {
        this.isSunatValidating.set(false);
        this.isLoading.set(false);
        this.sunatValidation = validationResult;

        this.showSunatValidationResult(validationResult);

        this.router.navigate(['/invoices']);
      },
      error: (error) => {
        this.isSunatValidating.set(false);
        this.isLoading.set(false);
        console.error('Error al validar con SUNAT:', error);

        this.notificationService.show(
          'Factura actualizada correctamente, pero hubo un error al validar con SUNAT',
          'error'
        );
        this.router.navigate(['/invoices']);
      },
    });
  }

  private showSunatValidationResult(validation: SunatValidationInfo) {
    let message = '';
    let type: 'success' | 'error' = 'success';

    if (validation.sunatValidation) {
      switch (validation.sunatValidation.status) {
        case 'VALIDO_ACEPTADO':
          message =
            'Factura validada correctamente con SUNAT - Comprobante válido';
          type = 'success';
          break;
        case 'VALIDO_NO_PERTENECE':
          message =
            'Comprobante válido en SUNAT pero no pertenece a esta empresa';
          type = 'error';
          break;
        case 'NO_ENCONTRADO':
          message = 'Comprobante no encontrado en SUNAT';
          type = 'error';
          break;
        case 'ERROR_SUNAT':
          message =
            'Error al validar con SUNAT: ' + validation.sunatValidation.message;
          type = 'error';
          break;
        default:
          message =
            'Resultado de validación SUNAT: ' +
            validation.sunatValidation.message;
          type = 'error';
      }
    } else {
      message = 'No se pudo obtener información de validación SUNAT';
      type = 'error';
    }

    this.notificationService.show(message, type);
  }
}
