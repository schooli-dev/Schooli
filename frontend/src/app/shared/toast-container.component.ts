import { Component, inject } from '@angular/core';
import { ToastService } from '../core/toast/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  templateUrl: './toast-container.component.html',
  styleUrl: './toast-container.component.scss'
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
}
