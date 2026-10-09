import { CommonModule } from '@angular/common';
import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Observable } from 'rxjs';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { PreviewKind, detectPreviewKind, fileExtension } from './material-preview.utils';

export type ViewerMaterial = { title: string; fileName: string | null; mimeType: string | null };

/** Renders a private learning-material file inside the website. It never triggers a browser download. */
@Component({
  selector: 'app-material-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './material-viewer.component.html',
  styleUrl: './material-viewer.component.scss'
})
export class MaterialViewerComponent implements OnInit, OnDestroy {
  @Input({ required: true }) material!: ViewerMaterial;
  @Input({ required: true }) loader!: () => Observable<Blob>;
  /** Lets non-admin users save a copy too (used for homework files, where students need their own documents). */
  @Input() allowDownload = false;
  @Output() closed = new EventEmitter<void>();
  @ViewChild('officeHost') private officeHost?: ElementRef<HTMLDivElement>;

  protected readonly kind = signal<PreviewKind>('unsupported');
  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly frameUrl = signal<SafeResourceUrl | null>(null);
  protected readonly mediaUrl = signal<string | null>(null);
  protected readonly textContent = signal('');
  private objectUrl: string | null = null;

  /** Administrators may always save a copy; others only when the host allows it. */
  protected canDownload = false;
  private readonly isAdmin: boolean;
  private sourceBlob: Blob | null = null;

  protected readonly zoom = signal(1);
  private readonly zoomSteps = [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3];

  constructor(private readonly sanitizer: DomSanitizer, tokens: AuthTokenService) {
    this.isAdmin = tokens.getRoles().includes('admin');
  }

  protected canZoom(): boolean {
    return this.kind() !== 'video' && this.kind() !== 'unsupported' && !this.loading() && !this.error();
  }

  protected zoomIn(): void {
    const next = this.zoomSteps.find((step) => step > this.zoom() + 0.001);
    if (next) this.zoom.set(next);
  }

  protected zoomOut(): void {
    const previous = [...this.zoomSteps].reverse().find((step) => step < this.zoom() - 0.001);
    if (previous) this.zoom.set(previous);
  }

  protected resetZoom(): void {
    this.zoom.set(1);
  }

  ngOnInit(): void {
    this.canDownload = this.isAdmin || this.allowDownload;
    const kind = detectPreviewKind(this.material.fileName, this.material.mimeType);
    this.kind.set(kind);
    if (kind === 'unsupported') {
      this.loading.set(false);
      return;
    }
    this.loader().subscribe({
      next: (blob) => void this.render(kind, blob),
      error: () => this.fail('This file could not be opened.')
    });
  }

  ngOnDestroy(): void {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }

  @HostListener('document:keydown.escape')
  protected close(): void {
    this.closed.emit();
  }

  protected blockContextMenu(event: Event): void {
    if (!this.canDownload) event.preventDefault();
  }

  protected download(): void {
    if (!this.canDownload) return;
    if (this.sourceBlob) {
      this.saveBlob(this.sourceBlob);
      return;
    }
    this.loader().subscribe({ next: (blob) => this.saveBlob(blob) });
  }

  private saveBlob(blob: Blob): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = this.material.fileName ?? this.material.title;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  protected extensionLabel(): string {
    return fileExtension(this.material.fileName).toUpperCase() || 'These';
  }

  private async render(kind: PreviewKind, blob: Blob): Promise<void> {
    try {
      this.sourceBlob = blob;
      if (kind === 'pdf') {
        this.objectUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
        this.frameUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(`${this.objectUrl}#toolbar=0&navpanes=0`));
      } else if (kind === 'image' || kind === 'video') {
        this.objectUrl = URL.createObjectURL(blob);
        this.mediaUrl.set(this.objectUrl);
      } else if (kind === 'text') {
        this.textContent.set(await blob.text());
      } else if (kind === 'docx') {
        this.loading.set(false);
        await this.nextFrame();
        const { renderAsync } = await import('docx-preview');
        await renderAsync(blob, this.officeHost!.nativeElement, undefined, { inWrapper: true, breakPages: true, ignoreLastRenderedPageBreak: true });
      } else if (kind === 'pptx') {
        this.loading.set(false);
        await this.nextFrame();
        const { init } = await import('pptx-preview');
        const host = this.officeHost!.nativeElement;
        const previewer = init(host, { width: Math.max(320, Math.min(host.clientWidth - 8, 960)), mode: 'list' });
        await previewer.preview(await blob.arrayBuffer());
      }
      this.loading.set(false);
    } catch {
      this.fail('This file could not be previewed. It may be damaged or protected.');
    }
  }

  private fail(message: string): void {
    this.error.set(message);
    this.loading.set(false);
  }

  private nextFrame(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve));
  }
}
