import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';
import { DateTimeService } from '../../core/datetime/date-time.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.scss'
})
export class StudentDashboardComponent implements OnInit {
  private readonly authToken = inject(AuthTokenService);
  private readonly classesApi = inject(ClassesApiService);
  private readonly dateTime = inject(DateTimeService);

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
    const currentMonth = this.monthKey(new Date());
    return this.classes().filter((item) => this.monthKey(item.startTime) === currentMonth).length;
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

  protected userTimezone(): string {
    const timezone = this.user?.timezone;
    return this.dateTime.isValidTimezone(timezone) ? timezone : this.dateTime.browserTimezone();
  }

  protected classMonth(item: ClassListItem): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: this.userTimezone(), month: 'short' }).format(new Date(item.startTime));
  }

  protected classDay(item: ClassListItem): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: this.userTimezone(), day: 'numeric' }).format(new Date(item.startTime));
  }

  protected classTimeRange(item: ClassListItem): string {
    return this.dateTime.formatTimeRange(item.startTime, item.endTime, this.userTimezone());
  }

  protected classTimeOnlyRange(item: ClassListItem): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone(),
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `${formatter.format(new Date(item.startTime))} to ${formatter.format(new Date(item.endTime))}`;
  }

  ngOnInit(): void {
    this.classesApi.listClasses({ limit: 100 }).subscribe({
      next: (response) => this.classes.set(response.data),
      error: () => this.classes.set([])
    });
  }

  private attendance(item: ClassListItem): string {
    return item.participants[0]?.attendanceStatus ?? 'pending';
  }

  private monthKey(value: Date | string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.userTimezone(),
      year: 'numeric',
      month: '2-digit'
    }).format(new Date(value));
  }
}