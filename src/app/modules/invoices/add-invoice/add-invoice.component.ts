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

  form: FormGroup = this.fb.group({
    proyect: ['', Validators.required],
    category: ['', Validators.required],
    file: ['', Validators.required],
  });

  id: string = this.route.snapshot.params['id'];
  categories: ICategory[] = [];
  proyects: IProject[] = [];
  previewImage: SafeUrl | null = null;
  selectedFile!: File;

  percentage = signal(0);
  isLoading = signal(false);

  constructor() {
    this.initForm();
  }

  ngOnInit() {
    this.loadCategories();
    this.loadProjects();

    if (this.id) {
      this.getInvoice();
    }
  }

  loadCategories() {
    this.invoiceService.getCategories().subscribe({
      next: (categories) => {
        this.categories = categories;
      },
      error: (error) => {},
    });
  }

  loadProjects() {
    this.invoiceService.getProjects().subscribe({
      next: (projects) => {
        this.proyects = projects;
      },
      error: (error) => {},
    });
  }

  getInvoice() {
    this.invoiceService.getInvoiceById(this.id).subscribe((res) => {
      this.form.patchValue({
        proyect: res.proyect,
        category: res.category,
        file: res.file,
      });
    });
  }

  initForm() {
    this.form = this.fb.group({
      proyect: ['', Validators.required],
      category: ['', Validators.required],
      file: ['', Validators.required],
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
    if (this.form.valid) {
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
      const projectId = this.form.get('proyect')?.value;

      const selectedProject = this.proyects.find((p) => p._id === projectId);
      const projectName = selectedProject?.name || '';

      const payload = {
        proyect: projectId,
        projectName: projectName,
        category: this.form.get('category')?.value,
        imageUrl: this.form.get('file')?.value,
        status: 'pending' as InvoiceStatus,
      };

      this.invoiceService.analyzeInvoice(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.notificationService.show(
            'Factura subida correctamente',
            'success'
          );
          this.router.navigate(['/invoices']);
        },
        error: (error) => {
          this.isLoading.set(false);
          this.notificationService.show(
            'Error al subir la factura: ' +
              (error.message || 'Intente nuevamente'),
            'error'
          );
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

  get category() {
    return this.form.get('category');
  }

  get proyect() {
    return this.form.get('proyect');
  }

  get imageUrl() {
    return this.form.get('file');
  }
}
