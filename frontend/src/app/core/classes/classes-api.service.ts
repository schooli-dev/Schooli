import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type ClassParticipant = {
  studentId: string;
  studentName: string;
  attendanceStatus: string;
  creditsConsumed: string;
};

export type ClassListItem = {
  id: string;
  teacherId: string;
  teacherName: string;
  title: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  timezone: string;
  status: string;
  notes?: string | null;
  cancellationReason?: string | null;
  cancellationRequestStatus?: string | null;
  cancellationRequestsCount?: number;
  participants: ClassParticipant[];
  videoMeeting: {
    provider: 'daily';
    providerMeetingId: string | null;
    roomName: string | null;
    roomUrl: string | null;
    status: string;
    creationStatus: string;
  } | null;
};

export type ClassJoinPayload = {
  classId: string;
  title: string;
  provider: 'daily';
  daily: {
    roomName: string | null;
    roomUrl: string | null;
    canStart: boolean;
    status: string;
    creationStatus: string;
  };
  message: string;
};

export type CreateClassRequest = {
  teacherId: string;
  studentId: string;
  title: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  notes?: string;
  overrideConflicts?: boolean;
};

export type SchedulingConflict = {
  type: 'teacher_availability' | 'teacher_unavailable' | 'teacher_overlap' | 'student_overlap';
  message: string;
  details?: {
    id?: string;
    title?: string;
    startTime?: string;
    endTime?: string;
    status?: string;
    dayOfWeek?: string;
    timezone?: string;
    scheduleTimezone?: string;
    startTimeLocal?: string;
    endTimeLocal?: string;
    reason?: string | null;
  };
};

export type CheckConflictsRequest = {
  teacherId: string;
  studentId: string;
  startTime: string;
  durationMinutes: number;
  timezone: string;
  excludeClassId?: string;
};

export type CheckConflictsResponse = {
  hasConflicts: boolean;
  conflicts: SchedulingConflict[];
};

export type ClassCancellationRequest = {
  id: string;
  classId: string;
  classTitle: string;
  classStartTime: string;
  teacherId: string;
  teacherName: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByRole: string;
  reason: string;
  status: string;
  adminNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

@Injectable({ providedIn: 'root' })
export class ClassesApiService {
  constructor(private readonly api: ApiClientService) {}

  listClasses(params?: {
    page?: number;
    limit?: number;
    status?: string;
    teacherId?: string;
    studentId?: string;
    from?: string;
    to?: string;
  }) {
    return this.api.get<ClassListItem[]>('/classes', params);
  }

  createClass(payload: CreateClassRequest) {
    return this.api.post<ClassListItem>('/classes', payload);
  }

  getClass(id: string) {
    return this.api.get<ClassListItem>(`/classes/${id}`);
  }

  cancelClass(id: string, reason: string) {
    return this.api.post<ClassListItem>(`/classes/${id}/cancel`, { reason });
  }

  requestCancellation(id: string, reason: string) {
    return this.api.post<ClassCancellationRequest>(`/classes/${id}/cancel-requests`, { reason });
  }

  checkConflicts(payload: CheckConflictsRequest) {
    return this.api.post<CheckConflictsResponse>('/classes/check-conflicts', payload);
  }

  joinClass(id: string) {
    return this.api.post<ClassJoinPayload>(`/classes/${id}/join`, {});
  }
}
