import { DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { HomeworkApiService, HomeworkAttempt } from '../../core/homework/homework-api.service';
import { HomeworkFileItem, HomeworkFileListComponent } from './homework-file-list.component';

/** Every attempt is kept separately, newest first: what was submitted, the points and the teacher's feedback. */
@Component({
  selector: 'app-homework-attempt-list',
  standalone: true,
  imports: [DatePipe, HomeworkFileListComponent],
  template: `
    <div class="d-grid gap-3">
      @for (attempt of ordered(); track attempt.id) {
        <section class="border rounded-4 bg-white p-3">
          <div class="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
            <strong>Attempt #{{ attempt.attemptNumber }}</strong>
            <span class="badge rounded-pill" [class]="badgeClass(attempt.status)">{{ label(attempt.status) }}</span>
          </div>
          <p class="small text-muted mb-2">Submitted {{ attempt.submittedAt | date: 'MMM d, y, h:mm a' }}</p>

          @if (attempt.text) {
            <p class="mb-2" style="white-space: pre-line">{{ attempt.text }}</p>
          }
          @if (attempt.link) {
            <p class="mb-2"><i class="bi bi-link-45deg me-1"></i><a [href]="attempt.link" target="_blank" rel="noopener noreferrer">{{ attempt.link }}</a></p>
          }
          @if (attempt.files.length) {
            <div class="mb-2"><app-homework-file-list [files]="fileItems(attempt)" /></div>
          }
          @if (attempt.comment) {
            <p class="small mb-2"><span class="text-muted">Comment to teacher:</span> {{ attempt.comment }}</p>
          }

          @if (attempt.reviewedAt) {
            <div class="rounded-3 bg-light p-3 mt-2">
              <p class="mb-1"><strong>Score:</strong> {{ attempt.pointsAwarded }}@if (maxPoints) {<span>/{{ maxPoints }}</span>}</p>
              @if (attempt.feedback) { <p class="mb-0" style="white-space: pre-line"><strong>Feedback:</strong> {{ attempt.feedback }}</p> }
            </div>
          }
        </section>
      } @empty {
        <p class="text-muted mb-0">Nothing has been submitted yet.</p>
      }
    </div>
  `
})
export class HomeworkAttemptListComponent {
  @Input({ required: true }) homeworkId!: string;
  @Input({ required: true }) attempts: HomeworkAttempt[] = [];
  @Input() maxPoints: number | null = null;

  constructor(private readonly api: HomeworkApiService) {}

  protected ordered(): HomeworkAttempt[] {
    return [...this.attempts].sort((a, b) => b.attemptNumber - a.attemptNumber);
  }

  protected label(status: string): string {
    return { submitted: 'Waiting for review', resubmission_requested: 'Revision required', accepted: 'Completed' }[status] ?? status;
  }

  protected badgeClass(status: string): string {
    return { submitted: 'text-bg-warning', resubmission_requested: 'text-bg-danger', accepted: 'text-bg-success' }[status] ?? 'text-bg-secondary';
  }

  protected fileItems(attempt: HomeworkAttempt): HomeworkFileItem[] {
    return attempt.files.map((file) => ({
      key: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      load: () => this.api.submissionFile(this.homeworkId, attempt.id, file.id)
    }));
  }
}
