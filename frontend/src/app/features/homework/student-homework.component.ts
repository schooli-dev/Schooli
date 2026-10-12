import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { HomeworkApiService, HomeworkListItem } from '../../core/homework/homework-api.service';
import { ToastService } from '../../core/toast/toast.service';

type Tab = 'pending' | 'submitted' | 'needs_revision' | 'completed';

/** Student Homework: to-do list in four tabs. Opening an item goes to its own detail/submit page. */
@Component({
  selector: 'app-student-homework',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="page">
      <header class="mb-4">
        <h1 class="h3 fw-bold mb-1">Homework</h1>
        <p class="text-muted mb-0">Homework from your teachers appears here as soon as it is assigned.</p>
      </header>

      <div class="d-flex flex-wrap gap-2 mb-3" role="tablist">
        @for (t of tabs; track t.value) {
          <button class="btn rounded-pill fw-semibold" role="tab" type="button" [class]="tab() === t.value ? 'btn-primary' : 'btn-outline-secondary'" (click)="select(t.value)">
            {{ t.label }} <span class="badge text-bg-light ms-1">{{ count(t.value) }}</span>
          </button>
        }
      </div>

      @if (loading()) {
        <p class="text-muted">Loading homework...</p>
      } @else if (!visible().length) {
        <div class="border rounded-4 bg-white p-4 text-center text-muted">Nothing here right now.</div>
      } @else {
        <div class="row g-3">
          @for (item of visible(); track item.id) {
            <div class="col-12 col-md-6 col-xl-4">
              <article class="border rounded-4 bg-white p-3 h-100 d-flex flex-column gap-2">
                <div class="d-flex justify-content-between align-items-start gap-2">
                  <h2 class="h6 fw-bold mb-0">{{ item.title }}</h2>
                  <span class="badge rounded-pill flex-shrink-0" [class]="statusClass(item)">{{ statusLabel(item) }}</span>
                </div>
                <p class="small text-muted mb-0">{{ item.moduleName || 'Custom homework' }}@if (item.lessonTitle) { &bull; Class {{ item.lessonNumber }} - {{ item.lessonTitle }} }</p>
                <dl class="small mb-0 meta">
                  <dt>Assigned</dt><dd>{{ item.assignedAt | date: 'MMM d, y' }}</dd>
                  <dt>Due</dt><dd>{{ item.dueDate ? (item.dueDate | date: 'MMM d, y, h:mm a') : 'No due date' }}</dd>
                  <dt>Max Points</dt><dd>{{ item.maxPoints ?? '-' }}</dd>
                  @if (item.status === 'completed') { <dt>Score</dt><dd>{{ item.latestPoints }}/{{ item.maxPoints }}</dd> }
                </dl>
                <button class="btn btn-primary btn-sm mt-auto align-self-start" type="button" (click)="open(item)">{{ actionLabel(item) }}</button>
              </article>
            </div>
          }
        </div>
      }
    </section>
  `,
  styles: [`.meta { display: grid; grid-template-columns: auto 1fr; gap: 2px 12px; } dt { color: #64748b; font-weight: 600; } dd { margin: 0; }`]
})
export class StudentHomeworkComponent implements OnInit {
  private readonly api = inject(HomeworkApiService);
  private readonly router = inject(Router);
  private readonly toasts = inject(ToastService);

  protected readonly items = signal<HomeworkListItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly tab = signal<Tab>('pending');

  protected readonly tabs: Array<{ value: Tab; label: string }> = [
    { value: 'pending', label: 'Pending' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'needs_revision', label: 'Needs Revision' },
    { value: 'completed', label: 'Completed' }
  ];

  protected readonly visible = computed(() => this.items().filter((item) => this.matches(item, this.tab())));

  ngOnInit(): void {
    this.api.list('all').subscribe({
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

  protected select(tab: Tab): void {
    this.tab.set(tab);
  }

  protected count(tab: Tab): number {
    return this.items().filter((item) => this.matches(item, tab)).length;
  }

  private matches(item: HomeworkListItem, tab: Tab): boolean {
    return (tab === 'pending' ? 'assigned' : tab) === item.status;
  }

  protected statusLabel(item: HomeworkListItem): string {
    if (item.status === 'submitted') return 'Submitted';
    if (item.status === 'needs_revision') return 'Needs Revision';
    if (item.status === 'completed') return 'Completed';
    return item.isOverdue ? 'Overdue' : 'Pending';
  }

  protected statusClass(item: HomeworkListItem): string {
    if (item.status === 'completed') return 'text-bg-success';
    if (item.status === 'submitted') return 'text-bg-info';
    if (item.status === 'needs_revision' || item.isOverdue) return 'text-bg-danger';
    return 'text-bg-warning';
  }

  protected actionLabel(item: HomeworkListItem): string {
    if (item.status === 'assigned') return 'View Homework';
    return item.status === 'needs_revision' ? 'Revise & Resubmit' : 'View';
  }

  protected open(item: HomeworkListItem): void {
    void this.router.navigate(['/student/homework', item.id], { skipLocationChange: true });
  }
}
