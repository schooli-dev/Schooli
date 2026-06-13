import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ClassListItem, ClassesApiService } from '../../core/classes/classes-api.service';

type StudentClassTab = 'upcoming' | 'completed' | 'cancelled' | 'all';

@Component({
  selector: 'app-student-classes',
  standalone: true,
  imports: [DatePipe, FormsModule],
  templateUrl: './student-classes.component.html',
  styleUrl: './student-classes.component.scss'
})
export class StudentClassesComponent implements OnInit {
  protected readonly classes = signal<ClassListItem[]>([]);
  protected readonly activeTab = signal<StudentClassTab>('all');
  protected readonly currentPage = signal(1);
  protected readonly pageSize = 5;
  protected readonly searchText = signal('');
  protected readonly apiWarning = signal('');
  protected readonly cancelRequestOpen = signal(false);
  protected readonly classToCancel = signal<ClassListItem | null>(null);
  protected readonly cancelRequestSubmitting = signal(false);
  protected readonly cancelRequestMessage = signal('');
  protected readonly cancelRequestMessageType = signal<'success' | 'error'>('success');
  protected readonly detailsOpen = signal(false);
  protected readonly selectedClass = signal<ClassListItem | null>(null);
  protected cancelReason = '';
  protected readonly tabs: Array<{ key: StudentClassTab; label: string }> = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'completed', label: 'Completed' },
    { key: 'cancelled', label: 'Cancelled' },
    { key: 'all', label: 'All' }
  ];

  protected readonly filteredClasses = computed(() => {
    const query = this.searchText().trim().toLowerCase();
    const tabFiltered = this.classes().filter((item) => this.matchesTab(item, this.activeTab()));

    if (!query) {
      return tabFiltered;
    }

    return tabFiltered.filter((item) =>
      [item.title, item.teacherName, item.status].some((value) => value.toLowerCase().includes(query))
    );
  });

  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filteredClasses().length / this.pageSize)));

  protected readonly pageNumbers = computed(() => Array.from({ length: this.totalPages() }, (_, index) => index + 1));

  protected readonly pagedClasses = computed(() => {
    const page = Math.min(this.currentPage(), this.totalPages());
    const start = (page - 1) * this.pageSize;
    return this.filteredClasses().slice(start, start + this.pageSize);
  });

  protected readonly nextClass = computed(() =>
    this.classes()
      .filter((item) => ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now())
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0] ?? null
  );

  protected readonly monthCount = computed(() => {
    const now = new Date();
    return this.classes().filter((item) => {
      const start = new Date(item.startTime);
      return start.getMonth() === now.getMonth() && start.getFullYear() === now.getFullYear();
    }).length;
  });

  protected readonly completedCount = computed(() => this.classes().filter((item) => item.status === 'completed').length);

  protected readonly attendancePercent = computed(() => {
    const attended = this.classes().filter((item) => ['present', 'in session'].includes(this.attendance(item).toLowerCase())).length;
    return this.classes().length ? Math.round((attended / this.classes().length) * 100) : 0;
  });

  protected readonly nextClassLabel = computed(() => {
    const next = this.nextClass();
    if (!next) {
      return '--';
    }

    if (next.status === 'live') {
      return 'Live';
    }

    const minutes = Math.max(0, Math.round((new Date(next.startTime).getTime() - Date.now()) / 60000));
    return minutes < 60 ? `${minutes} min` : `${Math.round(minutes / 60)} hr`;
  });

  protected readonly nextClassTitle = computed(() => this.nextClass()?.title ?? 'No upcoming class');

  protected readonly nextClassStatus = computed(() => this.nextClass()?.status ?? 'None');

  protected readonly nextClassTeacher = computed(() => this.nextClass()?.teacherName ?? 'Your upcoming class details will appear here.');

  constructor(
    private readonly classesApi: ClassesApiService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.loadClasses();
  }

  protected clearFilters(): void {
    this.searchText.set('');
    this.activeTab.set('all');
    this.currentPage.set(1);
  }

  protected setActiveTab(tab: StudentClassTab): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
  }

  protected setPage(page: number): void {
    this.currentPage.set(Math.min(Math.max(page, 1), this.totalPages()));
  }

  protected previousPage(): void {
    this.setPage(this.currentPage() - 1);
  }

  protected nextPage(): void {
    this.setPage(this.currentPage() + 1);
  }

  protected tabCount(tab: StudentClassTab): number {
    return this.classes().filter((item) => this.matchesTab(item, tab)).length;
  }

  protected canJoin(item: ClassListItem): boolean {
    return ['live', 'scheduled', 'rescheduled'].includes(item.status) && Boolean(item.videoMeeting?.roomUrl);
  }

  protected joinClass(item: ClassListItem): void {
    void this.router.navigate(['/student/classes', item.id, 'room'], { skipLocationChange: true });
  }

  protected openClassDetails(item: ClassListItem): void {
    this.selectedClass.set(item);
    this.detailsOpen.set(true);
    this.classesApi.getClass(item.id).subscribe({
      next: (response) => this.selectedClass.set(response.data),
      error: () => undefined
    });
  }

  protected closeClassDetails(): void {
    this.detailsOpen.set(false);
  }

  protected canRequestCancellation(item: ClassListItem): boolean {
    return item.status === 'scheduled' && new Date(item.startTime).getTime() > Date.now() && !this.hasPendingCancellationRequest(item);
  }

  protected openCancelRequest(item: ClassListItem): void {
    this.classToCancel.set(item);
    this.cancelReason = '';
    this.cancelRequestMessage.set('');
    this.cancelRequestOpen.set(true);
  }

  protected closeCancelRequest(): void {
    this.cancelRequestOpen.set(false);
  }

  protected submitCancelRequest(): void {
    const item = this.classToCancel();
    const reason = this.cancelReason.trim();

    if (!item) {
      return;
    }

    if (!reason) {
      this.cancelRequestMessageType.set('error');
      this.cancelRequestMessage.set('Please enter a reason for cancellation.');
      return;
    }

    this.cancelRequestSubmitting.set(true);
    this.cancelRequestMessage.set('');

    this.classesApi
      .requestCancellation(item.id, reason)
      .pipe(finalize(() => this.cancelRequestSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.cancelRequestMessageType.set('success');
          this.cancelRequestMessage.set('Cancellation request submitted successfully.');
          this.classes.update((classes) =>
            classes.map((classItem) =>
              classItem.id === item.id
                ? {
                    ...classItem,
                    cancellationRequestStatus: 'pending',
                    cancellationRequestsCount: Math.max(1, classItem.cancellationRequestsCount ?? 0)
                  }
                : classItem
            )
          );
          setTimeout(() => {
            this.closeCancelRequest();
            this.loadClasses();
          }, 700);
        },
        error: (error) => {
          const message = error?.error?.message ?? error?.error?.error?.message;
          this.cancelRequestMessageType.set('error');
          this.cancelRequestMessage.set(message || 'Could not submit cancellation request.');
        }
      });
  }

  private loadClasses(): void {
    this.apiWarning.set('');

    this.classesApi
      .listClasses({ limit: 100 })
      .pipe(finalize(() => undefined))
      .subscribe({
        next: (response) => this.classes.set(response.data),
        error: () => {
          this.apiWarning.set('Could not load student classes from backend.');
          this.classes.set([]);
        }
      });
  }

  private matchesTab(item: ClassListItem, tab: StudentClassTab): boolean {
    if (tab === 'all') {
      return true;
    }

    if (tab === 'upcoming') {
      return ['live', 'scheduled', 'rescheduled'].includes(item.status) && new Date(item.endTime).getTime() >= Date.now();
    }

    return item.status === tab;
  }

  private attendance(item: ClassListItem): string {
    return item.participants[0]?.attendanceStatus ?? 'pending';
  }

  protected attendanceLabel(item: ClassListItem): string {
    return this.attendance(item);
  }

  protected hasPendingCancellationRequest(item: ClassListItem): boolean {
    return item.cancellationRequestStatus === 'pending' || Boolean(item.cancellationRequestsCount);
  }
}
