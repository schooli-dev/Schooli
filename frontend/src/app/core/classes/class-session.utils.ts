import type { ClassListItem } from './classes-api.service';

export const CLASS_JOIN_EARLY_MINUTES = 5;

export function isClassJoinWindowOpen(item: ClassListItem, now = Date.now()): boolean {
  const startsAt = new Date(item.startTime).getTime() - CLASS_JOIN_EARLY_MINUTES * 60 * 1000;
  const endsAt = new Date(item.endTime).getTime();
  return now >= startsAt && now < endsAt;
}

export function effectiveClassStatus(item: ClassListItem, now = Date.now()): string {
  return item.status === 'live' && !isClassJoinWindowOpen(item, now) ? 'scheduled' : item.status;
}
