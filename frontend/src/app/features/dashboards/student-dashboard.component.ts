import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  template: `
    <div class="student-dashboard-page w-100 overflow-hidden">

      <!-- Header -->
      <div class="mb-4">
        <p class="section-kicker text-uppercase fw-bold small mb-2">Student Dashboard</p>
        <h1 class="fw-bold mb-2 student-title">{{ greeting() }}, {{ studentFirstName() }}</h1>
        <p class="text-muted mb-0 student-summary">{{ dashboardSummary() }}</p>
      </div>

      <!-- Main Grid -->
      <section class="row g-4">

        <!-- Left Column -->
        <div class="col-12 col-xl-8 d-grid gap-4">

          <!-- Hero Next Class -->
          <article class="student-hero-card position-relative overflow-hidden rounded-4 p-4 p-lg-5 text-white">
            @if (nextClass()) {
              <div class="position-relative z-1">
                <span class="badge rounded-pill bg-white bg-opacity-25 text-white px-3 py-2 mb-4">
                  <i class="bi bi-clock me-1"></i>
                  {{ nextClassLabel() }}
                </span>

                <h2 class="fw-bold mb-3 hero-class-title">
                  {{ nextClass()!.title }}
                </h2>

                <p class="mb-0 text-white-75 d-flex align-items-center gap-2">
                  <i class="bi bi-person-video3"></i>
                  {{ nextClass()!.teacherName }}
                </p>
              </div>

              <div class="position-relative z-1 mt-5">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 hero-footer-card">
                  <div class="d-flex align-items-start gap-3 min-w-0">
                    <span class="icon-box icon-glass flex-shrink-0">
                      <i class="bi bi-calendar-event"></i>
                    </span>

                    <div class="min-w-0">
                      <small class="d-block text-uppercase fw-bold text-white-50">Class Time</small>
                      <strong class="d-block text-white">
                        {{ nextClass()!.startTime | date: 'MMM d, hh:mm a' }} - {{ nextClass()!.endTime | date: 'hh:mm a' }}
                      </strong>
                    </div>
                  </div>

                  <a class="btn btn-light text-primary fw-bold px-4" routerLink="/student/classes">
                    <i class="bi bi-box-arrow-up-right me-2"></i>
                    Open Class
                  </a>
                </div>
              </div>
            } @else {
              <div class="position-relative z-1">
                <span class="badge rounded-pill bg-white bg-opacity-25 text-white px-3 py-2 mb-4">
                  <i class="bi bi-calendar2-check me-1"></i>
                  No upcoming class
                </span>

                <h2 class="fw-bold mb-3 hero-class-title">
                  Your schedule is clear
                </h2>

                <p class="mb-0 text-white-75">
                  New sessions will appear here after admin schedules them.
                </p>
              </div>

              <div class="position-relative z-1 mt-5">
                <div class="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 hero-footer-card">
                  <div class="d-flex align-items-start gap-3 min-w-0">
                    <span class="icon-box icon-glass flex-shrink-0">
                      <i class="bi bi-calendar-plus"></i>
                    </span>

                    <div>
                      <small class="d-block text-uppercase fw-bold text-white-50">Schedule Status</small>
                      <strong class="d-block text-white">Check back later</strong>
                    </div>
                  </div>

                  <a class="btn btn-light text-primary fw-bold px-4" routerLink="/student/classes">
                    <i class="bi bi-calendar3 me-2"></i>
                    View Classes
                  </a>
                </div>
              </div>
            }
          </article>

          <!-- Upcoming Classes -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex flex-column flex-sm-row justify-content-between gap-3">
                <div>
                  <h2 class="h5 fw-bold mb-1">Upcoming Classes</h2>
                  <p class="small text-muted mb-0">Your next scheduled learning sessions</p>
                </div>

                <a class="fw-bold text-primary text-decoration-none small d-inline-flex align-items-center gap-2" routerLink="/student/classes">
                  View Calendar
                  <i class="bi bi-arrow-right"></i>
                </a>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">
                @for (item of upcomingPreview(); track item.id) {
                  <div class="card border class-preview-card">
                    <div class="card-body p-3">
                      <div class="row g-3 align-items-center">

                        <div class="col-12 col-sm-auto">
                          <div class="date-tile text-center rounded-4 p-3">
                            <span class="d-block small text-uppercase fw-bold">{{ item.startTime | date: 'MMM' }}</span>
                            <strong class="d-block fs-4 lh-1">{{ item.startTime | date: 'd' }}</strong>
                          </div>
                        </div>

                        <div class="col-12 col-sm min-w-0">
                          <h3 class="h6 fw-bold mb-2 text-truncate">{{ item.title }}</h3>

                          <div class="d-flex flex-wrap gap-3 small text-muted">
                            <span class="d-inline-flex align-items-center gap-1">
                              <i class="bi bi-person-video3"></i>
                              {{ item.teacherName }}
                            </span>

                            <span class="d-inline-flex align-items-center gap-1">
                              <i class="bi bi-clock"></i>
                              {{ item.startTime | date: 'hh:mm a' }} to {{ item.endTime | date: 'hh:mm a' }}
                            </span>
                          </div>
                        </div>

                        <div class="col-12 col-sm-auto">
                          <a class="btn btn-outline-primary btn-sm fw-bold w-100" routerLink="/student/classes">
                            <i class="bi bi-eye me-1"></i>
                            View Details
                          </a>
                        </div>

                      </div>
                    </div>
                  </div>
                } @empty {
                  <div class="empty-state">
                    <i class="bi bi-calendar2-x"></i>
                    <strong>No upcoming classes</strong>
                    <span>Your scheduled sessions will appear here.</span>
                  </div>
                }
              </div>
            </div>
          </article>

        </div>

        <!-- Right Column -->
        <div class="col-12 col-xl-4 d-grid gap-4 align-content-start">

          <!-- Metrics -->
          <section class="row g-3">
            <div class="col-12 col-sm-6 col-xl-6">
              <article class="card border h-100 metric-card-modern">
                <div class="card-body">
                  <span class="icon-box bg-primary-subtle text-primary mb-3">
                    <i class="bi bi-calendar-event"></i>
                  </span>
                  <p class="small fw-bold text-muted mb-2">Upcoming Classes</p>
                  <h3 class="fw-bold mb-1">{{ upcomingClasses().length }}</h3>
                  <p class="small text-primary fw-semibold mb-0">Scheduled sessions</p>
                </div>
              </article>
            </div>

            <div class="col-12 col-sm-6 col-xl-6">
              <article class="card border h-100 metric-card-modern">
                <div class="card-body">
                  <span class="icon-box bg-purple-subtle text-purple mb-3">
                    <i class="bi bi-calendar-month"></i>
                  </span>
                  <p class="small fw-bold text-muted mb-2">Classes This Month</p>
                  <h3 class="fw-bold mb-1">{{ monthCount() }}</h3>
                  <p class="small text-primary fw-semibold mb-0">Current month</p>
                </div>
              </article>
            </div>

            <div class="col-12">
              <article class="card border h-100 metric-card-modern">
                <div class="card-body d-flex align-items-center gap-3">
                  <span class="icon-box icon-box-lg bg-success-subtle text-success flex-shrink-0">
                    <i class="bi bi-person-check"></i>
                  </span>

                  <div class="min-w-0">
                    <p class="small fw-bold text-muted mb-1">Attendance</p>
                    <h3 class="fw-bold mb-1">{{ attendancePercent() }}%</h3>
                    <p class="small text-primary fw-semibold mb-0">Based on class records</p>
                  </div>
                </div>
              </article>
            </div>

            <div class="col-12">
              <article class="card border h-100 metric-card-modern">
                <div class="card-body d-flex align-items-center gap-3">
                  <span class="icon-box icon-box-lg bg-warning-subtle text-warning-emphasis flex-shrink-0">
                    <i class="bi bi-check2-circle"></i>
                  </span>

                  <div class="min-w-0">
                    <p class="small fw-bold text-muted mb-1">Completed</p>
                    <h3 class="fw-bold mb-1">{{ completedCount() }}</h3>
                    <p class="small text-primary fw-semibold mb-0">Finished sessions</p>
                  </div>
                </div>
              </article>
            </div>
          </section>

          <!-- Class Status -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <h2 class="h5 fw-bold mb-1">Class Status</h2>
              <p class="small text-muted mb-0">Your current learning records</p>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">

                <div class="status-row d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box bg-danger-subtle text-danger flex-shrink-0">
                    <i class="bi bi-exclamation-circle"></i>
                  </span>

                  <div class="min-w-0">
                    <strong
                      class="d-block"
                      [class.text-danger]="pendingAttendanceCount() > 0"
                    >
                      Attendance pending: {{ pendingAttendanceCount() }}
                    </strong>
                    <span class="small text-muted">Attendance records waiting for update</span>
                  </div>
                </div>

                <div class="status-row d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box bg-success-subtle text-success flex-shrink-0">
                    <i class="bi bi-broadcast"></i>
                  </span>

                  <div class="min-w-0">
                    <strong class="d-block">{{ liveCount() }} live class(es)</strong>
                    <span class="small text-muted">Currently active sessions</span>
                  </div>
                </div>

                <div class="status-row d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box bg-secondary-subtle text-secondary flex-shrink-0">
                    <i class="bi bi-calendar-x"></i>
                  </span>

                  <div class="min-w-0">
                    <strong class="d-block">{{ cancelledCount() }} cancelled class(es)</strong>
                    <span class="small text-muted">Cancelled sessions in your records</span>
                  </div>
                </div>

                <a class="btn btn-primary fw-bold w-100" routerLink="/student/classes">
                  <i class="bi bi-calendar3 me-2"></i>
                  Manage Classes
                </a>

              </div>
            </div>
          </article>

        </div>

      </section>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }

    .student-dashboard-page {
      width: 100%;
      max-width: 1480px;
      overflow-x: hidden;
    }

    .student-dashboard-page *,
    .student-dashboard-page *::before,
    .student-dashboard-page *::after {
      box-sizing: border-box;
    }

    .min-w-0 {
      min-width: 0;
    }

    .student-title {
      font-size: clamp(30px, 3.2vw, 42px);
      line-height: 1.08;
      letter-spacing: -0.03em;
    }

    .student-summary {
      max-width: 720px;
      line-height: 1.6;
    }

    .student-hero-card {
      min-height: 360px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      background:
        radial-gradient(circle at 85% 20%, rgba(124, 58, 237, 0.18), transparent 30%),
        linear-gradient(135deg, #004ac6 0%, #2563eb 48%, #7c3aed 100%);
      box-shadow: 0 24px 70px rgba(30, 64, 175, 0.16);
    }

    .student-hero-card::after {
      content: "";
      position: absolute;
      right: -90px;
      bottom: -110px;
      width: 280px;
      height: 280px;
      border-radius: 999px;
      border: 42px solid rgba(255, 255, 255, 0.11);
      pointer-events: none;
    }

    .student-hero-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.16) 1px, transparent 1px);
      background-size: 30px 30px;
      opacity: 0.34;
    }

    .z-1 {
      z-index: 1;
    }

    .hero-class-title {
      max-width: 780px;
      font-size: clamp(34px, 4vw, 50px);
      line-height: 1.04;
      letter-spacing: -0.04em;
      overflow-wrap: anywhere;
    }

    .text-white-75 {
      color: rgba(255, 255, 255, 0.76);
    }

    .hero-footer-card {
      border: 1px solid rgba(255, 255, 255, 0.22);
      border-radius: 18px;
      background: rgba(255, 255, 255, 0.13);
      backdrop-filter: blur(14px);
      padding: 16px;
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
    .class-preview-card,
    .status-row {
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .metric-card-modern:hover,
    .class-preview-card:hover,
    .status-row:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28) !important;
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .date-tile {
      min-width: 74px;
      background: #eef4ff;
      color: var(--color-primary);
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

    @media (max-width: 575.98px) {
      .student-title {
        font-size: 30px;
      }

      .student-hero-card {
        min-height: 320px;
        border-radius: 18px !important;
        padding: 18px !important;
      }

      .hero-class-title {
        font-size: 30px;
        line-height: 1.1;
      }

      .hero-footer-card {
        padding: 14px;
      }

      .hero-footer-card .btn {
        width: 100%;
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

      .date-tile {
        width: 100%;
      }
    }

    @media (max-width: 360px) {
      .student-hero-card {
        padding: 16px !important;
      }

      .hero-class-title {
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
    }
  `
})
export class StudentDashboardComponent implements OnInit {
  private readonly authToken = inject(AuthTokenService);
  private readonly classesApi = inject(ClassesApiService);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly user = this.authToken.getUser();
  protected readonly upcomingClasses = computed(() =>
    this.classes()
      .filter((item) => ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  );
  protected readonly upcomingPreview = computed(() => this.upcomingClasses().slice(0, 3));
  protected readonly nextClass = computed(() => this.upcomingClasses()[0] ?? null);
  protected readonly completedCount = computed(() => this.classes().filter((item) => item.status === 'completed').length);
  protected readonly cancelledCount = computed(() => this.classes().filter((item) => item.status === 'cancelled').length);
  protected readonly liveCount = computed(() => this.classes().filter((item) => item.status === 'live').length);
  protected readonly pendingAttendanceCount = computed(() =>
    this.classes().filter((item) => this.attendance(item).toLowerCase() === 'pending').length
  );
  protected readonly monthCount = computed(() => {
    const now = new Date();
    return this.classes().filter((item) => {
      const start = new Date(item.startTime);
      return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
    }).length;
  });
  protected readonly attendancePercent = computed(() => {
    const attended = this.classes().filter((item) => ['present', 'in session'].includes(this.attendance(item).toLowerCase())).length;
    return this.classes().length ? Math.round((attended / this.classes().length) * 100) : 0;
  });
  protected readonly nextClassLabel = computed(() => {
    const next = this.nextClass();
    if (!next) {
      return 'No class';
    }
    if (next.status === 'live') {
      return 'Live now';
    }
    const minutes = Math.max(0, Math.round((new Date(next.startTime).getTime() - Date.now()) / 60000));
    return minutes < 60 ? `Starts in ${minutes} min` : `Starts in ${Math.round(minutes / 60)} hr`;
  });
  protected readonly studentFirstName = computed(() => this.user?.firstName || this.user?.username || 'Student');
  protected readonly dashboardSummary = computed(() => {
    const next = this.nextClass();
    if (!next) {
      return 'No upcoming class is scheduled right now.';
    }
    return `Your next class is ${next.title} with ${next.teacherName}.`;
  });
  protected readonly greeting = computed(() => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  });

  ngOnInit(): void {
    this.classesApi.listClasses({ limit: 100 }).subscribe({
      next: (response) => this.classes.set(response.data),
      error: () => this.classes.set([])
    });
  }

  private attendance(item: ClassListItem): string {
    return item.participants[0]?.attendanceStatus ?? 'pending';
  }
}