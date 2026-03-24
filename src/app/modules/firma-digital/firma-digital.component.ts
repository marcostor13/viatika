import { Component, ElementRef, ViewChild, AfterViewInit, HostListener, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { UserStateService } from '../../services/user-state.service';
import { NotificationService } from '../../services/notification.service';
import { environment } from '../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

@Component({
  selector: 'app-firma-digital',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './firma-digital.component.html',
  styleUrls: ['./firma-digital.component.scss']
})
export class FirmaDigitalComponent implements AfterViewInit, OnInit {
  @ViewChild('signatureCanvas', { static: false }) signatureCanvas!: ElementRef<HTMLCanvasElement>;
  
  private cx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private lastPos = { x: 0, y: 0 };
  
  private userStateService = inject(UserStateService);
  private notificationService = inject(NotificationService);
  private http = inject(HttpClient);
  private router = inject(Router);

  isSaving = false;
  hasSignature = false;
  savedSignatureImage: string | null = null;

  ngOnInit() {
    // Load existing signature if available
    const user = this.userStateService.getUser() as any;
    if (user?.signature) {
      this.savedSignatureImage = user.signature;
      this.hasSignature = true;
    }
  }

  ngAfterViewInit(): void {
    if (this.signatureCanvas) {
      this.initCanvas();
    }
  }

  private initCanvas(): void {
    const canvasEl: HTMLCanvasElement = this.signatureCanvas.nativeElement;
    // Setup context
    this.cx = canvasEl.getContext('2d')!;
    this.cx.lineWidth = 3;
    this.cx.lineCap = 'round';
    this.cx.lineJoin = 'round';
    this.cx.strokeStyle = '#000000';
    
    // Clear the canvas to be transparent
    this.cx.clearRect(0, 0, canvasEl.width, canvasEl.height);
  }

  private getCanvasPos(evt: MouseEvent | TouchEvent) {
    const rect = this.signatureCanvas.nativeElement.getBoundingClientRect();
    let clientX, clientY;
    
    if (evt instanceof MouseEvent) {
      clientX = evt.clientX;
      clientY = evt.clientY;
    } else {
      clientX = evt.touches[0].clientX;
      clientY = evt.touches[0].clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  onPointerDown(e: MouseEvent | TouchEvent): void {
    e.preventDefault();
    this.isDrawing = true;
    const pos = this.getCanvasPos(e);
    this.lastPos = pos;
    // Draw dot for simple clicks
    this.cx.beginPath();
    this.cx.arc(pos.x, pos.y, this.cx.lineWidth / 2, 0, Math.PI * 2);
    this.cx.fill();
    this.cx.beginPath();
    this.cx.moveTo(pos.x, pos.y);
    this.hasSignature = true;
  }

  onPointerMove(e: MouseEvent | TouchEvent): void {
    if (!this.isDrawing) return;
    e.preventDefault();
    const currentPos = this.getCanvasPos(e);
    
    this.cx.beginPath();
    this.cx.moveTo(this.lastPos.x, this.lastPos.y);
    this.cx.lineTo(currentPos.x, currentPos.y);
    this.cx.stroke();
    
    this.lastPos = currentPos;
  }

  onPointerUp(): void {
    this.isDrawing = false;
  }

  clearSignature(): void {
    const canvasEl = this.signatureCanvas.nativeElement;
    this.cx.clearRect(0, 0, canvasEl.width, canvasEl.height);
    this.hasSignature = false;
  }

  deleteSavedSignature(): void {
    if (confirm('¿Estás seguro de eliminar tu firma configurada?')) {
      this.saveSignature(true);
    }
  }

  startNewSignature(): void {
    this.savedSignatureImage = null;
    this.hasSignature = false;
    setTimeout(() => {
      this.initCanvas();
    }, 0);
  }

  saveSignature(clear = false): void {
    if (!this.hasSignature && !clear && !this.savedSignatureImage) {
      this.notificationService.show('Por favor, dibuja tu firma antes de guardar.', 'warning');
      return;
    }
    
    let base64Signature = '';
    if (!clear && !this.savedSignatureImage) {
      const canvasEl = this.signatureCanvas.nativeElement;
      // Trimming empty space from canvas would be nice but simple canvas DataURL works for now.
      base64Signature = canvasEl.toDataURL('image/png');
    } else if (!clear && this.savedSignatureImage) {
       // Already has saved signature, just exiting
       return;
    }
    
    this.isSaving = true;
    this.http.patch(`${environment.api}/user/profile/signature`, { signature: base64Signature }).subscribe({
      next: (res: any) => {
        this.notificationService.show(clear ? 'Firma eliminada exitosamente' : 'Firma guardada exitosamente.', 'success');
        this.isSaving = false;
        
        // Update local user state
        const user = this.userStateService.getUser() as any;
        if (user) {
          user.signature = base64Signature;
          this.userStateService.setUser(user);
        }
        
        if (clear) {
          this.startNewSignature();
        } else {
          this.savedSignatureImage = base64Signature;
        }
      },
      error: (e) => {
        this.isSaving = false;
        this.notificationService.show('Error al guardar la firma', 'error');
        console.error(e);
      }
    });
  }
}
