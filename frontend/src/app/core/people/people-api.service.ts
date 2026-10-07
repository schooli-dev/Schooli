import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type PersonOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  timezone: string;
};

export type MyStudent = {
  studentId: string;
  studentName: string;
  courseName: string | null;
  moduleId: string | null;
  moduleName: string | null;
  moduleSortOrder: number | null;
  currentLesson: { id: string; lessonNumber: number; title: string } | null;
  moduleCompleted: boolean;
};

export type CurriculumLessonState = 'done' | 'current' | 'upcoming';

export type MyStudentCurriculum = {
  student: { id: string; name: string };
  course: { name: string };
  module: { id: string; name: string; sortOrder: number };
  currentLessonId: string | null;
  lessons: Array<{ id: string; lessonNumber: number; title: string; description: string | null; state: CurriculumLessonState }>;
  nextClass: { id: string; startTime: string; timezone: string } | null;
};

@Injectable({ providedIn: 'root' })
export class PeopleApiService {
  constructor(private readonly api: ApiClientService) {}

  listTeachers() {
    return this.api.get<PersonOption[]>('/teachers', { limit: 100 });
  }

  /** Teacher-scoped: only students with a (non-cancelled) class with the signed-in teacher. */
  listMyStudents() {
    return this.api.get<MyStudent[]>('/students/my');
  }

  /** One student's own curriculum progress for a module (module from moduleId, or from lessonId). */
  getMyStudentCurriculum(studentId: string, params: { moduleId?: string; lessonId?: string } = {}) {
    return this.api.get<MyStudentCurriculum>(`/students/my/${studentId}/curriculum`, params);
  }

  listStudents() {
    return this.api.get<PersonOption[]>('/students', { limit: 100 });
  }
}
