import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';
import { DateTimeService } from '../../core/datetime/date-time.service';
import { TeacherAvailabilityApiService, TeacherAvailabilityItem } from '../../core/teachers/teacher-availability-api.service';

@Component({
  selector: 'app-teacher-dashboard',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './teacher-dashboard.component.html',
  styleUrl: './teacher-dashboard.component.scss'
})
export class TeacherDashboardComponent implements OnInit {
  private readonly authToken = inject(AuthTokenService);
  private readonly classesApi = inject(ClassesApiService);
  private readonly availabilityApi = inject(TeacherAvailabilityApiService);
  private readonly dateTime = inject(DateTimeService);

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
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.userTimezone(),
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `${formatter.format(new Date(item.startTime))} - ${formatter.format(new Date(item.endTime))}`;
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

  private dateKey(value: Date | string): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: this.userTimezone(),
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(value));
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