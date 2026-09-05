import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { finalize, forkJoin, of } from 'rxjs';
import { ClassListItem, ClassesApiService, CreateClassSeriesRequest, SchedulingConflict, SeriesWeekdaySchedule } from '../../core/classes/classes-api.service';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { DateTimeService } from '../../core/datetime/date-time.service';
import { timezoneShortLabel } from '../../core/datetime/timezone-options';
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

type Weekday = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type ConvertedAvailabilityPreview = {
  key: string;
  scheduleDate: string;
  dateLabel: string;
  scheduleRange: string;
  startsAt: number;
};

type WeeklyScheduleRow = {
  dayOfWeek: Weekday;
  dayLabel: string;
  scheduleDate: string;
  dateLabel: string;
  startTime: string;
  availability: ConvertedAvailabilityPreview[];
};

@Component({
  selector: 'app-admin-classes',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    MatButtonToggleModule
  ],
  templateUrl: './admin-classes.component.html',
  styleUrl: './admin-classes.component.scss'
})
export class AdminClassesComponent implements OnInit {
  protected readonly scheduleOpen = signal(false);
  protected readonly scheduleStep = signal<1 | 2>(1);
  protected readonly searchText = signal('');
  protected readonly selectedTeacherIds = signal<string[]>([]);
  protected readonly selectedStudentIds = signal<string[]>([]);
  protected readonly teacherFilterOpen = signal(false);
  protected readonly studentFilterOpen = signal(false);
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
  protected readonly scheduledClassCount = signal(0);
  protected readonly selectedClass = signal<ClassListItem | null>(null);
  protected readonly classDrawerOpen = signal(false);
  protected readonly classToCancel = signal<ClassListItem | null>(null);
  protected readonly cancelConfirmOpen = signal(false);
  protected readonly cancelSubmitting = signal(false);
  protected readonly cancelMessage = signal('');
  protected readonly classToReschedule = signal<ClassListItem | null>(null);
  protected readonly rescheduleOpen = signal(false);
  protected readonly rescheduleSubmitting = signal(false);
  protected readonly rescheduleMessage = signal('');
  protected cancelReason = '';
  protected rescheduleForm = { startTime: '', durationMinutes: 60, timezone: 'Asia/Kolkata' };
  protected scheduleDate = '';

  protected scheduleForm = {
    teacherId: '',
    studentId: '',
    title: '',
    description: '',
    timezone: 'Asia/Kolkata',
    weekdays: [] as Weekday[],
    weeklySchedules: [] as SeriesWeekdaySchedule[],
    classCount: 1
  };

