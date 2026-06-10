import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClassListItem, ClassesApiService, SchedulingConflict } from '../../core/classes/classes-api.service';
import { PeopleApiService, PersonOption } from '../../core/people/people-api.service';
import { TeacherAvailabilityApiService, TeacherAvailabilityItem } from '../../core/teachers/teacher-availability-api.service';

type ClassTabKey =
  | 'all'
  | 'today'
  | 'upcoming'
  | 'live'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'failed'
  | 'cancellation_requests';

@Component({
  selector: 'app-admin-classes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  template: `
  <div class="admin-classes-page">

    <!-- Header -->
    <div class="page-heading row align-items-start mb-4">
      <div>
        <span class="section-kicker">ADMIN PANEL</span>
        <h1>Classes</h1>
        <p>Schedule, manage, and track live one-to-one learning sessions.</p>
      </div>

      <div class="heading-actions mt-3 mt-lg-0">
        <button class="btn btn-outline-secondary admin-btn" type="button">
          <i class="bi bi-download"></i>
          <span>Export</span>
        </button>

        <button class="btn btn-outline-secondary admin-btn" type="button">
          <i class="bi bi-calendar3"></i>
          <span>Calendar View</span>
        </button>

        <button class="btn btn-primary admin-btn" type="button" (click)="openSchedule()">
          <i class="bi bi-calendar-plus"></i>
          <span>Schedule Class</span>
        </button>
      </div>
    </div>

    <!-- Metrics -->
    <section class="class-metrics-grid mb-4">
      <article class="class-metric-card">
        <span class="metric-icon blue"><i class="bi bi-calendar-day"></i></span>
        <span>Classes Today</span>
        <strong>{{ todayCount() }}</strong>
        <small>Scheduled today</small>
      </article>

      <article class="class-metric-card">
        <span class="metric-icon purple"><i class="bi bi-calendar-event"></i></span>
        <span>Upcoming</span>
        <strong>{{ upcomingCount() }}</strong>
        <small>Next sessions</small>
      </article>

      <article class="class-metric-card active">
        <span class="metric-icon green"><i class="bi bi-broadcast"></i></span>
        <span>Live Now</span>
        <strong>{{ liveCount() }}</strong>
        <small>Active sessions</small>
      </article>

      <article class="class-metric-card">
        <span class="metric-icon green"><i class="bi bi-check2-circle"></i></span>
        <span>Completed</span>
        <strong>{{ completedCount() }}</strong>
        <small>Completed records</small>
      </article>

      <article class="class-metric-card">
        <span class="metric-icon orange"><i class="bi bi-calendar-x"></i></span>
        <span>Cancelled</span>
        <strong>{{ cancelledCount() }}</strong>
        <small>Cancelled records</small>
      </article>

      <article class="class-metric-card">
        <span class="metric-icon red"><i class="bi bi-exclamation-triangle"></i></span>
        <span>No Shows</span>
        <strong class="danger-text">{{ noShowCount() }}</strong>
        <small class="danger-text">Needs attention</small>
      </article>
    </section>

    <!-- Classes Panel -->
    <section class="panel classes-panel">

      <!-- Tabs -->
      <div class="class-tabs scroll-row">
        @for (tab of classTabs; track tab.key) {
          <button
            type="button"
            [class.is-active]="activeTab() === tab.key"
            (click)="setActiveTab(tab.key)"
          >
            <span>{{ tab.label }}</span>

            @if (tabCount(tab.key) > 0) {
              <span class="tab-count">{{ tabCount(tab.key) }}</span>
            }
          </button>
        }
      </div>

      <!-- Filters -->
      <div class="class-filters">
        <div class="input-group">
          <span class="input-group-text">
            <i class="bi bi-search"></i>
          </span>
          <input
            class="form-control"
            placeholder="Filter by title, teacher, student..."
            [ngModel]="searchText()"
            (ngModelChange)="searchText.set($event)"
          />
        </div>

        <select class="form-select">
          <option>Teacher: All</option>
        </select>

        <select class="form-select">
          <option>Student: All</option>
        </select>

        <select
          class="form-select"
          [ngModel]="activeTab()"
          (ngModelChange)="setActiveTab($event)"
        >
          @for (tab of classTabs; track tab.key) {
            <option [ngValue]="tab.key">{{ tab.label }}</option>
          }
        </select>
      </div>

      @if (loading()) {
        <div class="state-strip">
          <i class="bi bi-arrow-repeat me-2"></i>
          Loading classes from backend...
        </div>
      } @else if (apiWarning()) {
        <div class="state-strip warning">
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ apiWarning() }}
        </div>
      }

      <!-- Desktop Table -->
      <div class="table-responsive d-none d-lg-block">
        <table class="table align-middle mb-0 class-table">
          <thead>
            <tr>
              <th>Class Title</th>
              <th>Teacher</th>
              <th>Student</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Zoom</th>
              <th>Attendance</th>
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
                      <span class="d-block text-muted small">Session #{{ shortId(item.id) }}</span>
                    </div>
                  </div>
                </td>

                <td>
                  <span class="person-cell">
                    <i class="bi bi-person-video3"></i>
                    {{ item.teacherName }}
                  </span>
                </td>

                <td>
                  <span class="person-cell">
                    <i class="bi bi-person"></i>
                    {{ participantName(item) }}
                  </span>
                </td>

                <td>
                  <div class="date-cell">
                    <strong>{{ item.startTime | date: 'MMM d' }}</strong>
                    <span>{{ item.startTime | date: 'hh:mm a' }} · {{ item.durationMinutes }} min</span>
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
                  <span class="zoom-chip">
                    <i class="bi bi-camera-video"></i>
                    {{ item.zoomMeeting?.creationStatus ?? 'pending' }}
                  </span>
                </td>

                <td>
                  <strong
                    class="attendance-text"
                    [class.success-text]="participantAttendance(item) === 'present'"
                  >
                    {{ participantAttendance(item) }}
                  </strong>
                </td>

                <td class="text-end">
                  <div class="action-group">
                    <button
                      class="btn btn-light action-btn"
                      type="button"
                      title="View class"
                      aria-label="View class"
                      (click)="openClassDrawer(item)"
                    >
                      <i class="bi bi-eye"></i>
                    </button>

                    <button
                      class="btn btn-light action-btn text-danger"
                      type="button"
                      title="Cancel class"
                      aria-label="Cancel class"
                      [disabled]="item.status === 'cancelled'"
                      (click)="openCancelConfirm(item)"
                    >
                      <i class="bi bi-calendar-x"></i>
                    </button>
                  </div>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8">
                  <div class="empty-state">
                    <i class="bi bi-calendar2-x"></i>
                    <strong>No classes found</strong>
                    <span>Try changing your tab or search filter.</span>
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Mobile Cards -->
      <div class="mobile-class-list d-lg-none">
        @for (item of pagedClasses(); track item.id) {
          <article class="mobile-class-card">
            <div class="d-flex align-items-start gap-3">
              <span class="class-avatar">
                <i class="bi bi-camera-video"></i>
              </span>

              <div class="min-w-0 flex-grow-1">
                <strong class="d-block text-truncate">{{ item.title }}</strong>
                <span class="d-block text-muted small">Session #{{ shortId(item.id) }}</span>

                <div class="mobile-class-meta mt-3">
                  <span>
                    <i class="bi bi-person-video3"></i>
                    {{ item.teacherName }}
                  </span>

                  <span>
                    <i class="bi bi-person"></i>
                    {{ participantName(item) }}
                  </span>

                  <span>
                    <i class="bi bi-clock"></i>
                    {{ item.startTime | date: 'MMM d, hh:mm a' }}
                  </span>

                  <span>
                    <i class="bi bi-hourglass-split"></i>
                    {{ item.durationMinutes }} min
                  </span>
                </div>

                <div class="d-flex flex-wrap gap-2 mt-3">
                  <span
                    class="status-chip"
                    [class.status-live]="item.status === 'live'"
                    [class.status-success]="item.status === 'completed'"
                    [class.status-danger]="item.status === 'cancelled'"
                  >
                    {{ item.status }}
                  </span>

                  <span class="zoom-chip">
                    <i class="bi bi-camera-video"></i>
                    {{ item.zoomMeeting?.creationStatus ?? 'pending' }}
                  </span>

                  <span class="zoom-chip">
                    <i class="bi bi-person-check"></i>
                    {{ participantAttendance(item) }}
                  </span>
                </div>
              </div>
            </div>

            <div class="mobile-actions mt-3">
              <button class="btn btn-outline-primary btn-sm" type="button" (click)="openClassDrawer(item)">
                <i class="bi bi-eye"></i>
                View
              </button>

              <button
                class="btn btn-outline-danger btn-sm"
                type="button"
                [disabled]="item.status === 'cancelled'"
                (click)="openCancelConfirm(item)"
              >
                <i class="bi bi-calendar-x"></i>
                Cancel
              </button>
            </div>
          </article>
        } @empty {
          <div class="empty-state mobile-empty">
            <i class="bi bi-calendar2-x"></i>
            <strong>No classes found</strong>
            <span>Try changing your tab or search filter.</span>
          </div>
        }
      </div>

      <!-- Footer -->
      <div class="class-table-footer">
        <span class="text-muted small">Showing {{ filteredClasses().length }} classes</span>

        <nav aria-label="Classes pagination">
          <ul class="pagination pagination-sm mb-0 flex-wrap">
            <li class="page-item" [class.disabled]="currentPage() === 1">
              <button class="page-link" type="button" (click)="previousPage()">Prev</button>
            </li>

            @for (page of pageNumbers(); track page) {
              <li class="page-item" [class.active]="currentPage() === page">
                <button class="page-link" type="button" (click)="setPage(page)">{{ page }}</button>
              </li>
            }

            <li class="page-item" [class.disabled]="currentPage() === totalPages()">
              <button class="page-link" type="button" (click)="nextPage()">Next</button>
            </li>
          </ul>
        </nav>
      </div>
    </section>
  </div>

  <!-- Schedule Modal -->
  @if (scheduleOpen()) {
    <section class="schedule-modal-overlay" role="dialog" aria-modal="true">
      <div class="class-schedule-modal">

        <header class="schedule-header">
          <div class="d-flex align-items-start gap-3 min-w-0">
            <span class="modal-icon">
              <i class="bi bi-calendar-plus"></i>
            </span>

            <div>
              <p class="section-kicker mb-1">Class scheduling</p>
              <h2>Schedule New Class</h2>
            </div>
          </div>

          <button class="btn-close" type="button" aria-label="Close" (click)="closeSchedule()"></button>
        </header>

        <div class="wizard-steps schedule-two-steps">
          @for (step of steps; track step.index) {
            <div [class.is-active]="step.index === scheduleStep()">
              <span>{{ step.index }}</span>
              <strong>{{ step.label }}</strong>
            </div>
          }
        </div>

        @if (scheduleStep() === 1) {
          <form class="schedule-form-grid" id="participantsForm" (ngSubmit)="nextFromParticipants()">
            <label>
              <span class="field-label">
                <i class="bi bi-person-video3"></i>
                Teacher <b>*</b>
              </span>

              <select name="teacherId" [(ngModel)]="scheduleForm.teacherId" required (ngModelChange)="onTeacherChanged()">
                <option value="">Select teacher</option>

                @for (teacher of teachers(); track teacher.id) {
                  <option [value]="teacher.id">{{ fullName(teacher) }}</option>
                }
              </select>
            </label>

            <label>
              <span class="field-label">
                <i class="bi bi-person"></i>
                Student <b>*</b>
              </span>

              <select name="studentId" [(ngModel)]="scheduleForm.studentId" required (ngModelChange)="refreshBusySlots()">
                <option value="">Select student</option>

                @for (student of students(); track student.id) {
                  <option [value]="student.id">{{ fullName(student) }}</option>
                }
              </select>
            </label>

            <label class="full-field">
              <span class="field-label">
                <i class="bi bi-type"></i>
                Class Title <b>*</b>
              </span>

              <input
                name="title"
                [(ngModel)]="scheduleForm.title"
                required
                placeholder="Example: Advanced Algebra - Doubt Session"
              />
            </label>

            <label class="full-field">
              <span class="field-label">
                <i class="bi bi-card-text"></i>
                Meeting Description
              </span>

              <textarea
                name="description"
                [(ngModel)]="scheduleForm.description"
                rows="4"
                placeholder="Add agenda, preparation notes, learning goals, or anything the student should know."
              ></textarea>
            </label>

            @if (scheduleMessage()) {
              <article class="info-card full" [class.conflict-card]="scheduleMessageType() === 'error'">
                <i class="bi bi-info-circle me-2"></i>
                {{ scheduleMessage() }}
              </article>
            }
          </form>
        } @else {
          <form class="schedule-form-grid" id="dateTimeForm" (ngSubmit)="validateAndSchedule()">
            <label>
              <span class="field-label">
                <i class="bi bi-calendar-event"></i>
                Start Date & Time <b>*</b>
              </span>

              <input
                name="startTime"
                type="datetime-local"
                [(ngModel)]="scheduleForm.startTime"
                required
                (ngModelChange)="refreshBusySlots()"
              />
            </label>

            <label>
              <span class="field-label">
                <i class="bi bi-hourglass-split"></i>
                Duration <b>*</b>
              </span>

              <select name="durationMinutes" [(ngModel)]="scheduleForm.durationMinutes" (ngModelChange)="clearConflicts()">
                <option [ngValue]="30">30 min</option>
                <option [ngValue]="45">45 min</option>
                <option [ngValue]="60">60 min</option>
                <option [ngValue]="90">90 min</option>
              </select>
            </label>

            <article class="schedule-side-card">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
                <strong>
                  <i class="bi bi-calendar-check me-2"></i>
                  Teacher working hours
                </strong>
                <span class="status-chip">{{ selectedTeacherAvailability().length }}</span>
              </div>

              <div class="slot-list">
                @for (slot of selectedTeacherAvailability(); track slot.id) {
                  <span [class.is-match]="slot.dayOfWeek === selectedDayOfWeek()">
                    {{ dayLabel(slot.dayOfWeek) }} {{ slot.startTime }} - {{ slot.endTime }}
                  </span>
                } @empty {
                  <span class="text-muted">No active availability found for this teacher.</span>
                }
              </div>
            </article>

            <article class="schedule-side-card">
              <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
                <strong>
                  <i class="bi bi-calendar-x me-2"></i>
                  Busy on selected day
                </strong>
                <span class="status-chip">{{ busySlots().length }}</span>
              </div>

              <div class="slot-list">
                @for (slot of busySlots(); track slot.id) {
                  <span>{{ slot.startTime | date: 'hh:mm a' }} - {{ slot.endTime | date: 'hh:mm a' }} · {{ slot.title }}</span>
                } @empty {
                  <span class="success-text">No teacher/student overlap found for this day.</span>
                }
              </div>
            </article>

            @if (conflicts().length) {
              <article class="info-card full conflict-card">
                <strong>
                  <i class="bi bi-exclamation-triangle me-2"></i>
                  Schedule conflicts
                </strong>

                <ul class="mb-0 mt-2">
                  @for (conflict of conflicts(); track conflict.message) {
                    <li>{{ conflict.message }}{{ conflictDetail(conflict) }}</li>
                  }
                </ul>
              </article>
            } @else if (scheduleMessage()) {
              <article
                class="info-card full"
                [class.conflict-card]="scheduleMessageType() === 'error'"
                [class.success-card]="scheduleMessageType() === 'success'"
              >
                <strong>
                  <i class="bi bi-check-circle me-2"></i>
                  {{ scheduleMessage() }}
                </strong>

                @if (scheduledClass()?.zoomMeeting?.joinUrl) {
                  <div class="zoom-link-box mt-3">
                    <span>Student / Teacher Join Link</span>
                    <a [href]="scheduledClass()!.zoomMeeting!.joinUrl!" target="_blank" rel="noopener noreferrer">
                      {{ scheduledClass()!.zoomMeeting!.joinUrl }}
                    </a>
                  </div>
                } @else if (scheduledClass()) {
                  <p class="mb-0 mt-2">Zoom link is not available yet. Check Zoom configuration or refresh the class details.</p>
                }
              </article>
            }
          </form>
        }

        <footer class="schedule-footer">
          <button class="btn btn-outline-secondary" type="button" (click)="scheduleStep() === 1 ? closeSchedule() : previousStep()">
            {{ scheduleStep() === 1 ? 'Cancel' : 'Previous' }}
          </button>

          <button
            class="btn btn-primary"
            type="submit"
            [attr.form]="scheduleStep() === 1 ? 'participantsForm' : 'dateTimeForm'"
            [disabled]="scheduleSubmitting()"
          >
            @if (scheduleSubmitting()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            {{ scheduleStep() === 1 ? 'Next' : scheduledClass() ? 'Done' : scheduleSubmitting() ? 'Scheduling...' : 'Validate & Schedule' }}
          </button>
        </footer>
      </div>
    </section>
  }

  <!-- Class Drawer -->
  @if (classDrawerOpen() && selectedClass()) {
    <section class="drawer-backdrop" (click)="closeClassDrawer()"></section>

    <aside class="meeting-drawer admin-class-drawer">
      <header class="drawer-header">
        <div class="d-flex align-items-start gap-3 min-w-0">
          <span class="modal-icon">
            <i class="bi bi-camera-video"></i>
          </span>

          <div class="min-w-0">
            <p class="section-kicker mb-1">Meeting details</p>
            <h2>{{ selectedClass()!.title }}</h2>
          </div>
        </div>

        <button class="btn-close" type="button" aria-label="Close" (click)="closeClassDrawer()"></button>
      </header>

      <div class="detail-list">
        <div>
          <span><i class="bi bi-person-video3 me-1"></i> Teacher</span>
          <strong>{{ selectedClass()!.teacherName }}</strong>
        </div>

        <div>
          <span><i class="bi bi-person me-1"></i> Student</span>
          <strong>{{ participantName(selectedClass()!) }}</strong>
        </div>

        <div>
          <span><i class="bi bi-calendar-event me-1"></i> Schedule</span>
          <strong>{{ selectedClass()!.startTime | date: 'MMM d, y, hh:mm a' }}</strong>
        </div>

        <div>
          <span><i class="bi bi-hourglass-split me-1"></i> Duration</span>
          <strong>{{ selectedClass()!.durationMinutes }} minutes</strong>
        </div>

        <div>
          <span><i class="bi bi-activity me-1"></i> Status</span>
          <strong>{{ selectedClass()!.status }}</strong>
        </div>

        <div>
          <span><i class="bi bi-camera-video me-1"></i> Zoom</span>
          <strong>{{ selectedClass()!.zoomMeeting?.creationStatus ?? 'pending' }}</strong>
        </div>
      </div>

      <div class="zoom-link-box mt-3">
        <span>Join Link</span>

        @if (selectedClass()!.zoomMeeting?.joinUrl) {
          <a [href]="selectedClass()!.zoomMeeting!.joinUrl!" target="_blank" rel="noopener noreferrer">
            {{ selectedClass()!.zoomMeeting!.joinUrl }}
          </a>
        } @else {
          <p class="mb-0">No Zoom join link available.</p>
        }
      </div>

      <div class="d-grid gap-2 mt-4">
        @if (selectedClass()!.zoomMeeting?.joinUrl) {
          <a class="btn btn-primary" [href]="selectedClass()!.zoomMeeting!.joinUrl!" target="_blank" rel="noopener noreferrer">
            <i class="bi bi-box-arrow-up-right me-2"></i>
            Open Zoom Link
          </a>
        }

        <button
          class="btn btn-outline-danger"
          type="button"
          [disabled]="selectedClass()!.status === 'cancelled'"
          (click)="openCancelConfirm(selectedClass()!)"
        >
          <i class="bi bi-calendar-x me-2"></i>
          Cancel Class
        </button>
      </div>
    </aside>
  }

  <!-- Cancel Confirm -->
  @if (cancelConfirmOpen() && classToCancel()) {
    <section class="schedule-modal-overlay" role="dialog" aria-modal="true">
      <div class="confirm-card">
        <header>
          <div class="d-flex align-items-start gap-3">
            <span class="confirm-icon">
              <i class="bi bi-calendar-x"></i>
            </span>

            <div>
              <p class="section-kicker mb-1">Confirm cancellation</p>
              <h2>Cancel this class?</h2>
            </div>
          </div>

          <button class="btn-close" type="button" aria-label="Close" (click)="closeCancelConfirm()"></button>
        </header>

        <p class="mb-3">
          This will cancel <strong>{{ classToCancel()!.title }}</strong>. If a real Zoom meeting exists, it will be cancelled in Zoom as well.
        </p>

        <label class="w-100">
          <span class="field-label">
            <i class="bi bi-chat-left-text"></i>
            Cancellation Reason <b>*</b>
          </span>

          <textarea
            class="form-control mt-2"
            rows="3"
            [(ngModel)]="cancelReason"
            name="cancelReason"
            placeholder="Add a clear reason for audit and notification"
          ></textarea>
        </label>

        @if (cancelMessage()) {
          <div class="alert alert-danger mt-3 mb-0">
            <i class="bi bi-exclamation-triangle me-2"></i>
            {{ cancelMessage() }}
          </div>
        }

        <footer>
          <button class="btn btn-outline-secondary" type="button" (click)="closeCancelConfirm()">Keep Class</button>

          <button class="btn btn-danger fw-bold" type="button" [disabled]="cancelSubmitting()" (click)="confirmCancelClass()">
            @if (cancelSubmitting()) {
              <span class="spinner-border spinner-border-sm me-2"></span>
            }
            {{ cancelSubmitting() ? 'Cancelling...' : 'Cancel Class' }}
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

    .admin-classes-page {
      width: 100%;
      max-width: 1480px;
      overflow-x: hidden;
    }

    .admin-classes-page *,
    .admin-classes-page *::before,
    .admin-classes-page *::after {
      box-sizing: border-box;
    }

    .admin-btn {
      min-height: 42px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border-radius: var(--radius-md);
      font-weight: 700;
    }

    .class-metrics-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 16px;
    }

    .class-metric-card {
      min-height: 148px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      border: 1px solid var(--color-border);
      border-radius: 20px;
      background: linear-gradient(180deg, #ffffff 0%, #fbfcff 100%);
      padding: 18px;
      transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
    }

    .class-metric-card:hover {
      transform: translateY(-2px);
      border-color: rgba(37, 99, 235, 0.28);
      box-shadow: 0 18px 44px rgba(30, 64, 175, 0.1);
    }

    .class-metric-card.active {
      border-color: rgba(21, 128, 61, 0.28);
      background: linear-gradient(180deg, #ffffff 0%, #f0fdf4 100%);
    }

    .metric-icon {
      width: 44px;
      height: 44px;
      display: grid;
      place-items: center;
      border-radius: 14px;
      font-size: 20px;
    }

    .class-metric-card > span:not(.metric-icon) {
      margin-top: 14px;
      color: var(--color-muted);
      font-size: 13px;
      font-weight: 800;
    }

    .class-metric-card strong {
      color: var(--color-text);
      font-size: clamp(24px, 3vw, 30px);
      line-height: 1;
    }

    .class-metric-card small {
      color: var(--color-primary);
      font-size: 12px;
      font-weight: 700;
    }

    .blue {
      color: var(--color-primary);
      background: #eef4ff;
    }

    .purple {
      color: var(--color-secondary);
      background: #f2eaff;
    }

    .green {
      color: var(--color-success);
      background: #dcfce7;
    }

    .orange {
      color: #9a3412;
      background: #ffedd5;
    }

    .red {
      color: var(--color-danger);
      background: #fee2e2;
    }

    .danger-text {
      color: var(--color-danger) !important;
    }

    .success-text {
      color: var(--color-success) !important;
    }

    .classes-panel {
      overflow: hidden;
    }

    .class-tabs {
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--color-border-soft);
      padding: 16px 20px;
      overflow-x: auto;
      white-space: nowrap;
    }

    .class-tabs button {
      min-height: 38px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid transparent;
      border-radius: 999px;
      background: transparent;
      color: var(--color-text-soft);
      padding: 0 14px;
      font-weight: 800;
    }

    .class-tabs button.is-active {
      border-color: rgba(37, 99, 235, 0.18);
      background: #eef4ff;
      color: var(--color-primary);
    }

    .tab-count {
      min-width: 24px;
      height: 24px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: #ffffff;
      color: currentColor;
      font-size: 12px;
    }

    .class-filters {
      display: grid;
      grid-template-columns: minmax(260px, 1fr) 180px 180px 220px;
      gap: 12px;
      border-bottom: 1px solid var(--color-border-soft);
      padding: 16px 20px;
    }

    .form-control,
    .form-select,
    .input-group-text,
    .btn {
      border-radius: var(--radius-md);
    }

    .input-group > .form-control,
    .input-group > .form-select {
      border-top-left-radius: 0;
      border-bottom-left-radius: 0;
    }

    .input-group-text {
      border-color: var(--color-border);
      background: var(--color-surface-soft);
      color: var(--color-muted);
    }

    .form-control,
    .form-select,
    .schedule-form-grid input,
    .schedule-form-grid select,
    .schedule-form-grid textarea {
      min-height: 42px;
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      background: #ffffff;
      color: var(--color-text);
      padding: 0 14px;
      outline: 0;
    }

    .schedule-form-grid textarea {
      min-height: 96px;
      padding-top: 12px;
      padding-bottom: 12px;
      resize: vertical;
    }

    .form-control:focus,
    .form-select:focus,
    .schedule-form-grid input:focus,
    .schedule-form-grid select:focus,
    .schedule-form-grid textarea:focus {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 0.22rem rgba(37, 99, 235, 0.14);
    }

    .class-table {
      --bs-table-bg: #ffffff;
    }

    .class-table thead th {
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

    .class-table tbody td {
      padding: 18px 22px;
      border-bottom: 1px solid var(--color-border-soft);
    }

    .class-table tbody tr:hover {
      background: #f8fbff;
    }

    .min-w-0 {
      min-width: 0;
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

    .date-cell span {
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

    .mobile-class-list {
      display: grid;
      gap: 14px;
      padding: 16px;
    }

    .mobile-class-card {
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #ffffff;
      padding: 16px;
      box-shadow: 0 12px 32px rgba(30, 64, 175, 0.07);
    }

    .mobile-class-meta {
      display: grid;
      gap: 8px;
    }

    .mobile-class-meta span {
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

    .mobile-actions .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-weight: 700;
    }

    .class-table-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      border-top: 1px solid var(--color-border-soft);
      padding: 16px 20px;
    }

    .pagination .page-link {
      color: var(--color-primary);
      font-weight: 700;
    }

    .pagination .active .page-link {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: #ffffff;
    }

    .empty-state {
      min-height: 220px;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 8px;
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

    .mobile-empty {
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #ffffff;
    }

    /* Fixed above App Shell */
    .schedule-modal-overlay {
      position: fixed;
      inset: 0;
      z-index: 3000;
      display: grid;
      place-items: center;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(8px);
      padding: 16px;
    }

    .class-schedule-modal {
      width: min(1120px, 100%);
      max-height: calc(100dvh - 32px);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      border: 1px solid var(--color-border);
      border-radius: 24px;
      background: #ffffff;
      box-shadow: 0 34px 90px rgba(15, 23, 42, 0.22);
    }

    .schedule-header,
    .schedule-footer {
      flex-shrink: 0;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      padding: 24px 28px;
    }

    .schedule-header {
      border-bottom: 1px solid var(--color-border-soft);
    }

    .schedule-footer {
      align-items: center;
      border-top: 1px solid var(--color-border-soft);
      background: #fbfcff;
    }

    .schedule-header h2 {
      margin: 0;
      font-size: 28px;
      letter-spacing: -0.02em;
    }

    .modal-icon,
    .confirm-icon {
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      flex: 0 0 52px;
      border-radius: 16px;
      background: #eef4ff;
      color: var(--color-primary);
      font-size: 24px;
    }

    .confirm-icon {
      background: #fee2e2;
      color: var(--color-danger);
    }

    .schedule-two-steps {
      flex-shrink: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
      border-bottom: 1px solid var(--color-border-soft);
      padding: 20px 28px;
    }

    .wizard-steps div {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--color-border-soft);
      border-radius: 16px;
      background: #ffffff;
      padding: 14px;
      color: var(--color-muted);
    }

    .wizard-steps div.is-active {
      border-color: rgba(37, 99, 235, 0.3);
      background: #eef4ff;
      color: var(--color-primary);
    }

    .wizard-steps span {
      width: 38px;
      height: 38px;
      display: grid;
      place-items: center;
      border-radius: 999px;
      background: currentColor;
      color: #ffffff;
      font-weight: 900;
    }

    .wizard-steps strong {
      font-size: 14px;
    }

    .schedule-form-grid {
      flex: 1;
      min-height: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 18px;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 24px 28px;
    }

    .schedule-form-grid label {
      display: grid;
      gap: 8px;
      font-weight: 700;
    }

    .full-field,
    .schedule-form-grid .full {
      grid-column: 1 / -1;
    }

    .field-label {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      font-size: 14px;
      font-weight: 800;
    }

    .field-label b {
      color: var(--color-danger);
    }

    .schedule-side-card {
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: var(--color-surface-soft);
      padding: 18px;
    }

    .slot-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .slot-list span {
      border: 1px solid var(--color-border-soft);
      border-radius: 999px;
      background: #ffffff;
      color: var(--color-text-soft);
      padding: 8px 12px;
      font-weight: 700;
    }

    .slot-list span.is-match {
      border-color: var(--color-primary);
      color: var(--color-primary);
      background: #eef4ff;
    }

    .info-card {
      border: 1px solid var(--color-border-soft);
      border-radius: 16px;
      background: var(--color-surface-soft);
      padding: 16px;
    }

    .conflict-card {
      border-color: #fecaca !important;
      background: #fff1f2 !important;
      color: var(--color-danger) !important;
    }

    .success-card {
      border-color: #bbf7d0 !important;
      background: #f0fdf4 !important;
      color: var(--color-success) !important;
    }

    .zoom-link-box {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-md);
      background: #ffffff;
      padding: 14px;
    }

    .zoom-link-box span,
    .detail-list span {
      display: block;
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .zoom-link-box a {
      display: block;
      max-width: 100%;
      overflow: hidden;
      color: var(--color-primary);
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .drawer-backdrop {
      position: fixed;
      inset: 0;
      z-index: 3000;
      background: rgba(15, 23, 42, 0.42);
      backdrop-filter: blur(8px);
    }

    .admin-class-drawer {
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

    .admin-class-drawer::-webkit-scrollbar,
    .schedule-form-grid::-webkit-scrollbar {
      width: 8px;
    }

    .admin-class-drawer::-webkit-scrollbar-thumb,
    .schedule-form-grid::-webkit-scrollbar-thumb {
      border-radius: 999px;
      background: rgba(100, 116, 139, 0.32);
    }

    .drawer-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 24px;
    }

    .drawer-header h2 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.02em;
    }

    .detail-list {
      display: grid;
      gap: 12px;
    }

    .detail-list > div {
      border: 1px solid var(--color-border-soft);
      border-radius: var(--radius-md);
      background: var(--color-surface-soft);
      padding: 14px;
    }

    .detail-list strong {
      display: block;
      margin-top: 4px;
      overflow: hidden;
      color: var(--color-text);
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .confirm-card {
      width: min(540px, 100%);
      max-height: calc(100dvh - 32px);
      overflow-y: auto;
      border: 1px solid var(--color-border);
      border-radius: 22px;
      background: #ffffff;
      box-shadow: 0 34px 90px rgba(15, 23, 42, 0.22);
      padding: 24px;
    }

    .confirm-card header,
    .confirm-card footer {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .confirm-card h2 {
      margin: 0;
    }

    .confirm-card footer {
      align-items: center;
      margin-top: 22px;
    }

    @media (max-width: 1180px) {
      .class-metrics-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .class-filters {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 820px) {
      .heading-actions {
        width: 100%;
        display: grid;
        grid-template-columns: 1fr;
      }

      .heading-actions .btn {
        width: 100%;
        justify-content: center;
      }

      .class-metrics-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .class-filters {
        grid-template-columns: 1fr;
        padding: 14px;
      }

      .class-table-footer {
        align-items: flex-start;
        flex-direction: column;
      }

      .schedule-modal-overlay {
        align-items: stretch;
        padding: 10px;
      }

      .class-schedule-modal {
        max-height: calc(100dvh - 20px);
        border-radius: 20px;
      }

      .schedule-header,
      .schedule-footer {
        padding: 18px;
      }

      .schedule-header h2 {
        font-size: 23px;
      }

      .schedule-two-steps {
        gap: 10px;
        padding: 16px 18px;
      }

      .wizard-steps div {
        padding: 12px;
      }

      .schedule-form-grid {
        grid-template-columns: 1fr;
        padding: 18px;
      }

      .full-field,
      .schedule-form-grid .full {
        grid-column: auto;
      }

      .schedule-footer {
        display: grid;
        grid-template-columns: 1fr;
      }

      .schedule-footer .btn {
        width: 100%;
      }

      .admin-class-drawer {
        width: 100vw;
        border-left: 0;
        padding: 18px;
      }

      .confirm-card footer {
        display: grid;
        grid-template-columns: 1fr;
      }

      .confirm-card footer .btn {
        width: 100%;
      }
    }

    @media (max-width: 560px) {
      .class-metrics-grid {
        grid-template-columns: 1fr;
      }

      .class-metric-card {
        min-height: auto;
      }

      .class-tabs {
        padding: 12px;
      }

      .mobile-actions {
        grid-template-columns: 1fr;
      }

      .class-avatar {
        width: 40px;
        height: 40px;
        flex-basis: 40px;
        border-radius: 12px;
        font-size: 18px;
      }

      .mobile-class-card {
        padding: 14px;
      }

      .modal-icon,
      .confirm-icon {
        width: 46px;
        height: 46px;
        flex-basis: 46px;
        font-size: 21px;
      }

      .schedule-two-steps {
        grid-template-columns: 1fr;
      }

      .confirm-card {
        padding: 20px;
        border-radius: 20px;
      }
    }
  `
})
export class AdminClassesComponent implements OnInit {
  protected readonly scheduleOpen = signal(false);
  protected readonly scheduleStep = signal<1 | 2>(1);
  protected readonly searchText = signal('');
  protected readonly activeTab = signal<ClassTabKey>('all');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 10;
  protected readonly loading = signal(false);
  protected readonly apiWarning = signal('');
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly teachers = signal<PersonOption[]>([]);
  protected readonly students = signal<PersonOption[]>([]);
  protected readonly selectedTeacherAvailability = signal<TeacherAvailabilityItem[]>([]);
  protected readonly busySlots = signal<ClassListItem[]>([]);
  protected readonly conflicts = signal<SchedulingConflict[]>([]);
  protected readonly scheduleSubmitting = signal(false);
  protected readonly scheduleMessage = signal('');
  protected readonly scheduleMessageType = signal<'success' | 'error'>('success');
  protected readonly scheduledClass = signal<ClassListItem | null>(null);
  protected readonly selectedClass = signal<ClassListItem | null>(null);
  protected readonly classDrawerOpen = signal(false);
  protected readonly classToCancel = signal<ClassListItem | null>(null);
  protected readonly cancelConfirmOpen = signal(false);
  protected readonly cancelSubmitting = signal(false);
  protected readonly cancelMessage = signal('');
  protected cancelReason = '';

  protected scheduleForm = {
    teacherId: '',
    studentId: '',
    title: '',
    description: '',
    startTime: '',
    durationMinutes: 60,
    timezone: 'Asia/Kolkata'
  };

  protected readonly steps = [
    { index: 1, label: 'Participants' },
    { index: 2, label: 'Date & Time' }
  ];

  protected readonly classTabs: Array<{ key: ClassTabKey; label: string }> = [
    { key: 'all', label: 'All Classes' },
    { key: 'today', label: 'Today' },
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'live', label: 'Live' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'rescheduled', label: 'Rescheduled' },
    { key: 'failed', label: 'Failed / No Show' },
    { key: 'cancellation_requests', label: 'Cancellation Requests' }
  ];

  protected readonly filteredClasses = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    const tabFiltered = this.classes().filter((item) => this.matchesTab(item, this.activeTab()));

    if (!query) {
      return tabFiltered;
    }

    return tabFiltered.filter((item) =>
      [item.title, item.teacherName, this.participantName(item), item.status].some((value) => value.toLowerCase().includes(query))
    );
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredClasses().length / this.pageSize)));

  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  protected readonly pagedClasses = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredClasses().slice(start, start + this.pageSize);
  });

  protected readonly todayCount = computed(() =>
    this.classes().filter((item) => new Date(item.startTime).toDateString() === new Date().toDateString()).length
  );

  protected readonly upcomingCount = computed(() => this.classes().filter((item) => this.matchesTab(item, 'upcoming')).length);
  protected readonly liveCount = computed(() => this.classes().filter((item) => item.status === 'live').length);
  protected readonly completedCount = computed(() => this.classes().filter((item) => item.status === 'completed').length);
  protected readonly cancelledCount = computed(() => this.classes().filter((item) => item.status === 'cancelled').length);
  protected readonly noShowCount = computed(() => this.classes().filter((item) => ['failed', 'no_show', 'no-show'].includes(item.status)).length);

  constructor(
    private readonly classesApi: ClassesApiService,
    private readonly peopleApi: PeopleApiService,
    private readonly availabilityApi: TeacherAvailabilityApiService
  ) {}

  ngOnInit(): void {
    this.loadClasses();
    this.loadPeople();
  }

  protected loadClasses(): void {
    this.loading.set(true);
    this.apiWarning.set('');

    this.classesApi
      .listClasses({ limit: 100 })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => this.classes.set(response.data),
        error: () => {
          this.apiWarning.set('Could not reach backend classes API.');
          this.classes.set([]);
        }
      });
  }

  protected setActiveTab(tab: ClassTabKey): void {
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

  protected tabCount(tab: ClassTabKey): number {
    return this.classes().filter((item) => this.matchesTab(item, tab)).length;
  }

  protected openSchedule(): void {
    this.resetScheduleForm();
    this.scheduleOpen.set(true);
  }

  protected closeSchedule(): void {
    this.scheduleOpen.set(false);
  }

  protected openClassDrawer(item: ClassListItem): void {
    this.selectedClass.set(item);
    this.classDrawerOpen.set(true);
    this.classesApi.getClass(item.id).subscribe({
      next: (response) => this.selectedClass.set(response.data),
      error: () => undefined
    });
  }

  protected closeClassDrawer(): void {
    this.classDrawerOpen.set(false);
  }

  protected openCancelConfirm(item: ClassListItem): void {
    this.classToCancel.set(item);
    this.cancelReason = '';
    this.cancelMessage.set('');
    this.cancelConfirmOpen.set(true);
  }

  protected closeCancelConfirm(): void {
    this.cancelConfirmOpen.set(false);
  }

  protected confirmCancelClass(): void {
    const item = this.classToCancel();
    const reason = this.cancelReason.trim();

    if (!item) {
      return;
    }

    if (!reason) {
      this.cancelMessage.set('Please add a cancellation reason.');
      return;
    }

    this.cancelSubmitting.set(true);
    this.cancelMessage.set('');
    this.classesApi
      .cancelClass(item.id, reason)
      .pipe(finalize(() => this.cancelSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          this.classes.update((classes) => classes.map((classItem) => (classItem.id === response.data.id ? response.data : classItem)));
          this.selectedClass.update((selected) => (selected?.id === response.data.id ? response.data : selected));
          this.closeCancelConfirm();
        },
        error: () => this.cancelMessage.set('Could not cancel this class or Zoom meeting. Please try again.')
      });
  }

  protected nextFromParticipants(): void {
    this.scheduleMessage.set('');
    if (!this.scheduleForm.teacherId || !this.scheduleForm.studentId || !this.scheduleForm.title.trim()) {
      this.showScheduleError('Please select teacher, student, and class title before continuing.');
      return;
    }
    this.scheduleStep.set(2);
    this.loadSelectedTeacherAvailability();
    this.refreshBusySlots();
  }

  protected previousStep(): void {
    this.scheduleStep.set(1);
    this.conflicts.set([]);
    this.scheduleMessage.set('');
  }

  protected onTeacherChanged(): void {
    this.selectedTeacherAvailability.set([]);
    this.busySlots.set([]);
    this.conflicts.set([]);
    if (this.scheduleForm.teacherId) {
      this.loadSelectedTeacherAvailability();
    }
    this.refreshBusySlots();
  }

  protected clearConflicts(): void {
    this.conflicts.set([]);
    this.scheduleMessage.set('');
  }

  protected refreshBusySlots(): void {
    this.conflicts.set([]);
    if (!this.scheduleForm.startTime || (!this.scheduleForm.teacherId && !this.scheduleForm.studentId)) {
      this.busySlots.set([]);
      return;
    }

    const day = new Date(this.scheduleForm.startTime);
    const from = new Date(day);
    from.setHours(0, 0, 0, 0);
    const to = new Date(day);
    to.setHours(23, 59, 59, 999);

    const byId = new Map<string, ClassListItem>();
    const setSlots = (items: ClassListItem[]) => {
      for (const item of items) {
        byId.set(item.id, item);
      }
      this.busySlots.set(
        Array.from(byId.values()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
      );
    };

    if (this.scheduleForm.teacherId) {
      this.classesApi
        .listClasses({ teacherId: this.scheduleForm.teacherId, from: from.toISOString(), to: to.toISOString(), limit: 100 })
        .subscribe({ next: (response) => setSlots(response.data), error: () => this.busySlots.set([]) });
    }

    if (this.scheduleForm.studentId) {
      this.classesApi
        .listClasses({ studentId: this.scheduleForm.studentId, from: from.toISOString(), to: to.toISOString(), limit: 100 })
        .subscribe({ next: (response) => setSlots(response.data), error: () => undefined });
    }
  }

  protected validateAndSchedule(): void {
    if (this.scheduledClass()) {
      this.closeSchedule();
      return;
    }

    this.scheduleMessage.set('');
    this.conflicts.set([]);

    if (!this.scheduleForm.startTime) {
      this.showScheduleError('Please choose the class start date and time.');
      return;
    }

    this.scheduleSubmitting.set(true);
    const payload = {
      teacherId: this.scheduleForm.teacherId,
      studentId: this.scheduleForm.studentId,
      startTime: new Date(this.scheduleForm.startTime).toISOString(),
      durationMinutes: Number(this.scheduleForm.durationMinutes),
      timezone: this.scheduleForm.timezone
    };

    this.classesApi.checkConflicts(payload).subscribe({
      next: (response) => {
        if (response.data.hasConflicts) {
          this.conflicts.set(response.data.conflicts);
          this.scheduleSubmitting.set(false);
          return;
        }
        this.createClass(payload.startTime);
      },
      error: (error) => {
        const conflicts = error?.error?.error?.details?.conflicts as SchedulingConflict[] | undefined;
        if (conflicts?.length) {
          this.conflicts.set(conflicts);
          this.scheduleSubmitting.set(false);
          return;
        }
        this.showScheduleError('Could not validate this schedule. Please check the backend connection.');
        this.scheduleSubmitting.set(false);
      }
    });
  }

  protected shortId(id: string): string {
    return id.slice(0, 8);
  }

  protected participantName(item: ClassListItem): string {
    return item.participants[0]?.studentName ?? 'Unassigned';
  }

  protected participantAttendance(item: ClassListItem): string {
    return item.participants[0]?.attendanceStatus ?? 'pending';
  }

  protected matchesTab(item: ClassListItem, tab: ClassTabKey): boolean {
    const status = item.status.toLowerCase();
    const start = new Date(item.startTime);
    const now = new Date();

    switch (tab) {
      case 'all':
        return true;
      case 'today':
        return start.toDateString() === now.toDateString();
      case 'upcoming':
        return start.getTime() > now.getTime() && ['scheduled', 'rescheduled'].includes(status);
      case 'live':
        return status === 'live';
      case 'completed':
        return status === 'completed';
      case 'cancelled':
        return status === 'cancelled';
      case 'rescheduled':
        return status === 'rescheduled';
      case 'failed':
        return ['failed', 'no_show', 'no-show'].includes(status);
      case 'cancellation_requests':
        return Boolean(
          (item as ClassListItem & { cancellationRequestStatus?: string; cancellationRequestsCount?: number }).cancellationRequestStatus ||
            (item as ClassListItem & { cancellationRequestsCount?: number }).cancellationRequestsCount
        );
    }
  }

  protected fullName(person: PersonOption): string {
    return `${person.firstName} ${person.lastName}`;
  }

  protected dayLabel(day: string): string {
    return day.slice(0, 3).toUpperCase();
  }

  protected selectedDayOfWeek(): string {
    if (!this.scheduleForm.startTime) {
      return '';
    }
    return new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date(this.scheduleForm.startTime)).toLowerCase();
  }

  protected conflictDetail(conflict: SchedulingConflict): string {
    if (!conflict.details?.title) {
      return '';
    }
    return `: ${conflict.details.title}`;
  }

  private createClass(startTime: string): void {
    this.classesApi
      .createClass({
        teacherId: this.scheduleForm.teacherId,
        studentId: this.scheduleForm.studentId,
        title: this.scheduleForm.title.trim(),
        startTime,
        durationMinutes: Number(this.scheduleForm.durationMinutes),
        timezone: this.scheduleForm.timezone,
        notes: this.scheduleForm.description.trim() || undefined,
        overrideConflicts: false
      })
      .pipe(finalize(() => this.scheduleSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          this.scheduledClass.set(response.data);
          this.scheduleMessageType.set('success');
          this.scheduleMessage.set(response.data.zoomMeeting?.joinUrl ? 'Class scheduled successfully. Zoom meeting link is ready.' : 'Class scheduled successfully.');
          this.loadClasses();
          this.refreshBusySlots();
        },
        error: (error) => {
          const conflicts = error?.error?.error?.details?.conflicts as SchedulingConflict[] | undefined;
          if (conflicts?.length) {
            this.conflicts.set(conflicts);
            return;
          }
          this.showScheduleError('Could not schedule class. Please check availability, conflicts, and Zoom/backend configuration.');
        }
      });
  }

  private loadPeople(): void {
    this.peopleApi.listTeachers().subscribe({
      next: (response) => this.teachers.set(response.data),
      error: () => this.teachers.set([])
    });

    this.peopleApi.listStudents().subscribe({
      next: (response) => this.students.set(response.data),
      error: () => this.students.set([])
    });
  }

  private loadSelectedTeacherAvailability(): void {
    if (!this.scheduleForm.teacherId) {
      this.selectedTeacherAvailability.set([]);
      return;
    }

    this.availabilityApi.listAvailability(this.scheduleForm.teacherId).subscribe({
      next: (response) => this.selectedTeacherAvailability.set(response.data.availability.filter((slot) => slot.isActive)),
      error: () => this.selectedTeacherAvailability.set([])
    });
  }

  private resetScheduleForm(): void {
    this.scheduleStep.set(1);
    this.scheduleForm = {
      teacherId: '',
      studentId: '',
      title: '',
      description: '',
      startTime: '',
      durationMinutes: 60,
      timezone: 'Asia/Kolkata'
    };
    this.selectedTeacherAvailability.set([]);
    this.busySlots.set([]);
    this.conflicts.set([]);
    this.scheduledClass.set(null);
    this.scheduleMessage.set('');
  }

  private showScheduleError(message: string): void {
    this.scheduleMessageType.set('error');
    this.scheduleMessage.set(message);
  }
}
