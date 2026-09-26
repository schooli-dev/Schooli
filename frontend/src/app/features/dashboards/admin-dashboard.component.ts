import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboardApiService, AdminDashboardStats } from '../../core/admin/admin-dashboard-api.service';

const emptyStats: AdminDashboardStats = {
  users: { total: 0, active: 0, inactive: 0, teachers: 0, students: 0, support: 0 },
  classes: { today: 0, live: 0, upcoming: 0, completedThisMonth: 0 },
  tickets: { open: 0, urgent: 0 },
  homework: { pending: 0, overdue: 0 },
  r2Storage: { status: 'not_configured', objectCount: 0, sizeBytes: 0, uploadsLast24Hours: 0 },
  todaysClasses: [],
  openTickets: []
};

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [DatePipe, DecimalPipe, RouterLink],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss'
})
export class AdminDashboardComponent implements OnInit {
  protected readonly stats = signal<AdminDashboardStats>(emptyStats);
  protected readonly apiWarning = signal('');

  constructor(private readonly dashboardApi: AdminDashboardApiService) {}

  ngOnInit(): void {
    this.dashboardApi.getStats().subscribe({
      next: (response) => this.stats.set(response.data),
      error: () => this.apiWarning.set('Could not load dashboard stats from backend.')
    });
  }

  protected storageSize(bytes: number): string {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** unitIndex).toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  }

  protected storageStatusLabel(status: AdminDashboardStats['r2Storage']['status']): string {
    return ({ connected: 'R2 connected', not_configured: 'R2 not configured', unavailable: 'R2 unavailable' })[status];
  }
}
