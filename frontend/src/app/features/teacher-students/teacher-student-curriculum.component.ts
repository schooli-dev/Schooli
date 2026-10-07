import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { AuthTokenService } from '../../core/auth/auth-token.service';
import { DateTimeService } from '../../core/datetime/date-time.service';
import { LearningMaterial, LearningMaterialsApiService } from '../../core/learning-materials/learning-materials-api.service';
import { MyStudentCurriculum, PeopleApiService } from '../../core/people/people-api.service';
import { MaterialViewerComponent } from '../../shared/material-viewer/material-viewer.component';

type LessonMaterials = { loading: boolean; failed: boolean; items: LearningMaterial[] };

/** One student's own progress through a module: done / current / upcoming, with each class's materials. */
@Component({
  selector: 'app-teacher-student-curriculum',
  standalone: true,
  imports: [MaterialViewerComponent],
  templateUrl: './teacher-student-curriculum.component.html',
  styleUrl: './teacher-students.component.scss'
})
export class TeacherStudentCurriculumComponent implements OnInit {
  protected readonly curriculum = signal<MyStudentCurriculum | null>(null);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);
  protected readonly expandedLessonId = signal<string | null>(null);
  protected readonly materials = signal<Record<string, LessonMaterials>>({});
  protected readonly viewing = signal<LearningMaterial | null>(null);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly peopleApi: PeopleApiService,
    private readonly learningMaterialsApi: LearningMaterialsApiService,
    private readonly authToken: AuthTokenService,
    private readonly dateTime: DateTimeService
  ) {}

  ngOnInit(): void {
    const studentId = this.route.snapshot.paramMap.get('studentId') ?? '';
    const moduleId = this.route.snapshot.queryParamMap.get('moduleId') ?? undefined;
    const lessonId = this.route.snapshot.queryParamMap.get('lessonId') ?? undefined;

    this.peopleApi.getMyStudentCurriculum(studentId, { moduleId, lessonId }).subscribe({
      next: (response) => {
        this.curriculum.set(response.data);
        this.loading.set(false);
        // Opened from a scheduled class: land on that exact class.
        if (lessonId && response.data.lessons.some((lesson) => lesson.id === lessonId)) {
          this.toggleLesson(lessonId);
        }
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  protected back(): void {
    void this.router.navigate(['/teacher/students'], { skipLocationChange: true });
  }

  protected toggleLesson(lessonId: string): void {
    if (this.expandedLessonId() === lessonId) {
      this.expandedLessonId.set(null);
      return;
    }
    this.expandedLessonId.set(lessonId);
    if (this.materials()[lessonId]) return;

    this.setMaterials(lessonId, { loading: true, failed: false, items: [] });
    this.learningMaterialsApi.getMyClass(lessonId).subscribe({
      next: (response) => this.setMaterials(lessonId, { loading: false, failed: false, items: response.data.materials }),
      error: () => this.setMaterials(lessonId, { loading: false, failed: true, items: [] })
    });
  }

  protected lessonMaterials(lessonId: string): LessonMaterials | null {
    return this.materials()[lessonId] ?? null;
  }

  protected openMaterial(material: LearningMaterial): void {
    if (material.sourceType === 'link') {
      if (material.externalUrl) window.open(material.externalUrl, '_blank', 'noopener');
      return;
    }
    this.viewing.set(material);
  }

  protected closeViewer(): void {
    this.viewing.set(null);
  }

  protected readonly viewerLoader = (): Observable<Blob> => this.learningMaterialsApi.downloadMyMaterial(this.viewing()!.id);

  protected materialIcon(section: string): string {
    return ({ presentation: 'bi-easel2', lesson_plan: 'bi-journal-richtext', homework: 'bi-pencil-square', file: 'bi-file-earmark' } as Record<string, string>)[section] ?? 'bi-file-earmark';
  }

  protected materialSection(section: string): string {
    return section.replace('_', ' ');
  }

  protected nextClassTime(): string {
    const next = this.curriculum()?.nextClass;
    if (!next) return '';
    const timezone = this.authToken.getUser()?.timezone;
    return this.dateTime.formatDateTime(next.startTime, this.dateTime.isValidTimezone(timezone) ? timezone : this.dateTime.browserTimezone());
  }

  protected openNextClass(): void {
    const next = this.curriculum()?.nextClass;
    if (!next) return;
    void this.router.navigate(['/teacher/classes'], { queryParams: { openClass: next.id }, skipLocationChange: true });
  }

  private setMaterials(lessonId: string, value: LessonMaterials): void {
    this.materials.update((current) => ({ ...current, [lessonId]: value }));
  }
}
