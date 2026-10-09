import { Component, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AcademicOutcome,
  AttendanceApiService,
  AttendanceContinuation,
  AttendanceHomeworkType,
  AttendanceStatus,
  MarkAttendanceRequest
} from '../../../core/attendance/attendance-api.service';
import { AuthTokenService } from '../../../core/auth/auth-token.service';
import { CustomHomeworkDraft } from '../../../core/homework/homework-api.service';
import { LearningMaterial, LearningMaterialsApiService, LessonDetail } from '../../../core/learning-materials/learning-materials-api.service';
import { CustomHomeworkFormComponent } from './custom-homework-form.component';

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
  imports: [FormsModule, CustomHomeworkFormComponent],
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
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal('');

  protected attendance: '' | 'present' | 'absent' = '';
  protected outcome: '' | AcademicOutcome = '';
  protected absenceNote = '';
  protected homeworkType: AttendanceHomeworkType = 'none';
  protected readonly selectedMaterialIds = signal<string[]>([]);
  protected homeworkDueDate = '';

  // Custom homework: the filled-in form (created for this student when attendance is saved), or
  // the homework already assigned by an earlier save of this same attendance.
  protected readonly customHomework = signal<CustomHomeworkDraft | null>(null);
  protected readonly existingHomework = signal<{ id: string; title: string } | null>(null);
  protected readonly homeworkFormOpen = signal(false);

  protected readonly outcomes: Array<{ value: AcademicOutcome; label: string; hint: string }> = [
    { value: 'completed', label: 'Completed', hint: 'The curriculum class was fully taught.' },
    { value: 'partially_completed', label: 'Partially Completed', hint: 'Taught, but part of it is unfinished.' },
    { value: 'continue_next_class', label: 'Continue Next Class', hint: 'Continue this same class next session.' }
  ];

  protected readonly homeworkMaterials = computed<LearningMaterial[]>(() =>
    (this.lesson()?.materials ?? []).filter((material) => material.section === 'homework')
  );

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
          this.homeworkType = record.homeworkType;
          this.selectedMaterialIds.set(record.assignedHomework.filter((item) => item.type === 'curriculum' && item.materialId).map((item) => item.materialId!));
          const custom = record.assignedHomework.find((item) => item.type === 'custom');
          if (custom) this.existingHomework.set({ id: custom.id, title: custom.title });
          if (record.status === 'absent') this.absenceNote = record.teacherNotes ?? '';
        }
      },
      error: () => undefined
    });

    const lessonId = this.target.curriculumLessonId;
    if (!lessonId) {
      this.loading.set(false);
      return;
    }
    const request = this.auth.getUser()?.roles.includes('teacher')
      ? this.learningMaterialsApi.getMyClass(lessonId)
      : this.learningMaterialsApi.getLesson(lessonId);
    request.subscribe({
      next: (response) => {
        this.lesson.set(response.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false)
    });
  }

  protected isSelected(id: string): boolean {
    return this.selectedMaterialIds().includes(id);
  }

  protected toggleMaterial(id: string): void {
    this.selectedMaterialIds.update((ids) => (ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]));
  }

  /** Picking "Create Custom Homework" opens the form straight away (unless one is already filled in). */
  protected onCustomHomeworkSelected(): void {
    if (!this.customHomework() && !this.existingHomework()) this.homeworkFormOpen.set(true);
  }

  protected onHomeworkAssigned(draft: CustomHomeworkDraft): void {
    this.customHomework.set(draft);
    this.homeworkFormOpen.set(false);
    this.error.set('');
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
    if (this.homeworkType === 'curriculum' && !this.selectedMaterialIds().length) {
      this.error.set('Choose at least one curriculum homework, or switch to another homework option.');
      return null;
    }
    if (this.homeworkType === 'custom' && !this.customHomework() && !this.existingHomework()) {
      this.error.set('Fill in the custom homework form, or switch to another homework option.');
      return null;
    }

    return {
      classId: this.target.classId,
      studentId,
      status: 'present',
      academicOutcome: this.outcome,
      homeworkType: this.homeworkType,
      ...(this.homeworkType === 'curriculum'
        ? { homeworkMaterialIds: this.selectedMaterialIds(), homeworkDueDate: this.homeworkDueDate ? new Date(this.homeworkDueDate).toISOString() : null }
        : {}),
      ...(this.homeworkType === 'custom' && this.customHomework() ? { customHomework: this.customHomework()! } : {})
    };
  }
}
