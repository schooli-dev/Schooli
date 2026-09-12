import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LearningCourse, LearningMaterialsApiService, LearningModule, ModuleDetail } from '../../../core/learning-materials/learning-materials-api.service';
import { ToastService } from '../../../core/toast/toast.service';

type DialogMode = 'create' | 'edit';
type ModuleForm = { courseId: string; name: string; description: string; sortOrder: number; status: 'active' | 'inactive' };

@Component({
  selector: 'app-admin-modules',
  standalone: true,
  imports: [CommonModule, DatePipe, FormsModule],
  templateUrl: './admin-modules.component.html',
  styleUrl: './admin-modules.component.scss'
})
export class AdminModulesComponent implements OnInit {
  protected readonly modules = signal<LearningModule[]>([]);
  protected readonly courses = signal<LearningCourse[]>([]);
  protected readonly selectedModule = signal<ModuleDetail | null>(null);
  protected readonly drawerOpen = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);
  protected readonly mode = signal<DialogMode>('create');
  private readonly editingModuleId = signal<string | null>(null);
  protected searchText = '';
  protected courseFilter = '';
  protected statusFilter: 'all' | 'active' | 'inactive' = 'all';
  protected sort = 'order';
  protected form: ModuleForm = this.emptyForm();
  protected readonly filteredModules = computed(() => {
    const query = this.searchText.trim().toLowerCase();
    return this.modules().filter((module) => {
      const matchesSearch = !query || `${module.name} ${module.courseName} ${module.description ?? ''}`.toLowerCase().includes(query);
      return matchesSearch && (!this.courseFilter || module.courseId === this.courseFilter) && (this.statusFilter === 'all' || module.status === this.statusFilter);
    });
  });
  protected readonly activeCourses = computed(() => this.courses().filter((course) => course.status === 'active'));

  constructor(private readonly api: LearningMaterialsApiService, private readonly toasts: ToastService) {}

  ngOnInit(): void { this.loadData(); }

  protected loadData(): void {
    this.loading.set(true);
    this.api.listCourses().subscribe({ next: (response) => this.courses.set(response.data), error: () => this.toasts.error('Courses could not be loaded.') });
    this.api.listModules({ sort: this.sort }).subscribe({
      next: (response) => { this.modules.set(response.data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toasts.error('Modules could not be loaded.'); }
    });
  }

  protected updateSort(): void { this.loadData(); }
  protected openCreate(): void { this.mode.set('create'); this.editingModuleId.set(null); this.form = this.emptyForm(); this.modalOpen.set(true); }
  protected openEdit(module: LearningModule): void { this.mode.set('edit'); this.editingModuleId.set(module.id); this.form = { courseId: module.courseId, name: module.name, description: module.description ?? '', sortOrder: module.sortOrder, status: module.status }; this.selectedModule.set(null); this.modalOpen.set(true); }
  protected openDetails(module: LearningModule): void { this.api.getModule(module.id).subscribe({ next: (response) => { this.selectedModule.set(response.data); this.drawerOpen.set(true); }, error: () => this.toasts.error('Module details could not be loaded.') }); }
  protected closeModal(): void { if (!this.saving()) this.modalOpen.set(false); }
  protected closeDrawer(): void { this.drawerOpen.set(false); }

  protected saveModule(): void {
    if (!this.form.courseId || this.form.name.trim().length < 2 || this.form.sortOrder < 1) { this.toasts.error('Select a course, enter a module name, and set an order of 1 or more.'); return; }
    this.saving.set(true);
    const payload = { ...this.form, name: this.form.name.trim(), description: this.form.description.trim() || null };
    const request = this.mode() === 'create' ? this.api.createModule(payload) : this.api.updateModule(this.editingModuleId()!, payload);
    request.subscribe({
      next: () => { this.saving.set(false); this.modalOpen.set(false); this.toasts.success(this.mode() === 'create' ? 'Module created.' : 'Module updated.'); this.loadData(); },
      error: (error) => { this.saving.set(false); this.toasts.error(error?.error?.message ?? 'Module could not be saved.'); }
    });
  }

  protected editDrawer(): void { const item = this.selectedModule(); if (item) { this.closeDrawer(); this.openEdit(item); } }
  protected statusLabel(status: string): string { return status === 'active' ? 'Active' : 'Inactive'; }
  private emptyForm(): ModuleForm { return { courseId: '', name: '', description: '', sortOrder: 1, status: 'active' }; }
}
