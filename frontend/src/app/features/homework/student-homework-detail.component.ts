import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { HomeworkApiService, HomeworkAttachment, HomeworkDetail } from '../../core/homework/homework-api.service';
import { ToastService } from '../../core/toast/toast.service';
import { HomeworkAttemptListComponent } from './homework-attempt-list.component';
import { HomeworkFileItem, HomeworkFileListComponent } from './homework-file-list.component';

/** One homework: instructions, teacher files, the submission form (by the configured type) and every attempt. */
@Component({
  selector: 'app-student-homework-detail',
  standalone: true,
  imports: [DatePipe, FormsModule, HomeworkAttemptListComponent, HomeworkFileListComponent],
  template: `
    <section class="page">
      <button class="btn btn-link px-0 mb-2" type="button" (click)="back()"><i class="bi bi-arrow-left me-1"></i>Back to Homework</button>

      @if (loading()) {
        <p class="text-muted">Loading...</p>
      } @else if (detail(); as hw) {
        <header class="mb-3">
          <h1 class="h3 fw-bold mb-1">{{ hw.title }}</h1>
          <p class="text-muted mb-0">{{ hw.moduleName || 'Custom homework' }}@if (hw.lessonTitle) { &bull; Class {{ hw.lessonNumber }} - {{ hw.lessonTitle }} } &bull; Teacher: {{ hw.teacherName }}</p>
        </header>

        <div class="border rounded-4 bg-white p-3 mb-3">
          <p class="mb-1"><strong>Due:</strong> {{ hw.dueDate ? (hw.dueDate | date: 'MMM d, y, h:mm a') : 'No due date' }} &nbsp; <strong>Max points:</strong> {{ hw.maxPoints ?? '-' }}</p>
          @if (hw.status === 'completed') { <p class="text-success fw-bold mb-1">Completed - {{ hw.latestPoints }}/{{ hw.maxPoints }}</p> }
          @if (hw.status === 'needs_revision') { <p class="text-danger fw-bold mb-1">Your teacher asked for a revision. Read the feedback below and resubmit.</p> }
          @if (hw.instructions) {
            <p class="fw-semibold mt-3 mb-1">Instructions</p>
            <p style="white-space: pre-line">{{ hw.instructions }}</p>
          }
          @if (hw.document?.sourceType === 'link' && hw.document?.externalUrl) {
            <p class="mb-2"><i class="bi bi-link-45deg me-1"></i><a [href]="hw.document!.externalUrl" target="_blank" rel="noopener noreferrer">Open homework document</a></p>
          }
          @if (documentFiles().length) { <app-homework-file-list [files]="documentFiles()" /> }
        </div>

        @if (hw.canSubmit) {
          <form class="border rounded-4 bg-white p-3 mb-3" (ngSubmit)="submit()">
            <h2 class="h5 fw-bold">{{ hw.attemptsDetail.length ? 'Resubmit (Attempt #' + (hw.attemptsDetail.length + 1) + ')' : 'Your submission' }}</h2>

            @if (showText()) {
              <label class="d-block mb-3">
                <span class="small text-muted">Your answer</span>
                <textarea class="form-control" rows="5" name="text" [(ngModel)]="text"></textarea>
              </label>
            }
            @if (showLink()) {
              <label class="d-block mb-3">
                <span class="small text-muted">Link (https://...)</span>
                <input class="form-control" type="url" name="link" [(ngModel)]="link" />
              </label>
            }
            @if (showFiles()) {
              <div class="mb-3">
                <span class="small text-muted d-block">Files (PDF, documents, slides, images, ZIP, code, video...)</span>
                <input class="form-control" type="file" multiple (change)="onFiles($event)" />
              </div>
            }
            <label class="d-block mb-3">
              <span class="small text-muted">Comment to teacher (optional)</span>
              <textarea class="form-control" rows="2" name="comment" [(ngModel)]="comment"></textarea>
            </label>

            @if (error()) { <div class="alert alert-danger py-2" role="alert">{{ error() }}</div> }
            <button class="btn btn-primary fw-bold" type="submit" [disabled]="submitting()">
              @if (submitting()) { <span class="spinner-border spinner-border-sm me-2"></span> }
              Submit
            </button>
          </form>
        }

        @if (hw.attemptsDetail.length) {
          <h2 class="h5 fw-bold">Your attempts</h2>
          <app-homework-attempt-list [homeworkId]="hw.id" [attempts]="hw.attemptsDetail" [maxPoints]="hw.maxPoints" />
        }
      } @else {
        <p class="text-muted">This homework could not be found.</p>
      }
    </section>
  `
})
export class StudentHomeworkDetailComponent implements OnInit {
  private readonly api = inject(HomeworkApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly detail = signal<HomeworkDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal('');

  protected text = '';
  protected link = '';
  protected comment = '';
  private files: File[] = [];

  protected readonly showText = computed(() => ['text', 'file_text'].includes(this.detail()?.submissionType ?? ''));
  protected readonly showLink = computed(() => this.detail()?.submissionType === 'link');
  protected readonly showFiles = computed(() => ['file', 'file_text'].includes(this.detail()?.submissionType ?? ''));

  protected readonly documentFiles = computed<HomeworkFileItem[]>(() => {
    const hw = this.detail();
    if (!hw) return [];
    const items: HomeworkFileItem[] = [];
    if (hw.document?.sourceType === 'file' && hw.document.fileName) {
      items.push({ key: 'document', fileName: hw.document.fileName, mimeType: hw.document.mimeType, sizeBytes: null, load: () => this.api.documentFile(hw.id) });
    }
    for (const file of hw.attachments) {
      items.push({ key: file.id, fileName: file.fileName, mimeType: file.mimeType, sizeBytes: file.sizeBytes, load: () => this.api.resourceFile(hw.id, file.id) });
    }
    return items;
  });

  ngOnInit(): void {
    this.reload();
  }

  private reload(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading.set(false);
      return;
    }
    this.api.detail(id).subscribe({
      next: (response) => {
        this.detail.set(response.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected back(): void {
    void this.router.navigate(['/student/homework'], { skipLocationChange: true });
  }

  protected onFiles(event: Event): void {
    this.files = Array.from((event.target as HTMLInputElement).files ?? []);
  }

  protected submit(): void {
    const hw = this.detail();
    if (!hw || this.submitting()) return;

    const text = this.text.trim();
    const link = this.link.trim();
    if (!text && !link && !this.files.length) {
      this.error.set('Add your answer, a link or a file before submitting.');
      return;
    }

    this.submitting.set(true);
    this.error.set('');
    const send = (files: HomeworkAttachment[]) =>
      this.api
        .submit(hw.id, { text: text || undefined, link: link || undefined, comment: this.comment.trim() || undefined, files })
        .subscribe({
          next: (response) => {
            this.submitting.set(false);
            this.detail.set(response.data);
            this.text = this.link = this.comment = '';
            this.files = [];
            this.toasts.success('Homework submitted. Your teacher has been notified.');
          },
          error: (error) => {
            this.submitting.set(false);
            this.error.set(error?.error?.message ?? 'Your homework could not be submitted.');
          }
        });

    if (!this.files.length) {
      send([]);
      return;
    }
    forkJoin(this.files.map((file) => this.api.uploadSubmissionFile(file))).subscribe({
      next: (responses) => send(responses.map((response) => response.data)),
      error: (error) => {
        this.submitting.set(false);
        this.error.set(error?.error?.message ?? 'A file could not be uploaded.');
      }
    });
  }
}
