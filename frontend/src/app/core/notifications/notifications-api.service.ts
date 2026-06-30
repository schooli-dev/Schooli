import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import type { ApiResponse } from '../api/api-response.model';

export type UserNotification = {
  id: string;
  eventKey: string;
  title: string;
  message: string;
  linkPath: string | null;
  payload: Record<string, unknown>;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type NotificationsSummary = {
  notifications: UserNotification[];
  unreadCount: number;
};

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  constructor(private readonly api: ApiClientService) {}

  getMine(limit = 5): Observable<ApiResponse<NotificationsSummary>> {
    return this.api.get<NotificationsSummary>('/notifications', { limit });
  }

  markAllRead(): Observable<ApiResponse<{ unreadCount: number }>> {
    return this.api.post<{ unreadCount: number }>('/notifications/mark-read', {});
  }
}
