import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CourseDetail, LearningCourse, LearningMaterialsApiService } from '../../../core/learning-materials/learning-materials-api.service';
import { ToastService } from '../../../core/toast/toast.service';

type DialogMode = 'create' | 'edit';
type CourseForm = { name: string; description: string; iconKey: string; status: 'active' | 'inactive' };

const iconChoices = ['bi-code-slash', 'bi-calculator', 'bi-book', 'bi-globe2', 'bi-palette', 'bi-cpu', 'bi-lightbulb', 'bi-graph-up-arrow'];

@Component({
  selector: 'app-admin-courses',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-courses.component.html',
  styleUrl: './admin-courses.component.scss'
})
export class AdminCoursesComponent implements OnInit {
  protected readonly courses = signal<LearningCourse[]>([]);
  protected readonly selectedCourse = signal<CourseDetail | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly mode = signal<DialogMode>('create');
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  private readonly editingCourseId = signal<string | null>(null);
  protected readonly iconChoices = iconChoices;
  protected readonly filteredCourses = computed(() => {
    const query = this.searchText.trim().toLowerCase();
    return this.courses().filter((course) => {
      const matchesSearch = !query || `${course.name} ${course.description ?? ''}`.toLowerCase().includes(query);
      return matchesSearch && (this.statusFilter === 'all' || course.status === this.statusFilter);
    });
  });
  protected searchText = '';
  protected statusFilter: 'all' | 'active' | 'inactive' = 'all';
  protected form: CourseForm = this.emptyForm();

  constructor(private readonly api: LearningMaterialsApiService, private readonly toasts: ToastService) {}

  ngOnInit(): void { this.loadCourses(); }

  protected loadCourses(): void {
    this.loading.set(true);
    this.api.listCourses({ status: this.statusFilter }).subscribe({
      next: (response) => { this.courses.set(response.data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toasts.error('Courses could not be loaded.'); }
    });
  }

  protected openCreate(): void {
    this.mode.set('create');
    this.editingCourseId.set(null);
    this.form = this.emptyForm();
    this.modalOpen.set(true);
  }

  protected openEdit(course: LearningCourse): void {
    this.mode.set('edit');
    this.editingCourseId.set(course.id);
    this.form = { name: course.name, description: course.description ?? '', iconKey: course.iconKey, status: course.status };
    this.modalOpen.set(true);
  }

  protected openDetails(course: LearningCourse): void {
    this.api.getCourse(course.id).subscribe({
      next: (response) => {
        this.selectedCourse.set(response.data);
        this.drawerOpen.set(true);
      },
      error: () => this.toasts.error('Course details could not be loaded.')
    });
  }

  protected closeModal(): void { if (!this.saving()) this.modalOpen.set(false); }
  protected closeDrawer(): void { this.drawerOpen.set(false); }

  protected saveCourse(): void {
    if (this.form.name.trim().length < 2) {
      this.toasts.error('Enter a course name with at least 2 characters.');
      return;
    }
    this.saving.set(true);
    const payload = { name: this.form.name.trim(), description: this.form.description.trim() || null, iconKey: this.form.iconKey, status: this.form.status };
    const request = this.mode() === 'create'
      ? this.api.createCourse(payload)
      : this.api.updateCourse(this.editingCourseId()!, payload);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.toasts.success(this.mode() === 'create' ? 'Course created.' : 'Course updated.');
        this.loadCourses();
      },
      error: (error) => {
        this.saving.set(false);
        this.toasts.error(error?.error?.message ?? 'Course could not be saved.');
      }
    });
  }

  protected statusLabel(status: string): string { return status === 'active' ? 'Active' : 'Inactive'; }
  protected updateStatusFilter(): void { this.loadCourses(); }

  private emptyForm(): CourseForm { return { name: '', description: '', iconKey: 'bi-code-slash', status: 'active' }; }
}
