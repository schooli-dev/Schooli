import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AcademicOutcome,
  AttendanceApiService,
  AttendanceContinuation,
  AttendanceStatus,
  MarkAttendanceRequest
} from '../../../core/attendance/attendance-api.service';
import { AuthTokenService } from '../../../core/auth/auth-token.service';
import { LearningMaterialsApiService, LessonDetail } from '../../../core/learning-materials/learning-materials-api.service';

/** What the dialog needs to mark one student in one class (from the classroom or the Attendance page). */
export type MarkAttendanceTarget = {
  classId: string;
  title: string;
  studentId: string;
  studentName: string;
  curriculumLessonId: string | null;
};

/**
 * Combined Attendance + Class Outcome dialog opened from the classroom's Mark Attendance action.
 * Attendance (Present / Absent) is separate from the academic outcome, which only exists when Present.
 */
@Component({
  selector: 'app-mark-attendance-dialog',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './mark-attendance-dialog.component.html',
  styleUrl: './mark-attendance-dialog.component.scss'
})
export class MarkAttendanceDialogComponent implements OnInit {
  @Input({ required: true }) target!: MarkAttendanceTarget;
  @Output() saved = new EventEmitter<AttendanceStatus>();
  @Output() closed = new EventEmitter<void>();

  private readonly attendanceApi = inject(AttendanceApiService);
  private readonly learningMaterialsApi = inject(LearningMaterialsApiService);
  private readonly auth = inject(AuthTokenService);

  protected readonly lesson = signal<LessonDetail | null>(null);
  protected readonly continuation = signal<AttendanceContinuation | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected attendance: '' | 'present' | 'absent' = '';
  protected outcome: '' | AcademicOutcome = '';
  protected absenceNote = '';

  protected readonly outcomes: Array<{ value: AcademicOutcome; label: string; hint: string }> = [
    { value: 'completed', label: 'Completed', hint: 'The curriculum class was fully taught.' },
    { value: 'partially_completed', label: 'Partially Completed', hint: 'Taught, but part of it is unfinished.' },
    { value: 'continue_next_class', label: 'Continue Next Class', hint: 'Continue this same class next session.' }
  ];

  protected student() {
    return this.target;
  }

  ngOnInit(): void {
    const student = this.student();
    this.attendanceApi.listClassAttendance(this.target.classId).subscribe({
      next: (response) => {
        const record = response.data.find((item) => item.studentId === student?.studentId);
        this.continuation.set(record?.continuation ?? null);
        // Reopening after a save: show what was recorded.
        if (record && (record.status === 'present' || record.status === 'absent')) {
          this.attendance = record.status;
          this.outcome = record.academicOutcome ?? '';
          if (record.status === 'absent') this.absenceNote = record.teacherNotes ?? '';
        }
      },
      error: () => undefined
    });

    const lessonId = this.target.curriculumLessonId;
    if (!lessonId) return;
    const request = this.auth.getUser()?.roles.includes('teacher')
      ? this.learningMaterialsApi.getMyClass(lessonId)
      : this.learningMaterialsApi.getLesson(lessonId);
    request.subscribe({ next: (response) => this.lesson.set(response.data), error: () => undefined });
  }

  protected save(): void {
    const student = this.student();
    if (!student || this.saving()) return;

    const payload = this.buildPayload(student.studentId);
    if (!payload) return;

    this.saving.set(true);
    this.error.set('');
    this.attendanceApi.markAttendance(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.saved.emit(payload.status);
      },
      error: (error) => {
        this.saving.set(false);
        this.error.set(error?.error?.message ?? 'Could not save attendance. Please try again.');
      }
    });
  }

  private buildPayload(studentId: string): MarkAttendanceRequest | null {
    if (!this.attendance) {
      this.error.set('Select Present or Absent.');
      return null;
    }

    if (this.attendance === 'absent') {
      return { classId: this.target.classId, studentId, status: 'absent', teacherNotes: this.absenceNote.trim() || null };
    }

    if (!this.outcome) {
      this.error.set('Select a class outcome.');
      return null;
    }

    return { classId: this.target.classId, studentId, status: 'present', academicOutcome: this.outcome, homeworkType: 'none' };
  }
}
