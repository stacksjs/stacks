import type { CatchCallbackFn, Cron } from '@stacksjs/cron'

// IANA Timezone
export type Timezone =
  | 'Africa/Abidjan'
  | 'Africa/Accra'
  | 'Africa/Addis_Ababa'
  | 'Africa/Algiers'
  | 'Africa/Cairo'
  | 'Africa/Casablanca'
  | 'Africa/Lagos'
  | 'Africa/Nairobi'
  | 'America/Anchorage'
  | 'America/Argentina/Buenos_Aires'
  | 'America/Bogota'
  | 'America/Caracas'
  | 'America/Chicago'
  | 'America/Denver'
  | 'America/Detroit'
  | 'America/Halifax'
  | 'America/Los_Angeles'
  | 'America/Mexico_City'
  | 'America/New_York'
  | 'America/Phoenix'
  | 'America/Santiago'
  | 'America/Sao_Paulo'
  | 'America/Toronto'
  | 'America/Vancouver'
  | 'Asia/Bangkok'
  | 'Asia/Dubai'
  | 'Asia/Hong_Kong'
  | 'Asia/Istanbul'
  | 'Asia/Jakarta'
  | 'Asia/Jerusalem'
  | 'Asia/Karachi'
  | 'Asia/Kolkata'
  | 'Asia/Kuwait'
  | 'Asia/Manila'
  | 'Asia/Shanghai'
  | 'Asia/Singapore'
  | 'Asia/Tokyo'
  | 'Australia/Melbourne'
  | 'Australia/Perth'
  | 'Australia/Sydney'
  | 'Europe/Amsterdam'
  | 'Europe/Athens'
  | 'Europe/Belgrade'
  | 'Europe/Berlin'
  | 'Europe/Brussels'
  | 'Europe/Budapest'
  | 'Europe/Copenhagen'
  | 'Europe/Dublin'
  | 'Europe/Helsinki'
  | 'Europe/Istanbul'
  | 'Europe/Lisbon'
  | 'Europe/London'
  | 'Europe/Madrid'
  | 'Europe/Moscow'
  | 'Europe/Paris'
  | 'Europe/Prague'
  | 'Europe/Rome'
  | 'Europe/Stockholm'
  | 'Europe/Vienna'
  | 'Europe/Warsaw'
  | 'Europe/Zurich'
  | 'Pacific/Auckland'
  | 'Pacific/Fiji'
  | 'Pacific/Honolulu'
  | 'UTC'

// Base interface for common methods
export interface BaseSchedule {
  withErrorHandler: (handler: CatchCallbackFn) => this
  withMaxRuns: (runs: number) => this
  withProtection: (callback?: (job: Cron) => void) => this
  withName: (name: string) => this
  withContext: (context: any) => this
  withInterval: (seconds: number) => this
  between: (startAt: string | Date, stopAt: string | Date) => this
  setTimeZone: (timezone: Timezone) => this
}

// Interface for schedule after timing is set
export interface TimedSchedule extends BaseSchedule {
  // Only includes the configuration methods, no timing methods
}

// Interface for schedule before timing is set
export interface UntimedSchedule extends BaseSchedule {
  everySecond: () => TimedSchedule
  everyMinute: () => TimedSchedule
  everyTwoMinutes: () => TimedSchedule
  everyFiveMinutes: () => TimedSchedule
  everyTenMinutes: () => TimedSchedule
  everyThirtyMinutes: () => TimedSchedule
  everyHour: () => TimedSchedule
  everyDay: () => TimedSchedule
  hourly: () => TimedSchedule
  daily: () => TimedSchedule
  weekly: () => TimedSchedule
  monthly: () => TimedSchedule
  yearly: () => TimedSchedule
  annually: () => TimedSchedule
  onDays: (days: number[]) => TimedSchedule
  at: (time: string) => TimedSchedule
}
