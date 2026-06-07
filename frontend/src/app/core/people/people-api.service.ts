import { Injectable } from '@angular/core';
import { ApiClientService } from '../api/api-client.service';

export type PersonOption = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

@Injectable({ providedIn: 'root' })
export class PeopleApiService {
  constructor(private readonly api: ApiClientService) {}

  listTeachers() {
    return this.api.get<PersonOption[]>('/teachers', { limit: 100 });
  }

  listStudents() {
    return this.api.get<PersonOption[]>('/students', { limit: 100 });
  }
}
