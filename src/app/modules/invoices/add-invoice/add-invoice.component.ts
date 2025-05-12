import { Component, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  FormsModule,
} from '@angular/forms';
import { NotificationService } from '../../../services/notification.service';
import { CATEGORIES } from '../constants/categories';
import { InvoicesService } from '../services/invoices.service';
import { PROYECTS } from '../constants/proyects';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-add-invoice',
  standalone: true,
  imports: [ReactiveFormsModule, FormsModule],
  templateUrl: './add-invoice.component.html',
  styleUrl: './add-invoice.component.scss',
})
export default class AddInvoiceComponent {
  private invoiceService = inject(InvoicesService);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private notificationService = inject(NotificationService);
  private route = inject(ActivatedRoute);
  private sanitizer = inject(DomSanitizer);

  form: FormGroup = this.fb.group({
    proyect: ['', Validators.required],
    category: ['', Validators.required],
    file: [null, Validators.required],
  });

  id: string = this.route.snapshot.params['id'];
  categories = CATEGORIES;
  proyects = PROYECTS;
  previewImage: SafeUrl | null = null;
  selectedFile!: File;

  constructor() {
    this.initForm();
  }

  ngOnInit() {
    if (this.id) {
      this.getInvoice();
    }
  }

  getInvoice() {
    this.invoiceService.getInvoiceById(this.id).subscribe((res) => {
      console.log(res);
      this.form.patchValue({
        proyect: res.proyect,
        category: res.category,
        file: res.file,
      });
    });
  }

  initForm() {
    this.form = this.fb.group({
      proyect: ['1', Validators.required],
      category: ['food', Validators.required],
      file: [null, Validators.required],
    });
  }

  saveOrUpdate() {
    if (this.id) {
      this.update();
    } else {
      this.save();
    }
  }

  save() {
    if (this.form.valid) {
      this.uploadInvoice();
    }
  }

  update() {
    if (this.form.valid) {
      console.log('update');
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

  uploadInvoice() {
    const formData = new FormData();
    formData.append('invoice', this.selectedFile, this.selectedFile.name);
    formData.append('proyect', this.proyect?.value || '');
    formData.append('category', this.category?.value || '');
    this.invoiceService.uploadInvoice(formData).subscribe((res) => {
      this.notificationService.show('Factura subida correctamente', 'success');
      this.router.navigate(['/invoices']);
    });
  }

  openInvoice() {
    //open image in new tab if previewImage is not null
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

  get file() {
    return this.form.get('file');
  }
}
