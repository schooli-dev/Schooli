import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';
import { DateTimeService } from '../../core/datetime/date-time.service';

type TeacherClassTab = 'today' | 'upcoming' | 'completed' | 'cancelled' | 'all';

@Component({
  selector: 'app-teacher-classes',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './teacher-classes.component.html',
  styleUrl: './teacher-classes.component.scss'
})
export class TeacherClassesComponent implements OnInit {
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly activeTab = signal<TeacherClassTab>('all');
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
    return next ? this.classTimeOnlyRange(next) : '--';
  });

  protected readonly nextClassStatus = computed(() => this.nextClass()?.status ?? 'none');

  protected readonly nextClassSummary = computed(() => {
    const next = this.nextClass();
    return next ? `${next.title} with ${this.studentName(next)}` : 'No upcoming class scheduled.';
  });

  constructor(
    private readonly classesApi: ClassesApiService,
    private readonly router: Router,
    private readonly authToken: AuthTokenService,
    private readonly dateTime: DateTimeService
  ) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.activeTab.set('all');
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

  protected userTimezone(): string {
    const timezone = this.authToken.getUser()?.timezone;
    return this.dateTime.isValidTimezone(timezone) ? timezone : this.dateTime.browserTimezone();
  }

  protected classDate(item: ClassListItem): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone(),
      month: 'short',
      day: 'numeric'
    }).format(new Date(item.startTime));
  }

  protected classDateTime(item: ClassListItem): string {
    return this.dateTime.formatDateTime(item.startTime, this.userTimezone());
  }

  protected classTimeOnlyRange(item: ClassListItem): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone(),
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `${formatter.format(new Date(item.startTime))} - ${formatter.format(new Date(item.endTime))}`;
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
    return !this.isClassOver(item) && ['live', 'scheduled', 'rescheduled'].includes(item.status) && Boolean(item.videoMeeting?.roomUrl);
  }

  protected isClassOver(item: ClassListItem): boolean {
    return new Date(item.endTime).getTime() < Date.now();
  }

  protected joinClass(item: ClassListItem): void {
    void this.router.navigate(['/teacher/classes', item.id, 'room'], { skipLocationChange: true });
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
    return this.dateKey(item.startTime) === this.dateKey(new Date());
  }

  private dateKey(value: Date | string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.userTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
  }
}
