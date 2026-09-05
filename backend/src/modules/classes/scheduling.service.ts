import { pool } from "../../db/pool.js";
import type { CheckConflictsInput } from "./classes.validation.js";

export type SchedulingConflict = {
  type: "teacher_availability" | "teacher_unavailable" | "teacher_overlap" | "student_overlap";
  message: string;
  details?: unknown;
};

type AvailabilityRow = { id: string; day_of_week: string; start_time: string; end_time: string; timezone: string };
type UnavailableDateRow = { id: string; unavailable_date: string; start_time: string | null; end_time: string | null; reason: string | null };
type OverlapRow = { id: string; title: string; start_time: Date; end_time: Date; status: string };
type LocalDateTimeParts = { date: string; time: string; dayOfWeek: string };
type TimeInterval = { start: Date; end: Date };

export async function checkSchedulingConflicts(input: CheckConflictsInput): Promise<SchedulingConflict[]> {
  const start = new Date(input.startTime);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const conflicts: SchedulingConflict[] = [];
  const availabilityResult = await pool.query<AvailabilityRow>(
    `SELECT id, day_of_week, start_time, end_time, timezone
     FROM teacher_availability
     WHERE teacher_id = $1 AND is_active = TRUE
     ORDER BY day_of_week, start_time`,
    [input.teacherId]
  );
  const availability = availabilityResult.rows;
  const teacherTimezone = availability[0]?.timezone ?? input.timezone;
  const localStart = getLocalDateTimeParts(start, teacherTimezone);
  const localEnd = getLocalDateTimeParts(end, teacherTimezone);

  if (!isCoveredByIntervals(start, end, buildAvailabilityIntervals(start, end, availability, teacherTimezone))) {
    conflicts.push({
      type: "teacher_availability",
      message: "Teacher availability does not cover the complete requested time window",
      details: {
        startDate: localStart.date,
        dayOfWeek: localStart.dayOfWeek,
        startTime: localStart.time,
        endDate: localEnd.date,
        endTime: localEnd.time,
        timezone: teacherTimezone,
        scheduleTimezone: input.timezone
      }
    });
  }

  const unavailableDates = await pool.query<UnavailableDateRow>(
    `SELECT id, unavailable_date::TEXT, start_time, end_time, reason
     FROM teacher_unavailable_dates
     WHERE teacher_id = $1 AND unavailable_date = ANY($2::DATE[])
     ORDER BY unavailable_date, start_time`,
    [input.teacherId, localDateRange(localStart.date, localEnd.date)]
  );

  for (const block of unavailableDates.rows) {
    const blockStart = localDateTimeToUtc(block.unavailable_date, block.start_time ?? "00:00", teacherTimezone);
    const blockEnd = localDateTimeToUtc(block.unavailable_date, block.end_time ?? "24:00", teacherTimezone);

    if (blockStart && blockEnd && intervalsOverlap(start, end, blockStart, blockEnd)) {
      conflicts.push({
        type: "teacher_unavailable",
        message: "Teacher has an unavailable date block during this time",
        details: {
          id: block.id,
          date: block.unavailable_date,
          startTime: block.start_time,
          endTime: block.end_time,
          reason: block.reason,
          timezone: teacherTimezone
        }
      });
    }
  }

  for (const overlap of await findTeacherOverlaps(input.teacherId, start, end, input.excludeClassId)) {
    conflicts.push({ type: "teacher_overlap", message: "Teacher has another class during this time", details: mapOverlap(overlap) });
  }
  for (const overlap of await findStudentOverlaps(input.studentId, start, end, input.excludeClassId)) {
    conflicts.push({ type: "student_overlap", message: "Student has another class during this time", details: mapOverlap(overlap) });
  }

  return conflicts;
}

function buildAvailabilityIntervals(classStart: Date, classEnd: Date, availability: AvailabilityRow[], timezone: string): TimeInterval[] {
  const localStart = getLocalDateTimeParts(classStart, timezone);
  const localEnd = getLocalDateTimeParts(classEnd, timezone);
  const slotsByWeekday = new Map<string, AvailabilityRow[]>();

  for (const slot of availability) {
    const slots = slotsByWeekday.get(slot.day_of_week) ?? [];
    slots.push(slot);
    slotsByWeekday.set(slot.day_of_week, slots);
  }

  const intervals: TimeInterval[] = [];
  for (const date of localDateRange(localStart.date, localEnd.date)) {
    for (const slot of slotsByWeekday.get(weekdayForDate(date)) ?? []) {
      const start = localDateTimeToUtc(date, slot.start_time, timezone);
      const end = localDateTimeToUtc(date, slot.end_time, timezone);
      if (start && end && start < end) {
        intervals.push({ start, end });
      }
    }
  }

  return mergeIntervals(intervals);
}

