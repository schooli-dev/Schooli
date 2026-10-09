import { Component, EventEmitter, Input, OnInit, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CustomHomeworkDraft,
  HomeworkApiService,
  HomeworkAttachment,
  HomeworkLibraryItem,
  HomeworkSubmissionType
} from '../../../core/homework/homework-api.service';

/** "Create Custom Homework": captured here, created for the one student when the attendance is saved. */
@Component({
  selector: 'app-custom-homework-form',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './custom-homework-form.component.html',
  styleUrl: './custom-homework-form.component.scss'
})
export class CustomHomeworkFormComponent implements OnInit {
  @Input({ required: true }) studentName!: string;
  /** Prefill when the teacher reopens the form to edit what they already filled in. */
  @Input() draft: CustomHomeworkDraft | null = null;
  @Output() assigned = new EventEmitter<CustomHomeworkDraft>();
  @Output() closed = new EventEmitter<void>();

  constructor(private readonly homeworkApi: HomeworkApiService) {}

  protected readonly library = signal<HomeworkLibraryItem[]>([]);
  protected readonly uploading = signal(false);
  protected readonly error = signal('');

  protected libraryId = '';
  protected title = '';
  protected instructions = '';
  protected maxPoints = 10;
  protected dueDate = '';
  protected submissionType: HomeworkSubmissionType = 'file';
  protected saveToLibrary = false;
  protected attachments: HomeworkAttachment[] = [];

  protected readonly submissionTypes: Array<{ value: HomeworkSubmissionType; label: string }> = [
    { value: 'file', label: 'File' },
    { value: 'text', label: 'Text' },
    { value: 'link', label: 'Link' },
    { value: 'file_text', label: 'File + Text' }
  ];

  ngOnInit(): void {
    if (this.draft) {
      this.title = this.draft.title;
      this.instructions = this.draft.instructions ?? '';
      this.maxPoints = this.draft.maxPoints;
      this.dueDate = this.draft.dueDate ? this.toLocalInput(this.draft.dueDate) : '';
      this.submissionType = this.draft.submissionType;
      this.attachments = [...this.draft.attachments];
      this.saveToLibrary = this.draft.saveToLibrary;
    }

    this.homeworkApi.listLibrary().subscribe({
      next: (response) => this.library.set(response.data),
      error: () => undefined
    });
  }

  /** Start from a saved homework: copies its fields and attachments into the form. */
  protected useLibraryItem(): void {
    const item = this.library().find((candidate) => candidate.id === this.libraryId);
    if (!item) return;

    this.title = item.title;
    this.instructions = item.instructions ?? '';
    this.maxPoints = item.maxPoints;
    this.submissionType = item.submissionType;
    this.attachments = [...item.attachments];
    this.saveToLibrary = false;
  }

  protected onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';

    for (const file of files) {
      if (this.attachments.length >= 10) {
        this.error.set('You can attach up to 10 files.');
        break;
      }
      this.uploading.set(true);
      this.error.set('');
      this.homeworkApi.uploadAttachment(file).subscribe({
        next: (response) => {
          this.attachments = [...this.attachments, response.data];
          this.uploading.set(false);
        },
        error: (error) => {
          this.uploading.set(false);
          this.error.set(error?.error?.message ?? `${file.name} could not be uploaded.`);
        }
      });
    }
  }

  protected removeAttachment(index: number): void {
    this.attachments = this.attachments.filter((_, position) => position !== index);
  }

  protected submit(): void {
    const title = this.title.trim();
    const points = Number(this.maxPoints);

    if (title.length < 2) {
      this.error.set('Enter a title for the homework.');
      return;
    }
    if (!Number.isInteger(points) || points < 1 || points > 1000) {
      this.error.set('Maximum points must be a whole number between 1 and 1000.');
      return;
    }
    if (this.uploading()) {
      this.error.set('Wait for the file upload to finish.');
      return;
    }
    const due = this.dueDate ? new Date(this.dueDate) : null;
    if (due && due.getTime() <= Date.now()) {
      this.error.set('Choose a due date in the future.');
      return;
    }

    this.assigned.emit({
      title,
      instructions: this.instructions.trim() || null,
      maxPoints: points,
      dueDate: due ? due.toISOString() : null,
      submissionType: this.submissionType,
      attachments: this.attachments,
      saveToLibrary: this.saveToLibrary
    });
  }

  protected formatSize(bytes: number | null | undefined): string {
    if (!bytes) return '';
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /** ISO -> the value format of <input type="datetime-local"> in the browser's timezone. */
  private toLocalInput(iso: string): string {
    const date = new Date(iso);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
}
