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

// ---------------------------------------------------------------- homework analytics

export type HomeworkDisplayStatus = 'pending' | 'pending_review' | 'revision_required' | 'completed' | 'overdue';
export type HomeworkStatusFilter = 'all' | HomeworkDisplayStatus;
export type HomeworkTypeFilter = 'all' | 'curriculum' | 'custom';
export type HomeworkAssignmentSort = 'assignedDesc' | 'assignedAsc' | 'dueDateAsc' | 'dueDateDesc' | 'studentName';

export type HomeworkAnalyticsSummary = {
  totalAssigned: number;
  pending: number;
  pendingReview: number;
  revisionRequired: number;
  completed: number;
  overdue: number;
};

export type HomeworkFilterPerson = { id: string; name: string };
export type HomeworkFilterCourse = { id: string; name: string };
export type HomeworkFilterModule = { id: string; name: string; courseId: string };
export type HomeworkFilterLesson = { id: string; moduleId: string; lessonNumber: number; title: string };
export type HomeworkAnalyticsFilters = {
  students: HomeworkFilterPerson[];
  teachers: HomeworkFilterPerson[];
  courses: HomeworkFilterCourse[];
  modules: HomeworkFilterModule[];
  lessons: HomeworkFilterLesson[];
};

export type HomeworkAssignmentAnalytics = {
  id: string;
  title: string;
  homeworkType: string;
  status: 'assigned' | 'submitted' | 'needs_revision' | 'completed';
  displayStatus: HomeworkDisplayStatus;
  isOverdue: boolean;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  courseName: string | null;
  moduleName: string | null;
  lessonNumber: number | null;
  lessonTitle: string | null;
  assignedAt: string;
  dueDate: string | null;
  maxPoints: number | null;
  latestPoints: number | null;
  attempts: number;
  completedAt: string | null;
};

export type HomeworkAssignmentDetail = HomeworkAssignmentAnalytics & {
  description: string | null;
  submissionType: string;
};

export type HomeworkSubmissionFile = { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null };

export type HomeworkSubmissionAttempt = {
  id: string;
  attemptNumber: number;
  submittedAt: string;
  submissionText: string | null;
  submissionLink: string | null;
  studentComment: string | null;
  /** submitted | resubmission_requested | accepted */
  status: string;
  pointsAwarded: number | null;
  teacherFeedback: string | null;
  reviewedAt: string | null;
  reviewerName: string | null;
  files: HomeworkSubmissionFile[];
};

export type HomeworkAssignmentDetailResponse = {
  assignment: HomeworkAssignmentDetail;
  attempts: HomeworkSubmissionAttempt[];
};

export type HomeworkAssignmentsQuery = {
  search?: string;
  status?: HomeworkStatusFilter;
  studentId?: string;
  teacherId?: string;
  courseId?: string;
  moduleId?: string;
  lessonId?: string;
  homeworkType?: HomeworkTypeFilter;
  dateFrom?: string;
  dateTo?: string;
  sort?: HomeworkAssignmentSort;
  page?: number;
  limit?: number;
};
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

  getHomeworkSummary() {
    return this.api.get<HomeworkAnalyticsSummary>('/reports-analytics/homework/summary');
  }

  getHomeworkFilters() {
    return this.api.get<HomeworkAnalyticsFilters>('/reports-analytics/homework/filters');
  }

  listHomeworkAssignments(params: HomeworkAssignmentsQuery) {
    return this.api.get<HomeworkAssignmentAnalytics[]>('/reports-analytics/homework/assignments', params);
  }

  getHomeworkAssignmentDetail(id: string) {
    return this.api.get<HomeworkAssignmentDetailResponse>(`/reports-analytics/homework/assignments/${id}`);
  }

  homeworkSubmissionFile(homeworkId: string, submissionId: string, fileId: string) {
    return this.api.getBlob(`/reports-analytics/homework/assignments/${homeworkId}/submissions/${submissionId}/files/${fileId}/file`);
  }
}
