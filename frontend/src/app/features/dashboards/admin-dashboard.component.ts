import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminDashboardApiService, AdminDashboardStats } from '../../core/admin/admin-dashboard-api.service';

const emptyStats: AdminDashboardStats = {
  users: { total: 0, active: 0, inactive: 0, teachers: 0, students: 0, support: 0 },
  classes: { today: 0, live: 0, upcoming: 0, completedThisMonth: 0 },
  tickets: { open: 0, urgent: 0 },
  homework: { pending: 0, overdue: 0 },
  credits: { approvedTotal: 0 },
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
}