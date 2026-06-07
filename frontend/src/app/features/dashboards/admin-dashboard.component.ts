import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboardApiService, AdminDashboardStats } from '../../core/admin/admin-dashboard-api.service';

const emptyStats: AdminDashboardStats = {
  users: { total: 0, active: 0, inactive: 0, teachers: 0, students: 0, support: 0 },
  classes: { today: 0, live: 0, upcoming: 0, completedThisMonth: 0 },
  tickets: { open: 0, urgent: 0 },
  homework: { pending: 0, overdue: 0 },
  credits: { approvedTotal: 0 },
  todaysClasses: [],
  openTickets: []
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  template: `
    <div class="admin-dashboard-page w-100 overflow-hidden">

      <!-- Header -->
      <section class="dashboard-hero position-relative overflow-hidden rounded-4 p-4 p-lg-5 mb-4 text-white">
        <div class="row g-4 align-items-end position-relative z-1">
          <div class="col-12 col-xl-8">
            <p class="text-uppercase fw-bold small mb-2 text-white-50">Admin Dashboard</p>

            <h1 class="display-6 fw-bold lh-1 mb-3 hero-title">
              Manage your learning platform from one place
            </h1>

            <p class="mb-0 text-white-75 hero-subtitle">
              Track classes, users, support tickets, homework, credits, and daily operations.
            </p>
          </div>

          <div class="col-12 col-xl-4">
            <div class="d-flex align-items-center gap-3 rounded-4 border border-white border-opacity-25 bg-white bg-opacity-10 p-3 hero-status-card">
              <span class="icon-box icon-glass flex-shrink-0">
                <i class="bi bi-speedometer2"></i>
              </span>

              <div class="min-w-0">
                <small class="d-block text-uppercase fw-bold text-white-50">Platform Status</small>
                <strong class="d-block text-truncate">Operational Overview</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-xl-3">
          <a class="card h-100 text-decoration-none text-dark border quick-card" routerLink="/admin/users">
            <div class="card-body">
              <span class="icon-box bg-primary-subtle text-primary mb-3">
                <i class="bi bi-person-plus"></i>
              </span>
              <h2 class="h6 fw-bold mb-2">Create Student</h2>
              <p class="small text-muted mb-0">Add a new learner profile</p>
            </div>
          </a>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <a class="card h-100 text-decoration-none text-dark border quick-card" routerLink="/admin/users">
            <div class="card-body">
              <span class="icon-box bg-purple-subtle text-purple mb-3">
                <i class="bi bi-mortarboard"></i>
              </span>
              <h2 class="h6 fw-bold mb-2">Create Teacher</h2>
              <p class="small text-muted mb-0">Add teaching staff access</p>
            </div>
          </a>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <a class="card h-100 text-decoration-none text-dark border quick-card" routerLink="/admin/classes">
            <div class="card-body">
              <span class="icon-box bg-success-subtle text-success mb-3">
                <i class="bi bi-calendar-plus"></i>
              </span>
              <h2 class="h6 fw-bold mb-2">Schedule Class</h2>
              <p class="small text-muted mb-0">Create a new live session</p>
            </div>
          </a>
        </div>

        <div class="col-12 col-sm-6 col-xl-3">
          <a class="card h-100 text-decoration-none text-dark border quick-card" routerLink="/admin/users">
            <div class="card-body">
              <span class="icon-box bg-warning-subtle text-warning-emphasis mb-3">
                <i class="bi bi-headset"></i>
              </span>
              <h2 class="h6 fw-bold mb-2">Create Support</h2>
              <p class="small text-muted mb-0">Add support team member</p>
            </div>
          </a>
        </div>
      </section>

      <!-- Metrics -->
      <section class="row g-3 mb-4">
        <div class="col-12 col-sm-6 col-lg-4 col-xxl-2">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-primary-subtle text-primary mb-3">
                <i class="bi bi-backpack"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Students</p>
              <h3 class="fw-bold mb-1">{{ stats().users.students | number }}</h3>
              <p class="small text-primary fw-semibold mb-0">Active directory</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-lg-4 col-xxl-2">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-purple-subtle text-purple mb-3">
                <i class="bi bi-mortarboard"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Teachers</p>
              <h3 class="fw-bold mb-1">{{ stats().users.teachers | number }}</h3>
              <p class="small text-primary fw-semibold mb-0">Teaching staff</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-lg-4 col-xxl-2">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-success-subtle text-success mb-3">
                <i class="bi bi-camera-video"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Classes Today</p>
              <h3 class="fw-bold mb-1">{{ stats().classes.today | number }}</h3>
              <p class="small text-primary fw-semibold mb-0">Live: {{ stats().classes.live }}</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-lg-4 col-xxl-2">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-danger-subtle text-danger mb-3">
                <i class="bi bi-ticket-detailed"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Open Tickets</p>
              <h3 class="fw-bold mb-1">{{ stats().tickets.open | number }}</h3>
              <p class="small text-danger fw-semibold mb-0">{{ stats().tickets.urgent }} urgent</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-lg-4 col-xxl-2">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-warning-subtle text-warning-emphasis mb-3">
                <i class="bi bi-journal-check"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Pending HW</p>
              <h3 class="fw-bold mb-1">{{ stats().homework.pending | number }}</h3>
              <p class="small text-primary fw-semibold mb-0">{{ stats().homework.overdue }} overdue</p>
            </div>
          </article>
        </div>

        <div class="col-12 col-sm-6 col-lg-4 col-xxl-2">
          <article class="card h-100 border metric-card-modern">
            <div class="card-body">
              <span class="icon-box bg-primary-subtle text-primary mb-3">
                <i class="bi bi-credit-card"></i>
              </span>
              <p class="small fw-bold text-muted mb-2">Credits</p>
              <h3 class="fw-bold mb-1">{{ stats().credits.approvedTotal | number: '1.0-0' }}</h3>
              <p class="small text-primary fw-semibold mb-0">Approved total</p>
            </div>
          </article>
        </div>
      </section>

      @if (apiWarning()) {
        <div class="alert alert-warning d-flex align-items-start gap-2 mb-4" role="alert">
          <i class="bi bi-exclamation-triangle-fill flex-shrink-0"></i>
          <span>{{ apiWarning() }}</span>
        </div>
      }

      <!-- Main Dashboard Grid -->
      <section class="row g-4">

        <!-- Left Column -->
        <div class="col-12 col-xl-8 d-grid gap-4">

          <!-- Today's Classes -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex flex-column flex-sm-row gap-3 justify-content-between">
                <div>
                  <h2 class="h5 fw-bold mb-1">Today's Classes</h2>
                  <p class="small text-muted mb-0">Live and scheduled sessions for today</p>
                </div>

                <a class="fw-bold text-primary text-decoration-none small d-inline-flex align-items-center gap-2" routerLink="/admin/classes">
                  View All
                  <i class="bi bi-arrow-right"></i>
                </a>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">
                @for (item of stats().todaysClasses; track item.id) {
                  <div class="card border class-row-card" [class.border-primary]="item.status === 'live'">
                    <div class="card-body p-3">
                      <div class="row g-3 align-items-center">
                        <div class="col-12 col-md-2">
                          <div class="d-flex align-items-center gap-2 text-primary fw-bold">
                            <i class="bi bi-clock"></i>
                            <span>{{ item.startTime | date: 'hh:mm a' }}</span>
                          </div>
                        </div>

                        <div class="col-12 col-md">
                          <h3 class="h6 fw-bold mb-2 text-truncate">{{ item.title }}</h3>

                          <div class="d-flex flex-wrap gap-3 small text-muted">
                            <span class="d-inline-flex align-items-center gap-1">
                              <i class="bi bi-person-video3"></i>
                              {{ item.teacherName }}
                            </span>

                            <span class="d-inline-flex align-items-center gap-1">
                              <i class="bi bi-person"></i>
                              {{ item.studentName ?? 'Unassigned' }}
                            </span>
                          </div>
                        </div>

                        <div class="col-12 col-md-auto">
                          <span class="badge rounded-pill text-uppercase"
                            [class.text-bg-success]="item.status === 'live'"
                            [class.text-bg-secondary]="item.status !== 'live'">
                            {{ item.status }}
                          </span>
                        </div>

                        <div class="col-12 col-md-auto">
                          <a class="btn btn-primary btn-sm w-100 fw-bold" routerLink="/admin/classes">
                            View
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                } @empty {
                  <div class="empty-state">
                    <i class="bi bi-calendar2-check"></i>
                    <strong>No classes scheduled today</strong>
                    <span>Scheduled classes will appear here.</span>
                  </div>
                }
              </div>
            </div>
          </article>

          <!-- Platform Snapshot -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex flex-column flex-sm-row gap-3 justify-content-between">
                <div>
                  <h2 class="h5 fw-bold mb-1">Platform Snapshot</h2>
                  <p class="small text-muted mb-0">Key user and class totals</p>
                </div>

                <a class="fw-bold text-primary text-decoration-none small d-inline-flex align-items-center gap-2" routerLink="/admin/users">
                  User Management
                  <i class="bi bi-arrow-right"></i>
                </a>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="row g-3">
                <div class="col-12 col-md-6">
                  <div class="snapshot-card d-flex align-items-center gap-3 border rounded-4 p-3 h-100">
                    <span class="icon-box icon-box-lg bg-primary-subtle text-primary flex-shrink-0">
                      <i class="bi bi-people"></i>
                    </span>

                    <div class="min-w-0">
                      <small class="text-uppercase fw-bold text-muted">Total Users</small>
                      <h3 class="fw-bold mb-1">{{ stats().users.total | number }}</h3>
                      <p class="small text-muted mb-0">All accounts</p>
                    </div>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="snapshot-card d-flex align-items-center gap-3 border rounded-4 p-3 h-100">
                    <span class="icon-box icon-box-lg bg-success-subtle text-success flex-shrink-0">
                      <i class="bi bi-person-check"></i>
                    </span>

                    <div class="min-w-0">
                      <small class="text-uppercase fw-bold text-muted">Active Users</small>
                      <h3 class="fw-bold mb-1">{{ stats().users.active | number }}</h3>
                      <p class="small text-muted mb-0">Can sign in</p>
                    </div>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="snapshot-card d-flex align-items-center gap-3 border rounded-4 p-3 h-100">
                    <span class="icon-box icon-box-lg bg-secondary-subtle text-secondary flex-shrink-0">
                      <i class="bi bi-person-x"></i>
                    </span>

                    <div class="min-w-0">
                      <small class="text-uppercase fw-bold text-muted">Inactive Users</small>
                      <h3 class="fw-bold mb-1">{{ stats().users.inactive | number }}</h3>
                      <p class="small text-muted mb-0">Disabled or suspended</p>
                    </div>
                  </div>
                </div>

                <div class="col-12 col-md-6">
                  <div class="snapshot-card d-flex align-items-center gap-3 border rounded-4 p-3 h-100">
                    <span class="icon-box icon-box-lg bg-purple-subtle text-purple flex-shrink-0">
                      <i class="bi bi-calendar-event"></i>
                    </span>

                    <div class="min-w-0">
                      <small class="text-uppercase fw-bold text-muted">Upcoming Classes</small>
                      <h3 class="fw-bold mb-1">{{ stats().classes.upcoming | number }}</h3>
                      <p class="small text-muted mb-0">Future sessions</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>

        </div>

        <!-- Right Column -->
        <div class="col-12 col-xl-4 d-grid gap-4 align-content-start">

          <!-- Open Tickets -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <div class="d-flex justify-content-between align-items-start gap-3">
                <div>
                  <h2 class="h5 fw-bold mb-1">Open Tickets</h2>
                  <p class="small text-muted mb-0">Support items needing attention</p>
                </div>

                <span class="badge rounded-pill text-bg-danger">
                  {{ stats().tickets.urgent }}
                </span>
              </div>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">
                @for (ticket of stats().openTickets; track ticket.id) {
                  <div class="d-flex align-items-start gap-3 border rounded-4 p-3">
                    <span class="icon-box bg-danger-subtle text-danger flex-shrink-0">
                      <i class="bi bi-ticket-detailed"></i>
                    </span>

                    <div class="min-w-0">
                      <strong class="d-block text-truncate">{{ ticket.subject }}</strong>
                      <span class="small text-muted">{{ ticket.priority }} · {{ ticket.status }}</span>
                    </div>
                  </div>
                } @empty {
                  <div class="empty-state compact">
                    <i class="bi bi-check-circle"></i>
                    <strong>No open tickets</strong>
                    <span>Support queue is clear.</span>
                  </div>
                }
              </div>
            </div>
          </article>

          <!-- Work Queue -->
          <article class="card border rounded-4 overflow-hidden">
            <div class="card-header bg-white p-3 p-md-4">
              <h2 class="h5 fw-bold mb-1">Work Queue</h2>
              <p class="small text-muted mb-0">Operational items to monitor</p>
            </div>

            <div class="card-body p-3 p-md-4">
              <div class="d-grid gap-3">

                <div class="queue-card d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box icon-box-lg bg-warning-subtle text-warning-emphasis flex-shrink-0">
                    <i class="bi bi-journal-text"></i>
                  </span>

                  <div class="min-w-0">
                    <h3 class="fw-bold mb-1">{{ stats().homework.pending }}</h3>
                    <p class="small text-muted mb-0">Homework items pending</p>
                  </div>
                </div>

                <div class="queue-card d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box icon-box-lg bg-danger-subtle text-danger flex-shrink-0">
                    <i class="bi bi-exclamation-circle"></i>
                  </span>

                  <div class="min-w-0">
                    <h3 class="fw-bold mb-1">{{ stats().homework.overdue }}</h3>
                    <p class="small text-muted mb-0">Homework items overdue</p>
                  </div>
                </div>

                <div class="queue-card d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box icon-box-lg bg-success-subtle text-success flex-shrink-0">
                    <i class="bi bi-check2-circle"></i>
                  </span>

                  <div class="min-w-0">
                    <h3 class="fw-bold mb-1">{{ stats().classes.completedThisMonth }}</h3>
                    <p class="small text-muted mb-0">Classes completed this month</p>
                  </div>
                </div>

                <div class="queue-card d-flex align-items-center gap-3 border rounded-4 p-3">
                  <span class="icon-box icon-box-lg bg-primary-subtle text-primary flex-shrink-0">
                    <i class="bi bi-headset"></i>
                  </span>

                  <div class="min-w-0">
                    <h3 class="fw-bold mb-1">{{ stats().tickets.open }}</h3>
                    <p class="small text-muted mb-0">Support tickets need attention</p>
                  </div>
                </div>

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

    .admin-dashboard-page {
      width: 100%;
      max-width: 1480px;
      overflow-x: hidden;
    }

    .admin-dashboard-page *,
    .admin-dashboard-page *::before,
    .admin-dashboard-page *::after {
      box-sizing: border-box;
    }

    .min-w-0 {
      min-width: 0;
    }

    .text-white-75 {
      color: rgba(255, 255, 255, 0.76);
    }

    .dashboard-hero {
      background:
        radial-gradient(circle at 85% 20%, rgba(124, 58, 237, 0.18), transparent 30%),
        linear-gradient(135deg, #004ac6 0%, #2563eb 48%, #7c3aed 100%);
      box-shadow: 0 24px 70px rgba(30, 64, 175, 0.16);
    }

    .dashboard-hero::after {
      content: "";
      position: absolute;
      inset: 0;
      background-image: radial-gradient(rgba(255, 255, 255, 0.18) 1px, transparent 1px);
      background-size: 30px 30px;
      opacity: 0.35;
    }

    .z-1 {
      z-index: 1;
    }

    .hero-title,
    .hero-subtitle {
      max-width: 100%;
      overflow-wrap: anywhere;
    }

    .hero-status-card {
      backdrop-filter: blur(14px);
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

    .quick-card,
    .metric-card-modern,
    .snapshot-card,
    .queue-card,
    .class-row-card {
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .quick-card:hover,
    .metric-card-modern:hover,
    .snapshot-card:hover,
    .queue-card:hover,
    .class-row-card:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28) !important;
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .metric-card-modern {
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
    }

    .snapshot-card,
    .queue-card {
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
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

    .empty-state.compact {
      min-height: 150px;
    }

    .empty-state i {
      color: var(--color-primary);
      font-size: 34px;
    }

    .empty-state strong {
      color: var(--color-text);
    }

    @media (max-width: 575.98px) {
      .admin-dashboard-page {
        max-width: 100%;
      }

      .dashboard-hero {
        border-radius: 18px !important;
        padding: 18px !important;
      }

      .hero-title {
        font-size: 1.7rem;
        line-height: 1.12;
        letter-spacing: -0.03em;
      }

      .hero-subtitle {
        font-size: 0.9rem;
        line-height: 1.55;
      }

      .icon-box-lg {
        width: 48px;
        height: 48px;
        min-width: 48px;
        border-radius: 14px;
        font-size: 21px;
      }

      .card-body,
      .card-header {
        padding: 1rem !important;
      }

      .quick-card,
      .metric-card-modern {
        min-height: auto;
      }
    }

    @media (max-width: 360px) {
      .dashboard-hero {
        padding: 16px !important;
      }

      .hero-title {
        font-size: 1.5rem;
      }

      .hero-status-card {
        display: grid !important;
        grid-template-columns: 44px minmax(0, 1fr);
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
export class AdminDashboardComponent implements OnInit {
  protected readonly stats = signal<AdminDashboardStats>(emptyStats);
  protected readonly apiWarning = signal('');

  constructor(private readonly dashboardApi: AdminDashboardApiService) {}

  ngOnInit(): void {
    this.dashboardApi.getStats().subscribe({
      next: (response) => this.stats.set(response.data),
      error: () => this.apiWarning.set('Could not load dashboard stats from backend.')
    });
  }
}