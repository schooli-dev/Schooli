import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';

type TeacherClassTab = 'today' | 'upcoming' | 'completed' | 'cancelled' | 'all';

@Component({
  selector: 'app-teacher-classes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
    <div class="teacher-classes-page w-100 overflow-hidden">

      <!-- Header -->
      <div class="d-flex flex-column flex-lg-row justify-content-between align-items-lg-start gap-3 mb-4">
        <div class="min-w-0">
          <p class="section-kicker text-uppercase fw-bold small mb-2">Teacher Classes</p>
          <h1 class="fw-bold mb-2 page-title">My Classes</h1>
          <p class="text-muted mb-0 page-subtitle">
            View, join, and manage your scheduled teaching sessions.
          </p>
        </div>

        <button class="btn btn-outline-primary fw-bold d-inline-flex align-items-center justify-content-center gap-2" type="button">
          <i class="bi bi-download"></i>
          Export
        </button>
      </div>

      <!-- Metrics -->
      <section class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-xl">
          <article class="card h-100 border metric-card-modern active-metric">
            <div class="card-body">
              <span class="icon-box bg-primary-subtle text-primary mb-3">
                <i class="bi bi-calendar-day"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Today's Classes</p>
              <h3 class="fw-bold mb-1">{{ todayCount() }}</h3>
              <p class="small text-primary fw-semibold mb-0">Scheduled today</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-success-subtle text-success mb-3">
                <i class="bi bi-clock"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Next Class</p>
              <h3 class="fw-bold mb-1 metric-title">{{ nextClassTime() }}</h3>
              <p class="small text-primary fw-semibold mb-0 text-truncate">{{ nextClassStatus() }}</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-purple-subtle text-purple mb-3">
                <i class="bi bi-calendar-event"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Upcoming Classes</p>
              <h3 class="fw-bold mb-1">{{ upcomingCount() }}</h3>
              <p class="small text-primary fw-semibold mb-0">Future sessions</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-xl">
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

        <div class="col-12 col-sm-6 col-xl">
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
                      placeholder="Search student or class..."
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

          <!-- Desktop Table -->
          <article class="card border rounded-4 overflow-hidden d-none d-lg-block">
            <div class="table-responsive">
              <table class="table align-middle mb-0 teacher-class-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Student</th>
                    <th>Schedule</th>
                    <th>Status</th>
                    <th>Attendance</th>
                    <th>Zoom</th>
                    <th class="text-end">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  @for (item of pagedClasses(); track item.id) {
                    <tr>
                      <td>
                        <div class="d-flex align-items-center gap-3">
                          <span class="class-avatar">
                            <i class="bi bi-camera-video"></i>
                          </span>

                          <div class="min-w-0">
                            <strong class="d-block text-truncate">{{ item.title }}</strong>
                            <span class="d-block text-muted small">Session #{{ item.id.slice(0, 8) }}</span>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span class="person-cell">
                          <i class="bi bi-person"></i>
                          {{ studentName(item) }}
                        </span>
                      </td>

                      <td>
                        <div class="date-cell">
                          <strong>{{ item.startTime | date: 'MMM d' }}</strong>
                          <span>{{ item.startTime | date: 'hh:mm a' }} - {{ item.endTime | date: 'hh:mm a' }}</span>
                          <small>{{ item.durationMinutes }} min</small>
                        </div>
                      </td>

                      <td>
                        <span
                          class="status-chip"
                          [class.status-live]="item.status === 'live'"
                          [class.status-success]="item.status === 'completed'"
                          [class.status-danger]="item.status === 'cancelled'"
                        >
                          {{ item.status }}
                        </span>
                      </td>

                      <td>
                        <strong
                          class="attendance-text"
                          [class.text-danger]="attendance(item) === 'pending'"
                          [class.text-success]="attendance(item).toLowerCase() === 'present'"
                        >
                          {{ attendance(item) }}
                        </strong>
                      </td>

                      <td>
                        <span class="zoom-chip">
                          <i class="bi bi-camera-video"></i>
                          {{ item.zoomMeeting?.creationStatus ?? 'pending' }}
                        </span>
                      </td>

                      <td class="text-end">
                        <div class="action-group">
                          <button
                            class="btn btn-light action-btn"
                            type="button"
                            title="Join class"
                            aria-label="Join class"
                            [disabled]="!canJoin(item)"
                            (click)="joinClass(item)"
                          >
                            <i class="bi bi-box-arrow-in-right"></i>
                          </button>

                          <button
                            class="btn btn-light action-btn"
                            type="button"
                            title="Class details"
                            aria-label="Class details"
                            (click)="openDrawer(item)"
                          >
                            <i class="bi bi-eye"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr>
                      <td colspan="7">
                        <div class="empty-state">
                          <i class="bi bi-calendar2-x"></i>
                          <strong>No classes found</strong>
                          <span>No classes found for this filter.</span>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </article>

          <!-- Mobile Cards -->
          <div class="d-grid gap-3 d-lg-none">
            @for (item of pagedClasses(); track item.id) {
              <article class="card border rounded-4 class-card-modern">
                <div class="card-body p-3">

                  <div class="d-flex align-items-start gap-3">
                    <span class="class-avatar">
                      <i class="bi bi-camera-video"></i>
                    </span>

                    <div class="min-w-0 flex-grow-1">
                      <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
                        <span
                          class="status-chip"
                          [class.status-live]="item.status === 'live'"
                          [class.status-success]="item.status === 'completed'"
                          [class.status-danger]="item.status === 'cancelled'"
                        >
                          {{ item.status }}
                        </span>

                        <span class="small text-muted">#{{ item.id.slice(0, 8) }}</span>
                      </div>

                      <h2 class="h6 fw-bold mb-2 class-title">{{ item.title }}</h2>

                      <div class="mobile-meta">
                        <span>
                          <i class="bi bi-person"></i>
                          {{ studentName(item) }}
                        </span>

                        <span>
                          <i class="bi bi-calendar-event"></i>
                          {{ item.startTime | date: 'MMM d, hh:mm a' }}
                        </span>

                        <span>
                          <i class="bi bi-hourglass-split"></i>
                          {{ item.durationMinutes }} min
                        </span>

                        <span>
                          <i class="bi bi-person-check"></i>
                          Attendance: {{ attendance(item) }}
                        </span>

                        <span>
                          <i class="bi bi-camera-video"></i>
                          Zoom: {{ item.zoomMeeting?.creationStatus ?? 'pending' }}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div class="mobile-actions mt-3">
                    <button
                      class="btn btn-primary btn-sm fw-bold"
                      type="button"
                      [disabled]="!canJoin(item)"
                      (click)="joinClass(item)"
                    >
                      <i class="bi bi-box-arrow-in-right me-1"></i>
                      Join
                    </button>

                    <button
                      class="btn btn-outline-secondary btn-sm fw-bold"
                      type="button"
                      (click)="openDrawer(item)"
                    >
                      <i class="bi bi-eye me-1"></i>
                      Details
                    </button>
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

          <!-- Footer / Pagination -->
          <div class="d-flex flex-column flex-md-row gap-3 justify-content-between align-items-md-center mt-4">
            <span class="small text-muted">Showing {{ filteredClasses().length }} class(es)</span>

            <nav aria-label="Teacher classes pagination">
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

        </div>

        <!-- Right Column -->
        <aside class="col-12 col-xl-4 d-grid gap-4 align-content-start">

          <!-- Next Class Card -->
          <article class="teacher-next-card position-relative overflow-hidden rounded-4 p-4 text-white">
            <div class="position-relative z-1">
              <span class="badge rounded-pill bg-white bg-opacity-25 text-white px-3 py-2 mb-4">
                <i class="bi bi-broadcast me-1"></i>
                {{ nextClassStatus() === 'live' ? 'Live now' : 'Next class' }}
              </span>

              <h2 class="fw-bold mb-2">{{ nextClassTime() }}</h2>
              <p class="text-white-75 mb-4">{{ nextClassSummary() }}</p>

              @if (nextClass()) {
                <button
                  class="btn btn-light text-primary fw-bold w-100"
                  type="button"
                  [disabled]="!canJoin(nextClass()!)"
                  (click)="joinClass(nextClass()!)"
                >
                  <i class="bi bi-camera-video me-2"></i>
                  Join Next Class
                </button>
              }
            </div>
          </article>

          <!-- Pending Actions -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <h2 class="h5 fw-bold mb-1">Pending Actions</h2>
              <p class="small text-muted mb-0">Items that need your attention</p>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">
                <div class="pending-action-card d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box bg-danger-subtle text-danger flex-shrink-0">
                    <i class="bi bi-person-check"></i>
                  </span>

                  <div class="min-w-0">
                    <strong class="d-block">Mark attendance</strong>
                    <span class="small text-muted">For {{ pendingAttendanceCount() }} class(es)</span>
                  </div>
                </div>

                <div class="pending-action-card d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box bg-primary-subtle text-primary flex-shrink-0">
                    <i class="bi bi-journal-text"></i>
                  </span>

                  <div class="min-w-0">
                    <strong class="d-block">Review lessons</strong>
                    <span class="small text-muted">Check upcoming sessions before joining</span>
                  </div>
                </div>
              </div>
            </div>
          </article>

        </aside>

      </section>
    </div>

    <!-- Details Drawer -->
    @if (drawerOpen() && selectedClass()) {
      <section class="teacher-drawer-backdrop" (click)="closeDrawer()"></section>

      <aside class="teacher-drawer">
        <header class="d-flex align-items-start justify-content-between gap-3 mb-4">
          <div class="d-flex align-items-start gap-3 min-w-0">
            <span class="icon-box icon-box-lg bg-primary-subtle text-primary flex-shrink-0">
              <i class="bi bi-camera-video"></i>
            </span>

            <div class="min-w-0">
              <p class="section-kicker text-uppercase fw-bold small mb-1">Class Details</p>
              <h2 class="h4 fw-bold mb-0 text-truncate">{{ selectedClass()!.title }}</h2>
            </div>
          </div>

          <button class="btn-close" type="button" aria-label="Close" (click)="closeDrawer()"></button>
        </header>

        <div class="student-strip d-flex align-items-center gap-3 rounded-4 p-3 mb-3">
          <span class="drawer-avatar">{{ initials(studentName(selectedClass()!)) }}</span>

          <div class="min-w-0">
            <strong class="d-block text-truncate">{{ studentName(selectedClass()!) }}</strong>
            <p class="small text-muted mb-0 text-truncate">{{ selectedClass()!.title }}</p>
          </div>
        </div>

        <button
          class="btn btn-primary btn-lg w-100 fw-bold d-inline-flex align-items-center justify-content-center gap-2 mb-3"
          type="button"
          [disabled]="!canJoin(selectedClass()!)"
          (click)="joinClass(selectedClass()!)"
        >
          <i class="bi bi-camera-video"></i>
          Join Zoom Meeting
        </button>

        <div class="detail-grid mb-3">
          <div class="detail-box">
            <span>Schedule</span>
            <strong>{{ selectedClass()!.startTime | date: 'MMM d, hh:mm a' }}</strong>
          </div>

          <div class="detail-box">
            <span>Duration</span>
            <strong>{{ selectedClass()!.durationMinutes }} min</strong>
          </div>

          <div class="detail-box">
            <span>Status</span>
            <strong>{{ selectedClass()!.status }}</strong>
          </div>

          <div class="detail-box">
            <span>Zoom</span>
            <strong>{{ selectedClass()!.zoomMeeting?.creationStatus ?? 'pending' }}</strong>
          </div>
        </div>

        <div class="evidence-card rounded-4 p-3 mb-3">
          <strong class="d-block mb-2">
            <i class="bi bi-person-check me-2"></i>
            Attendance Evidence
          </strong>
          <p class="mb-0 text-muted">
            Current status:
            <span class="fw-bold text-dark">{{ attendance(selectedClass()!) }}</span>
          </p>
        </div>

        <label class="notes-box mb-3">
          <span class="fw-bold d-block mb-2">
            <i class="bi bi-journal-text me-2"></i>
            Private Teacher Notes
          </span>

          <textarea
            class="form-control"
            rows="5"
            placeholder="Add notes about progress in this session..."
          ></textarea>
        </label>

        <button class="btn btn-outline-secondary fw-bold w-100">
          <i class="bi bi-save me-2"></i>
          Save Notes
        </button>
      </aside>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 100%;
      overflow-x: hidden;
    }

    .teacher-classes-page {
      width: 100%;
      max-width: 1480px;
      overflow-x: hidden;
    }

    .teacher-classes-page *,
    .teacher-classes-page *::before,
    .teacher-classes-page *::after {
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

    .bg-purple-subtle {
      background: #f2eaff;
    }

    .text-purple {
      color: var(--color-secondary);
    }

    .text-white-75 {
      color: rgba(255, 255, 255, 0.76);
    }

    .metric-card-modern,
    .class-card-modern,
    .pending-action-card {
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .metric-card-modern:hover,
    .class-card-modern:hover,
    .pending-action-card:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28) !important;
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .active-metric {
      border-color: rgba(37, 99, 235, 0.28) !important;
      background: linear-gradient(180deg, #ffffff 0%, #eef4ff 100%);
    }

    .metric-title {
      font-size: clamp(22px, 2vw, 28px);
    }

    .tabs-scroll {
      scrollbar-width: thin;
    }

    .tab-btn {
      white-space: nowrap;
      min-height: 38px;
    }

    .teacher-class-table {
      --bs-table-bg: #ffffff;
    }

    .teacher-class-table thead th {
      border-bottom: 1px solid var(--color-border-soft);
      background: var(--color-surface-soft);
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
      padding: 16px 22px;
    }

    .teacher-class-table tbody td {
      padding: 18px 22px;
      border-bottom: 1px solid var(--color-border-soft);
    }

    .teacher-class-table tbody tr:hover {
      background: #f8fbff;
    }

    .class-avatar {
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: #eef4ff;
      color: var(--color-primary);
      font-size: 21px;
    }

    .person-cell {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--color-text-soft);
      font-weight: 700;
      white-space: nowrap;
    }

    .date-cell {
      display: grid;
      gap: 2px;
    }

    .date-cell span,
    .date-cell small {
      color: var(--color-muted);
      font-size: 13px;
    }

    .status-chip,
    .zoom-chip {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      min-height: 30px;
      border-radius: 999px;
      background: #eef1fb;
      color: var(--color-text-soft);
      padding: 0 11px;
      font-size: 12px;
      font-weight: 800;
      text-transform: capitalize;
      white-space: nowrap;
    }

    .status-chip.status-live,
    .status-chip.status-success {
      background: #dcfce7;
      color: var(--color-success);
    }

    .status-chip.status-danger {
      background: #fee2e2;
      color: var(--color-danger);
    }

    .zoom-chip {
      background: #eef4ff;
      color: var(--color-primary);
    }

    .attendance-text {
      text-transform: capitalize;
    }

    .action-group {
      display: inline-flex;
      gap: 6px;
      padding: 4px;
      border: 1px solid var(--color-border-soft);
      border-radius: 999px;
      background: #f8fafc;
    }

    .action-btn {
      width: 34px;
      height: 34px;
      display: inline-grid;
      place-items: center;
      border: 0;
      border-radius: 999px;
      color: var(--color-text-soft);
    }

    .action-btn:hover:not(:disabled) {
      color: var(--color-primary);
      background: #eef4ff;
    }

    .action-btn:disabled {
      opacity: 0.45;
    }

    .mobile-meta {
      display: grid;
      gap: 8px;
    }

    .mobile-meta span {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      color: var(--color-muted);
      font-size: 13px;
    }

    .mobile-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .teacher-next-card {
      min-height: 210px;
      background:
        radial-gradient(circle at 85% 20%, rgba(124, 58, 237, 0.18), transparent 30%),
        linear-gradient(135deg, #004ac6 0%, #2563eb 48%, #7c3aed 100%);
      box-shadow: 0 24px 70px rgba(30, 64, 175, 0.16);
    }

    .teacher-next-card::after {
      content: "";
      position: absolute;
      right: -70px;
      bottom: -90px;
      width: 220px;
      height: 220px;
      border-radius: 999px;
      border: 34px solid rgba(255, 255, 255, 0.11);
      pointer-events: none;
    }

    .teacher-next-card::before {
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

    /* Drawer fixed above App Shell */
    .teacher-drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 3000;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(8px);
    }

    .teacher-drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      z-index: 3010;
      width: min(460px, 100vw);
      height: 100dvh;
      max-height: 100dvh;
      overflow-y: auto;
      overflow-x: hidden;
      border-left: 1px solid var(--color-border);
      background: #ffffff;
      box-shadow: -24px 0 70px rgba(15, 23, 42, 0.22);
      padding: 24px;
    }

    .teacher-drawer::-webkit-scrollbar {
      width: 8px;
    }

    .teacher-drawer::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.32);
    }

    .student-strip,
    .evidence-card {
      border: 1px solid var(--color-border-soft);
      background: var(--color-surface-soft);
    }

    .drawer-avatar {
      width: 46px;
      height: 46px;
      flex: 0 0 46px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      background: linear-gradient(135deg, var(--color-primary), var(--color-secondary));
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
    }

    .detail-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }

    .detail-box {
      border: 1px solid var(--color-border-soft);
      border-radius: 14px;
      background: #ffffff;
      padding: 12px;
    }

    .detail-box span {
      display: block;
      color: var(--color-muted);
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .detail-box strong {
      display: block;
      margin-top: 4px;
      color: var(--color-text);
      font-size: 13px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .notes-box textarea {
      resize: vertical;
    }

    .pagination .page-link {
      color: var(--color-primary);
    }

    .pagination .active .page-link {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }

    @media (max-width: 991.98px) {
      .teacher-drawer {
        width: 100vw;
        border-left: 0;
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

      .mobile-actions {
        grid-template-columns: 1fr;
      }

      .teacher-next-card {
        min-height: 190px;
        border-radius: 18px !important;
      }

      .teacher-drawer {
        padding: 18px;
      }

      .detail-grid {
        grid-template-columns: 1fr;
      }

      .class-avatar {
        width: 40px;
        height: 40px;
        flex-basis: 40px;
        border-radius: 12px;
        font-size: 18px;
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
    }
  `
})
export class TeacherClassesComponent implements OnInit {
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly activeTab = signal<TeacherClassTab>('today');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 8;
  protected readonly searchText = signal('');
  protected readonly apiWarning = signal('');
  protected readonly drawerOpen = signal(false);
  protected readonly selectedClass = signal<ClassListItem | null>(null);
  protected readonly tabs: Array<{ key: TeacherClassTab; label: string }> = [
    { key: 'today', label: 'Today' },
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
      [item.title, this.studentName(item), item.status].some((value) => value.toLowerCase().includes(query))
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

  protected readonly todayCount = computed(() => this.classes().filter((item) => this.isToday(item)).length);

  protected readonly upcomingCount = computed(() => this.classes().filter((item) => this.matchesTab(item, 'upcoming')).length);

  protected readonly completedCount = computed(() => this.classes().filter((item) => item.status === 'completed').length);

  protected readonly pendingAttendanceCount = computed(() =>
    this.classes().filter((item) => this.attendance(item).toLowerCase() === 'pending').length
  );

  protected readonly nextClassTime = computed(() => {
    const next = this.nextClass();
    return next ? new Date(next.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  });

  protected readonly nextClassStatus = computed(() => this.nextClass()?.status ?? 'none');

  protected readonly nextClassSummary = computed(() => {
    const next = this.nextClass();
    return next ? `${next.title} with ${this.studentName(next)}` : 'No upcoming class scheduled.';
  });

  constructor(private readonly classesApi: ClassesApiService) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.activeTab.set('today');
    this.currentPage.set(1);
  }

  protected setActiveTab(tab: TeacherClassTab): void {
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

  protected tabCount(tab: TeacherClassTab): number {
    return this.classes().filter((item) => this.matchesTab(item, tab)).length;
  }

  protected openDrawer(item: ClassListItem): void {
    this.selectedClass.set(item);
    this.drawerOpen.set(true);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected studentName(item: ClassListItem): string {
    return item.participants[0]?.studentName ?? 'Unassigned student';
  }

  protected attendance(item: ClassListItem): string {
    return item.participants[0]?.attendanceStatus ?? 'pending';
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected canJoin(item: ClassListItem): boolean {
    return ['live', 'scheduled', 'rescheduled'].includes(item.status) && Boolean(item.zoomMeeting?.joinUrl || item.zoomMeeting?.startUrl);
  }

  protected joinClass(item: ClassListItem): void {
    this.classesApi.joinClass(item.id).subscribe({
      next: (response) => {
        const zoomUrl = response.data.zoom.startUrl ?? response.data.zoom.joinUrl;
        if (zoomUrl) {
          window.open(zoomUrl, '_blank', 'noopener,noreferrer');
        }
      }
    });
  }

  private loadClasses(): void {
    this.apiWarning.set('');
    this.classesApi.listClasses({ limit: 100 }).subscribe({
      next: (response) => this.classes.set(response.data),
      error: () => {
        this.apiWarning.set('Could not load teacher classes from backend.');
        this.classes.set([]);
      }
    });
  }

  private matchesTab(item: ClassListItem, tab: TeacherClassTab): boolean {
    if (tab === 'all') {
      return true;
    }

    if (tab === 'today') {
      return this.isToday(item);
    }

    if (tab === 'upcoming') {
      return ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now();
    }

    return item.status === tab;
  }

  private isToday(item: ClassListItem): boolean {
    return new Date(item.startTime).toDateString() === new Date().toDateString();
  }
}