function mergeIntervals(intervals: TimeInterval[]): TimeInterval[] {
  const sorted = [...intervals].sort((left, right) => left.start.getTime() - right.start.getTime());
  const merged: TimeInterval[] = [];

  for (const interval of sorted) {
    const previous = merged[merged.length - 1];
    if (!previous || interval.start > previous.end) {
      merged.push({ ...interval });
    } else if (interval.end > previous.end) {
      previous.end = interval.end;
    }
  }

  return merged;
}

function isCoveredByIntervals(start: Date, end: Date, intervals: TimeInterval[]): boolean {
  let cursor = start;
  for (const interval of intervals) {
    if (interval.end <= cursor) continue;
    if (interval.start > cursor) return false;
    if (interval.end >= end) return true;
    cursor = interval.end;
  }
  return false;
}

function localDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  let current = startDate;
  while (current <= endDate) {
    dates.push(current);
    current = addCalendarDays(current, 1);
  }
  return dates;
}

function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekdayForDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

function localDateTimeToUtc(date: string, time: string, timezone: string): Date | null {
  let localDate = date;
  let localTime = time.slice(0, 5);
  if (localTime === "24:00") {
    localDate = addCalendarDays(localDate, 1);
    localTime = "00:00";
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) return null;
  const [, year, month, day] = match;
  const [hour, minute] = localTime.split(":").map(Number);
  const targetMinutes = Date.UTC(Number(year), Number(month) - 1, Number(day), hour, minute) / 60000;
  let utc = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), hour, minute));

  for (let index = 0; index < 4; index += 1) {
    const actual = getLocalDateTimeParts(utc, timezone);
    const [actualYear, actualMonth, actualDay] = actual.date.split("-").map(Number);
    const [actualHour, actualMinute] = actual.time.split(":").map(Number);
    const actualMinutes = Date.UTC(actualYear, actualMonth - 1, actualDay, actualHour, actualMinute) / 60000;
    const deltaMinutes = targetMinutes - actualMinutes;
    if (deltaMinutes === 0) return utc;
    utc = new Date(utc.getTime() + deltaMinutes * 60 * 1000);
  }

  return null;
}

async function findTeacherOverlaps(teacherId: string, start: Date, end: Date, excludeClassId?: string): Promise<OverlapRow[]> {
  const values: unknown[] = [teacherId, start, end];
  const excludeClause = excludeClassId ? "AND c.id <> $4" : "";
  if (excludeClassId) values.push(excludeClassId);
  const result = await pool.query<OverlapRow>(
    `SELECT c.id, c.title, c.start_time, c.end_time, c.status
     FROM classes c
     WHERE c.teacher_id = $1 AND c.status IN ('scheduled', 'live')
       AND c.start_time < $3 AND c.end_time > $2 ${excludeClause}
     ORDER BY c.start_time`,
    values
  );
  return result.rows;
}

async function findStudentOverlaps(studentId: string, start: Date, end: Date, excludeClassId?: string): Promise<OverlapRow[]> {
  const values: unknown[] = [studentId, start, end];
  const excludeClause = excludeClassId ? "AND c.id <> $4" : "";
  if (excludeClassId) values.push(excludeClassId);
  const result = await pool.query<OverlapRow>(
    `SELECT c.id, c.title, c.start_time, c.end_time, c.status
     FROM classes c JOIN class_participants cp ON cp.class_id = c.id
     WHERE cp.student_id = $1 AND c.status IN ('scheduled', 'live')
       AND c.start_time < $3 AND c.end_time > $2 ${excludeClause}
     ORDER BY c.start_time`,
    values
  );
  return result.rows;
}

function getLocalDateTimeParts(date: Date, timezone: string): LocalDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long"
  }).formatToParts(date);
  const map = new Map(parts.map((part) => [part.type, part.value]));
  return {
    date: `${map.get("year")}-${map.get("month")}-${map.get("day")}`,
    time: `${map.get("hour")}:${map.get("minute")}`,
    dayOfWeek: map.get("weekday")?.toLowerCase() ?? ""
  };
}

function intervalsOverlap(start: Date, end: Date, blockStart: Date, blockEnd: Date): boolean {
  return start < blockEnd && end > blockStart;
}

function mapOverlap(overlap: OverlapRow) {
  return { id: overlap.id, title: overlap.title, startTime: overlap.start_time, endTime: overlap.end_time, status: overlap.status };
}
