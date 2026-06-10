import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AttendanceApiService, AttendanceStatus } from '../../core/attendance/attendance-api.service';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';
import { RuntimeConfigService } from '../../core/config/runtime-config.service';
import { ToastService } from '../../core/toast/toast.service';
import { ZoomApiService } from '../../core/zoom/zoom-api.service';

@Component({
  selector: 'app-classroom',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="classroom-shell">
      <header class="classroom-header">
        <div>
          <p class="section-kicker mb-1">Live Classroom</p>
          <h1>{{ classItem()?.title ?? 'Classroom' }}</h1>
          <p>{{ classItem()?.teacherName ?? 'Preparing meeting room...' }}</p>
        </div>
        <a class="btn btn-outline-secondary fw-bold" [routerLink]="backLink()">Back to classes</a>
      </header>

      <div class="classroom-grid">
        <main class="meeting-panel">
          @if (sdkMessage()) {
            <div class="meeting-state">
              <div class="spinner-border text-primary" aria-hidden="true"></div>
              <strong>{{ sdkMessage() }}</strong>
              @if (sdkError()) {
                <p>{{ sdkError() }}</p>
                @if (classItem()?.zoomMeeting?.joinUrl) {
                  <a class="btn btn-primary" [href]="classItem()!.zoomMeeting!.joinUrl!" target="_blank" rel="noopener noreferrer">Open Zoom fallback</a>
                }
              }
            </div>
          }
          <div #zoomRoot class="zoom-root" [class.is-hidden]="sdkError()"></div>
        </main>

        <aside class="class-side-panel">
          <article class="panel">
            <div class="panel__header"><h2>Session</h2></div>
            <div class="room-detail"><span>Teacher</span><strong>{{ classItem()?.teacherName ?? '--' }}</strong></div>
            <div class="room-detail"><span>Student</span><strong>{{ studentName() }}</strong></div>
            <div class="room-detail"><span>Zoom</span><strong>{{ classItem()?.zoomMeeting?.creationStatus ?? 'pending' }}</strong></div>
          </article>

          @if (canMarkAttendance()) {
            <article class="panel attendance-panel">
              <div class="panel__header"><h2>Attendance</h2></div>
              <div class="attendance-actions">
                <button class="btn btn-outline-success" type="button" (click)="markAttendance('present')">Present</button>
                <button class="btn btn-outline-warning" type="button" (click)="markAttendance('late')">Late</button>
                <button class="btn btn-outline-danger" type="button" (click)="markAttendance('absent')">Absent</button>
                <button class="btn btn-outline-secondary" type="button" (click)="markAttendance('excused')">Excused</button>
              </div>
              <label class="notes-label">
                Notes
                <textarea class="form-control" rows="4" [(ngModel)]="teacherNotes" placeholder="Optional attendance note"></textarea>
              </label>
            </article>
          }
        </aside>
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
      min-height: calc(100dvh - 136px);
    }

    .classroom-shell {
      display: grid;
      gap: 18px;
    }

    .classroom-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }

    .classroom-header h1 {
      margin: 0;
      font-size: clamp(28px, 3vw, 40px);
    }

    .classroom-header p:last-child {
      margin: 6px 0 0;
      color: var(--color-muted);
    }

    .classroom-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(280px, 360px);
      gap: 18px;
      align-items: stretch;
    }

    .meeting-panel {
      position: relative;
      min-height: min(720px, calc(100dvh - 210px));
      overflow: hidden;
      border: 1px solid var(--color-border);
      border-radius: 18px;
      background: #0f172a;
    }

    .zoom-root {
      width: 100%;
      height: 100%;
      min-height: inherit;
      background: #111827;
    }

    .zoom-root :global(.meeting-client),
    .zoom-root :global(.meeting-client-inner),
    .zoom-root :global(.meeting-app),
    .zoom-root :global(.meeting-app__meeting),
    .zoom-root :global(.video-layout),
    .zoom-root :global(.video-avatar__avatar),
    .zoom-root :global(.gallery-video-container__main-view),
    .zoom-root :global(.speaker-active-container__main-view) {
      width: 100% !important;
      height: 100% !important;
      min-width: 100% !important;
      min-height: 100% !important;
    }

    .zoom-root.is-hidden {
      display: none;
    }

    .meeting-state {
      position: absolute;
      inset: 0;
      z-index: 2;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 12px;
      padding: 24px;
      color: #fff;
      text-align: center;
      background: rgba(15, 23, 42, 0.9);
    }

    .meeting-state p {
      max-width: 520px;
      margin: 0;
      color: rgba(255, 255, 255, 0.78);
    }

    .class-side-panel {
      display: grid;
      align-content: start;
      gap: 18px;
    }

    .room-detail {
      display: grid;
      gap: 4px;
      border-bottom: 1px solid var(--color-border-soft);
      padding: 14px 18px;
    }

    .room-detail span {
      color: var(--color-muted);
      font-size: 12px;
      font-weight: 800;
      text-transform: uppercase;
    }

    .attendance-actions {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
      padding: 18px;
    }

    .notes-label {
      display: grid;
      gap: 8px;
      padding: 0 18px 18px;
      font-weight: 800;
    }

    @media (max-width: 991.98px) {
      .classroom-grid {
        grid-template-columns: 1fr;
      }

      .meeting-panel {
        min-height: 72dvh;
      }
    }

    @media (max-width: 560px) {
      .classroom-header {
        display: grid;
      }

      .meeting-panel {
        min-height: 68dvh;
        border-radius: 12px;
      }
    }
  `
})
export class ClassroomComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('zoomRoot') private zoomRoot?: ElementRef<HTMLElement>;

  private readonly route = inject(ActivatedRoute);
  private readonly classesApi = inject(ClassesApiService);
  private readonly zoomApi = inject(ZoomApiService);
  private readonly attendanceApi = inject(AttendanceApiService);
  private readonly auth = inject(AuthTokenService);
  private readonly runtimeConfig = inject(RuntimeConfigService);
  private readonly toasts = inject(ToastService);

  protected readonly classItem = signal<ClassListItem | null>(null);
  protected readonly sdkMessage = signal('Preparing Zoom classroom...');
  protected readonly sdkError = signal('');
  protected readonly user = this.auth.getUser();
  protected teacherNotes = '';

  protected readonly studentName = computed(() => this.classItem()?.participants[0]?.studentName ?? 'Student');
  protected readonly canMarkAttendance = computed(() => Boolean(this.user?.roles.includes('teacher') || this.user?.roles.includes('admin')));

  private sdkStarted = false;
  private hasJoinedMeeting = false;
  private cleanupStarted = false;
  private zoomClient?: any;
  private resizeObserver?: ResizeObserver;

  ngOnInit(): void {
    const classId = this.route.snapshot.paramMap.get('id');
    if (!classId) {
      this.sdkError.set('Class id is missing.');
      return;
    }

    this.classesApi.getClass(classId).subscribe({
      next: (response) => {
        this.classItem.set(response.data);
        void this.startZoomIfReady();
      },
      error: () => {
        this.sdkMessage.set('');
        this.sdkError.set('Could not load this class.');
      }
    });
  }

  ngAfterViewInit(): void {
    void this.startZoomIfReady();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    void this.cleanupMeetingSession();
  }

  @HostListener('window:beforeunload')
  protected onBeforeUnload(): void {
    this.sendLeaveBeacon();
  }

  protected backLink(): string {
    return this.user?.roles.includes('teacher') ? '/teacher/classes' : '/student/classes';
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
        status,
        teacherNotes: this.teacherNotes || null
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
        }
      });
  }

  private async startZoomIfReady(): Promise<void> {
    const item = this.classItem();
    const root = this.zoomRoot?.nativeElement;

    if (this.sdkStarted || !item || !root) {
      return;
    }

    if (!item.zoomMeeting?.zoomMeetingId) {
      this.sdkMessage.set('');
      this.sdkError.set('Zoom meeting has not been created for this class.');
      return;
    }

    try {
      this.sdkStarted = true;
      this.sdkMessage.set('Joining Zoom inside SchooliEdu...');
      const role: 0 | 1 = this.canMarkAttendance() ? 1 : 0;
      const signature = await firstValueFrom(this.zoomApi.getSignature(item.id, role));
      await this.startEmbeddedZoom(root, item, signature.data);
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

    return 'Embedded Zoom could not start. Please check Meeting SDK credentials and browser permissions.';
  }

  private async startEmbeddedZoom(
    root: HTMLElement,
    item: ClassListItem,
    signature: { sdkKey: string; signature: string; meetingNumber: string; password?: string | null; zak?: string; role: 0 | 1 }
  ): Promise<void> {
    const module = (await import('@zoom/meetingsdk/embedded')) as any;
    const ZoomMtgEmbedded = module.default ?? module;
    const client = ZoomMtgEmbedded.createClient();
    this.zoomClient = client;
    const viewSize = this.getZoomViewSize(root);

    await client.init({
      zoomAppRoot: root,
      language: 'en-US',
      patchJsMedia: true,
      customize: {
        video: {
          isResizable: true,
          viewSizes: {
            default: {
              width: viewSize.width,
              height: viewSize.height
            },
            ribbon: {
              width: viewSize.width,
              height: viewSize.height
            }
          }
        }
      }
    });

    await client.join({
      signature: signature.signature,
      meetingNumber: signature.meetingNumber,
      password: signature.password ?? item.zoomMeeting?.zoomPassword ?? '',
      userName: this.user ? `${this.user.firstName} ${this.user.lastName}`.trim() : 'Schooli User',
      userEmail: this.user?.email,
      ...(signature.zak ? { zak: signature.zak } : {})
    });
    this.hasJoinedMeeting = true;
    this.observeZoomResize(root);
    this.resizeZoom(root);
  }

  private async cleanupMeetingSession(): Promise<void> {
    if (this.cleanupStarted) {
      return;
    }

    this.cleanupStarted = true;
    this.sdkStarted = false;
    const item = this.classItem();
    const role: 0 | 1 = this.canMarkAttendance() ? 1 : 0;

    try {
      if (this.hasJoinedMeeting && this.zoomClient) {
        if (role === 1 && typeof this.zoomClient.endMeeting === 'function') {
          await Promise.resolve(this.zoomClient.endMeeting());
        } else if (typeof this.zoomClient.leaveMeeting === 'function') {
          await Promise.resolve(this.zoomClient.leaveMeeting());
        }
      }
    } catch {
      // Route changes should continue even if the Zoom SDK has already disconnected.
    } finally {
      this.hasJoinedMeeting = false;
      this.zoomClient = undefined;
    }

    if (!item) {
      return;
    }

    try {
      await firstValueFrom(this.zoomApi.leaveRoom(item.id, role));
    } catch {
      this.sendLeaveBeacon(item.id, role);
    }
  }

  private sendLeaveBeacon(classId = this.classItem()?.id, role: 0 | 1 = this.canMarkAttendance() ? 1 : 0): void {
    const token = this.auth.getAccessToken();

    if (!classId || !token) {
      return;
    }

    void fetch(`${this.runtimeConfig.apiBaseUrl}/classes/${classId}/zoom/leave`, {
      method: 'POST',
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ role })
    }).catch(() => undefined);
  }

  private getZoomViewSize(root: HTMLElement): { width: number; height: number } {
    const rect = root.getBoundingClientRect();

    return {
      width: Math.max(640, Math.floor(rect.width || root.parentElement?.clientWidth || window.innerWidth * 0.7)),
      height: Math.max(520, Math.floor(rect.height || root.parentElement?.clientHeight || window.innerHeight * 0.7))
    };
  }

  private observeZoomResize(root: HTMLElement): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = new ResizeObserver(() => this.resizeZoom(root));
    this.resizeObserver.observe(root);
  }

  private resizeZoom(root: HTMLElement): void {
    const viewSize = this.getZoomViewSize(root);
    this.zoomClient?.updateVideoOptions?.({
      isResizable: true,
      viewSizes: {
        default: viewSize,
        ribbon: viewSize
      }
    });
  }
}
