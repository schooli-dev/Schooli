import { Injectable, signal } from '@angular/core';

export type AppToastTone = 'success' | 'error' | 'info' | 'warning';

export type AppToast = {
  id: number;
  message: string;
  tone: AppToastTone;
};

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<AppToast[]>([]);
  private nextId = 1;

  show(message: string, tone: AppToastTone = 'info'): void {
    const trimmed = message.trim();

    if (!trimmed) {
      return;
    }

    const toast: AppToast = {
      id: this.nextId++,
      message: trimmed,
      tone
    };

    this.toasts.update((items) => [...items, toast]);
    window.setTimeout(() => this.dismiss(toast.id), 4200);
  }

  success(message: string): void {
    this.show(message, 'success');
  }

  error(message: string): void {
    this.show(message, 'error');
  }

  info(message: string): void {
    this.show(message, 'info');
  }

  warning(message: string): void {
    this.show(message, 'warning');
  }

  dismiss(id: number): void {
    this.toasts.update((items) => items.filter((toast) => toast.id !== id));
  }
}
