import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';
import { TeacherAvailabilityApiService, TeacherAvailabilityItem } from '../../core/teachers/teacher-availability-api.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  template: `
    <div class="teacher-dashboard-page w-100 overflow-hidden">

      <!-- Header -->
      <div class="mb-4">
        <p class="section-kicker text-uppercase fw-bold small mb-2">Teacher Dashboard</p>
        <h1 class="fw-bold mb-2 page-title">Manage your classes, students, homework, and attendance</h1>
        <p class="text-muted mb-0 page-subtitle">{{ todaySummary() }}</p>
      </div>

      <!-- Hero Row -->
      <section class="row g-4 mb-4">

        <!-- Welcome Hero -->
        <div class="col-12 col-xl-7">
          <article class="teacher-hero-card position-relative overflow-hidden rounded-4 p-4 p-lg-5 text-white h-100">
            <div class="position-relative z-1">
              <span class="badge rounded-pill bg-white bg-opacity-25 text-white px-3 py-2 mb-4">
                <i class="bi bi-person-video3 me-1"></i>
                Teacher Workspace
              </span>

              <h2 class="fw-bold mb-3 hero-title">
                Welcome back, {{ teacherDisplayName() }}
              </h2>

              <p class="mb-4 text-white-75 hero-summary">
                {{ todaySummary() }}
              </p>

              <a class="btn btn-light text-primary fw-bold px-4" routerLink="/teacher/classes">
                <i class="bi bi-calendar3 me-2"></i>
                View Classes
              </a>
            </div>
          </article>
        </div>

        <!-- Next Class -->
        <div class="col-12 col-xl-5">
          <article class="card border rounded-4 overflow-hidden h-100 next-class-card">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div>
                  <h2 class="h5 fw-bold mb-1">Next Class</h2>
                  <p class="small text-muted mb-0">Nearest scheduled session</p>
                </div>

                @if (nextClass()) {
                  <span
                    class="badge rounded-pill text-uppercase"
                    [class.text-bg-success]="nextClass()!.status === 'live'"
                    [class.text-bg-primary]="nextClass()!.status !== 'live'"
                  >
                    {{ nextClass()!.status }}
                  </span>
                } @else {
                  <span class="badge rounded-pill text-bg-secondary text-uppercase">Clear</span>
                }
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              @if (nextClass()) {
                <div class="d-grid gap-3">
                  <div class="d-flex align-items-start gap-3">
                    <span class="icon-box icon-box-lg bg-primary-subtle text-primary flex-shrink-0">
                      <i class="bi bi-camera-video"></i>
                    </span>

                    <div class="min-w-0">
                      <p class="small text-primary fw-bold mb-1">{{ nextClassLeadText() }}</p>
                      <h3 class="h4 fw-bold mb-1 text-truncate">{{ studentName(nextClass()!) }}</h3>
                      <p class="text-muted mb-0">{{ nextClass()!.title }}</p>
                    </div>
                  </div>

                  <div class="class-time-box border rounded-4 p-3">
                    <div class="d-flex align-items-center gap-2 text-muted small mb-1">
                      <i class="bi bi-clock"></i>
                      Class Time
                    </div>
                    <strong>
                      {{ nextClass()!.startTime | date: 'MMM d, hh:mm a' }} -
                      {{ nextClass()!.endTime | date: 'hh:mm a' }}
                    </strong>
                  </div>

                  <a class="btn btn-primary fw-bold w-100" routerLink="/teacher/classes">
                    <i class="bi bi-box-arrow-up-right me-2"></i>
                    Open Class
                  </a>
                </div>
              } @else {
                <div class="empty-mini-state">
                  <span class="icon-box icon-box-lg bg-success-subtle text-success">
                    <i class="bi bi-calendar2-check"></i>
                  </span>

                  <h3 class="h4 fw-bold mb-2">Your schedule is clear</h3>
                  <p class="text-muted mb-4">New classes will appear here once admin schedules them.</p>

                  <a class="btn btn-primary fw-bold w-100" routerLink="/teacher/classes">
                    <i class="bi bi-calendar3 me-2"></i>
                    View Classes
                  </a>
                </div>
              }
            </div>
          </article>
        </div>

      </section>

      <!-- Metrics -->
      <section class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-primary-subtle text-primary mb-3">
                <i class="bi bi-calendar-day"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Today's Classes</p>
              <h3 class="fw-bold mb-1">{{ todayClasses().length }}</h3>
              <p class="small text-primary fw-semibold mb-0">Scheduled today</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-purple-subtle text-purple mb-3">
                <i class="bi bi-people"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Assigned Students</p>
              <h3 class="fw-bold mb-1">{{ uniqueStudentsCount() }}</h3>
              <p class="small text-primary fw-semibold mb-0">Unique learners</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-danger-subtle text-danger mb-3">
                <i class="bi bi-exclamation-circle"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Pending Attendance</p>
              <h3 class="fw-bold mb-1 text-danger">{{ pendingAttendanceCount() }}</h3>
              <p class="small text-danger fw-semibold mb-0">Needs update</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-success-subtle text-success mb-3">
                <i class="bi bi-check2-circle"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Completed</p>
              <h3 class="fw-bold mb-1">{{ completedCount() }}</h3>
              <p class="small text-primary fw-semibold mb-0">Finished sessions</p>
            </div>
          </article>
        </div>
      </section>

      <!-- Main Content -->
      <section class="row g-4">

        <!-- Today's Schedule -->
        <div class="col-12 col-xl-8">
          <article class="card border rounded-4 overflow-hidden h-100">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex flex-column flex-sm-row gap-3 justify-content-between">
                <div>
                  <h2 class="h5 fw-bold mb-1">Today's Schedule</h2>
                  <p class="small text-muted mb-0">Your classes for today</p>
                </div>

                <a class="fw-bold text-primary text-decoration-none small d-inline-flex align-items-center gap-2" routerLink="/teacher/classes">
                  View Calendar
                  <i class="bi bi-arrow-right"></i>
                </a>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">
                @for (item of todayClasses(); track item.id) {
                  <div class="schedule-card-modern border rounded-4 p-3" [class.active]="item.status === 'live'">
                    <div class="row g-3 align-items-center">
                      <div class="col-12 col-md-3">
                        <div class="d-flex align-items-center gap-2 text-primary fw-bold">
                          <i class="bi bi-clock"></i>
                          <span>{{ item.startTime | date: 'hh:mm a' }} - {{ item.endTime | date: 'hh:mm a' }}</span>
                        </div>
                      </div>

                      <div class="col-12 col-md min-w-0">
                        <h3 class="h6 fw-bold mb-1 text-truncate">{{ item.title }}</h3>
                        <p class="text-muted small mb-0 d-flex align-items-center gap-1">
                          <i class="bi bi-person"></i>
                          {{ studentName(item) }}
                        </p>
                      </div>

                      <div class="col-12 col-md-auto">
                        <span
                          class="badge rounded-pill text-uppercase"
                          [class.text-bg-success]="item.status === 'live'"
                          [class.text-bg-secondary]="item.status !== 'live'"
                        >
                          {{ item.status }}
                        </span>
                      </div>

                      @if (item.status === 'live') {
                        <div class="col-12 col-md-auto">
                          <button class="btn btn-primary btn-sm fw-bold w-100" type="button">
                            <i class="bi bi-camera-video me-1"></i>
                            Join Zoom
                          </button>
                        </div>
                      }
                    </div>
                  </div>
                } @empty {
                  <div class="empty-state">
                    <i class="bi bi-calendar2-check"></i>
                    <strong>No classes scheduled</strong>
                    <span>Your schedule is clear for today.</span>
                  </div>
                }
              </div>
            </div>
          </article>
        </div>

        <!-- Quick Actions -->
        <div class="col-12 col-xl-4">
          <article class="card border rounded-4 overflow-hidden h-100">
            <div class="card-header bg-white p-3 p-md-4">
              <h2 class="h5 fw-bold mb-1">Quick Actions</h2>
              <p class="small text-muted mb-0">Common teaching tasks</p>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="row g-3">
                <div class="col-12 col-sm-6 col-xl-6">
                  <a class="quick-action-tile" routerLink="/teacher/classes">
                    <span class="icon-box bg-primary-subtle text-primary">
                      <i class="bi bi-camera-video"></i>
                    </span>
                    <strong>Join Class</strong>
                  </a>
                </div>

                <div class="col-12 col-sm-6 col-xl-6">
                  <a class="quick-action-tile">
                    <span class="icon-box bg-warning-subtle text-warning-emphasis">
                      <i class="bi bi-journal-check"></i>
                    </span>
                    <strong>Homework</strong>
                  </a>
                </div>

                <div class="col-12 col-sm-6 col-xl-6">
                  <a class="quick-action-tile">
                    <span class="icon-box bg-success-subtle text-success">
                      <i class="bi bi-person-check"></i>
                    </span>
                    <strong>Attendance</strong>
                  </a>
                </div>

                <div class="col-12 col-sm-6 col-xl-6">
                  <a class="quick-action-tile">
                    <span class="icon-box bg-purple-subtle text-purple">
                      <i class="bi bi-calendar-week"></i>
                    </span>
                    <strong>Availability</strong>
                  </a>
                </div>
              </div>
            </div>
          </article>
        </div>

        <!-- Availability -->
        <div class="col-12">
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
                <div>
                  <h2 class="h5 fw-bold mb-1">Availability</h2>
                  <p class="small text-muted mb-0">View or update your weekly teaching hours</p>
                </div>

                <div class="form-check form-switch m-0">
                  <input
                    class="form-check-input"
                    id="availabilityEditMode"
                    type="checkbox"
                    [ngModel]="availabilityEditMode()"
                    (ngModelChange)="toggleAvailabilityEdit($event)"
                  />
                  <label class="form-check-label fw-bold" for="availabilityEditMode">
                    {{ availabilityEditMode() ? 'Edit Mode' : 'View Mode' }}
                  </label>
                </div>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              @if (!availabilityEditMode()) {
                <div class="row g-3">
                  @for (slot of activeAvailability(); track slot.id) {
                    <div class="col-12 col-sm-6 col-lg-4 col-xxl-3">
                      <div class="availability-card border rounded-4 p-3 h-100">
                        <div class="d-flex align-items-center gap-3">
                          <span class="icon-box bg-primary-subtle text-primary flex-shrink-0">
                            <i class="bi bi-calendar-check"></i>
                          </span>

                          <div>
                            <strong class="d-block">{{ dayLabel(slot.dayOfWeek) }}</strong>
                            <span class="small text-muted">{{ trimTime(slot.startTime) }} - {{ trimTime(slot.endTime) }}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  } @empty {
                    <div class="col-12">
                      <div class="empty-state">
                        <i class="bi bi-calendar-x"></i>
                        <strong>No active slots found</strong>
                        <span>Your availability is not set yet.</span>
                      </div>
                    </div>
                  }
                </div>
              } @else {
                <div class="availability-editor">
                  @for (slot of availabilityDraft(); track slot.dayOfWeek) {
                    <div class="availability-edit-row border rounded-4 p-3">
                      <label class="form-check m-0 d-flex align-items-center gap-2">
                        <input
                          class="form-check-input"
                          type="checkbox"
                          [(ngModel)]="slot.isActive"
                          [name]="'active-' + slot.dayOfWeek"
                        />
                        <span class="form-check-label fw-bold">{{ dayLabel(slot.dayOfWeek) }}</span>
                      </label>

                      <div>
                        <label class="small text-muted fw-bold mb-1">Start</label>
                        <input
                          class="form-control"
                          type="time"
                          [(ngModel)]="slot.startTime"
                          [name]="'start-' + slot.dayOfWeek"
                          [disabled]="!slot.isActive"
                        />
                      </div>

                      <div>
                        <label class="small text-muted fw-bold mb-1">End</label>
                        <input
                          class="form-control"
                          type="time"
                          [(ngModel)]="slot.endTime"
                          [name]="'end-' + slot.dayOfWeek"
                          [disabled]="!slot.isActive"
                        />
                      </div>
                    </div>
                  }

                  @if (availabilityMessage()) {
                    <div
                      class="alert py-2 mb-0"
                      [class.alert-success]="availabilityMessageType() === 'success'"
                      [class.alert-danger]="availabilityMessageType() === 'error'"
                    >
                      <i
                        class="bi me-2"
                        [class.bi-check-circle]="availabilityMessageType() === 'success'"
                        [class.bi-exclamation-triangle]="availabilityMessageType() === 'error'"
                      ></i>
                      {{ availabilityMessage() }}
                    </div>
                  }

                  <button
                    class="btn btn-primary fw-bold d-inline-flex align-items-center justify-content-center gap-2"
                    type="button"
                    [disabled]="availabilitySaving()"
                    (click)="updateAvailability()"
                  >
                    @if (availabilitySaving()) {
                      <span class="spinner-border spinner-border-sm"></span>
                    } @else {
                      <i class="bi bi-save"></i>
                    }

                    {{ availabilitySaving() ? 'Updating...' : 'Update Availability' }}
                  </button>
                </div>
              }
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

    .teacher-dashboard-page {
      width: 100%;
      max-width: 1480px;
      overflow-x: hidden;
    }

    .teacher-dashboard-page *,
    .teacher-dashboard-page *::before,
    .teacher-dashboard-page *::after {
      box-sizing: border-box;
    }

    .min-w-0 {
      min-width: 0;
    }

    .page-title {
      font-size: clamp(30px, 3.2vw, 42px);
      line-height: 1.08;
      letter-spacing: -0.03em;
      max-width: 900px;
    }

    .page-subtitle {
      max-width: 760px;
      line-height: 1.6;
    }

    .teacher-hero-card {
      min-height: 320px;
      display: flex;
      align-items: center;
      background:
        radial-gradient(circle at 85% 20%, rgba(124, 58, 237, 0.18), transparent 30%),
        linear-gradient(135deg, #004ac6 0%, #2563eb 48%, #7c3aed 100%);
      box-shadow: 0 24px 70px rgba(30, 64, 175, 0.16);
    }

    .teacher-hero-card::after {
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

    .teacher-hero-card::before {
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

    .hero-title {
      max-width: 720px;
      font-size: clamp(34px, 4vw, 50px);
      line-height: 1.04;
      letter-spacing: -0.04em;
      overflow-wrap: anywhere;
    }

    .hero-summary {
      max-width: 680px;
      line-height: 1.6;
    }

    .text-white-75 {
      color: rgba(255, 255, 255, 0.76);
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

    .bg-purple-subtle {
      background: #f2eaff;
    }

    .text-purple {
      color: var(--color-secondary);
    }

    .metric-card-modern,
    .next-class-card,
    .schedule-card-modern,
    .quick-action-tile,
    .availability-card,
    .availability-edit-row {
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .metric-card-modern:hover,
    .schedule-card-modern:hover,
    .quick-action-tile:hover,
    .availability-card:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28) !important;
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .class-time-box {
      background: var(--color-surface-soft);
    }

    .empty-mini-state {
      min-height: 260px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
      text-align: center;
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

    .quick-action-tile {
      min-height: 120px;
      display: grid;
      align-content: center;
      justify-items: center;
      gap: 10px;
      border: 1px solid var(--color-border);
      border-radius: 18px;
      color: var(--color-text);
      text-align: center;
      text-decoration: none;
      padding: 16px;
    }

    .availability-editor {
      display: grid;
      gap: 12px;
    }

    .availability-edit-row {
      display: grid;
      grid-template-columns: minmax(130px, 1fr) minmax(0, 160px) minmax(0, 160px);
      align-items: end;
      gap: 12px;
    }

    @media (max-width: 991.98px) {
      .availability-edit-row {
        grid-template-columns: 1fr 1fr;
      }

      .availability-edit-row .form-check {
        grid-column: 1 / -1;
      }
    }

    @media (max-width: 575.98px) {
      .page-title {
        font-size: 30px;
      }

      .teacher-hero-card {
        min-height: 300px;
        border-radius: 18px !important;
        padding: 18px !important;
      }

      .hero-title {
        font-size: 30px;
        line-height: 1.1;
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

      .availability-edit-row {
        grid-template-columns: 1fr;
      }

      .availability-editor .btn {
        width: 100%;
      }

      .quick-action-tile {
        min-height: 104px;
      }
    }

    @media (max-width: 360px) {
      .page-title {
        font-size: 26px;
      }

      .teacher-hero-card {
        padding: 16px !important;
      }

      .hero-title {
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
export class TeacherDashboardComponent implements OnInit {
  private readonly authToken = inject(AuthTokenService);
  private readonly classesApi = inject(ClassesApiService);
  private readonly availabilityApi = inject(TeacherAvailabilityApiService);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly availability = signal<TeacherAvailabilityItem[]>([]);
  protected readonly availabilityEditMode = signal(false);
  protected readonly availabilityDraft = signal<AvailabilityDraft[]>([]);
  protected readonly availabilitySaving = signal(false);
  protected readonly availabilityMessage = signal('');
  protected readonly availabilityMessageType = signal<'success' | 'error'>('success');
  protected readonly user = this.authToken.getUser();

  protected readonly todayClasses = computed(() =>
    this.classes()
      .filter((item) => new Date(item.startTime).toDateString() === new Date().toDateString())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
  );
  protected readonly nextClass = computed(() =>
    this.classes()
      .filter((item) => ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null
  );
  protected readonly uniqueStudentsCount = computed(() => {
    const ids = new Set<string>();
    for (const item of this.classes()) {
      for (const participant of item.participants) {
        ids.add(participant.studentId);
      }
    }
    return ids.size;
  });
  protected readonly pendingAttendanceCount = computed(() =>
    this.classes().filter((item) => item.participants.some((participant) => participant.attendanceStatus === 'pending')).length
  );
  protected readonly completedCount = computed(() => this.classes().filter((item) => item.status === 'completed').length);
  protected readonly activeAvailability = computed(() => this.availability().filter((slot) => slot.isActive));
  protected readonly teacherDisplayName = computed(() => {
    if (!this.user) {
      return 'Teacher';
    }
    return `${this.user.firstName} ${this.user.lastName}`.trim() || this.user.username || 'Teacher';
  });
  protected readonly todaySummary = computed(() => {
    const count = this.todayClasses().length;
    const pending = this.pendingAttendanceCount();
    if (count === 0) {
      return 'No classes are scheduled for today. New assignments will appear as admin creates them.';
    }
    return `You have ${count} class${count === 1 ? '' : 'es'} scheduled today and ${pending} attendance item${pending === 1 ? '' : 's'} pending.`;
  });
  protected readonly nextClassLeadText = computed(() => {
    const next = this.nextClass();
    if (!next) {
      return 'No upcoming session';
    }
    const minutes = Math.max(0, Math.round((new Date(next.startTime).getTime() - Date.now()) / 60000));
    if (next.status === 'live') {
      return 'Live now';
    }
    return minutes < 60 ? `Next class in ${minutes} min` : `Next class on ${new Date(next.startTime).toLocaleDateString()}`;
  });

  ngOnInit(): void {
    this.classesApi.listClasses({ limit: 100 }).subscribe({
      next: (response) => this.classes.set(response.data),
      error: () => this.classes.set([])
    });

    if (this.user?.id) {
      this.availabilityApi.listAvailability(this.user.id).subscribe({
        next: (response) => {
          this.availability.set(response.data.availability);
          this.resetAvailabilityDraft(response.data.availability);
        },
        error: () => this.availability.set([])
      });
    }
  }

  protected studentName(item: ClassListItem): string {
    return item.participants[0]?.studentName ?? 'Unassigned student';
  }

  protected dayLabel(day: string): string {
    return day.slice(0, 3).toUpperCase();
  }

  protected trimTime(value: string): string {
    return value.slice(0, 5);
  }

  protected toggleAvailabilityEdit(value: boolean): void {
    this.availabilityEditMode.set(value);
    this.availabilityMessage.set('');

    if (value) {
      this.resetAvailabilityDraft(this.availability());
    }
  }

  protected updateAvailability(): void {
    if (!this.user?.id) {
      return;
    }

    const activeSlots = this.availabilityDraft().filter((slot) => slot.isActive);
    const invalid = activeSlots.find((slot) => !slot.startTime || !slot.endTime || slot.startTime >= slot.endTime);

    if (invalid) {
      this.availabilityMessageType.set('error');
      this.availabilityMessage.set('Each active day needs a valid start time before end time.');
      return;
    }

    this.availabilitySaving.set(true);
    this.availabilityMessage.set('');
    this.availabilityApi
      .replaceAvailability(
        this.user.id,
        activeSlots.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          startTime: slot.startTime,
          endTime: slot.endTime,
          timezone: slot.timezone,
          isActive: true
        }))
      )
      .subscribe({
        next: (response) => {
          this.availability.set(response.data.availability);
          this.resetAvailabilityDraft(response.data.availability);
          this.availabilityMessageType.set('success');
          this.availabilityMessage.set('Availability updated.');
          this.availabilityEditMode.set(false);
          this.availabilitySaving.set(false);
        },
        error: () => {
          this.availabilityMessageType.set('error');
          this.availabilityMessage.set('Could not update availability.');
          this.availabilitySaving.set(false);
        }
      });
  }

  private resetAvailabilityDraft(slots: TeacherAvailabilityItem[]): void {
    const byDay = new Map(slots.map((slot) => [slot.dayOfWeek, slot]));
    this.availabilityDraft.set(
      weekdays.map((dayOfWeek) => {
        const slot = byDay.get(dayOfWeek);
        return {
          dayOfWeek,
          startTime: slot ? this.trimTime(slot.startTime) : '09:00',
          endTime: slot ? this.trimTime(slot.endTime) : '18:00',
          timezone: slot?.timezone ?? 'Asia/Kolkata',
          isActive: slot?.isActive ?? false
        };
      })
    );
  }
}

type AvailabilityDraft = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
};

const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];