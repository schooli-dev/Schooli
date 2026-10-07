import { Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MyStudent, PeopleApiService } from '../../core/people/people-api.service';

@Component({
  selector: 'app-teacher-students',
  standalone: true,
  templateUrl: './teacher-students.component.html',
  styleUrl: './teacher-students.component.scss'
})
export class TeacherStudentsComponent implements OnInit {
  protected readonly students = signal<MyStudent[]>([]);
  protected readonly loading = signal(true);
  protected readonly failed = signal(false);

  constructor(
    private readonly peopleApi: PeopleApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.peopleApi.listMyStudents().subscribe({
      next: (response) => {
        this.students.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.failed.set(true);
        this.loading.set(false);
      }
    });
  }

  protected initials(student: MyStudent): string {
    return student.studentName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  /** Each student's own curriculum, never a shared teacher-level position. */
  protected openCurriculum(student: MyStudent): void {
    void this.router.navigate(['/teacher/students', student.studentId, 'curriculum'], {
      queryParams: student.moduleId ? { moduleId: student.moduleId } : {},
      skipLocationChange: true
    });
  }
}
