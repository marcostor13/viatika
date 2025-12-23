import { Component, input, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './button.component.html',
  styleUrl: './button.component.scss',
})
export class ButtonComponent {
  // Required inputs
  label = input.required<string>();
  
  // Optional inputs
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  disabled = input<boolean>(false);
  fullWidth = input<boolean>(false);
  type = input<'button' | 'submit' | 'reset'>('button');
  
  // Outputs
  clicked = output<void>();

  // Computed classes
  buttonClasses = computed(() => {
    const base = 'font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2';
    
    const variants = {
      primary: 'bg-primary text-quaternary hover:bg-primary/90 shadow-soft hover:shadow-lg',
      secondary: 'bg-transparent border border-tertiary text-secondary hover:bg-background hover:border-primary',
      ghost: 'bg-transparent text-tertiary hover:text-primary hover:bg-background',
      danger: 'bg-error text-quaternary hover:bg-error/90 shadow-soft hover:shadow-lg',
    };
    
    const sizes = {
      sm: 'px-4 py-2 text-sm rounded-lg',
      md: 'px-6 py-3 text-base rounded-xl',
      lg: 'px-8 py-4 text-lg rounded-xl',
    };
    
    const width = this.fullWidth() ? 'w-full' : '';
    
    return `${base} ${variants[this.variant()]} ${sizes[this.size()]} ${width}`;
  });

  onClick(): void {
    if (!this.disabled()) {
      this.clicked.emit();
    }
  }
}

