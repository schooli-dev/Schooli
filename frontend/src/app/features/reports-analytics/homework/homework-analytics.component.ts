import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  HomeworkAnalyticsFilters,
  HomeworkAnalyticsSummary,
  HomeworkAssignmentAnalytics,
  HomeworkAssignmentDetailResponse,
  HomeworkAssignmentSort,
  HomeworkDisplayStatus,
  HomeworkStatusFilter,
  HomeworkTypeFilter,
  ReportsAnalyticsApiService
} from '../../../core/reports-analytics/reports-analytics-api.service';
import { ToastService } from '../../../core/toast/toast.service';
import { HomeworkFileItem, HomeworkFileListComponent } from '../../homework/homework-file-list.component';

type Pagination = { page: number; limit: number; total: number; totalPages: number };

const statusLabels: Record<HomeworkDisplayStatus, string> = {
  pending: 'Pending',
  pending_review: 'Pending Review',
  revision_required: 'Revision Required',
  completed: 'Completed',
  overdue: 'Overdue'
};

@Component({
  selector: 'app-homework-analytics',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule, HomeworkFileListComponent],
  templateUrl: './homework-analytics.component.html',
  styleUrl: './homework-analytics.component.scss'
})
export class HomeworkAnalyticsComponent implements OnInit {
  protected readonly loading = signal(false);
  protected readonly summary = signal<HomeworkAnalyticsSummary | null>(null);
  protected readonly filters = signal<HomeworkAnalyticsFilters>({ students: [], teachers: [], courses: [], modules: [], lessons: [] });
  protected readonly items = signal<HomeworkAssignmentAnalytics[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);

  protected readonly drawerOpen = signal(false);
  protected readonly detailLoading = signal(false);
  protected readonly detail = signal<HomeworkAssignmentDetailResponse | null>(null);

  protected search = '';
  protected status: HomeworkStatusFilter = 'all';
  protected studentId = '';
  protected teacherId = '';
  protected courseId = '';
  protected moduleId = '';
  protected lessonId = '';
  protected homeworkType: HomeworkTypeFilter = 'all';
  protected dateFrom = '';
  protected dateTo = '';
  protected sort: HomeworkAssignmentSort = 'assignedDesc';
  protected page = 1;
  protected readonly limit = 20;

  protected readonly modulesForSelectedCourse = computed(() => {
    const modules = this.filters().modules;
    return this.courseId ? modules.filter((module) => module.courseId === this.courseId) : modules;
  });

  protected readonly lessonsForSelectedModule = computed(() => {
    const lessons = this.filters().lessons;
    if (this.moduleId) return lessons.filter((lesson) => lesson.moduleId === this.moduleId);
    if (this.courseId) {
      const moduleIds = new Set(this.modulesForSelectedCourse().map((module) => module.id));
      return lessons.filter((lesson) => moduleIds.has(lesson.moduleId));
    }
    return lessons;
  });

  constructor(
    private readonly api: ReportsAnalyticsApiService,
    private readonly toasts: ToastService
  ) {}

  ngOnInit(): void {
    this.loadStaticData();
    this.loadAssignments();
  }

  protected onCourseFilterChange(): void {
    if (this.moduleId && !this.modulesForSelectedCourse().some((module) => module.id === this.moduleId)) this.moduleId = '';
    if (this.lessonId && !this.lessonsForSelectedModule().some((lesson) => lesson.id === this.lessonId)) this.lessonId = '';
    this.onFilterChange();
  }

  protected onModuleFilterChange(): void {
    if (this.lessonId && !this.lessonsForSelectedModule().some((lesson) => lesson.id === this.lessonId)) this.lessonId = '';
    this.onFilterChange();
  }

  protected onFilterChange(): void {
    this.page = 1;
    this.loadAssignments();
  }

  protected goToPage(page: number): void {
    const pagination = this.pagination();
    if (page < 1 || (pagination && page > pagination.totalPages)) return;
    this.page = page;
    this.loadAssignments();
  }

  private loadStaticData(): void {
    this.api.getHomeworkSummary().subscribe({
      next: (response) => this.summary.set(response.data),
      error: () => this.toasts.error('Homework summary could not be loaded.')
    });
    this.api.getHomeworkFilters().subscribe({
      next: (response) => this.filters.set(response.data),
      error: () => this.toasts.error('Filters could not be loaded.')
    });
  }

  private loadAssignments(): void {
    this.loading.set(true);
    this.api
      .listHomeworkAssignments({
        search: this.search.trim() || undefined,
        status: this.status,
        studentId: this.studentId || undefined,
        teacherId: this.teacherId || undefined,
        courseId: this.courseId || undefined,
        moduleId: this.moduleId || undefined,
        lessonId: this.lessonId || undefined,
        homeworkType: this.homeworkType,
        dateFrom: this.dateFrom || undefined,
        dateTo: this.dateTo || undefined,
        sort: this.sort,
        page: this.page,
        limit: this.limit
      })
      .subscribe({
        next: (response) => {
          this.items.set(response.data);
          this.pagination.set(response.pagination ?? null);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.toasts.error('Homework assignments could not be loaded.');
        }
      });
  }

  protected openDetails(id: string): void {
    this.drawerOpen.set(true);
    this.detailLoading.set(true);
    this.detail.set(null);
    this.api.getHomeworkAssignmentDetail(id).subscribe({
      next: (response) => {
        this.detail.set(response.data);
        this.detailLoading.set(false);
      },
      error: () => {
        this.detailLoading.set(false);
        this.toasts.error('Assignment details could not be loaded.');
        this.drawerOpen.set(false);
      }
    });
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
    this.detail.set(null);
  }

  protected statusLabel(status: HomeworkDisplayStatus): string {
    return statusLabels[status] ?? status;
  }

  protected formatClass(lessonNumber: number | null): string {
    return lessonNumber === null ? '—' : `Class ${lessonNumber}`;
  }

  protected formatScore(points: number | null, maxPoints: number | null): string {
    if (points === null) return '-';
    return maxPoints ? `${points} / ${maxPoints}` : String(points);
  }

  protected attemptResultLabel(status: string): string {
    return { submitted: 'Pending Review', resubmission_requested: 'Revision Required', accepted: 'Completed' }[status] ?? status;
  }

  protected attemptFileItems(homeworkId: string, submissionId: string, files: { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null }[]): HomeworkFileItem[] {
    return files.map((file) => ({
      key: file.id,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      load: () => this.api.homeworkSubmissionFile(homeworkId, submissionId, file.id)
    }));
  }
}
