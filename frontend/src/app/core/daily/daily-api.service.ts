import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type DailyJoinPayload = {
  provider: 'daily';
  roomName: string;
  roomUrl: string;
  token: string;
  role: 0 | 1;
};

@Injectable({ providedIn: 'root' })
export class DailyApiService {
  constructor(private readonly api: ApiClientService) {}

  joinRoom(classId: string, role: 0 | 1) {
    return this.api.post<DailyJoinPayload>(`/classes/${classId}/daily/join`, { role });
  }

  leaveRoom(classId: string, role: 0 | 1) {
    return this.api.post<{ classId: string; role: 0 | 1 }>(`/classes/${classId}/daily/leave`, { role });
  }

  recordSessionEvent(classId: string, eventType: 'join' | 'leave') {
    return this.api.post<{ classId: string; eventType: 'join' | 'leave' }>(`/classes/${classId}/daily/session-event`, { eventType });
  }

  endClass(classId: string) {
    return this.api.post<{ classId: string }>(`/classes/${classId}/daily/end`, {});
  }
}
