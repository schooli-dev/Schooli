import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CurriculumFilters,
  CurriculumModuleAnalytics,
  CurriculumModuleSort,
  CurriculumStatusFilter,
  CurriculumSummary,
  ModuleTeacherProgress,
  ModuleTeacherScheduledClass,
  ReportsAnalyticsApiService
} from '../../../core/reports-analytics/reports-analytics-api.service';

type ScheduledClassGroup = { lessonNumber: number | null; lessonTitle: string | null; sessions: ModuleTeacherScheduledClass[] };
import { ToastService } from '../../../core/toast/toast.service';

@Component({
  selector: 'app-curriculum-analytics',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './curriculum-analytics.component.html',
  styleUrl: './curriculum-analytics.component.scss'
})
export class CurriculumAnalyticsComponent implements OnInit {
  protected readonly loading = signal(false);
  protected readonly summary = signal<CurriculumSummary | null>(null);
  protected readonly filters = signal<CurriculumFilters>({ courses: [], modules: [] });
  protected readonly modules = signal<CurriculumModuleAnalytics[]>([]);

  protected readonly teachersDrawerOpen = signal(false);
  protected readonly teachersLoading = signal(false);
  protected readonly teachersModule = signal<CurriculumModuleAnalytics | null>(null);
  protected readonly teachersProgress = signal<ModuleTeacherProgress | null>(null);

  protected courseFilter = '';
  protected moduleFilter = '';
  protected statusFilter: CurriculumStatusFilter = 'all';
  protected sort: CurriculumModuleSort = 'courseName';

  protected readonly modulesForSelectedCourse = computed(() => {
    const modules = this.filters().modules;
    return this.courseFilter ? modules.filter((module) => module.courseId === this.courseFilter) : modules;
  });

  constructor(
    private readonly api: ReportsAnalyticsApiService,
    private readonly toasts: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStaticData();
    this.loadModules();
  }

  protected onCourseFilterChange(): void {
    if (this.moduleFilter && !this.modulesForSelectedCourse().some((module) => module.id === this.moduleFilter)) {
      this.moduleFilter = '';
    }
    this.loadModules();
  }

  protected onFilterChange(): void {
    this.loadModules();
  }

  private loadStaticData(): void {
    this.api.getCurriculumSummary().subscribe({
      next: (response) => this.summary.set(response.data),
      error: () => this.toasts.error('Curriculum summary could not be loaded.')
    });
    this.api.getCurriculumFilters().subscribe({
      next: (response) => this.filters.set(response.data),
      error: () => this.toasts.error('Filters could not be loaded.')
    });
  }

  private loadModules(): void {
    this.loading.set(true);
    this.api
      .listCurriculumModules({
        courseId: this.courseFilter || undefined,
        moduleId: this.moduleFilter || undefined,
        status: this.statusFilter,
        sort: this.sort
      })
      .subscribe({
        next: (response) => {
          this.modules.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toasts.error('Module analytics could not be loaded.');
        }
      });
  }

  protected statusLabel(status: string): string {
    return status === 'active' ? 'Active' : 'Inactive';
  }

  protected openTeachers(module: CurriculumModuleAnalytics): void {
    this.teachersModule.set(module);
    this.teachersDrawerOpen.set(true);
    this.teachersLoading.set(true);
    this.teachersProgress.set(null);
    this.api.getModuleTeacherProgress(module.moduleId).subscribe({
      next: (response) => {
        this.teachersProgress.set(response.data);
        this.teachersLoading.set(false);
      },
      error: () => {
        this.teachersLoading.set(false);
        this.toasts.error('Teacher progress could not be loaded.');
        this.teachersDrawerOpen.set(false);
      }
    });
  }

  protected closeTeachers(): void {
    this.teachersDrawerOpen.set(false);
    this.teachersProgress.set(null);
    this.teachersModule.set(null);
  }

  protected formatClass(lessonNumber: number | null): string {
    return lessonNumber === null ? '—' : `Class ${lessonNumber}`;
  }

  protected classStatusLabel(status: string): string {
    return (
      {
        scheduled: 'Scheduled',
        live: 'Live',
        completed: 'Completed',
        cancelled: 'Cancelled',
        rescheduled: 'Rescheduled',
        failed: 'Failed',
        no_show: 'No Show'
      }[status] ?? status
    );
  }

  protected initials(name: string): string {
    const parts = name.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  protected groupScheduledClasses(classes: ModuleTeacherScheduledClass[]): ScheduledClassGroup[] {
    const groups = new Map<string, ScheduledClassGroup>();
    for (const session of classes) {
      const key = `${session.lessonNumber ?? 'none'}`;
      let group = groups.get(key);
      if (!group) {
        group = { lessonNumber: session.lessonNumber, lessonTitle: session.lessonTitle, sessions: [] };
        groups.set(key, group);
      }
      group.sessions.push(session);
    }
    return Array.from(groups.values()).sort((a, b) => (a.lessonNumber ?? 0) - (b.lessonNumber ?? 0));
  }
}
