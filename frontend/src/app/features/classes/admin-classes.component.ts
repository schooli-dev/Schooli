import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClassListItem, ClassesApiService, SchedulingConflict } from '../../core/classes/classes-api.service';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { DateTimeService, TimePreview } from '../../core/datetime/date-time.service';
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

@Component({
  selector: 'app-admin-classes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './admin-classes.component.html',
  styleUrl: './admin-classes.component.scss'
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
  protected readonly minimumStartDateTime = signal('');
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
    this.updateMinimumStartDateTime();
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
    this.updateMinimumStartDateTime();
    this.clearConflicts();
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

    const selectedDate = this.scheduleForm.startTime.slice(0, 10);
    const from = this.dateTime.localDateTimeToUtc(`${selectedDate}T00:00`, this.scheduleForm.timezone);
    const to = new Date(this.dateTime.localDateTimeToUtc(`${selectedDate}T23:59`, this.scheduleForm.timezone).getTime() + 59 * 1000);

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

    if (this.isStartTimeInPast()) {
      this.showScheduleError('Please choose a future start date and time.');
      return;
    }

    this.scheduleSubmitting.set(true);
    const payload = {
      teacherId: this.scheduleForm.teacherId,
      studentId: this.scheduleForm.studentId,
      startTime: this.dateTime.localDateTimeToUtc(this.scheduleForm.startTime, this.scheduleForm.timezone).toISOString(),
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

  protected selectedDayOfWeek(): string {
    if (!this.scheduleForm.startTime) {
      return '';
    }
    const start = this.dateTime.localDateTimeToUtc(this.scheduleForm.startTime, this.scheduleForm.timezone);
    return new Intl.DateTimeFormat('en-US', { timeZone: this.scheduleForm.timezone, weekday: 'long' }).format(start).toLowerCase();
  }

  protected availabilityMatchesSelectedSlot(slot: TeacherAvailabilityItem): boolean {
    if (!this.scheduleForm.startTime) {
      return false;
    }

    const start = this.dateTime.localDateTimeToUtc(this.scheduleForm.startTime, this.scheduleForm.timezone);
    const slotDay = new Intl.DateTimeFormat('en-US', { timeZone: slot.timezone, weekday: 'long' }).format(start).toLowerCase();

    return slot.dayOfWeek === slotDay;
  }

  protected conflictDetail(conflict: SchedulingConflict): string {
    if (!conflict.details?.title) {
      return '';
    }
    return `: ${conflict.details.title}`;
  }

  protected isStartTimeInPast(): boolean {
    if (!this.scheduleForm.startTime) {
      return false;
    }

    return this.dateTime.localDateTimeToUtc(this.scheduleForm.startTime, this.scheduleForm.timezone).getTime() <= Date.now();
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

  protected timePreview(): TimePreview[] {
    if (!this.scheduleForm.startTime) {
      return [];
    }

    try {
      const start = this.dateTime.localDateTimeToUtc(this.scheduleForm.startTime, this.scheduleForm.timezone);
      const end = new Date(start.getTime() + Number(this.scheduleForm.durationMinutes) * 60 * 1000);
      const teacherTimezone = this.selectedTeacher()?.timezone ?? this.selectedTeacherAvailability()[0]?.timezone ?? this.scheduleForm.timezone;
      const studentTimezone = this.selectedStudent()?.timezone ?? this.scheduleForm.timezone;

      return [
        {
          label: 'Teacher joins at',
          timezone: teacherTimezone,
          value: this.dateTime.formatTimeRange(start, end, teacherTimezone)
        },
        {
          label: 'Student joins at',
          timezone: studentTimezone,
          value: this.dateTime.formatTimeRange(start, end, studentTimezone)
        },
        {
          label: 'Admin selected',
          timezone: this.scheduleForm.timezone,
          value: this.dateTime.formatTimeRange(start, end, this.scheduleForm.timezone)
        },
        {
          label: 'Stored in system',
          timezone: 'UTC',
          value: this.dateTime.formatTimeRange(start, end, 'UTC'),
          muted: true
        }
      ];
    } catch {
      return [];
    }
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
          this.scheduleMessage.set(response.data.videoMeeting?.roomUrl ? 'Class scheduled successfully. Daily room link is ready.' : 'Class scheduled successfully.');
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
      startTime: '',
      durationMinutes: 60,
      timezone: this.adminTimezone()
    };
    this.updateMinimumStartDateTime();
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

  private updateMinimumStartDateTime(): void {
    this.minimumStartDateTime.set(this.dateTime.toLocalInputValue(new Date(Date.now() + 60 * 1000), this.scheduleForm.timezone));
  }

  private applyRecommendedScheduleTimezone(): void {
    const current = this.scheduleForm.timezone;
    const validTimezones = this.scheduleTimezoneOptions().map((option) => option.value);

    if (validTimezones.includes(current)) {
      return;
    }

    this.scheduleForm.timezone = this.selectedTeacher()?.timezone ?? this.selectedStudent()?.timezone ?? this.adminTimezone();
    this.updateMinimumStartDateTime();
  }
}