  protected readonly weekdayOptions: Array<{ key: Weekday; label: string }> = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' }
  ];
  protected readonly timezoneShortLabel = timezoneShortLabel;

  protected openTimePicker(input: HTMLInputElement): void {
    try {
      input.showPicker();
      return;
    } catch {
      input.focus();
    }
  }

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
    const teacherIds = this.selectedTeacherIds();
    const studentIds = this.selectedStudentIds();
    const tabFiltered = this.classes().filter(
      (item) =>
        this.matchesTab(item, this.activeTab()) &&
        (!teacherIds.length || teacherIds.includes(item.teacherId)) &&
        (!studentIds.length || item.participants.some((participant) => studentIds.includes(participant.studentId)))
    );

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
    private readonly availabilityApi: TeacherAvailabilityApiService,
    private readonly dateTime: DateTimeService,
    private readonly authTokens: AuthTokenService
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

  protected setTeacherFilters(ids: string[]): void {
    this.selectedTeacherIds.set(ids);
    this.currentPage.set(1);
  }

  protected setStudentFilters(ids: string[]): void {
    this.selectedStudentIds.set(ids);
    this.currentPage.set(1);
  }

  protected toggleTeacherFilterMenu(): void {
    this.teacherFilterOpen.update((isOpen) => !isOpen);
    this.studentFilterOpen.set(false);
  }

  protected toggleStudentFilterMenu(): void {
    this.studentFilterOpen.update((isOpen) => !isOpen);
    this.teacherFilterOpen.set(false);
  }

  protected toggleTeacherFilter(teacherId: string, selected: boolean): void {
    this.setTeacherFilters(this.updateFilterSelection(this.selectedTeacherIds(), teacherId, selected));
  }

  protected toggleStudentFilter(studentId: string, selected: boolean): void {
    this.setStudentFilters(this.updateFilterSelection(this.selectedStudentIds(), studentId, selected));
  }

  protected clearTeacherFilters(): void {
    this.setTeacherFilters([]);
  }

  protected clearStudentFilters(): void {
    this.setStudentFilters([]);
  }

  protected teacherFilterLabel(): string {
    return this.filterLabel('Teacher', this.selectedTeacherIds().length);
  }

  protected studentFilterLabel(): string {
    return this.filterLabel('Student', this.selectedStudentIds().length);
  }

  protected personLabel(person: PersonOption): string {
    return `${person.firstName} ${person.lastName}`.trim();
  }

  private updateFilterSelection(ids: string[], id: string, selected: boolean): string[] {
    return selected ? [...new Set([...ids, id])] : ids.filter((currentId) => currentId !== id);
  }

  private filterLabel(entity: string, count: number): string {
    if (!count) {
      return `All ${entity.toLowerCase()}s`;
    }

    return `${entity}${count > 1 ? 's' : ''} (${count})`;
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
    this.cancelReason = item.pendingCancellationReason?.trim() ?? '';
    this.cancelMessage.set('');
    this.cancelConfirmOpen.set(true);
  }

  protected closeCancelConfirm(): void {
    this.cancelConfirmOpen.set(false);
  }

  protected openReschedule(item: ClassListItem): void {
    this.classToReschedule.set(item);
    this.rescheduleForm = {
      startTime: this.dateTime.toLocalInputValue(item.startTime, item.timezone),
      durationMinutes: item.durationMinutes,
      timezone: item.timezone
    };
    this.rescheduleMessage.set('');
    this.rescheduleOpen.set(true);
  }

  protected closeReschedule(): void {
    this.rescheduleOpen.set(false);
  }

  protected confirmReschedule(): void {
    const item = this.classToReschedule();
    if (!item || !this.rescheduleForm.startTime) {
      this.rescheduleMessage.set('Choose a new date and time.');
      return;
    }

    const startTime = this.dateTime.localDateTimeToUtc(this.rescheduleForm.startTime, this.rescheduleForm.timezone);
    if (startTime.getTime() <= Date.now()) {
      this.rescheduleMessage.set('Choose a future date and time.');
      return;
    }

    this.rescheduleSubmitting.set(true);
    this.rescheduleMessage.set('');
    this.classesApi
      .rescheduleClass(item.id, {
        startTime: startTime.toISOString(),
        durationMinutes: Number(this.rescheduleForm.durationMinutes),
        timezone: this.rescheduleForm.timezone
      })
      .pipe(finalize(() => this.rescheduleSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          this.classes.update((classes) => classes.map((classItem) => (classItem.id === response.data.id ? response.data : classItem)));
          this.selectedClass.set(response.data);
          this.closeReschedule();
        },
        error: (error) => {
          const conflicts = error?.error?.error?.details?.conflicts as SchedulingConflict[] | undefined;
          this.rescheduleMessage.set(conflicts?.length ? conflicts.map((conflict) => conflict.message).join(' ') : 'Could not reschedule this class.');
        }
      });
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
          this.selectedClass.update((selected) => (selected?.id === response.data.id ? response.data : selected));
          this.closeCancelConfirm();
          this.loadClasses();
        },
        error: () => this.cancelMessage.set('Could not cancel this class or Daily room. Please try again.')
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
    this.applyRecommendedScheduleTimezone();
    if (this.scheduleForm.teacherId) {
      this.loadSelectedTeacherAvailability();
    }
    this.refreshBusySlots();
  }

  protected onStudentChanged(): void {
    this.applyRecommendedScheduleTimezone();
    this.refreshBusySlots();
  }

  protected onScheduleTimezoneChanged(): void {
    this.clearConflicts();
    this.refreshBusySlots();
  }

  protected onScheduleDateChanged(): void {
    this.clearConflicts();
    this.refreshBusySlots();
  }

  protected clearConflicts(): void {
    this.conflicts.set([]);
    this.scheduleMessage.set('');
  }

  protected refreshBusySlots(): void {
    this.conflicts.set([]);
    if (!this.scheduleDate || (!this.scheduleForm.teacherId && !this.scheduleForm.studentId)) {
      this.busySlots.set([]);
      return;
    }

    const from = this.dateTime.localDateTimeToUtc(`${this.scheduleDate}T00:00`, this.scheduleForm.timezone);
    const to = this.dateTime.localDateTimeToUtc(`${this.addCalendarDays(this.scheduleDate, 7)}T00:00`, this.scheduleForm.timezone);

    const teacherRequest = this.scheduleForm.teacherId
      ? this.classesApi.listClasses({ teacherId: this.scheduleForm.teacherId, from: from.toISOString(), to: to.toISOString(), limit: 100 })
      : of({ data: [] as ClassListItem[] });
    const studentRequest = this.scheduleForm.studentId
      ? this.classesApi.listClasses({ studentId: this.scheduleForm.studentId, from: from.toISOString(), to: to.toISOString(), limit: 100 })
      : of({ data: [] as ClassListItem[] });

    forkJoin({ teacher: teacherRequest, student: studentRequest }).subscribe({
      next: ({ teacher, student }) => {
        const activeBookings = [...teacher.data, ...student.data].filter((item) => ['scheduled', 'live'].includes(item.status));
        const byId = new Map(activeBookings.map((item) => [item.id, item]));
        this.busySlots.set(Array.from(byId.values()).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
      },
      error: () => this.busySlots.set([])
    });
  }

  protected validateAndSchedule(): void {
    if (this.scheduledClass()) {
      this.closeSchedule();
      return;
    }

    this.scheduleMessage.set('');
    this.conflicts.set([]);

    if (!this.scheduleDate) {
      this.showScheduleError('Please choose the schedule start date.');
      return;
    }

    if (!this.scheduleForm.weekdays.length) {
      this.showScheduleError('Select at least one weekday for this schedule.');
      return;
    }

    if (this.scheduleForm.weeklySchedules.length !== this.scheduleForm.weekdays.length || this.scheduleForm.weeklySchedules.some((schedule) => !schedule.startTime)) {
      this.showScheduleError('Choose a class start time for every selected repeat day.');
      return;
    }

    if (this.hasSelectedScheduleInPast()) {
      this.showScheduleError('Choose a future time for every selected repeat day.');
      return;
    }

    this.scheduleSubmitting.set(true);
    const payload: CreateClassSeriesRequest = {
      teacherId: this.scheduleForm.teacherId,
      studentId: this.scheduleForm.studentId,
      title: this.scheduleForm.title.trim(),
      startDate: this.scheduleDate,
      timezone: this.scheduleForm.timezone,
      weeklySchedules: this.scheduleForm.weeklySchedules.map((schedule) => ({ ...schedule })),
      classCount: Number(this.scheduleForm.classCount),
      notes: this.scheduleForm.description.trim() || undefined,
      overrideConflicts: false
    };

    this.classesApi.checkSeriesConflicts(payload).subscribe({
      next: (response) => {
        if (response.data.hasConflicts) {
          this.conflicts.set(response.data.conflicts);
          this.scheduleSubmitting.set(false);
          return;
        }
        this.createClassSeries(payload);
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

  protected busySlotTimeRange(item: ClassListItem): string {
    return this.dateTime.formatTimeRange(item.startTime, item.endTime, this.scheduleForm.timezone);
  }

  protected classScheduleTime(item: ClassListItem): string {
    return this.dateTime.formatTimeRange(item.startTime, item.endTime, item.timezone);
  }

  protected sessionLogTime(item: ClassListItem, timestamp: string | null): string {
    return timestamp ? this.dateTime.formatDateTime(timestamp, item.timezone, false) : '—';
  }

  protected displayStatus(item: ClassListItem): string {
    return this.hasPendingCancellationRequest(item) ? 'Cancellation Requested' : item.status;
  }

  protected hasPendingCancellationRequest(item: ClassListItem): boolean {
    return item.cancellationRequestStatus === 'pending' || Boolean(item.cancellationRequestsCount);
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
        return this.hasPendingCancellationRequest(item);
    }
  }

  protected fullName(person: PersonOption): string {
    return `${person.firstName} ${person.lastName}`;
  }

  protected dayLabel(day: string): string {
    return day.slice(0, 3).toUpperCase();
  }

  protected selectedRepeatDayAvailability(): ConvertedAvailabilityPreview[] {
    if (!this.scheduleDate || !this.scheduleForm.weekdays.length || !this.selectedTeacherAvailability().length) {
      return [];
    }

    const scheduleTimezone = this.scheduleForm.timezone;
    const previews: ConvertedAvailabilityPreview[] = [];

    for (const scheduleDate of this.firstSelectedOccurrenceDates()) {
      const dayStart = this.dateTime.localDateTimeToUtc(`${scheduleDate}T00:00`, scheduleTimezone);
      const dayEnd = this.dateTime.localDateTimeToUtc(`${this.addCalendarDays(scheduleDate, 1)}T00:00`, scheduleTimezone);
      const dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: scheduleTimezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(dayStart);

      for (const slot of this.selectedTeacherAvailability()) {
        for (const teacherDate of this.teacherDatesWithin(dayStart, dayEnd, slot.timezone)) {
          if (slot.dayOfWeek !== this.weekdayForDate(teacherDate)) {
            continue;
          }

          const slotStart = this.dateTime.localDateTimeToUtc(`${teacherDate}T${slot.startTime.slice(0, 5)}`, slot.timezone);
          const slotEnd = this.availabilitySlotEnd(teacherDate, slot.endTime, slot.timezone);

          if (slotStart >= slotEnd || slotStart >= dayEnd || slotEnd <= dayStart) {
            continue;
          }

          const visibleStart = slotStart > dayStart ? slotStart : dayStart;
          const visibleEnd = slotEnd < dayEnd ? slotEnd : dayEnd;
          previews.push({
            key: `${scheduleDate}:${slot.id}:${teacherDate}`,
            scheduleDate,
            dateLabel,
            scheduleRange: this.formatTimeRange(visibleStart, visibleEnd, scheduleTimezone),
            startsAt: visibleStart.getTime()
          });
        }
      }
    }

    return previews.sort((left, right) => left.startsAt - right.startsAt);
  }

  protected conflictDetail(conflict: SchedulingConflict): string {
    const occurrence = conflict.occurrenceNumber ? ` (class ${conflict.occurrenceNumber})` : '';
    return conflict.details?.title ? `${occurrence}: ${conflict.details.title}` : occurrence;
  }

  protected weeklyScheduleRows(): WeeklyScheduleRow[] {
    return this.firstSelectedOccurrenceDates().map((scheduleDate) => {
      const dayOfWeek = this.weekdayForDate(scheduleDate);
      const schedule = this.scheduleForm.weeklySchedules.find((item) => item.dayOfWeek === dayOfWeek);
      const dayOption = this.weekdayOptions.find((item) => item.key === dayOfWeek);
      const dateLabel = new Intl.DateTimeFormat('en-US', {
        timeZone: this.scheduleForm.timezone,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      }).format(this.dateTime.localDateTimeToUtc(`${scheduleDate}T12:00`, this.scheduleForm.timezone));

      return {
        dayOfWeek,
        dayLabel: dayOption?.label ?? dayOfWeek,
        scheduleDate,
        dateLabel,
        startTime: schedule?.startTime ?? '',
        availability: this.selectedRepeatDayAvailability().filter((slot) => slot.scheduleDate === scheduleDate)
      };
    });
  }

  protected onWeeklyScheduleTimeChanged(): void {
    this.clearConflicts();
    this.refreshBusySlots();
  }

  protected weeklyScheduleStartTime(dayOfWeek: Weekday): string {
    return this.scheduleForm.weeklySchedules.find((schedule) => schedule.dayOfWeek === dayOfWeek)?.startTime ?? '';
  }

  protected setWeeklyScheduleStartTime(dayOfWeek: Weekday, startTime: string): void {
    const schedule = this.scheduleForm.weeklySchedules.find((item) => item.dayOfWeek === dayOfWeek);
    if (!schedule) return;

    schedule.startTime = startTime;
    this.onWeeklyScheduleTimeChanged();
  }

  protected hasSelectedScheduleInPast(): boolean {
    return this.weeklyScheduleRows().some((row) =>
      Boolean(row.startTime) &&
      this.dateTime.localDateTimeToUtc(`${row.scheduleDate}T${row.startTime}`, this.scheduleForm.timezone).getTime() <= Date.now()
    );
  }

  protected minimumStartDate(): string {
    return this.dateTime.toLocalInputValue(new Date(), this.scheduleForm.timezone).slice(0, 10);
  }

  protected selectedTeacher(): PersonOption | null {
    return this.teachers().find((teacher) => teacher.id === this.scheduleForm.teacherId) ?? null;
  }

  protected selectedStudent(): PersonOption | null {
    return this.students().find((student) => student.id === this.scheduleForm.studentId) ?? null;
  }

  protected adminTimezone(): string {
    return this.authTokens.getUser()?.timezone ?? this.dateTime.browserTimezone();
  }

  protected scheduleTimezoneOptions(): Array<{ label: string; value: string; hint: string }> {
    const options = [
      { label: `${timezoneShortLabel(this.adminTimezone())} (Admin)`, value: this.adminTimezone(), hint: 'Default scheduling view' },
      { label: `${timezoneShortLabel(this.selectedTeacher()?.timezone)} (Teacher)`, value: this.selectedTeacher()?.timezone ?? '', hint: this.selectedTeacher()?.timezone ?? 'Select teacher first' },
      { label: `${timezoneShortLabel(this.selectedStudent()?.timezone)} (Student)`, value: this.selectedStudent()?.timezone ?? '', hint: this.selectedStudent()?.timezone ?? 'Select student first' },
      { label: 'UTC', value: 'UTC', hint: 'System storage reference' }
    ];
    const seen = new Set<string>();

    return options.filter((option) => {
      if (!option.value || seen.has(`${option.label}:${option.value}`)) {
        return false;
      }
      seen.add(`${option.label}:${option.value}`);
      return true;
    });
  }

  protected recurrenceSummary(): string {
    const selectedDays = this.weekdayOptions
      .filter((option) => this.scheduleForm.weekdays.includes(option.key))
      .map((option) => option.label)
      .join(', ');
    return selectedDays ? `${this.scheduleForm.classCount} total class(es) across ${selectedDays} (60 min each)` : 'Select weekdays and class count';
  }

  protected setWeekdays(days: Weekday[]): void {
    const selectedDays = this.weekdayOptions.map((option) => option.key).filter((day) => days.includes(day));
    this.scheduleForm.weekdays = selectedDays;
    this.scheduleForm.weeklySchedules = selectedDays.map((dayOfWeek) =>
      this.scheduleForm.weeklySchedules.find((schedule) => schedule.dayOfWeek === dayOfWeek) ?? { dayOfWeek, startTime: '' }
    );
    this.clearConflicts();
    this.refreshBusySlots();
  }

  private createClassSeries(payload: CreateClassSeriesRequest): void {
    this.classesApi
      .createClassSeries(payload)
      .pipe(finalize(() => this.scheduleSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          this.scheduledClass.set(response.data.classes[0] ?? null);
          this.scheduledClassCount.set(response.data.classes.length);
          this.scheduleMessageType.set('success');
          const count = response.data.classes.length;
          this.scheduleMessage.set(count === 1 ? 'Class scheduled. Daily room is ready.' : `${count} classes scheduled. Daily rooms are ready.`);
          this.loadClasses();
          this.refreshBusySlots();
        },
        error: (error) => {
          const conflicts = error?.error?.error?.details?.conflicts as SchedulingConflict[] | undefined;
          if (conflicts?.length) {
            this.conflicts.set(conflicts);
            return;
          }
          this.showScheduleError('Could not schedule class. Please check availability, conflicts, and Daily/backend configuration.');
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
      timezone: this.adminTimezone(),
      weekdays: [],
      weeklySchedules: [],
      classCount: 1
    };
    this.scheduleDate = '';
    this.selectedTeacherAvailability.set([]);
    this.busySlots.set([]);
    this.conflicts.set([]);
    this.scheduledClass.set(null);
    this.scheduledClassCount.set(0);
    this.scheduleMessage.set('');
  }

  private showScheduleError(message: string): void {
    this.scheduleMessageType.set('error');
    this.scheduleMessage.set(message);
  }

  private applyRecommendedScheduleTimezone(): void {
    const current = this.scheduleForm.timezone;
    const validTimezones = this.scheduleTimezoneOptions().map((option) => option.value);

    if (validTimezones.includes(current)) {
      return;
    }

    this.scheduleForm.timezone = this.selectedTeacher()?.timezone ?? this.selectedStudent()?.timezone ?? this.adminTimezone();
  }

  private firstSelectedOccurrenceDates(): string[] {
    const dates: string[] = [];

    for (let offset = 0; offset < 7; offset += 1) {
      const date = this.addCalendarDays(this.scheduleDate, offset);
      if (this.scheduleForm.weekdays.includes(this.weekdayForDate(date))) {
        dates.push(date);
      }
    }

    return dates;
  }

  private teacherDatesWithin(start: Date, end: Date, timezone: string): string[] {
    const startDate = this.dateTime.toLocalInputValue(start, timezone).slice(0, 10);
    const endDate = this.dateTime.toLocalInputValue(new Date(end.getTime() - 1), timezone).slice(0, 10);
    return [...new Set([startDate, endDate])];
  }

  private availabilitySlotEnd(date: string, endTime: string, timezone: string): Date {
    const normalisedEnd = endTime.slice(0, 5);
    const endDate = normalisedEnd === '24:00' ? this.addCalendarDays(date, 1) : date;
    const time = normalisedEnd === '24:00' ? '00:00' : normalisedEnd;
    return this.dateTime.localDateTimeToUtc(`${endDate}T${time}`, timezone);
  }

  private weekdayForDate(date: string): Weekday {
    const [year, month, day] = date.split('-').map(Number);
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
      new Date(Date.UTC(year, month - 1, day)).getUTCDay()
    ] as Weekday;
  }

  private addCalendarDays(date: string, days: number): string {
    const [year, month, day] = date.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  private formatTimeRange(start: Date, end: Date, timezone: string): string {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit'
    });
    return `${formatter.format(start)} – ${formatter.format(end)}`;
  }
}


