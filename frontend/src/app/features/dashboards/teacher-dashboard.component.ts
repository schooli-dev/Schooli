import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';
import { DateTimeService } from '../../core/datetime/date-time.service';
import { TeacherAvailabilityApiService, TeacherAvailabilityItem, TeacherUnavailableDate } from '../../core/teachers/teacher-availability-api.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.scss'
})
export class TeacherDashboardComponent implements OnInit, OnDestroy {
  private readonly authToken = inject(AuthTokenService);
  private readonly classesApi = inject(ClassesApiService);
  private readonly availabilityApi = inject(TeacherAvailabilityApiService);
  private readonly dateTime = inject(DateTimeService);
  private readonly router = inject(Router);

  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly availability = signal<TeacherAvailabilityItem[]>([]);
  protected readonly unavailableDates = signal<TeacherUnavailableDate[]>([]);
  protected readonly calendarNow = signal(new Date());
  protected readonly user = this.authToken.getUser();

  protected readonly todayClasses = computed(() =>
    this.classes()
      .filter((item) => this.dateKey(item.startTime) === this.dateKey(new Date()))
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
  protected readonly calendarRange = computed(() => this.getCalendarRange());
  protected readonly calendarDays = computed(() => this.buildCalendarDays());
  protected readonly calendarTimeLabels = computed(() => {
    const range = this.calendarRange();
    const labels: Array<{ minutes: number; label: string }> = [];
    for (let minutes = range.start; minutes < range.end; minutes += 60) {
      labels.push({ minutes, label: this.formatMinute(minutes) });
    }
    return labels;
  });
  protected readonly calendarHeight = computed(() => ((this.calendarRange().end - this.calendarRange().start) / 60) * 54);
  protected readonly currentTimeMarker = computed(() => {
    const now = this.calendarNow();
    const range = this.calendarRange();
    const minutes = this.localTimeMinutes(now);
    if (minutes < range.start || minutes >= range.end) return null;

    return {
      date: this.dateKey(now),
      top: ((minutes - range.start) / (range.end - range.start)) * 100
    };
  });
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
    return minutes < 60 ? `Next class in ${minutes} min` : `Next class on ${this.classDate(next)}`;
  });
  private calendarClock: ReturnType<typeof setInterval> | undefined;

  ngOnInit(): void {
    this.calendarClock = setInterval(() => this.calendarNow.set(new Date()), 60_000);
    this.classesApi.listClasses({ limit: 100 }).subscribe({
      next: (response) => this.classes.set(response.data),
      error: () => this.classes.set([])
    });

    if (this.user?.id) {
      this.availabilityApi.listAvailability(this.user.id).subscribe({
        next: (response) => {
          this.availability.set(response.data.availability);
          this.unavailableDates.set(response.data.unavailableDates);
        },
        error: () => {
          this.availability.set([]);
          this.unavailableDates.set([]);
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.calendarClock) {
      clearInterval(this.calendarClock);
    }
  }

  protected studentName(item: ClassListItem): string {
    return item.participants[0]?.studentName ?? 'Unassigned student';
  }

  protected userTimezone(): string {
    const timezone = this.user?.timezone;
    return this.dateTime.isValidTimezone(timezone) ? timezone : this.dateTime.browserTimezone();
  }

  protected classDate(item: ClassListItem): string {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone(),
      month: 'short',
      day: 'numeric'
    }).format(new Date(item.startTime));
  }

  protected classTimeRange(item: ClassListItem): string {
    return this.dateTime.formatTimeRange(item.startTime, item.endTime, this.userTimezone());
  }

  protected classTimeOnlyRange(item: ClassListItem): string {
    return this.dateTime.formatTimeOnlyRange(item.startTime, item.endTime, this.userTimezone());
  }

  protected openClassDetails(classId: string | undefined): void {
    if (!classId) return;
    void this.router.navigate(['/teacher/classes'], { queryParams: { openClass: classId } });
  }

  protected calendarMarkerPosition(minutes: number): number {
    const range = this.calendarRange();
    return ((minutes - range.start) / (range.end - range.start)) * 100;
  }

  private dateKey(value: Date | string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.userTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
  }

  private getCalendarRange(): { start: number; end: number } {
    const minutes = [
      ...this.activeAvailability().flatMap((slot) => [this.timeToMinutes(slot.startTime), this.timeToMinutes(slot.endTime)]),
      ...this.calendarClasses().flatMap((item) => [this.localTimeMinutes(item.startTime), this.localTimeMinutes(item.endTime)])
    ];
    const earliest = minutes.length ? Math.min(...minutes) : 8 * 60;
    const latest = minutes.length ? Math.max(...minutes) : 22 * 60;
    return { start: Math.max(0, Math.min(8 * 60, Math.floor(earliest / 60) * 60)), end: Math.min(24 * 60, Math.max(22 * 60, Math.ceil(latest / 60) * 60)) };
  }

  private buildCalendarDays(): CalendarDay[] {
    const range = this.calendarRange();
    const today = this.dateKey(new Date());
    return this.currentWeekDates().map((date) => ({
      key: date,
      label: this.formatCalendarDate(date),
      isToday: date === today,
      blocks: this.blocksForDate(date, range)
    }));
  }

  private blocksForDate(date: string, range: { start: number; end: number }): CalendarBlock[] {
    const blocks: CalendarBlock[] = [];
    const dayStart = this.dateTime.localDateTimeToUtc(`${date}T00:00`, this.userTimezone());
    const nextDate = this.addCalendarDays(date, 1);
    const dayEnd = this.dateTime.localDateTimeToUtc(`${nextDate}T00:00`, this.userTimezone());
    const weekday = this.weekdayForDate(date);

    for (const slot of this.activeAvailability().filter((item) => item.dayOfWeek === weekday)) {
      blocks.push(this.createCalendarBlock('availability', slot.id, this.timeToMinutes(slot.startTime), this.timeToMinutes(slot.endTime), range));
    }

    for (const block of this.unavailableDates().filter((item) => item.unavailableDate === date)) {
      blocks.push(this.createCalendarBlock('unavailable', block.id, block.startTime ? this.timeToMinutes(block.startTime) : range.start, block.endTime ? this.timeToMinutes(block.endTime) : range.end, range, 'Unavailable'));
    }

    for (const item of this.calendarClasses()) {
      const start = new Date(item.startTime);
      const end = new Date(item.endTime);
      if (start >= dayEnd || end <= dayStart) continue;
      const visibleStart = start > dayStart ? start : dayStart;
      const visibleEnd = end < dayEnd ? end : dayEnd;
      const startMinute = visibleStart.getTime() === dayStart.getTime() ? 0 : this.localTimeMinutes(visibleStart);
      const endMinute = visibleEnd.getTime() === dayEnd.getTime() ? 24 * 60 : this.localTimeMinutes(visibleEnd);
      const student = item.participants[0]?.studentName ?? 'Class';
      blocks.push(this.createCalendarBlock(this.classBlockKind(item, date), item.id, startMinute, endMinute, range, item.title, `${student} · ${this.classTimeOnlyRange(item)}`, item.id));
    }

    return blocks.sort((left, right) => left.startMinute - right.startMinute || left.kind.localeCompare(right.kind));
  }

  private createCalendarBlock(kind: CalendarBlockKind, id: string, startMinute: number, endMinute: number, range: { start: number; end: number }, label?: string, detail?: string, classId?: string): CalendarBlock {
    const start = Math.max(range.start, startMinute);
    const end = Math.min(range.end, endMinute);
    return { id, kind, startMinute: start, top: ((start - range.start) / (range.end - range.start)) * 100, height: Math.max(((end - start) / (range.end - range.start)) * 100, 1.5), label, detail, classId };
  }

  protected calendarClasses(): ClassListItem[] {
    const weekDates = this.currentWeekDates();
    const weekStart = this.dateTime.localDateTimeToUtc(`${weekDates[0]}T00:00`, this.userTimezone());
    const weekEnd = this.dateTime.localDateTimeToUtc(`${this.addCalendarDays(weekDates[6], 1)}T00:00`, this.userTimezone());

    return this.classes().filter((item) =>
      item.status !== 'no_show' &&
      item.status !== 'failed' &&
      new Date(item.endTime) > weekStart &&
      new Date(item.startTime) < weekEnd
    );
  }

  private classBlockKind(item: ClassListItem, date: string): CalendarBlockKind {
    if (item.status === 'cancelled') return 'cancelled';
    if (item.status === 'completed') return 'completed';
    return date === this.dateKey(new Date()) || item.status === 'live' ? 'today-class' : 'upcoming-class';
  }

  private currentWeekDates(): string[] {
    const currentDate = this.dateKey(new Date());
    const mondayOffset = (new Date(`${currentDate}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = this.addCalendarDays(currentDate, -mondayOffset);
    return Array.from({ length: 7 }, (_, index) => this.addCalendarDays(monday, index));
  }

  private formatCalendarDate(date: string): string {
    return new Intl.DateTimeFormat('en-US', { timeZone: this.userTimezone(), weekday: 'short', month: 'short', day: 'numeric' }).format(this.dateTime.localDateTimeToUtc(`${date}T12:00`, this.userTimezone()));
  }

  private localTimeMinutes(value: Date | string): number {
    return this.timeToMinutes(this.dateTime.toLocalInputValue(value, this.userTimezone()).slice(11));
  }

  private timeToMinutes(value: string): number {
    const [hour = '0', minute = '0'] = value.split(':');
    return Number(hour) * 60 + Number(minute);
  }

  private formatMinute(minutes: number): string {
    const hour = Math.floor(minutes / 60) % 24;
    const minute = minutes % 60;
    const suffix = hour < 12 ? 'AM' : 'PM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${String(minute).padStart(2, '0')} ${suffix}`;
  }

  private weekdayForDate(date: string): string {
    const [year, month, day] = date.split('-').map(Number);
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  }

  private addCalendarDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }
}

type CalendarBlockKind = 'availability' | 'unavailable' | 'today-class' | 'upcoming-class' | 'cancelled' | 'completed';
type CalendarBlock = { id: string; kind: CalendarBlockKind; startMinute: number; top: number; height: number; label?: string; detail?: string; classId?: string };
type CalendarDay = { key: string; label: string; isToday: boolean; blocks: CalendarBlock[] };
