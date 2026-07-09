export type TimezoneOption = {
  label: string;
  value: string;
  hint: string;
};

export const TIMEZONE_OPTIONS: TimezoneOption[] = [
  { label: 'IST', value: 'Asia/Kolkata', hint: 'India' },
  { label: 'GMT', value: 'Europe/London', hint: 'United Kingdom' },
  { label: 'CET', value: 'Europe/Paris', hint: 'France' },
  { label: 'CET', value: 'Europe/Berlin', hint: 'Germany' },
  { label: 'EST', value: 'America/New_York', hint: 'US East' },
  { label: 'PST', value: 'America/Los_Angeles', hint: 'US West' },
  { label: 'UTC', value: 'UTC', hint: 'Universal' },
  { label: 'AEST', value: 'Australia/Sydney', hint: 'Australia East' },
  { label: 'JST', value: 'Asia/Tokyo', hint: 'Japan' },
  { label: 'SGT', value: 'Asia/Singapore', hint: 'Singapore' },
  { label: 'GST', value: 'Asia/Dubai', hint: 'UAE' }
];

const TIMEZONE_LABELS = new Map(TIMEZONE_OPTIONS.map((option) => [option.value, option.label]));

export function timezoneShortLabel(timezone: string | null | undefined): string {
  if (!timezone) {
    return 'UTC';
  }

  return TIMEZONE_LABELS.get(timezone) ?? timezone;
}
