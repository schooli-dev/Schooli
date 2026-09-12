import { CommonModule } from '@angular/common';
import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, switchMap } from 'rxjs';
import { LearningLesson, LearningMaterialsApiService, LearningModule, LessonDetail } from '../../../core/learning-materials/learning-materials-api.service';
import { ToastService } from '../../../core/toast/toast.service';

type LessonForm = { moduleId: string; lessonNumber: number; title: string; description: string; sortOrder: number; status: 'active' | 'inactive' };
type MaterialForm = { section: 'presentation' | 'lesson_plan' | 'homework' | 'file'; source: 'upload' | 'link'; title: string; url: string; audience: 'teachers_only' | 'students_and_teachers'; allowLateSubmission: boolean };

@Component({ selector: 'app-admin-lessons', standalone: true, imports: [CommonModule, FormsModule], templateUrl: './admin-lessons.component.html', styleUrl: './admin-lessons.component.scss' })
export class AdminLessonsComponent implements OnInit {
  protected readonly lessons = signal<LearningLesson[]>([]);
  protected readonly modules = signal<LearningModule[]>([]);
  protected readonly selected = signal<LessonDetail | null>(null);
  protected readonly createOpen = signal(false);
  protected readonly detailsOpen = signal(false);
  protected readonly materialOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly detailsMode = signal<'view' | 'edit'>('view');
  protected search = '';
  protected status = 'all';
  protected form: LessonForm = this.emptyLesson();
  protected editForm: LessonForm = this.emptyLesson();
  protected material: MaterialForm = this.emptyMaterial();
  protected selectedFile: File | null = null;

  constructor(private readonly api: LearningMaterialsApiService, private readonly toasts: ToastService) {}

  ngOnInit(): void { this.load(); }

  protected load(): void {
    this.api.listLessons().subscribe({ next: (r) => this.lessons.set(r.data), error: () => this.toasts.error('Curriculum classes could not be loaded.') });
    this.api.listModules({ status: 'active', sort: 'order' }).subscribe({ next: (r) => this.modules.set(r.data) });
  }

  protected filtered(): LearningLesson[] {
    const query = this.search.trim().toLowerCase();
    return this.lessons().filter((item) =>
      (!query || `${item.title} ${item.moduleName} ${item.courseName}`.toLowerCase().includes(query)) &&
      (this.status === 'all' || item.status === this.status)
    );
  }

  protected openCreate(): void { this.form = this.emptyLesson(); this.createOpen.set(true); }
  protected closeCreate(): void { if (!this.saving()) this.createOpen.set(false); }

  protected saveLesson(): void {
    if (!this.form.moduleId || this.form.title.trim().length < 2) {
      this.toasts.error('Select a module and enter a class title.');
      return;
    }
    this.saving.set(true);
    this.api.createLesson({ ...this.form, title: this.form.title.trim(), description: this.form.description.trim() || null }).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.createOpen.set(false); this.toasts.success('Curriculum class created.'); this.load(); },
      error: (error) => this.toasts.error(error?.error?.message ?? 'Curriculum class could not be saved.')
    });
  }

  protected openDetails(item: LearningLesson, mode: 'view' | 'edit' = 'view'): void {
    this.api.getLesson(item.id).subscribe({
      next: (response) => {
        this.selected.set(response.data);
        this.editForm = this.toLessonForm(response.data);
        this.detailsMode.set(mode);
        this.detailsOpen.set(true);
      },
      error: () => this.toasts.error('Class details could not be loaded.')
    });
  }

  protected closeDetails(): void { if (!this.saving()) this.detailsOpen.set(false); }

  protected beginEdit(): void {
    const lesson = this.selected();
    if (!lesson) return;
    this.editForm = this.toLessonForm(lesson);
    this.detailsMode.set('edit');
  }

  protected cancelEdit(): void {
    const lesson = this.selected();
    if (lesson) this.editForm = this.toLessonForm(lesson);
    this.detailsMode.set('view');
  }

  protected saveDetails(): void {
    const lesson = this.selected();
    if (!lesson || !this.editForm.moduleId || this.editForm.title.trim().length < 2) {
      this.toasts.error('Select a module and enter a class title.');
      return;
    }
    this.saving.set(true);
    this.api.updateLesson(lesson.id, { ...this.editForm, title: this.editForm.title.trim(), description: this.editForm.description.trim() || null })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (response) => { this.selected.set(response.data); this.editForm = this.toLessonForm(response.data); this.detailsMode.set('view'); this.toasts.success('Curriculum class updated.'); this.load(); },
        error: (error) => this.toasts.error(error?.error?.message ?? 'Curriculum class could not be updated.')
      });
  }

  protected openMaterial(): void {
    if (this.detailsMode() !== 'edit') return;
    this.material = this.emptyMaterial();
    this.selectedFile = null;
    this.materialOpen.set(true);
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files?.[0] ?? null;
  }

  protected saveMaterial(): void {
    const lesson = this.selected();
    if (!lesson || this.material.title.trim().length < 2) {
      this.toasts.error('Enter a material title.');
      return;
    }
    if (this.material.source === 'link' && !this.material.url.trim()) {
      this.toasts.error('Enter a valid external link.');
      return;
    }
    if (this.material.source === 'upload' && !this.selectedFile) {
      this.toasts.error('Choose a file to upload.');
      return;
    }

    this.saving.set(true);
    const payload = { lessonId: lesson.id, section: this.material.section, title: this.material.title.trim(), audience: this.material.audience, allowLateSubmission: this.material.allowLateSubmission } as const;
    const request = this.material.source === 'upload'
      ? this.api.uploadMaterialFile(this.selectedFile!).pipe(switchMap((upload) => this.api.createMaterial({ ...payload, sourceType: 'file', storageKey: upload.data.storageKey, fileName: upload.data.fileName, mimeType: upload.data.mimeType, sizeBytes: upload.data.sizeBytes })))
      : this.api.createMaterial({ ...payload, sourceType: 'link', externalUrl: this.material.url.trim() });

    request.pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => { this.materialOpen.set(false); this.toasts.success(this.material.source === 'upload' ? 'File uploaded and added to the class.' : 'Link added to the class.'); this.refreshSelected(); this.load(); },
      error: (error) => this.toasts.error(error?.error?.message ?? 'Material could not be added.')
    });
  }

  protected materialIcon(section: string): string {
    return ({ presentation: 'bi-easel2', lesson_plan: 'bi-journal-richtext', homework: 'bi-pencil-square', file: 'bi-file-earmark' } as Record<string, string>)[section] ?? 'bi-file-earmark';
  }

  protected materialSubtitle(item: LessonDetail['materials'][number]): string {
    const audience = item.audience === 'teachers_only' ? 'Teachers only' : 'Students and teachers';
    return `${item.section.replace('_', ' ')} · ${audience}`;
  }

  private refreshSelected(): void {
    const lesson = this.selected();
    if (!lesson) return;
    this.api.getLesson(lesson.id).subscribe({ next: (response) => this.selected.set(response.data) });
  }

  private toLessonForm(lesson: LessonDetail): LessonForm {
    return { moduleId: lesson.moduleId, lessonNumber: lesson.lessonNumber, title: lesson.title, description: lesson.description ?? '', sortOrder: lesson.sortOrder, status: lesson.status };
  }

  private emptyLesson(): LessonForm { return { moduleId: '', lessonNumber: 1, title: '', description: '', sortOrder: 1, status: 'active' }; }
  private emptyMaterial(): MaterialForm { return { section: 'presentation', source: 'link', title: '', url: '', audience: 'teachers_only', allowLateSubmission: false }; }
}
