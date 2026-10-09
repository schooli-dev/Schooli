import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';
export type AttendanceRecordStatus = AttendanceStatus | 'pending';

export type AttendanceEvidence = {
  joinCount: number;
  leaveCount: number;
  firstJoinTime: string | null;
  lastLeaveTime: string | null;
};

export type AcademicOutcome = 'completed' | 'partially_completed' | 'continue_next_class';
export type AttendanceHomeworkType = 'none' | 'curriculum' | 'custom';

/** Shown to the teacher when the previous session for this student+class ended Partial / Continue Next Class. */
export type AttendanceContinuation = {
  lessonTitle: string;
  taughtSummary: string | null;
  continueSummary: string | null;
  teacherNotes: string | null;
};

export type AttendanceRecord = {
  id: string;
  classId: string;
  classTitle: string;
  classStartTime: string;
  classEndTime: string;
  classStatus: string;
  teacherId: string;
  teacherName: string;
  studentId: string;
  studentName: string;
  status: AttendanceRecordStatus;
  markedByTeacherId: string | null;
  markedAt: string | null;
  source: string;
  teacherNotes: string | null;
  zoomJoinTime: string | null;
  zoomLeaveTime: string | null;
  totalZoomMinutes: number | null;
  zoomEvidence: AttendanceEvidence;
  academicOutcome: AcademicOutcome | null;
  taughtSummary: string | null;
  continueSummary: string | null;
  homeworkType: AttendanceHomeworkType;
  homeworkMaterialId: string | null;
  homeworkCustomText: string | null;
  curriculumLessonId: string | null;
  continuation: AttendanceContinuation | null;
  createdAt: string;
  updatedAt: string;
};

export type MarkAttendanceRequest = {
  classId: string;
  studentId: string;
  status: AttendanceStatus;
  teacherNotes?: string | null;
  zoomJoinTime?: string | null;
  zoomLeaveTime?: string | null;
  totalZoomMinutes?: number | null;
  /** Present only: required by the live Mark Attendance endpoint, rejected for any other status. */
  academicOutcome?: AcademicOutcome;
  taughtSummary?: string | null;
  continueSummary?: string | null;
  homeworkType?: AttendanceHomeworkType;
  homeworkMaterialId?: string | null;
  homeworkCustomText?: string | null;
};

@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  constructor(private readonly api: ApiClientService) {}

  listAttendance(params?: {
    page?: number;
    limit?: number;
    classId?: string;
    teacherId?: string;
    studentId?: string;
    status?: AttendanceRecordStatus;
    from?: string;
    to?: string;
  }) {
    return this.api.get<AttendanceRecord[]>('/attendance', params);
  }

  /** The class's attendance rows, including the continuation banner data for the mapped curriculum class. */
  listClassAttendance(classId: string) {
    return this.api.get<AttendanceRecord[]>(`/classes/${classId}/attendance`);
  }

  markAttendance(payload: MarkAttendanceRequest) {
    return this.api.post<AttendanceRecord>('/attendance/mark', payload);
  }

  updateAttendance(id: string, payload: Partial<Omit<MarkAttendanceRequest, 'classId' | 'studentId'>>) {
    return this.api.patch<AttendanceRecord>(`/attendance/${id}`, payload);
  }
}
