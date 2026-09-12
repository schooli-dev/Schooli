import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LearningCourse, LearningMaterialsApiService, LearningModule, TeacherAccessSummary } from '../../../core/learning-materials/learning-materials-api.service';
import { ToastService } from '../../../core/toast/toast.service';

type AccessFilter = 'all' | 'assigned' | 'unassigned';

@Component({ selector: 'app-teacher-access', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './teacher-access.component.html', styleUrl: './teacher-access.component.scss' })
export class TeacherAccessComponent implements OnInit {
  protected readonly modules = signal<LearningModule[]>([]);
  protected readonly courses = signal<LearningCourse[]>([]);
  protected readonly teachers = signal<TeacherAccessSummary[]>([]);
  protected readonly selectedTeacher = signal<TeacherAccessSummary | null>(null);
  protected readonly accessDialogOpen = signal(false);
  protected readonly accessReadOnly = signal(false);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected search = '';
  protected courseFilter = '';
  protected moduleFilter = '';
  protected moduleSearch = '';
  protected accessFilter: AccessFilter = 'all';
  protected selectedModuleIds = new Set<string>();

  protected readonly filteredTeachers = computed(() => {
    const query = this.search.trim().toLowerCase();
    return this.teachers().filter((teacher) => {
      const matchesSearch = !query || `${teacher.fullName} ${teacher.email}`.toLowerCase().includes(query);
      const matchesCourse = !this.courseFilter || teacher.moduleIds.some((moduleId) => this.moduleById(moduleId)?.courseId === this.courseFilter);
      const matchesModule = !this.moduleFilter || teacher.moduleIds.includes(this.moduleFilter);
      const matchesAccess = this.accessFilter === 'all' || (this.accessFilter === 'assigned' ? teacher.moduleCount > 0 : teacher.moduleCount === 0);
      return matchesSearch && matchesCourse && matchesModule && matchesAccess;
    });
  });
  protected readonly activeCourses = computed(() => this.courses().filter((course) => course.status === 'active'));

  constructor(private readonly api: LearningMaterialsApiService, private readonly toasts: ToastService) {}

  ngOnInit(): void { this.loadData(); }

  protected loadData(): void {
    this.loading.set(true);
    this.api.listCourses({ status: 'active' }).subscribe({ next: (response) => this.courses.set(response.data), error: () => this.toasts.error('Courses could not be loaded.') });
    this.api.listModules({ status: 'active', sort: 'order' }).subscribe({ next: (response) => this.modules.set(response.data), error: () => this.toasts.error('Modules could not be loaded.') });
    this.api.listTeacherAccess().subscribe({
      next: (response) => { this.teachers.set(response.data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toasts.error('Teacher access could not be loaded.'); }
    });
  }

  protected openAccess(teacher: TeacherAccessSummary, readOnly: boolean): void {
    this.api.getTeacherModules(teacher.id).subscribe({
      next: (response) => {
        this.selectedTeacher.set({ ...teacher, moduleIds: response.data.moduleIds });
        this.selectedModuleIds = new Set(response.data.moduleIds);
        this.moduleSearch = '';
        this.accessReadOnly.set(readOnly);
        this.accessDialogOpen.set(true);
      },
      error: (error) => this.toasts.error(error?.error?.message ?? 'Teacher access could not be loaded.')
    });
  }

  protected closeAccess(): void { if (!this.saving()) this.accessDialogOpen.set(false); }
  protected isModuleSelected(moduleId: string): boolean { return this.selectedModuleIds.has(moduleId); }
  protected toggleModule(moduleId: string): void {
    if (this.accessReadOnly()) return;
    const next = new Set(this.selectedModuleIds);
    next.has(moduleId) ? next.delete(moduleId) : next.add(moduleId);
    this.selectedModuleIds = next;
  }
  protected filteredModulesForCourse(courseId: string): LearningModule[] {
    const query = this.moduleSearch.trim().toLowerCase();
    return this.modules().filter((module) =>
      module.courseId === courseId &&
      (!query || `${module.name} ${module.courseName} ${module.description ?? ''}`.toLowerCase().includes(query))
    );
  }
  protected matchingModuleCount(): number { return this.modules().filter((module) => this.filteredModulesForCourse(module.courseId).some((item) => item.id === module.id)).length; }
  protected assignedCourseNames(teacher: TeacherAccessSummary): string {
    const names = [...new Set(teacher.moduleIds.map((moduleId) => this.moduleById(moduleId)?.courseName).filter(Boolean))] as string[];
    return names.length ? names.join(', ') : 'No module access assigned';
  }
  protected initials(teacher: TeacherAccessSummary): string { return teacher.fullName.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }

  protected saveAccess(): void {
    const teacher = this.selectedTeacher();
    if (!teacher) return;
    this.saving.set(true);
    this.api.replaceTeacherModules(teacher.id, [...this.selectedModuleIds]).subscribe({
      next: (response) => {
        const moduleIds = response.data.moduleIds;
        const courseCount = new Set(moduleIds.map((moduleId) => this.moduleById(moduleId)?.courseId).filter(Boolean)).size;
        this.teachers.update((teachers) => teachers.map((item) => item.id === teacher.id ? { ...item, moduleIds, moduleCount: moduleIds.length, courseCount } : item));
        this.selectedTeacher.update((item) => item ? { ...item, moduleIds, moduleCount: moduleIds.length, courseCount } : item);
        this.saving.set(false);
        this.accessDialogOpen.set(false);
        this.toasts.success('Teacher module access updated. The teacher has been notified.');
      },
      error: (error) => { this.saving.set(false); this.toasts.error(error?.error?.message ?? 'Teacher access could not be updated.'); }
    });
  }

  private moduleById(moduleId: string): LearningModule | undefined { return this.modules().find((module) => module.id === moduleId); }
}
