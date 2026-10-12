import { Component, Input, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { ToastService } from '../../core/toast/toast.service';
import { MaterialViewerComponent } from '../../shared/material-viewer/material-viewer.component';
import { detectPreviewKind } from '../../shared/material-viewer/material-preview.utils';

export type HomeworkFileItem = {
  key: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  /** Fetches the private file through the API (access is checked by the backend). */
  load: () => Observable<Blob>;
};

/** Open (in the in-app viewer, when the type can be previewed) and Download for private homework files. */
@Component({
  selector: 'app-homework-file-list',
  standalone: true,
  imports: [MaterialViewerComponent],
  template: `
    <ul class="list-unstyled d-grid gap-2 mb-0">
      @for (file of files; track file.key) {
        <li class="d-flex align-items-center gap-2 border rounded-3 bg-white px-3 py-2">
          <i class="bi bi-file-earmark text-primary flex-shrink-0"></i>
          <span class="min-w-0 flex-grow-1">
            <strong class="d-block text-truncate">{{ file.fileName }}</strong>
            @if (file.sizeBytes) { <small class="text-muted">{{ size(file.sizeBytes) }}</small> }
          </span>
          @if (canOpen(file)) {
            <button class="btn btn-sm btn-outline-primary" type="button" (click)="viewing.set(file)">Open</button>
          }
          <button class="btn btn-sm btn-outline-secondary" type="button" [disabled]="downloading() === file.key" (click)="download(file)">
            <i class="bi bi-download me-1"></i>Download
          </button>
        </li>
      }
    </ul>

    @if (viewing(); as file) {
      <app-material-viewer [material]="{ title: file.fileName, fileName: file.fileName, mimeType: file.mimeType }" [loader]="file.load" [allowDownload]="true" (closed)="viewing.set(null)" />
    }
  `
})
export class HomeworkFileListComponent {
  @Input({ required: true }) files: HomeworkFileItem[] = [];

  protected readonly viewing = signal<HomeworkFileItem | null>(null);
  protected readonly downloading = signal<string | null>(null);

  constructor(private readonly toasts: ToastService) {}

  protected canOpen(file: HomeworkFileItem): boolean {
    return detectPreviewKind(file.fileName, file.mimeType) !== 'unsupported';
  }

  protected size(bytes: number): string {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  protected download(file: HomeworkFileItem): void {
    this.downloading.set(file.key);
    file.load().subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = file.fileName;
        link.click();
        URL.revokeObjectURL(url);
        this.downloading.set(null);
      },
      error: () => {
        this.downloading.set(null);
        this.toasts.error('This file could not be downloaded.');
      }
    });
  }
}
