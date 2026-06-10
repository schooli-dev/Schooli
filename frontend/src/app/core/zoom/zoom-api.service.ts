import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type ZoomSignaturePayload = {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  password?: string | null;
  zak?: string;
  role: 0 | 1;
};

@Injectable({ providedIn: 'root' })
export class ZoomApiService {
  constructor(private readonly api: ApiClientService) {}

  getSignature(classId: string, role: 0 | 1) {
    return this.api.post<ZoomSignaturePayload>(`/classes/${classId}/zoom/signature`, { role });
  }

  leaveRoom(classId: string, role: 0 | 1) {
    return this.api.post<{ classId: string; role: 0 | 1 }>(`/classes/${classId}/zoom/leave`, { role });
  }
}
