import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LearningMaterialsApiService, LearningModule, ModuleDetail } from '../../../core/learning-materials/learning-materials-api.service';
import { UserListItem, UsersApiService } from '../../../core/users/users-api.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({ selector: 'app-teacher-access', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './teacher-access.component.html', styleUrl: './teacher-access.component.scss' })
export class TeacherAccessComponent implements OnInit {
  protected readonly modules = signal<LearningModule[]>([]);
  protected readonly teachers = signal<UserListItem[]>([]);
  protected readonly selectedDetail = signal<ModuleDetail | null>(null);
  protected readonly saving = signal(false);
  protected moduleId = '';
  protected search = '';
  protected selectedTeacherIds = new Set<string>();
  protected readonly filteredTeachers = computed(() => {
    const query = this.search.trim().toLowerCase();
    return this.teachers().filter((teacher) => !query || `${teacher.firstName} ${teacher.lastName} ${teacher.email}`.toLowerCase().includes(query));
  });
  constructor(private readonly api: LearningMaterialsApiService, private readonly usersApi: UsersApiService, private readonly toasts: ToastService) {}
  ngOnInit(): void {
    this.api.listModules({ status: 'active', sort: 'order' }).subscribe({ next: (r) => this.modules.set(r.data), error: () => this.toasts.error('Modules could not be loaded.') });
    this.usersApi.listUsers({ role: 'teacher', status: 'active', limit: 100 }).subscribe({ next: (r) => this.teachers.set(r.data), error: () => this.toasts.error('Teachers could not be loaded.') });
  }
  protected loadAccess(): void {
    if (!this.moduleId) { this.selectedDetail.set(null); this.selectedTeacherIds = new Set(); return; }
    this.api.getModule(this.moduleId).subscribe({ next: (r) => { this.selectedDetail.set(r.data); this.selectedTeacherIds = new Set(r.data.teachers.map((teacher) => teacher.id)); }, error: () => this.toasts.error('Module access could not be loaded.') });
  }
  protected isSelected(id: string): boolean { return this.selectedTeacherIds.has(id); }
  protected toggleTeacher(id: string): void { this.selectedTeacherIds.has(id) ? this.selectedTeacherIds.delete(id) : this.selectedTeacherIds.add(id); this.selectedTeacherIds = new Set(this.selectedTeacherIds); }
  protected save(): void {
    if (!this.moduleId) return;
    this.saving.set(true);
    this.api.replaceModuleTeachers(this.moduleId, [...this.selectedTeacherIds]).subscribe({ next: (r) => { this.saving.set(false); this.selectedDetail.set(r.data); this.selectedTeacherIds = new Set(r.data.teachers.map((teacher) => teacher.id)); this.toasts.success('Teacher access updated.'); }, error: (e) => { this.saving.set(false); this.toasts.error(e?.error?.message ?? 'Teacher access could not be updated.'); } });
  }
  protected fullName(teacher: UserListItem): string { return `${teacher.firstName} ${teacher.lastName}`.trim(); }
}
