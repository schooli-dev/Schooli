import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type AdminDashboardStats = {
  users: {
    total: number;
    active: number;
    inactive: number;
    teachers: number;
    students: number;
    support: number;
  };
  classes: {
    today: number;
    live: number;
    upcoming: number;
    completedThisMonth: number;
  };
  tickets: {
    open: number;
    urgent: number;
  };
  homework: {
    pending: number;
    overdue: number;
  };
  credits: {
    approvedTotal: number;
  };
  todaysClasses: Array<{
    id: string;
    title: string;
    teacherName: string;
    studentName: string | null;
    startTime: string;
    endTime: string;
    status: string;
  }>;
  openTickets: Array<{
    id: string;
    subject: string;
    priority: string;
    status: string;
    createdAt: string;
  }>;
};

@Injectable({ providedIn: 'root' })
export class AdminDashboardApiService {
  constructor(private readonly api: ApiClientService) {}

  getStats() {
    return this.api.get<AdminDashboardStats>('/admin/dashboard');
  }
}
