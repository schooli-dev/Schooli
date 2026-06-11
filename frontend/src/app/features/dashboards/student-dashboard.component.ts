import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './student-dashboard.component.html',
  styleUrl: './student-dashboard.component.scss'
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