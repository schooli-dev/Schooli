import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type CurriculumStatus = 'active' | 'inactive';
export type CurriculumStatusFilter = 'all' | CurriculumStatus;
export type CurriculumModuleSort = 'courseName' | 'moduleName' | 'classesDesc' | 'teachersDesc';

export type CurriculumSummary = {
  totalCourses: number;
  totalModules: number;
  activeModules: number;
  inactiveModules: number;
  totalClasses: number;
};

export type CurriculumFilterCourse = { id: string; name: string };
export type CurriculumFilterModule = { id: string; name: string; courseId: string; status: CurriculumStatus };
export type CurriculumFilters = { courses: CurriculumFilterCourse[]; modules: CurriculumFilterModule[] };

export type CurriculumModuleAnalytics = {
  moduleId: string;
  moduleName: string;
  status: CurriculumStatus;
  courseId: string;
  courseName: string;
  classesCount: number;
  teachersAssignedCount: number;
};

export type ModuleTeacherScheduledClass = {
  classId: string;
  lessonNumber: number | null;
  lessonTitle: string | null;
  studentName: string | null;
  /** scheduled | live | completed | cancelled | rescheduled | failed | no_show */
  status: string;
  startTime: string;
};

export type ModuleTeacherProgressEntry = {
  teacherId: string;
  teacherName: string;
  assignedAt: string;
  classesScheduled: number;
  classesCompleted: number;
  scheduledClasses: ModuleTeacherScheduledClass[];
};
export type ModuleTeacherProgress = { teachers: ModuleTeacherProgressEntry[] };

@Injectable({ providedIn: 'root' })
export class ReportsAnalyticsApiService {
  constructor(private readonly api: ApiClientService) {}

  getCurriculumSummary() {
    return this.api.get<CurriculumSummary>('/reports-analytics/curriculum/summary');
  }

  getCurriculumFilters() {
    return this.api.get<CurriculumFilters>('/reports-analytics/curriculum/filters');
  }

  listCurriculumModules(params: { courseId?: string; moduleId?: string; status?: CurriculumStatusFilter; sort?: CurriculumModuleSort }) {
    return this.api.get<CurriculumModuleAnalytics[]>('/reports-analytics/curriculum/modules', params);
  }

  getModuleTeacherProgress(moduleId: string) {
    return this.api.get<ModuleTeacherProgress>(`/reports-analytics/curriculum/modules/${moduleId}/teachers`);
  }
}
