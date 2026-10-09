import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type HomeworkSubmissionType = 'file' | 'text' | 'link' | 'file_text';

/** A file already uploaded to private storage (POST /homework/uploads), referenced by key. */
export type HomeworkAttachment = {
  storageKey: string;
  fileName: string;
  mimeType?: string | null;
  sizeBytes?: number | null;
};

/** The "Create Custom Homework" form. It is created for one student when the attendance is saved. */
export type CustomHomeworkDraft = {
  title: string;
  instructions: string | null;
  maxPoints: number;
  dueDate: string | null;
  submissionType: HomeworkSubmissionType;
  attachments: HomeworkAttachment[];
  saveToLibrary: boolean;
};

export type HomeworkLibraryItem = {
  id: string;
  title: string;
  instructions: string | null;
  maxPoints: number;
  submissionType: HomeworkSubmissionType;
  attachments: HomeworkAttachment[];
  createdAt: string;
};

// ---------------------------------------------------------------- assigned homework

/** assigned = Pending, submitted = Pending Review / Submitted, needs_revision, completed. Overdue is derived. */
export type HomeworkStatus = 'assigned' | 'submitted' | 'needs_revision' | 'completed';
export type HomeworkFilter = 'all' | 'pending' | 'submitted' | 'needs_revision' | 'completed' | 'completed_this_week' | 'overdue';

export type HomeworkListItem = {
  id: string;
  title: string;
  homeworkType: 'custom' | 'curriculum' | string;
  status: HomeworkStatus;
  isOverdue: boolean;
  studentId: string;
  studentName: string;
  teacherId: string;
  teacherName: string;
  courseName: string | null;
  moduleName: string | null;
  moduleSortOrder: number | null;
  lessonNumber: number | null;
  lessonTitle: string | null;
  assignedAt: string;
  dueDate: string | null;
  maxPoints: number | null;
  submissionType: HomeworkSubmissionType;
  attempts: number;
  latestPoints: number | null;
  completedAt: string | null;
};

export type HomeworkSummary = {
  pending: number;
  submitted: number;
  needsRevision: number;
  completed: number;
  completedThisWeek: number;
  overdue: number;
  pendingReview: number;
  revisionRequired: number;
};

export type HomeworkFileRef = { id: string; fileName: string; mimeType: string | null; sizeBytes: number | null };

export type HomeworkAttempt = {
  id: string;
  attemptNumber: number;
  /** submitted | resubmission_requested | accepted */
  status: string;
  text: string | null;
  link: string | null;
  comment: string | null;
  submittedAt: string;
  pointsAwarded: number | null;
  feedback: string | null;
  reviewedAt: string | null;
  files: HomeworkFileRef[];
};

export type HomeworkDetail = HomeworkListItem & {
  instructions: string | null;
  classId: string | null;
  /** The curriculum homework document (a file, or an external link). */
  document: { title: string; sourceType: 'file' | 'link'; fileName: string | null; mimeType: string | null; externalUrl: string | null } | null;
  attachments: HomeworkFileRef[];
  canSubmit: boolean;
  canReview: boolean;
  attemptsDetail: HomeworkAttempt[];
};

export type SubmitHomeworkPayload = {
  text?: string;
  link?: string;
  comment?: string;
  files: HomeworkAttachment[];
};

export type ReviewHomeworkPayload = {
  result: 'complete' | 'revision';
  points: number;
  feedback?: string;
};

@Injectable({ providedIn: 'root' })
export class HomeworkApiService {
  constructor(private readonly api: ApiClientService) {}

  // teacher attachments + library
  uploadAttachment(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post<HomeworkAttachment>('/homework/uploads', body);
  }

  listLibrary() {
    return this.api.get<HomeworkLibraryItem[]>('/homework/library');
  }

  // dashboards / lists (role-scoped by the backend)
  list(status: HomeworkFilter = 'all', search = '') {
    return this.api.get<HomeworkListItem[]>('/homework', { status, search });
  }

  summary() {
    return this.api.get<HomeworkSummary>('/homework/summary');
  }

  detail(id: string) {
    return this.api.get<HomeworkDetail>(`/homework/${id}`);
  }

  // student
  uploadSubmissionFile(file: File) {
    const body = new FormData();
    body.append('file', file, file.name);
    return this.api.post<HomeworkAttachment>('/homework/submission-uploads', body);
  }

  submit(id: string, payload: SubmitHomeworkPayload) {
    return this.api.post<HomeworkDetail>(`/homework/${id}/submissions`, payload);
  }

  // teacher
  review(id: string, payload: ReviewHomeworkPayload) {
    return this.api.post<HomeworkDetail>(`/homework/${id}/review`, payload);
  }

  // private files
  documentFile(id: string) {
    return this.api.getBlob(`/homework/${id}/document/file`);
  }

  resourceFile(id: string, resourceId: string) {
    return this.api.getBlob(`/homework/${id}/resources/${resourceId}/file`);
  }

  submissionFile(id: string, submissionId: string, fileId: string) {
    return this.api.getBlob(`/homework/${id}/submissions/${submissionId}/files/${fileId}/file`);
  }
}
