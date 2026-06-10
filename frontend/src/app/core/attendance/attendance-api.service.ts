import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused';

export type MarkAttendanceRequest = {
  classId: string;
  studentId: string;
  status: AttendanceStatus;
  teacherNotes?: string | null;
  zoomJoinTime?: string | null;
  zoomLeaveTime?: string | null;
  totalZoomMinutes?: number | null;
};

@Injectable({ providedIn: 'root' })
export class AttendanceApiService {
  constructor(private readonly api: ApiClientService) {}

  markAttendance(payload: MarkAttendanceRequest) {
    return this.api.post('/attendance/mark', payload);
  }
}
