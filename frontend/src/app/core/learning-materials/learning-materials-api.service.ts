import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import type { ApiResponse } from '../api/api-response.model';

export type CurriculumStatus = 'active' | 'inactive';

export type LearningCourse = {
  id: string;
  name: string;
  description: string | null;
  iconKey: string;
  iconUrl: string | null;
  status: CurriculumStatus;
  moduleCount: number;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
};

export type LearningModule = {
  id: string;
  courseId: string;
  courseName: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: CurriculumStatus;
  lessonCount: number;
  teacherCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ModuleTeacher = { id: string; fullName: string; email: string; timezone: string };
export type LessonPreview = { id: string; lessonNumber: number; title: string; status: CurriculumStatus; materialCount: number };
export type CourseDetail = LearningCourse & { modules: LearningModule[] };
export type ModuleDetail = LearningModule & { teachers: ModuleTeacher[]; lessons: LessonPreview[] };
export type LearningLesson = {
  id: string;
  moduleId: string;
  moduleName: string;
  courseId: string;
  courseName: string;
  lessonNumber: number;
  title: string;
  description: string | null;
  sortOrder: number;
  status: CurriculumStatus;
  materialCount: number;
  createdAt: string;
  updatedAt: string;
};
export type LearningMaterial = {
  id: string; logicalId: string; lessonId: string; section: 'presentation' | 'lesson_plan' | 'homework' | 'file';
  sourceType: 'file' | 'link'; title: string; fileUrl: string | null; storageKey: string | null; fileName: string | null; mimeType: string | null;
  sizeBytes: number | null; externalUrl: string | null; audience: 'teachers_only' | 'students_and_teachers';
  allowLateSubmission: boolean; version: number; status: CurriculumStatus; replacesMaterialId: string | null; createdAt: string; updatedAt: string;
};
export type LessonDetail = LearningLesson & { materials: LearningMaterial[] };

export type CoursePayload = {
  name: string;
  description?: string | null;
  iconKey?: string;
  iconUrl?: string | null;
  status?: CurriculumStatus;
};

export type ModulePayload = {
  courseId: string;
  name: string;
  description?: string | null;
  sortOrder: number;
  status?: CurriculumStatus;
};
export type LessonPayload = { moduleId: string; lessonNumber: number; title: string; description?: string | null; sortOrder: number; status?: CurriculumStatus };
export type MaterialPayload = {
  lessonId: string; section: 'presentation' | 'lesson_plan' | 'homework' | 'file'; sourceType: 'file' | 'link'; title: string;
  fileUrl?: string; storageKey?: string; fileName?: string; mimeType?: string; sizeBytes?: number; externalUrl?: string;
  audience?: 'teachers_only' | 'students_and_teachers'; allowLateSubmission?: boolean;
};
export type UploadedLearningMaterialFile = { storageKey: string; fileName: string; mimeType: string; sizeBytes: number };

@Injectable({ providedIn: 'root' })
export class LearningMaterialsApiService {
  constructor(private readonly api: ApiClientService) {}

  listCourses(filters: { search?: string; status?: 'all' | CurriculumStatus } = {}): Observable<ApiResponse<LearningCourse[]>> {
    return this.api.get('/learning-materials/courses', filters);
  }

  getCourse(id: string): Observable<ApiResponse<CourseDetail>> {
    return this.api.get(`/learning-materials/courses/${id}`);
  }

  createCourse(payload: CoursePayload): Observable<ApiResponse<LearningCourse>> {
    return this.api.post('/learning-materials/courses', payload);
  }

  updateCourse(id: string, payload: Partial<CoursePayload>): Observable<ApiResponse<LearningCourse>> {
    return this.api.patch(`/learning-materials/courses/${id}`, payload);
  }

  listModules(filters: { search?: string; courseId?: string; status?: 'all' | CurriculumStatus; sort?: string } = {}): Observable<ApiResponse<LearningModule[]>> {
    return this.api.get('/learning-materials/modules', filters);
  }

  getModule(id: string): Observable<ApiResponse<ModuleDetail>> {
    return this.api.get(`/learning-materials/modules/${id}`);
  }

  createModule(payload: ModulePayload): Observable<ApiResponse<LearningModule>> {
    return this.api.post('/learning-materials/modules', payload);
  }

  updateModule(id: string, payload: Partial<ModulePayload>): Observable<ApiResponse<ModuleDetail>> {
    return this.api.patch(`/learning-materials/modules/${id}`, payload);
  }

  replaceModuleTeachers(id: string, teacherIds: string[]): Observable<ApiResponse<ModuleDetail>> {
    return this.api.put(`/learning-materials/modules/${id}/teachers`, { teacherIds });
  }

  listLessons(filters: { moduleId?: string; status?: 'all' | CurriculumStatus } = {}): Observable<ApiResponse<LearningLesson[]>> {
    return this.api.get('/learning-materials/lessons', filters);
  }

  getLesson(id: string): Observable<ApiResponse<LessonDetail>> { return this.api.get(`/learning-materials/lessons/${id}`); }
  createLesson(payload: LessonPayload): Observable<ApiResponse<LearningLesson>> { return this.api.post('/learning-materials/lessons', payload); }
  updateLesson(id: string, payload: Partial<LessonPayload>): Observable<ApiResponse<LessonDetail>> { return this.api.patch(`/learning-materials/lessons/${id}`, payload); }
  uploadMaterialFile(file: File): Observable<ApiResponse<UploadedLearningMaterialFile>> {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post('/learning-materials/uploads', body);
  }
  createMaterial(payload: MaterialPayload): Observable<ApiResponse<LearningMaterial>> { return this.api.post('/learning-materials/materials', payload); }
  createMaterialRevision(id: string, payload: Omit<MaterialPayload, 'lessonId'>): Observable<ApiResponse<LearningMaterial>> { return this.api.post(`/learning-materials/materials/${id}/revisions`, payload); }
}
