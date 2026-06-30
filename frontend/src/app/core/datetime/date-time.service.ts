import { Injectable } from '@angular/core';

export type TimePreview = {
  label: string;
  timezone: string;
  value: string;
  muted?: boolean;
};

@Injectable({ providedIn: 'root' })
export class DateTimeService {
  readonly fallbackTimezone = 'Asia/Kolkata';

  browserTimezone(): string {
    return this.isValidTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone)
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : this.fallbackTimezone;
  }

  isValidTimezone(timezone: string | null | undefined): timezone is string {
    if (!timezone) {
      return false;
    }

    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
      return true;
    } catch {
      return false;
    }
  }

  localDateTimeToUtc(localValue: string, timezone: string): Date {
    const parsed = this.parseLocalValue(localValue);
    const targetTimezone = this.isValidTimezone(timezone) ? timezone : this.fallbackTimezone;
    let utc = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute));

    for (let index = 0; index < 4; index += 1) {
      const actual = this.partsInTimezone(utc, targetTimezone);
      const targetMinutes = Date.UTC(parsed.year, parsed.month - 1, parsed.day, parsed.hour, parsed.minute) / 60000;
      const actualMinutes = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute) / 60000;
      const deltaMinutes = targetMinutes - actualMinutes;

      if (deltaMinutes === 0) {
        break;
      }

      utc = new Date(utc.getTime() + deltaMinutes * 60000);
    }

    return utc;
  }

  toLocalInputValue(value: Date | string, timezone: string): string {
    const date = value instanceof Date ? value : new Date(value);
    const parts = this.partsInTimezone(date, this.isValidTimezone(timezone) ? timezone : this.fallbackTimezone);

    return `${parts.year}-${this.pad(parts.month)}-${this.pad(parts.day)}T${this.pad(parts.hour)}:${this.pad(parts.minute)}`;
  }

  formatDateTime(value: Date | string, timezone: string, includeZone = true): string {
    const date = value instanceof Date ? value : new Date(value);
    const targetTimezone = this.isValidTimezone(timezone) ? timezone : this.fallbackTimezone;

    return new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: includeZone ? 'short' : undefined
    }).format(date);
  }

  formatTimeRange(start: Date | string, end: Date | string, timezone: string): string {
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    const targetTimezone = this.isValidTimezone(timezone) ? timezone : this.fallbackTimezone;
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: targetTimezone,
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `${dateFormatter.format(startDate)}, ${timeFormatter.format(startDate)} - ${timeFormatter.format(endDate)}`;
  }

  private parseLocalValue(value: string): { year: number; month: number; day: number; hour: number; minute: number } {
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);

    if (!match) {
      throw new Error('Expected datetime-local value');
    }

    return {
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
      hour: Number(match[4]),
      minute: Number(match[5])
    };
  }

  private partsInTimezone(date: Date, timezone: string): { year: number; month: number; day: number; hour: number; minute: number } {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(date);
    const map = new Map(parts.map((part) => [part.type, part.value]));

    return {
      year: Number(map.get('year')),
      month: Number(map.get('month')),
      day: Number(map.get('day')),
      hour: Number(map.get('hour')),
      minute: Number(map.get('minute'))
    };
  }

  private pad(value: number): string {
    return value.toString().padStart(2, '0');
  }
}
