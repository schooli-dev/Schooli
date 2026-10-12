import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HomeworkApiService,
  HomeworkDetail,
  HomeworkFilter,
  HomeworkListItem,
  HomeworkSummary
} from '../../core/homework/homework-api.service';
import { ToastService } from '../../core/toast/toast.service';
import { HomeworkAttemptListComponent } from './homework-attempt-list.component';
import { HomeworkFileItem, HomeworkFileListComponent } from './homework-file-list.component';

/**
 * Teacher Homework: a review dashboard, not a creation screen (homework is assigned from Mark Attendance).
 * Kept separate from the student page because the workflow differs: review queue vs. to-do list.
 */
@Component({
  selector: 'app-teacher-homework',
  standalone: true,
  imports: [DatePipe, FormsModule, HomeworkAttemptListComponent, HomeworkFileListComponent],
  templateUrl: './teacher-homework.component.html',
  styleUrl: './teacher-homework.component.scss'
})
export class TeacherHomeworkComponent implements OnInit {
  private readonly api = inject(HomeworkApiService);
  private readonly toasts = inject(ToastService);

  protected readonly summary = signal<HomeworkSummary | null>(null);
  protected readonly items = signal<HomeworkListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly filter = signal<HomeworkFilter>('submitted');
  protected search = '';

  protected readonly cards = computed(() => {
    const s = this.summary();
    return [
      { filter: 'submitted' as HomeworkFilter, label: 'Pending Review', count: s?.pendingReview ?? 0, icon: 'bi-hourglass-split', tone: 'warn' },
      { filter: 'needs_revision' as HomeworkFilter, label: 'Revision Required', count: s?.revisionRequired ?? 0, icon: 'bi-arrow-repeat', tone: 'danger' },
      { filter: 'completed_this_week' as HomeworkFilter, label: 'Completed This Week', count: s?.completedThisWeek ?? 0, icon: 'bi-check-circle', tone: 'ok' },
      { filter: 'overdue' as HomeworkFilter, label: 'Overdue', count: s?.overdue ?? 0, icon: 'bi-exclamation-triangle', tone: 'danger' }
    ];
  });

  protected readonly filterOptions: Array<{ value: HomeworkFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pending', label: 'Not submitted' },
    { value: 'submitted', label: 'Pending review' },
    { value: 'needs_revision', label: 'Revision required' },
    { value: 'completed', label: 'Completed' },
    { value: 'overdue', label: 'Overdue' }
  ];

  // Review modal
  protected readonly reviewing = signal<HomeworkDetail | null>(null);
  protected readonly reviewLoading = signal(false);
  protected readonly saving = signal(false);
  protected readonly reviewError = signal('');
  protected points: number | null = null;
  protected feedback = '';

  ngOnInit(): void {
    this.loadSummary();
    this.load();
  }

  protected select(filter: HomeworkFilter): void {
    this.filter.set(filter);
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.list(this.filter(), this.search.trim()).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toasts.error('Homework could not be loaded.');
      }
    });
  }

  private loadSummary(): void {
    this.api.summary().subscribe({ next: (response) => this.summary.set(response.data), error: () => undefined });
  }

  protected statusLabel(item: HomeworkListItem): string {
    if (item.status === 'submitted') return 'Pending Review';
    if (item.status === 'needs_revision') return 'Revision Required';
    if (item.status === 'completed') return 'Completed';
    return item.isOverdue ? 'Overdue' : 'Not Submitted';
  }

  protected statusClass(item: HomeworkListItem): string {
    if (item.status === 'completed') return 'text-bg-success';
    if (item.status === 'submitted') return 'text-bg-warning';
    if (item.status === 'needs_revision' || item.isOverdue) return 'text-bg-danger';
    return 'text-bg-secondary';
  }

  protected actionLabel(item: HomeworkListItem): string {
    if (item.status === 'submitted') return 'Review';
    return item.status === 'completed' ? 'View' : 'Open';
  }

  protected open(item: HomeworkListItem): void {
    this.reviewing.set(null);
    this.reviewError.set('');
    this.reviewLoading.set(true);
    this.api.detail(item.id).subscribe({
      next: (response) => {
        this.reviewing.set(response.data);
        this.points = null;
        this.feedback = '';
        this.reviewLoading.set(false);
      },
      error: () => {
        this.reviewLoading.set(false);
        this.toasts.error('This homework could not be opened.');
      }
    });
  }

  protected close(): void {
    this.reviewing.set(null);
    this.reviewLoading.set(false);
  }

  protected attachmentItems(detail: HomeworkDetail): HomeworkFileItem[] {
    const items: HomeworkFileItem[] = [];
    if (detail.document?.sourceType === 'file' && detail.document.fileName) {
      items.push({
        key: 'document',
        fileName: detail.document.fileName,
        mimeType: detail.document.mimeType,
        sizeBytes: null,
        load: () => this.api.documentFile(detail.id)
      });
    }
    for (const file of detail.attachments) {
      items.push({ ...file, key: file.id, load: () => this.api.resourceFile(detail.id, file.id) });
    }
    return items;
  }

  protected submitReview(result: 'complete' | 'revision'): void {
    const detail = this.reviewing();
    if (!detail || this.saving()) return;

    const max = detail.maxPoints ?? 0;
    if (this.points === null || Number.isNaN(Number(this.points)) || this.points < 0 || (max && this.points > max)) {
      this.reviewError.set(max ? `Enter points between 0 and ${max}.` : 'Enter the points awarded.');
      return;
    }
    if (result === 'revision' && !this.feedback.trim()) {
      this.reviewError.set('Feedback is required when asking for a revision.');
      return;
    }

    this.saving.set(true);
    this.reviewError.set('');
    this.api.review(detail.id, { result, points: Number(this.points), feedback: this.feedback.trim() || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.reviewing.set(null);
        this.toasts.success(result === 'complete' ? 'Homework completed. The student has been notified.' : 'Revision requested. The student has been notified.');
        this.loadSummary();
        this.load();
      },
      error: (error) => {
        this.saving.set(false);
        this.reviewError.set(error?.error?.message ?? 'The review could not be saved.');
      }
    });
  }
}
