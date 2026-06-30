import { pool } from "../../db/pool.js";
import type { CheckConflictsInput } from "./classes.validation.js";

export type SchedulingConflict = {
  type:
    | "teacher_availability"
    | "teacher_unavailable"
    | "teacher_overlap"
    | "student_overlap";
  message: string;
  details?: unknown;
};

type AvailabilityRow = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  timezone: string;
};

type UnavailableDateRow = {
  id: string;
  unavailable_date: string;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
};

type OverlapRow = {
  id: string;
  title: string;
  start_time: Date;
  end_time: Date;
  status: string;
};

export async function checkSchedulingConflicts(input: CheckConflictsInput): Promise<SchedulingConflict[]> {
  const start = new Date(input.startTime);
  const end = new Date(start.getTime() + input.durationMinutes * 60 * 1000);
  const conflicts: SchedulingConflict[] = [];
  const availability = await pool.query<AvailabilityRow>(
    `
      SELECT id, day_of_week, start_time, end_time, timezone
      FROM teacher_availability
      WHERE teacher_id = $1
        AND is_active = TRUE
      ORDER BY day_of_week, start_time
    `,
    [input.teacherId]
  );

  const matchingAvailability = availability.rows.find((slot) => {
    const localStart = getLocalDateTimeParts(start, slot.timezone);
    const localEnd = getLocalDateTimeParts(end, slot.timezone);

    return (
      localStart.date === localEnd.date &&
      slot.day_of_week === localStart.dayOfWeek &&
      toMinutes(slot.start_time) <= toMinutes(localStart.time) &&
      toMinutes(slot.end_time) >= toMinutes(localEnd.time)
    );
  });

  if (!matchingAvailability) {
    const fallbackTimezone = availability.rows[0]?.timezone ?? input.timezone;
    const localStart = getLocalDateTimeParts(start, fallbackTimezone);
    const localEnd = getLocalDateTimeParts(end, fallbackTimezone);

    conflicts.push({
      type: "teacher_availability",
      message:
        localStart.date === localEnd.date
          ? "Teacher is not available for the requested time window"
          : "Class must fit within one local calendar day for teacher availability validation",
      details: {
        dayOfWeek: localStart.dayOfWeek,
        startTime: localStart.time,
        endTime: localEnd.time,
        timezone: fallbackTimezone,
        scheduleTimezone: input.timezone
      }
    });
  }

  const unavailableTimezones = [...new Set([matchingAvailability?.timezone, ...availability.rows.map((slot) => slot.timezone), input.timezone].filter(Boolean))] as string[];
  const unavailableConflicts = new Set<string>();

  for (const timezone of unavailableTimezones) {
    const localStart = getLocalDateTimeParts(start, timezone);
    const localEnd = getLocalDateTimeParts(end, timezone);

    if (localStart.date !== localEnd.date) {
      continue;
    }

    const unavailableDates = await pool.query<UnavailableDateRow>(
      `
        SELECT id, unavailable_date, start_time, end_time, reason
        FROM teacher_unavailable_dates
        WHERE teacher_id = $1
          AND unavailable_date = $2::DATE
          AND (
            start_time IS NULL
            OR (start_time < $4::TIME AND end_time > $3::TIME)
          )
        ORDER BY start_time
      `,
      [input.teacherId, localStart.date, localStart.time, localEnd.time]
    );

    for (const block of unavailableDates.rows) {
      if (unavailableConflicts.has(block.id)) {
        continue;
      }

      unavailableConflicts.add(block.id);
      conflicts.push({
        type: "teacher_unavailable",
        message: "Teacher has an unavailable date block during this time",
        details: {
          id: block.id,
          date: block.unavailable_date,
          startTime: block.start_time,
          endTime: block.end_time,
          reason: block.reason,
          timezone
        }
      });
    }
  }

  const teacherOverlaps = await findTeacherOverlaps(input.teacherId, start, end, input.excludeClassId);

  for (const overlap of teacherOverlaps) {
    conflicts.push({
      type: "teacher_overlap",
      message: "Teacher has another class during this time",
      details: mapOverlap(overlap)
    });
  }

  const studentOverlaps = await findStudentOverlaps(input.studentId, start, end, input.excludeClassId);

  for (const overlap of studentOverlaps) {
    conflicts.push({
      type: "student_overlap",
      message: "Student has another class during this time",
      details: mapOverlap(overlap)
    });
  }

  return conflicts;
}

async function findTeacherOverlaps(
  teacherId: string,
  start: Date,
  end: Date,
  excludeClassId?: string
): Promise<OverlapRow[]> {
  const values: unknown[] = [teacherId, start, end];
  const excludeClause = excludeClassId ? `AND c.id <> $4` : "";

  if (excludeClassId) {
    values.push(excludeClassId);
  }

  const result = await pool.query<OverlapRow>(
    `
      SELECT c.id, c.title, c.start_time, c.end_time, c.status
      FROM classes c
      WHERE c.teacher_id = $1
        AND c.status IN ('scheduled', 'live')
        AND c.start_time < $3
        AND c.end_time > $2
        ${excludeClause}
      ORDER BY c.start_time
    `,
    values
  );

  return result.rows;
}

async function findStudentOverlaps(
  studentId: string,
  start: Date,
  end: Date,
  excludeClassId?: string
): Promise<OverlapRow[]> {
  const values: unknown[] = [studentId, start, end];
  const excludeClause = excludeClassId ? `AND c.id <> $4` : "";

  if (excludeClassId) {
    values.push(excludeClassId);
  }

  const result = await pool.query<OverlapRow>(
    `
      SELECT c.id, c.title, c.start_time, c.end_time, c.status
      FROM classes c
      JOIN class_participants cp ON cp.class_id = c.id
      WHERE cp.student_id = $1
        AND c.status IN ('scheduled', 'live')
        AND c.start_time < $3
        AND c.end_time > $2
        ${excludeClause}
      ORDER BY c.start_time
    `,
    values
  );

  return result.rows;
}

function getLocalDateTimeParts(date: Date, timezone: string): {
  date: string;
  time: string;
  dayOfWeek: string;
} {
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

function toMinutes(value: string): number {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function mapOverlap(overlap: OverlapRow) {
  return {
    id: overlap.id,
    title: overlap.title,
    startTime: overlap.start_time,
    endTime: overlap.end_time,
    status: overlap.status
  };
}
