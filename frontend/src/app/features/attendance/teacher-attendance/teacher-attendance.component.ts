import { CommonModule, DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AttendanceApiService,
  AttendanceRecord,
  AttendanceRecordStatus,
  AttendanceStatus
} from '../../../core/attendance/attendance-api.service';
import { ToastService } from '../../../core/toast/toast.service';

type AttendanceTab = 'today' | 'pending' | 'completed' | 'all';
type DateRangeFilter = 'today' | '7days' | '30days' | 'all';
type FinalStatusFilter = AttendanceRecordStatus | 'any';

const pageSize = 10;

@Component({
  selector: 'app-teacher-attendance',
  standalone: true,
  imports: [CommonModule, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './teacher-attendance.component.html',
  styleUrl: './teacher-attendance.component.scss'
})
export class TeacherAttendanceComponent implements OnInit {
  protected readonly records = signal<AttendanceRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly activeTab = signal<AttendanceTab>('today');
  protected readonly selectedRecord = signal<AttendanceRecord | null>(null);
  protected readonly pagination = signal({ page: 1, limit: pageSize, total: 0, totalPages: 1 });

  protected dateRange: DateRangeFilter = 'today';
  protected classFilter = '';
  protected statusFilter: FinalStatusFilter = 'any';
  protected notes = '';
  protected selectedStatus: AttendanceStatus = 'present';

  protected readonly classOptions = computed(() => {
    const seen = new Map<string, string>();

    for (const record of this.records()) {
      seen.set(record.classId, record.classTitle);
    }

    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  });

  protected readonly stats = computed(() => {
    const records = this.records();
    const total = records.length;
    const pending = records.filter((record) => record.status === 'pending').length;
    const present = records.filter((record) => record.status === 'present').length;
    const absent = records.filter((record) => record.status === 'absent').length;
    const late = records.filter((record) => record.status === 'late').length;
    const excused = records.filter((record) => record.status === 'excused').length;

    return {
      todayClasses: total,
      pending,
      presentPercent: this.percent(present, total),
      absentPercent: this.percent(absent, total),
      latePercent: this.percent(late, total),
      excusedPercent: this.percent(excused, total)
    };
  });

  constructor(
    private readonly attendanceApi: AttendanceApiService,
    private readonly toasts: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAttendance(1);
  }

  protected setTab(tab: AttendanceTab): void {
    this.activeTab.set(tab);

    if (tab === 'today') {
      this.dateRange = 'today';
      this.statusFilter = 'any';
    } else if (tab === 'pending') {
      this.statusFilter = 'pending';
    } else if (tab === 'completed') {
      this.statusFilter = 'any';
    } else {
      this.statusFilter = 'any';
      this.dateRange = 'all';
    }

    this.loadAttendance(1);
  }

  protected applyFilters(): void {
    this.loadAttendance(1);
  }

  protected clearFilters(): void {
    this.activeTab.set('today');
    this.dateRange = 'today';
    this.classFilter = '';
    this.statusFilter = 'any';
    this.loadAttendance(1);
  }

  protected openVerify(record: AttendanceRecord): void {
    this.selectedRecord.set(record);
    this.selectedStatus = this.suggestStatus(record);
    this.notes = record.teacherNotes ?? '';
  }

  protected closeVerify(): void {
    if (this.saving()) {
      return;
    }

    this.selectedRecord.set(null);
    this.notes = '';
  }

  protected saveAttendance(): void {
    const record = this.selectedRecord();

    if (!record) {
      return;
    }

    this.saving.set(true);
    this.attendanceApi
      .updateAttendance(record.id, {
        status: this.selectedStatus,
        teacherNotes: this.notes.trim() || null
      })
      .subscribe({
        next: (response) => {
          this.records.update((records) => records.map((item) => (item.id === record.id ? response.data : item)));
          this.toasts.success('Attendance updated successfully.');
          this.saving.set(false);
          this.closeVerify();
        },
        error: () => {
          this.toasts.error('Could not update attendance.');
        },
        complete: () => this.saving.set(false)
      });
  }

  protected goToPage(page: number): void {
    const meta = this.pagination();

    if (page < 1 || page > meta.totalPages || page === meta.page) {
      return;
    }

    this.loadAttendance(page);
  }

  protected suggestedLabel(record: AttendanceRecord): string {
    return this.titleCase(this.suggestStatus(record));
  }

  protected suggestStatus(record: AttendanceRecord): AttendanceStatus {
    const minutes = this.evidenceMinutes(record);
    const scheduledMinutes = this.scheduledMinutes(record);

    if (minutes === null || minutes <= 0) {
      return 'absent';
    }

    if (minutes < Math.max(15, scheduledMinutes * 0.6)) {
      return 'late';
    }

    return 'present';
  }

  protected evidenceText(record: AttendanceRecord): string {
    const evidence = record.zoomEvidence;

    if (!evidence.firstJoinTime) {
      return 'No session data found';
    }

    const join = this.formatTime(evidence.firstJoinTime);
    const leave = evidence.lastLeaveTime ? this.formatTime(evidence.lastLeaveTime) : 'still connected';
    const minutes = this.evidenceMinutes(record);

    return `Joined ${join}, Left ${leave}${minutes === null ? '' : ` (${minutes} min)`}`;
  }

  protected evidenceTone(record: AttendanceRecord): string {
    const status = this.suggestStatus(record);

    return status;
  }

  protected statusTone(status: AttendanceRecordStatus): string {
    return status;
  }

  protected titleCase(value: string): string {
    return value
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  protected hasCompletedStatus(record: AttendanceRecord): boolean {
    return record.status !== 'pending';
  }

  private loadAttendance(page: number): void {
    this.loading.set(true);
    const range = this.getDateRange();
    const status = this.getApiStatus();

    this.attendanceApi
      .listAttendance({
        page,
        limit: pageSize,
        classId: this.classFilter || undefined,
        status,
        from: range.from,
        to: range.to
      })
      .subscribe({
        next: (response) => {
          const data = this.activeTab() === 'completed'
            ? response.data.filter((record) => record.status !== 'pending')
            : response.data;
          this.records.set(data);
          this.pagination.set(response.pagination ?? { page, limit: pageSize, total: data.length, totalPages: 1 });
        },
        error: () => {
          this.toasts.error('Could not load attendance records.');
        },
        complete: () => {
          this.loading.set(false);
        }
      });
  }

  private getApiStatus(): AttendanceRecordStatus | undefined {
    if (this.statusFilter !== 'any') {
      return this.statusFilter;
    }

    if (this.activeTab() === 'pending') {
      return 'pending';
    }

    return undefined;
  }

  private getDateRange(): { from?: string; to?: string } {
    if (this.dateRange === 'all') {
      return {};
    }

    const now = new Date();
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    if (this.dateRange === '7days') {
      start.setDate(start.getDate() - 6);
    }

    if (this.dateRange === '30days') {
      start.setDate(start.getDate() - 29);
    }

    return {
      from: start.toISOString(),
      to: end.toISOString()
    };
  }

  private evidenceMinutes(record: AttendanceRecord): number | null {
    if (record.totalZoomMinutes !== null) {
      return record.totalZoomMinutes;
    }

    const firstJoin = record.zoomEvidence.firstJoinTime;
    const lastLeave = record.zoomEvidence.lastLeaveTime;

    if (!firstJoin || !lastLeave) {
      return null;
    }

    return Math.max(0, Math.round((new Date(lastLeave).getTime() - new Date(firstJoin).getTime()) / 60000));
  }

  private scheduledMinutes(record: AttendanceRecord): number {
    return Math.max(1, Math.round((new Date(record.classEndTime).getTime() - new Date(record.classStartTime).getTime()) / 60000));
  }

  private formatTime(value: string): string {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    }).format(new Date(value));
  }

  private percent(value: number, total: number): number {
    return total ? Math.round((value / total) * 100) : 0;
  }
}
