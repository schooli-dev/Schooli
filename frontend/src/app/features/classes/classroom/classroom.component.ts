import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AttendanceApiService, AttendanceStatus } from '../../../core/attendance/attendance-api.service';
import { AuthTokenService } from '../../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../../core/classes/classes-api.service';
import { RuntimeConfigService } from '../../../core/config/runtime-config.service';
import { DailyApiService } from '../../../core/daily/daily-api.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-classroom',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './classroom.component.html',
  styleUrl: './classroom.component.scss'
})
export class ClassroomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('classroomPage') private classroomPage?: ElementRef<HTMLElement>;
  @ViewChild('dailyRoot') private dailyRoot?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly classesApi = inject(ClassesApiService);
  private readonly dailyApi = inject(DailyApiService);
  private readonly attendanceApi = inject(AttendanceApiService);
  private readonly auth = inject(AuthTokenService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly toasts = inject(ToastService);

  protected readonly classItem = signal<ClassListItem | null>(null);
  protected readonly sdkMessage = signal('Preparing Daily classroom...');
  protected readonly sdkError = signal('');
  protected readonly user = this.auth.getUser();

  protected readonly studentName = computed(() => this.classItem()?.participants[0]?.studentName ?? 'Student');
  protected readonly attendanceStatus = computed(() => this.classItem()?.participants[0]?.attendanceStatus ?? 'pending');
  protected readonly canMarkAttendance = computed(() => Boolean(this.user?.roles.includes('teacher') || this.user?.roles.includes('admin')));
  protected readonly attendancePosition = signal({ x: 16, y: 16 });

  private sdkStarted = false;
  private hasJoinedMeeting = false;
  private cleanupStarted = false;
  private dailyFrame?: any;
  private dragState: { pointerId: number; offsetX: number; offsetY: number } | null = null;

  ngOnInit(): void {
    const classId = this.route.snapshot.paramMap.get('id');
    if (!classId) {
      this.sdkError.set('Class id is missing.');
      return;
    }

    this.classesApi.getClass(classId).subscribe({
      next: (response) => {
        this.classItem.set(response.data);
        void this.startDailyIfReady();
      },
      error: () => {
        this.sdkMessage.set('');
        this.sdkError.set('Could not load this class.');
      }
    });
  }

  ngAfterViewInit(): void {
    void this.startDailyIfReady();
  }

  ngOnDestroy(): void {
    void this.cleanupMeetingSession();
  }

  @HostListener('window:beforeunload')
  protected onBeforeUnload(): void {
    this.sendLeaveBeacon();
  }

  @HostListener('window:pointermove', ['$event'])
  protected onAttendanceDrag(event: PointerEvent): void {
    if (!this.dragState) {
      return;
    }

    event.preventDefault();
    this.moveAttendanceWidget(event.clientX, event.clientY);
  }

  @HostListener('window:pointerup')
  @HostListener('window:pointercancel')
  protected stopAttendanceDrag(): void {
    this.dragState = null;
  }

  protected backLink(): string {
    return this.user?.roles.includes('teacher') ? '/teacher/classes' : '/student/classes';
  }

  protected startAttendanceDrag(event: PointerEvent): void {
    const target = event.currentTarget as HTMLElement;
    const widget = target.closest<HTMLElement>('.attendance-widget');

    if (!widget || event.button !== 0) {
      return;
    }

    const rect = widget.getBoundingClientRect();
    this.dragState = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top
    };
    target.setPointerCapture?.(event.pointerId);
  }

  protected markAttendance(status: AttendanceStatus): void {
    const item = this.classItem();
    const student = item?.participants[0];

    if (!item || !student) {
      return;
    }

    this.attendanceApi
      .markAttendance({
        classId: item.id,
        studentId: student.studentId,
        status
      })
      .subscribe({
        next: () => {
          this.toasts.success(`Attendance marked ${status}.`);
          this.classItem.update((current) => {
            if (!current) {
              return current;
            }
            return {
              ...current,
              participants: current.participants.map((participant) =>
                participant.studentId === student.studentId ? { ...participant, attendanceStatus: status } : participant
              )
            };
          });
        },
        error: () => this.toasts.error('Could not update attendance.')
      });
  }

  private async startDailyIfReady(): Promise<void> {
    const item = this.classItem();
    const root = this.dailyRoot?.nativeElement;

    if (this.sdkStarted || !item || !root) {
      return;
    }

    if (!item.videoMeeting?.roomUrl) {
      this.sdkMessage.set('');
      this.sdkError.set('Daily room has not been created for this class.');
      return;
    }

    try {
      this.sdkStarted = true;
      this.sdkMessage.set('Joining Daily classroom inside SchooliEdu...');
      const role: 0 | 1 = this.canMarkAttendance() ? 1 : 0;
      const joinPayload = await firstValueFrom(this.dailyApi.joinRoom(item.id, role));
      await this.startEmbeddedDaily(root, joinPayload.data);
      this.sdkMessage.set('');
    } catch (error) {
      this.sdkStarted = false;
      this.sdkMessage.set('');
      this.sdkError.set(this.getJoinErrorMessage(error));
    }
  }

  private getJoinErrorMessage(error: unknown): string {
    const apiMessage =
      typeof error === 'object' && error !== null && 'error' in error
        ? (error as { error?: { message?: string; error?: { message?: string } } }).error?.message ??
          (error as { error?: { error?: { message?: string } } }).error?.error?.message
        : null;

    if (apiMessage) {
      return apiMessage;
    }

    return 'Embedded Daily classroom could not start. Please check Daily credentials and browser permissions.';
  }

  private async startEmbeddedDaily(
    root: HTMLElement,
    joinPayload: { roomUrl: string; token: string }
  ): Promise<void> {
    const module = await import('@daily-co/daily-js');
    const DailyIframe = module.default ?? module;
    root.replaceChildren();
    root.style.minHeight = `${Math.max(root.closest('.meeting-panel')?.clientHeight ?? 0, 440)}px`;

    const frame = DailyIframe.createFrame(root, {
      showLeaveButton: true,
      iframeStyle: {
        width: '100%',
        height: '100%',
        border: '0',
        borderRadius: '0'
      }
    });

    this.dailyFrame = frame;

    frame.on('joined-meeting', () => {
      this.hasJoinedMeeting = true;
    });

    frame.on('left-meeting', () => {
      void this.cleanupMeetingSession();
    });

    void Promise.resolve(frame.join({
      url: joinPayload.roomUrl,
      token: joinPayload.token,
      userName: this.user ? `${this.user.firstName} ${this.user.lastName}`.trim() : 'Schooli User'
    })).catch((error) => {
      this.sdkMessage.set('');
      this.sdkError.set(this.getJoinErrorMessage(error));
    });
  }

  private async cleanupMeetingSession(): Promise<void> {
    if (this.cleanupStarted) {
      return;
    }

    this.cleanupStarted = true;
    this.sdkStarted = false;
    const item = this.classItem();
    const role: 0 | 1 = this.canMarkAttendance() ? 1 : 0;
    const shouldReleaseSession = this.hasJoinedMeeting;

    try {
      if (this.hasJoinedMeeting && this.dailyFrame) {
        await Promise.resolve(this.dailyFrame.leave());
      }
    } catch {
      // Route changes should continue even if Daily has already disconnected.
    } finally {
      this.hasJoinedMeeting = false;
      this.dailyFrame?.destroy?.();
      this.dailyFrame = undefined;
    }

    if (!item || !shouldReleaseSession) {
      return;
    }

    try {
      await firstValueFrom(this.dailyApi.leaveRoom(item.id, role));
    } catch {
      this.sendLeaveBeacon(item.id, role);
    }
  }

  private sendLeaveBeacon(classId = this.classItem()?.id, role: 0 | 1 = this.canMarkAttendance() ? 1 : 0): void {
    const token = this.auth.getAccessToken();

    if (!classId || !token) {
      return;
    }

    void fetch(`${this.runtimeConfig.apiBaseUrl}/classes/${classId}/daily/leave`, {
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    }).catch(() => undefined);
  }

  private moveAttendanceWidget(clientX: number, clientY: number): void {
    const container = this.classroomPage?.nativeElement;
    const containerRect = container?.getBoundingClientRect();

    if (!containerRect || !this.dragState) {
      return;
    }

    const margin = 12;
    const widgetWidth = Math.min(340, containerRect.width - margin * 2);
    const widgetHeight = 142;
    const x = clientX - containerRect.left - this.dragState.offsetX;
    const y = clientY - containerRect.top - this.dragState.offsetY;
    const maxX = Math.max(margin, containerRect.width - widgetWidth - margin);
    const maxY = Math.max(margin, containerRect.height - widgetHeight - margin);

    this.attendancePosition.set({
      x: Math.min(Math.max(x, margin), maxX),
      y: Math.min(Math.max(y, margin), maxY)
    });
  }
}
