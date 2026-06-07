import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';

type StudentClassTab = 'upcoming' | 'completed' | 'cancelled' | 'all';

@Component({
  selector: 'app-student-classes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="student-classes-page w-100 overflow-hidden">

      <!-- Header -->
      <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
        <div class="min-w-0">
          <p class="section-kicker text-uppercase fw-bold small mb-2">Student Classes</p>
          <h1 class="fw-bold mb-2 page-title">My Classes</h1>
          <p class="text-muted mb-0 page-subtitle">
            View your upcoming, completed, and cancelled learning sessions.
          </p>
        </div>

        <button class="btn btn-outline-primary fw-bold d-inline-flex align-items-center justify-content-center gap-2" type="button">
          <i class="bi bi-download"></i>
          Export Attendance
        </button>
      </div>

      <!-- Metrics -->
      <section class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-primary-subtle text-primary mb-3">
                <i class="bi bi-calendar-event"></i>
              </span>

              <p class="small fw-bold text-muted mb-2">Next Class</p>
              <h3 class="fw-bold mb-1 metric-title">{{ nextClassLabel() }}</h3>
              <p class="small text-primary fw-semibold mb-0 text-truncate">{{ nextClassTitle() }}</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-purple-subtle text-purple mb-3">
                <i class="bi bi-calendar-month"></i>
              </span>

              <p class="small fw-bold text-muted mb-2">Classes This Month</p>
              <h3 class="fw-bold mb-1">{{ monthCount() }}</h3>
              <p class="small text-primary fw-semibold mb-0">Scheduled this month</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-success-subtle text-success mb-3">
                <i class="bi bi-person-check"></i>
              </span>

              <p class="small fw-bold text-muted mb-2">Attendance %</p>
              <h3 class="fw-bold mb-2">{{ attendancePercent() }}%</h3>

              <div class="progress attendance-progress">
                <div
                  class="progress-bar"
                  role="progressbar"
                  [style.width.%]="attendancePercent()"
                  [attr.aria-valuenow]="attendancePercent()"
                  aria-valuemin="0"
                  aria-valuemax="100"
                ></div>
              </div>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-warning-subtle text-warning-emphasis mb-3">
                <i class="bi bi-check2-circle"></i>
              </span>

              <p class="small fw-bold text-muted mb-2">Completed</p>
              <h3 class="fw-bold mb-1">{{ completedCount() }}</h3>
              <p class="small text-primary fw-semibold mb-0">Finished sessions</p>
            </div>
          </article>
        </div>
      </section>

      <!-- Main Layout -->
      <section class="row g-4">

        <!-- Left Column -->
        <div class="col-12 col-xl-8">

          <!-- Filters -->
          <article class="card border rounded-4 overflow-hidden mb-4">
            <div class="card-body p-3 p-md-4">

              <!-- Tabs -->
              <div class="tabs-scroll d-flex gap-2 overflow-auto pb-2 mb-3">
                @for (tab of tabs; track tab.key) {
                  <button
                    class="btn tab-btn d-inline-flex align-items-center gap-2 rounded-pill fw-bold"
                    type="button"
                    [class.btn-primary]="activeTab() === tab.key"
                    [class.btn-light]="activeTab() !== tab.key"
                    (click)="setActiveTab(tab.key)"
                  >
                    <span>{{ tab.label }}</span>
                    <span
                      class="badge rounded-pill"
                      [class.text-bg-light]="activeTab() === tab.key"
                      [class.text-bg-secondary]="activeTab() !== tab.key"
                    >
                      {{ tabCount(tab.key) }}
                    </span>
                  </button>
                }
              </div>

              <!-- Filter Controls -->
              <div class="row g-3">
                <div class="col-12 col-lg">
                  <div class="input-group">
                    <span class="input-group-text">
                      <i class="bi bi-search"></i>
                    </span>

                    <input
                      class="form-control"
                      placeholder="Search by teacher or class..."
                      [ngModel]="searchText()"
                      (ngModelChange)="searchText.set($event)"
                    />
                  </div>
                </div>

                <div class="col-12 col-lg-4">
                  <select
                    class="form-select"
                    [ngModel]="activeTab()"
                    (ngModelChange)="setActiveTab($event)"
                  >
                    @for (tab of tabs; track tab.key) {
                      <option [ngValue]="tab.key">{{ tab.label }}</option>
                    }
                  </select>
                </div>

                <div class="col-12 col-lg-auto">
                  <button
                    class="btn btn-outline-secondary w-100 d-inline-flex align-items-center justify-content-center gap-2 fw-bold"
                    type="button"
                    (click)="clearFilters()"
                  >
                    <i class="bi bi-x-circle"></i>
                    Clear filters
                  </button>
                </div>
              </div>

            </div>
          </article>

          @if (apiWarning()) {
            <div class="alert alert-warning d-flex align-items-start gap-2 mb-4" role="alert">
              <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
              <span>{{ apiWarning() }}</span>
            </div>
          }

          <!-- Class List -->
          <div class="d-grid gap-3">
            @for (item of pagedClasses(); track item.id) {
              <article class="card border rounded-4 class-card-modern" [class.current]="item.status === 'live'">
                <div class="card-body p-3 p-md-4">

                  <div class="d-flex flex-column flex-lg-row gap-3 justify-content-between">

                    <div class="min-w-0 flex-grow-1">
                      <div class="d-flex flex-wrap align-items-center gap-2 mb-3">
                        <span
                          class="badge rounded-pill text-uppercase"
                          [class.text-bg-success]="item.status === 'live'"
                          [class.text-bg-primary]="item.status === 'scheduled' || item.status === 'rescheduled'"
                          [class.text-bg-secondary]="item.status !== 'live' && item.status !== 'scheduled' && item.status !== 'rescheduled' && item.status !== 'completed' && item.status !== 'cancelled'"
                          [class.text-bg-info]="item.status === 'completed'"
                          [class.text-bg-danger]="item.status === 'cancelled'"
                        >
                          {{ item.status }}
                        </span>

                        <span class="small text-muted d-inline-flex align-items-center gap-1">
                          <i class="bi bi-calendar-event"></i>
                          {{ item.startTime | date: 'MMM d, h:mm a' }} - {{ item.endTime | date: 'h:mm a' }}
                        </span>
                      </div>

                      <h2 class="h5 fw-bold mb-2 class-title">{{ item.title }}</h2>

                      <div class="d-flex flex-wrap gap-3 text-muted small">
                        <span class="d-inline-flex align-items-center gap-1">
                          <i class="bi bi-person-video3"></i>
                          {{ item.teacherName }}
                        </span>

                        <span class="d-inline-flex align-items-center gap-1">
                          <i class="bi bi-hourglass-split"></i>
                          {{ item.durationMinutes }} min
                        </span>

                        <span class="d-inline-flex align-items-center gap-1">
                          <i class="bi bi-person-check"></i>
                          Attendance: {{ attendanceLabel(item) }}
                        </span>
                      </div>
                    </div>

                    <div class="class-actions d-grid gap-2">
                      <button
                        class="btn btn-primary fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                        type="button"
                        [disabled]="!canJoin(item)"
                        (click)="joinClass(item)"
                      >
                        <i class="bi bi-camera-video"></i>
                        Join Class
                      </button>

                      <button
                        class="btn btn-outline-secondary fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                        type="button"
                      >
                        <i class="bi bi-eye"></i>
                        View Details
                      </button>

                      <button
                        class="btn btn-outline-danger fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                        type="button"
                        [disabled]="!canRequestCancellation(item)"
                        (click)="openCancelRequest(item)"
                      >
                        <i class="bi bi-calendar-x"></i>
                        Request Cancellation
                      </button>
                    </div>

                  </div>

                </div>
              </article>
            } @empty {
              <article class="empty-state">
                <i class="bi bi-calendar2-x"></i>
                <strong>No classes found</strong>
                <span>No classes found for this filter.</span>
              </article>
            }
          </div>

          <!-- Pagination -->
          <nav class="mt-4" aria-label="Student classes pagination">
            <ul class="pagination pagination-sm mb-0 flex-wrap">
              <li class="page-item" [class.disabled]="currentPage() === 1">
                <button class="page-link fw-bold" type="button" (click)="previousPage()">Prev</button>
              </li>

              @for (page of pageNumbers(); track page) {
                <li class="page-item" [class.active]="currentPage() === page">
                  <button class="page-link fw-bold" type="button" (click)="setPage(page)">{{ page }}</button>
                </li>
              }

              <li class="page-item" [class.disabled]="currentPage() === totalPages()">
                <button class="page-link fw-bold" type="button" (click)="nextPage()">Next</button>
              </li>
            </ul>
          </nav>

        </div>

        <!-- Right Column -->
        <aside class="col-12 col-xl-4">
          <article class="card border rounded-4 overflow-hidden next-class-card sticky-xl-top">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <h2 class="h5 fw-bold mb-1">Next Class</h2>
                  <p class="small text-muted mb-0">Your nearest learning session</p>
                </div>

                <span
                  class="badge rounded-pill text-uppercase"
                  [class.text-bg-success]="nextClassStatus() === 'live'"
                  [class.text-bg-secondary]="nextClassStatus() !== 'live'"
                >
                  {{ nextClassStatus() }}
                </span>
              </div>
            </div>

            <div class="next-class-preview">
              <div class="preview-overlay">
                <span class="icon-box icon-glass">
                  <i class="bi bi-camera-video"></i>
                </span>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              <h3 class="h5 fw-bold mb-2">{{ nextClassTitle() }}</h3>

              <p class="text-muted mb-4 d-flex align-items-start gap-2">
                <i class="bi bi-person-video3 flex-shrink-0 mt-1"></i>
                <span>{{ nextClassTeacher() }}</span>
              </p>

              <button
                class="btn btn-primary btn-lg w-100 fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                type="button"
                [disabled]="!nextClass()"
                (click)="nextClass() && joinClass(nextClass()!)"
              >
                <i class="bi bi-box-arrow-in-right"></i>
                Enter Session
              </button>
            </div>
          </article>
        </aside>

      </section>
    </div>

    <!-- Cancellation Request Modal -->
    @if (cancelRequestOpen() && classToCancel()) {
      <section class="student-modal-backdrop" role="dialog" aria-modal="true">
        <div class="student-cancel-dialog">

          <header class="d-flex align-items-start justify-content-between gap-3 mb-3">
            <div class="d-flex align-items-start gap-3 min-w-0">
              <span class="icon-box icon-box-lg bg-danger-subtle text-danger flex-shrink-0">
                <i class="bi bi-calendar-x"></i>
              </span>

              <div class="min-w-0">
                <p class="section-kicker text-uppercase fw-bold small mb-1">Cancellation Request</p>
                <h2 class="h4 fw-bold mb-0">Request class cancellation</h2>
              </div>
            </div>

            <button class="btn-close" type="button" aria-label="Close" (click)="closeCancelRequest()"></button>
          </header>

          <p class="text-muted mb-3">
            Your request for <strong>{{ classToCancel()!.title }}</strong> will be sent to admin for review.
          </p>

          <label class="w-100">
            <span class="fw-bold">
              Reason <span class="text-danger">*</span>
            </span>

            <textarea
              class="form-control mt-2"
              rows="4"
              name="cancelReason"
              [(ngModel)]="cancelReason"
              placeholder="Write the reason for cancellation"
            ></textarea>
          </label>

          @if (cancelRequestMessage()) {
            <div
              class="alert mt-3 mb-0"
              [class.alert-danger]="cancelRequestMessageType() === 'error'"
              [class.alert-success]="cancelRequestMessageType() === 'success'"
            >
              <i
                class="bi me-2"
                [class.bi-exclamation-triangle]="cancelRequestMessageType() === 'error'"
                [class.bi-check-circle]="cancelRequestMessageType() === 'success'"
              ></i>
              {{ cancelRequestMessage() }}
            </div>
          }

          <footer class="d-flex flex-column flex-sm-row justify-content-end gap-2 mt-4">
            <button class="btn btn-outline-secondary fw-bold" type="button" (click)="closeCancelRequest()">
              Cancel
            </button>

            <button
              class="btn btn-danger fw-bold d-inline-flex align-items-center justify-content-center gap-2"
              type="button"
              [disabled]="cancelRequestSubmitting()"
              (click)="submitCancelRequest()"
            >
              @if (cancelRequestSubmitting()) {
                <span class="spinner-border spinner-border-sm"></span>
              } @else {
                <i class="bi bi-send"></i>
              }

              {{ cancelRequestSubmitting() ? 'Requesting...' : 'Request' }}
            </button>
          </footer>

        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }

    .student-classes-page {
      width: 100%;
      max-width: 1480px;
      overflow-x: hidden;
    }

    .student-classes-page *,
    .student-classes-page *::before,
    .student-classes-page *::after {
      box-sizing: border-box;
    }

    .min-w-0 {
      min-width: 0;
    }

    .page-title {
      font-size: clamp(30px, 3.2vw, 42px);
      line-height: 1.08;
      letter-spacing: -0.03em;
    }

    .page-subtitle {
      max-width: 720px;
      line-height: 1.6;
    }

    .icon-box {
      width: 44px;
      height: 44px;
      display: inline-grid;
      place-items: center;
      border-radius: 14px;
      font-size: 20px;
      line-height: 1;
    }

    .icon-box i {
      line-height: 1;
    }

    .icon-box-lg {
      width: 54px;
      height: 54px;
      min-width: 54px;
      border-radius: 16px;
      font-size: 24px;
    }

    .icon-glass {
      background: rgba(255, 255, 255, 0.18);
      color: #ffffff;
    }

    .bg-purple-subtle {
      background: #f2eaff;
    }

    .text-purple {
      color: var(--color-secondary);
    }

    .metric-card-modern,
    .class-card-modern,
    .next-class-card {
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .metric-card-modern:hover,
    .class-card-modern:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28) !important;
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .metric-title {
      font-size: clamp(22px, 2vw, 28px);
    }

    .attendance-progress {
      height: 8px;
      border-radius: 999px;
      background: #e5e7eb;
    }

    .attendance-progress .progress-bar {
      border-radius: inherit;
      background: var(--color-primary);
    }

    .tabs-scroll {
      scrollbar-width: thin;
    }

    .tab-btn {
      white-space: nowrap;
      min-height: 38px;
    }

    .class-card-modern.current {
      border-color: rgba(37, 99, 235, 0.38) !important;
      background:
        linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
    }

    .class-title {
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .class-actions {
      width: min(230px, 100%);
      flex-shrink: 0;
    }

    .next-class-preview {
      min-height: 170px;
      position: relative;
      background:
        radial-gradient(circle at 78% 18%, rgba(124, 58, 237, 0.2), transparent 32%),
        linear-gradient(135deg, #004ac6 0%, #2563eb 48%, #7c3aed 100%);
      overflow: hidden;
    }

    .next-class-preview::after {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px);
      background-size: 28px 28px;
      opacity: 0.36;
    }

    .preview-overlay {
      position: relative;
      z-index: 1;
      min-height: inherit;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-state {
      min-height: 180px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      border: 1px dashed var(--color-border);
      border-radius: 16px;
      background: var(--color-surface-soft);
      color: var(--color-muted);
      text-align: center;
      padding: 18px;
    }

    .empty-state i {
      color: var(--color-primary);
      font-size: 34px;
    }

    .empty-state strong {
      color: var(--color-text);
    }

    .student-modal-backdrop {
      position: fixed;
      inset: 0;
      z-index: 1055;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.38);
      backdrop-filter: blur(8px);
      padding: 16px;
    }

    .student-cancel-dialog {
      width: min(560px, 100%);
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      border: 1px solid var(--color-border);
      border-radius: 22px;
      background: #ffffff;
      box-shadow: 0 34px 90px rgba(15, 23, 42, 0.22);
      padding: 24px;
    }

    .pagination .page-link {
      color: var(--color-primary);
    }

    .pagination .active .page-link {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }

    @media (min-width: 1200px) {
      .sticky-xl-top {
        top: 20px;
      }
    }

    @media (max-width: 991.98px) {
      .class-actions {
        width: 100%;
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 575.98px) {
      .page-title {
        font-size: 30px;
      }

      .card-body,
      .card-header {
        padding: 1rem !important;
      }

      .icon-box-lg {
        width: 48px;
        height: 48px;
        min-width: 48px;
        border-radius: 14px;
        font-size: 21px;
      }

      .tab-btn {
        font-size: 13px;
      }

      .student-modal-backdrop {
        align-items: stretch;
        padding: 10px;
      }

      .student-cancel-dialog {
        max-height: calc(100dvh - 20px);
        border-radius: 20px;
        padding: 18px;
      }

      .student-cancel-dialog footer .btn {
        width: 100%;
      }
    }

    @media (max-width: 360px) {
      .page-title {
        font-size: 26px;
      }

      .icon-box {
        width: 42px;
        height: 42px;
        font-size: 18px;
      }

      .icon-box-lg {
        width: 44px;
        height: 44px;
        min-width: 44px;
        font-size: 19px;
      }

      .next-class-preview {
        min-height: 140px;
      }
    }
  `
})
export class StudentClassesComponent implements OnInit {
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly activeTab = signal<StudentClassTab>('upcoming');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly searchText = signal('');
  protected readonly apiWarning = signal('');
  protected readonly cancelRequestOpen = signal(false);
  protected readonly classToCancel = signal<ClassListItem | null>(null);
  protected readonly cancelRequestSubmitting = signal(false);
  protected readonly cancelRequestMessage = signal('');
  protected readonly cancelRequestMessageType = signal<'success' | 'error'>('success');
  protected cancelReason = '';
  protected readonly tabs: Array<{ key: StudentClassTab; label: string }> = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' }
  ];

  protected readonly filteredClasses = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    const tabFiltered = this.classes().filter((item) => this.matchesTab(item, this.activeTab()));

    if (!query) {
      return tabFiltered;
    }

    return tabFiltered.filter((item) =>
      [item.title, item.teacherName, item.status].some((value) => value.toLowerCase().includes(query))
    );
  });
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredClasses().length / this.pageSize)));
  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));
  protected readonly pagedClasses = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredClasses().slice(start, start + this.pageSize);
  });
  protected readonly nextClass = computed(() =>
    this.classes()
      .filter((item) => ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null
  );
  protected readonly monthCount = computed(() => {
    const now = new Date();
    return this.classes().filter((item) => {
      const start = new Date(item.startTime);
      return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
    }).length;
  });
  protected readonly completedCount = computed(() => this.classes().filter((item) => item.status === 'completed').length);
  protected readonly attendancePercent = computed(() => {
    const attended = this.classes().filter((item) => ['present', 'in session'].includes(this.attendance(item).toLowerCase())).length;
    return this.classes().length ? Math.round((attended / this.classes().length) * 100) : 0;
  });
  protected readonly nextClassLabel = computed(() => {
    const next = this.nextClass();
    if (!next) {
      return '--';
    }

    if (next.status === 'live') {
      return 'Live';
    }

    const minutes = Math.max(0, Math.round((new Date(next.startTime).getTime() - Date.now()) / 60000));
    return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} hr`;
  });
  protected readonly nextClassTitle = computed(() => this.nextClass()?.title ?? 'No upcoming class');
  protected readonly nextClassStatus = computed(() => this.nextClass()?.status ?? 'None');
  protected readonly nextClassTeacher = computed(() => this.nextClass()?.teacherName ?? 'Your upcoming class details will appear here.');

  constructor(private readonly classesApi: ClassesApiService) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.activeTab.set('upcoming');
    this.currentPage.set(1);
  }

  protected setActiveTab(tab: StudentClassTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  protected setPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  protected previousPage(): void {
    this.setPage(this.currentPage() - 1);
  }

  protected nextPage(): void {
    this.setPage(this.currentPage() + 1);
  }

  protected tabCount(tab: StudentClassTab): number {
    return this.classes().filter((item) => this.matchesTab(item, tab)).length;
  }

  protected canJoin(item: ClassListItem): boolean {
    return ['live', 'scheduled', 'rescheduled'].includes(item.status) && Boolean(item.zoomMeeting?.joinUrl);
  }

  protected joinClass(item: ClassListItem): void {
    this.classesApi.joinClass(item.id).subscribe({
      next: (response) => {
        const joinUrl = response.data.zoom.joinUrl;
        if (joinUrl) {
          window.open(joinUrl, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  protected canRequestCancellation(item: ClassListItem): boolean {
    return item.status === 'scheduled' && new Date(item.startTime).getTime() > Date.now();
  }

  protected openCancelRequest(item: ClassListItem): void {
    this.classToCancel.set(item);
    this.cancelReason = '';
    this.cancelRequestMessage.set('');
    this.cancelRequestOpen.set(true);
  }

  protected closeCancelRequest(): void {
    this.cancelRequestOpen.set(false);
  }

  protected submitCancelRequest(): void {
    const item = this.classToCancel();
    const reason = this.cancelReason.trim();

    if (!item) {
      return;
    }

    if (!reason) {
      this.cancelRequestMessageType.set('error');
      this.cancelRequestMessage.set('Please enter a reason for cancellation.');
      return;
    }

    this.cancelRequestSubmitting.set(true);
    this.cancelRequestMessage.set('');
    this.classesApi
      .requestCancellation(item.id, reason)
      .pipe(finalize(() => this.cancelRequestSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.cancelRequestMessageType.set('success');
          this.cancelRequestMessage.set('Cancellation request submitted successfully.');
          setTimeout(() => this.closeCancelRequest(), 700);
        },
        error: (error) => {
          const message = error?.error?.message ?? error?.error?.error?.message;
          this.cancelRequestMessageType.set('error');
          this.cancelRequestMessage.set(message || 'Could not submit cancellation request.');
        }
      });
  }

  private loadClasses(): void {
    this.apiWarning.set('');
    this.classesApi
      .listClasses({ limit: 100 })
      .pipe(finalize(() => undefined))
      .subscribe({
        next: (response) => this.classes.set(response.data),
        error: () => {
          this.apiWarning.set('Could not load student classes from backend.');
          this.classes.set([]);
        }
      });
  }

  private matchesTab(item: ClassListItem, tab: StudentClassTab): boolean {
    if (tab === 'all') {
      return true;
    }

    if (tab === 'upcoming') {
      return ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now();
    }

    return item.status === tab;
  }

  private attendance(item: ClassListItem): string {
    return item.participants[0]?.attendanceStatus ?? 'pending';
  }

  protected attendanceLabel(item: ClassListItem): string {
    return this.attendance(item);
  }
}