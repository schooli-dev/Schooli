import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type CreateTeacherAvailabilityRequest = {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive?: boolean;
};

export type TeacherAvailabilityItem = {
  id: string;
  teacherId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  timezone: string;
  isActive: boolean;
};

export type TeacherUnavailableDate = {
  id: string;
  teacherId: string;
  unavailableDate: string;
  startTime: string | null;
  endTime: string | null;
  reason: string | null;
};

export type TeacherAvailabilityResponse = {
  availability: TeacherAvailabilityItem[];
  unavailableDates: TeacherUnavailableDate[];
};

@Injectable({ providedIn: 'root' })
export class TeacherAvailabilityApiService {
  constructor(private readonly api: ApiClientService) {}

  listAvailability(teacherId: string) {
    return this.api.get<TeacherAvailabilityResponse>(`/teachers/${teacherId}/availability`);
  }

  createAvailability(teacherId: string, payload: CreateTeacherAvailabilityRequest) {
    return this.api.post(`/teachers/${teacherId}/availability`, payload);
  }

  replaceAvailability(teacherId: string, availability: CreateTeacherAvailabilityRequest[]) {
    return this.api.patch<TeacherAvailabilityResponse>(`/teachers/${teacherId}/availability`, { availability });
  }
}
