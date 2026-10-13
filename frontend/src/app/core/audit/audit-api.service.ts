import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type AuditModuleOption = {
  key: string;
  label: string;
  actions: Array<{ key: string; label: string }>;
};

export type AuditLogItem = {
  id: string;
  createdAt: string;
  module: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  actorName: string | null;
  actorRole: string | null;
  studentName: string | null;
  homeworkTitle: string | null;
  curriculumModule: string | null;
  lessonLabel: string | null;
  attempt: number | null;
  points: number | null;
  maxPoints: number | null;
  backfilled: boolean;
};

export type AuditQuery = {
  page?: number;
  limit?: number;
  module?: string;
  actions?: string[];
  from?: string;
  to?: string;
  search?: string;
  entityId?: string;
  actorRole?: string;
  sort?: 'asc' | 'desc';
};

@Injectable({ providedIn: 'root' })
export class AuditApiService {
  constructor(private readonly api: ApiClientService) {}

  modules() {
    return this.api.get<AuditModuleOption[]>('/audit/modules');
  }

  list(query: AuditQuery) {
    const { actions, ...rest } = query;
    return this.api.get<AuditLogItem[]>('/audit', { ...rest, actions: actions?.length ? actions.join(',') : undefined });
  }
}
