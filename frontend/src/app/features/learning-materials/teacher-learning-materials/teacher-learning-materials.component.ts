import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { MaterialViewerComponent } from '../../../shared/material-viewer/material-viewer.component';
import { LearningLesson, LearningMaterial, LearningMaterialsApiService, LearningModule, LessonDetail, TeacherModuleDetail } from '../../../core/learning-materials/learning-materials-api.service';
import { ToastService } from '../../../core/toast/toast.service';

@Component({ selector: 'app-teacher-learning-materials', standalone: true, imports: [CommonModule, FormsModule, MaterialViewerComponent], templateUrl: './teacher-learning-materials.component.html', styleUrl: './teacher-learning-materials.component.scss' })
export class TeacherLearningMaterialsComponent implements OnInit {
  protected readonly modules = signal<LearningModule[]>([]);
  protected readonly lessons = signal<LearningLesson[]>([]);
  protected readonly loading = signal(true);
  protected readonly viewing = signal<LearningMaterial | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly selectedModule = signal<TeacherModuleDetail | null>(null);
  protected readonly selectedLesson = signal<LessonDetail | null>(null);
  protected readonly mode: 'modules' | 'classes';
  protected searchText = '';
  protected courseFilter = '';
  protected sort = 'order';

  constructor(private readonly route: ActivatedRoute, private readonly api: LearningMaterialsApiService, private readonly toasts: ToastService) {
    this.mode = this.route.snapshot.data['mode'] === 'classes' ? 'classes' : 'modules';
  }

  ngOnInit(): void {
    if (this.mode === 'modules') {
      this.api.listMyModules().subscribe({
        next: (response) => { this.modules.set(response.data); this.loading.set(false); },
        error: () => { this.loading.set(false); this.toasts.error('Your assigned learning materials could not be loaded.'); }
      });
      return;
    }
    this.api.listMyClasses().subscribe({
      next: (response) => { this.lessons.set(response.data); this.loading.set(false); },
      error: () => { this.loading.set(false); this.toasts.error('Your assigned learning materials could not be loaded.'); }
    });
  }

  protected viewModule(module: LearningModule): void {
    this.detailLoading.set(true);
    this.api.getMyModule(module.id).subscribe({
      next: (response) => { this.selectedModule.set(response.data); this.detailLoading.set(false); },
      error: () => { this.detailLoading.set(false); this.toasts.error('This module could not be opened.'); }
    });
  }

  protected viewLesson(lesson: LearningLesson): void {
    this.detailLoading.set(true);
    this.api.getMyClass(lesson.id).subscribe({
      next: (response) => { this.selectedLesson.set(response.data); this.detailLoading.set(false); },
      error: () => { this.detailLoading.set(false); this.toasts.error('This curriculum class could not be opened.'); }
    });
  }

  protected closeDetail(): void {
    this.selectedModule.set(null);
    this.selectedLesson.set(null);
  }

  protected openFile(material: LearningMaterial): void {
    this.viewing.set(material);
  }

  protected closeViewer(): void { this.viewing.set(null); }

  protected readonly viewerLoader = (): Observable<Blob> => this.api.downloadMyMaterial(this.viewing()!.id);

  protected filteredModules(): LearningModule[] {
    const query = this.searchText.trim().toLowerCase();
    return this.modules().filter((item) =>
      (!query || `${item.name} ${item.courseName} ${item.description ?? ''}`.toLowerCase().includes(query)) &&
      (!this.courseFilter || item.courseId === this.courseFilter)
    ).sort((a, b) => this.sort === 'name' ? a.name.localeCompare(b.name) : this.sort === 'updatedAt' ? new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime() : a.sortOrder - b.sortOrder);
  }

  protected filteredLessons(): LearningLesson[] {
    const query = this.searchText.trim().toLowerCase();
    return this.lessons().filter((item) => !query || `${item.title} ${item.moduleName} ${item.courseName} ${item.description ?? ''}`.toLowerCase().includes(query));
  }

  protected assignedCourses(): { id: string; name: string }[] {
    return [...new Map(this.modules().map((item) => [item.courseId, item.courseName])).entries()].map(([id, name]) => ({ id, name }));
  }
}
