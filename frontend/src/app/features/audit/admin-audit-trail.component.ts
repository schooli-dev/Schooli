import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuditApiService, AuditLogItem, AuditModuleOption, AuditQuery } from '../../core/audit/audit-api.service';
import { ToastService } from '../../core/toast/toast.service';

type DayGroup = { day: string; items: AuditLogItem[] };

/**
 * Admin-only, read-only history of important actions (currently the Homework module).
 * Filter by module, date range, the event types to include and free text; open one record's full timeline.
 */
@Component({
  selector: 'app-admin-audit-trail',
  standalone: true,
  imports: [DatePipe, DecimalPipe, FormsModule],
  templateUrl: './admin-audit-trail.component.html',
  styleUrl: './admin-audit-trail.component.scss'
})
export class AdminAuditTrailComponent implements OnInit {
  private readonly api = inject(AuditApiService);
  private readonly toasts = inject(ToastService);

  protected readonly modules = signal<AuditModuleOption[]>([]);
  protected readonly items = signal<AuditLogItem[]>([]);
  protected readonly loading = signal(true);
  protected readonly pagination = signal({ page: 1, limit: 25, total: 0, totalPages: 1 });

  protected module = '';
  protected search = '';
  protected actorRole = '';
  protected from = '';
  protected to = '';
  protected sort: 'asc' | 'desc' = 'desc';
  protected readonly selectedActions = signal<string[]>([]);

  /** Set when the admin opens one homework's full timeline (oldest first). */
  protected readonly focus = signal<AuditLogItem | null>(null);

  protected readonly actionOptions = computed(() => {
    const all = this.modules();
    const chosen = this.moduleSignal();
    return (chosen ? all.filter((item) => item.key === chosen) : all).flatMap((item) => item.actions);
  });
  private readonly moduleSignal = signal('');

  protected readonly groups = computed<DayGroup[]>(() => {
    const groups: DayGroup[] = [];
    for (const item of this.items()) {
      const day = new Date(item.createdAt).toDateString();
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(item);
      else groups.push({ day, items: [item] });
    }
    return groups;
  });

  ngOnInit(): void {
    this.api.modules().subscribe({ next: (response) => this.modules.set(response.data), error: () => undefined });
    this.load(1);
  }

  protected onModuleChange(): void {
    this.moduleSignal.set(this.module);
    // Event types belong to a module, so drop the ones that no longer apply.
    const valid = new Set(this.actionOptions().map((option) => option.key));
    this.selectedActions.update((current) => current.filter((key) => valid.has(key)));
    this.load(1);
  }

  protected toggleAction(key: string): void {
    this.selectedActions.update((current) => (current.includes(key) ? current.filter((item) => item !== key) : [...current, key]));
    this.load(1);
  }

  protected quickRange(days: number): void {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    this.from = this.toInputDate(start);
    this.to = this.toInputDate(end);
    this.load(1);
  }

  protected clear(): void {
    this.module = '';
    this.moduleSignal.set('');
    this.search = '';
    this.actorRole = '';
    this.from = '';
    this.to = '';
    this.sort = 'desc';
    this.selectedActions.set([]);
    this.focus.set(null);
    this.load(1);
  }

  protected openTimeline(item: AuditLogItem): void {
    if (!item.entityId) return;
    this.focus.set(item);
    this.sort = 'asc';
    this.load(1);
  }

  protected closeTimeline(): void {
    this.focus.set(null);
    this.sort = 'desc';
    this.load(1);
  }

  protected goToPage(page: number): void {
    const meta = this.pagination();
    if (page < 1 || page > meta.totalPages || page === meta.page) return;
    this.load(page);
  }

  protected load(page: number): void {
    this.loading.set(true);
    const query: AuditQuery = {
      page,
      limit: this.pagination().limit,
      module: this.module || undefined,
      actions: this.selectedActions(),
      search: this.search.trim() || undefined,
      actorRole: this.actorRole || undefined,
      from: this.from ? new Date(`${this.from}T00:00:00`).toISOString() : undefined,
      to: this.to ? new Date(`${this.to}T23:59:59.999`).toISOString() : undefined,
      entityId: this.focus()?.entityId ?? undefined,
      sort: this.sort
    };
    this.api.list(query).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.pagination.set(response.pagination ?? { page, limit: query.limit ?? 25, total: response.data.length, totalPages: 1 });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toasts.error('The audit trail could not be loaded.');
      }
    });
  }

  protected moduleLabel(key: string): string {
    return this.modules().find((item) => item.key === key)?.label ?? key;
  }

  protected tone(action: string): string {
    if (action.endsWith('completed')) return 'ok';
    if (action.endsWith('revision_required') || action.endsWith('withdrawn')) return 'danger';
    if (action.endsWith('submitted') || action.endsWith('resubmitted')) return 'info';
    if (action.endsWith('reviewed') || action.endsWith('updated')) return 'warn';
    return 'primary';
  }

  protected icon(action: string): string {
    const icons: Record<string, string> = {
      'homework.assigned': 'bi-journal-plus',
      'homework.updated': 'bi-pencil-square',
      'homework.withdrawn': 'bi-journal-x',
      'homework.submitted': 'bi-upload',
      'homework.resubmitted': 'bi-arrow-repeat',
      'homework.reviewed': 'bi-eye',
      'homework.revision_required': 'bi-exclamation-circle',
      'homework.completed': 'bi-check-circle-fill'
    };
    return icons[action] ?? 'bi-record-circle';
  }

  protected actionLabel(action: string): string {
    for (const module of this.modules()) {
      const match = module.actions.find((item) => item.key === action);
      if (match) return match.label;
    }
    return action;
  }

  private toInputDate(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }
}
