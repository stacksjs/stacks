import { format } from './format'
import { parse } from './parse'

type DateInput = Date | string

interface FormatOptions {
  locale?: string
  tz?: string
}

/**
 * A fluent DateTime wrapper inspired by Laravel's Carbon.
 *
 * Provides chainable date manipulation, formatting, and comparison
 * with zero external dependencies.
 */
export class DateTime {
  private date: Date

  constructor(date?: DateInput, formatStr?: string) {
    if (!date) {
      this.date = new Date()
    }
    else if (date instanceof Date) {
      this.date = new Date(date.getTime())
    }
    else if (formatStr) {
      this.date = parse(date, formatStr)
    }
    else {
      this.date = parse(date)
    }
  }

  // ── Factory methods ──────────────────────────────────

  static now(): DateTime {
    return new DateTime()
  }

  static create(year: number, month = 1, day = 1, hour = 0, minute = 0, second = 0): DateTime {
    return new DateTime(new Date(year, month - 1, day, hour, minute, second))
  }

  static fromDate(date: Date): DateTime {
    return new DateTime(date)
  }

  static parse(dateStr: string, formatStr?: string): DateTime {
    return new DateTime(dateStr, formatStr)
  }

  // ── Formatting ───────────────────────────────────────

  format(formatStr: string, localeOrOptions?: string | FormatOptions): string {
    return format(this.date, formatStr, localeOrOptions)
  }

  toDateString(): string {
    return format(this.date, 'YYYY-MM-DD')
  }

  toTimeString(): string {
    return format(this.date, 'HH:mm:ss')
  }

  toDateTimeString(): string {
    return format(this.date, 'YYYY-MM-DD HH:mm:ss')
  }

  toISOString(): string {
    return this.date.toISOString()
  }

  toString(): string {
    return this.toDateTimeString()
  }

  // ── Getters ──────────────────────────────────────────

  get year(): number { return this.date.getFullYear() }
  get month(): number { return this.date.getMonth() + 1 }
  get day(): number { return this.date.getDate() }
  get hour(): number { return this.date.getHours() }
  get minute(): number { return this.date.getMinutes() }
  get second(): number { return this.date.getSeconds() }
  get dayOfWeek(): number { return this.date.getDay() }
  get timestamp(): number { return this.date.getTime() }

  // ── Setters (return new instance) ────────────────────

  setYear(year: number): DateTime {
    const d = new Date(this.date)
    d.setFullYear(year)
    return new DateTime(d)
  }

  setMonth(month: number): DateTime {
    const d = new Date(this.date)
    d.setMonth(month - 1)
    return new DateTime(d)
  }

  setDay(day: number): DateTime {
    const d = new Date(this.date)
    d.setDate(day)
    return new DateTime(d)
  }

  setHour(hour: number): DateTime {
    const d = new Date(this.date)
    d.setHours(hour)
    return new DateTime(d)
  }

  setMinute(minute: number): DateTime {
    const d = new Date(this.date)
    d.setMinutes(minute)
    return new DateTime(d)
  }

  setSecond(second: number): DateTime {
    const d = new Date(this.date)
    d.setSeconds(second)
    return new DateTime(d)
  }

  // ── Manipulation (return new instance) ───────────────

  addSeconds(n: number): DateTime {
    return new DateTime(new Date(this.date.getTime() + n * 1000))
  }

  addMinutes(n: number): DateTime {
    return new DateTime(new Date(this.date.getTime() + n * 60000))
  }

  addHours(n: number): DateTime {
    return new DateTime(new Date(this.date.getTime() + n * 3600000))
  }

  addDays(n: number): DateTime {
    const d = new Date(this.date)
    d.setDate(d.getDate() + n)
    return new DateTime(d)
  }

  addWeeks(n: number): DateTime {
    return this.addDays(n * 7)
  }

  addMonths(n: number): DateTime {
    const d = new Date(this.date)
    d.setMonth(d.getMonth() + n)
    return new DateTime(d)
  }

  addYears(n: number): DateTime {
    const d = new Date(this.date)
    d.setFullYear(d.getFullYear() + n)
    return new DateTime(d)
  }

  subSeconds(n: number): DateTime { return this.addSeconds(-n) }
  subMinutes(n: number): DateTime { return this.addMinutes(-n) }
  subHours(n: number): DateTime { return this.addHours(-n) }
  subDays(n: number): DateTime { return this.addDays(-n) }
  subWeeks(n: number): DateTime { return this.addWeeks(-n) }
  subMonths(n: number): DateTime { return this.addMonths(-n) }
  subYears(n: number): DateTime { return this.addYears(-n) }

  // ── Start/End of period ──────────────────────────────

  startOfDay(): DateTime {
    const d = new Date(this.date)
    d.setHours(0, 0, 0, 0)
    return new DateTime(d)
  }

  endOfDay(): DateTime {
    const d = new Date(this.date)
    d.setHours(23, 59, 59, 999)
    return new DateTime(d)
  }

  startOfMonth(): DateTime {
    const d = new Date(this.date)
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return new DateTime(d)
  }

  endOfMonth(): DateTime {
    const d = new Date(this.date.getFullYear(), this.date.getMonth() + 1, 0, 23, 59, 59, 999)
    return new DateTime(d)
  }

  startOfYear(): DateTime {
    return new DateTime(new Date(this.date.getFullYear(), 0, 1, 0, 0, 0, 0))
  }

  endOfYear(): DateTime {
    return new DateTime(new Date(this.date.getFullYear(), 11, 31, 23, 59, 59, 999))
  }

  // ── Comparison ───────────────────────────────────────

  isBefore(other: DateTime | Date): boolean {
    const otherTime = other instanceof DateTime ? other.timestamp : other.getTime()
    return this.date.getTime() < otherTime
  }

  isAfter(other: DateTime | Date): boolean {
    const otherTime = other instanceof DateTime ? other.timestamp : other.getTime()
    return this.date.getTime() > otherTime
  }

  isSame(other: DateTime | Date): boolean {
    const otherTime = other instanceof DateTime ? other.timestamp : other.getTime()
    return this.date.getTime() === otherTime
  }

  isSameDay(other: DateTime | Date): boolean {
    const o = other instanceof Date ? other : other.toNativeDate()
    return this.date.getFullYear() === o.getFullYear()
      && this.date.getMonth() === o.getMonth()
      && this.date.getDate() === o.getDate()
  }

  isBetween(start: DateTime | Date, end: DateTime | Date): boolean {
    return this.isAfter(start) && this.isBefore(end)
  }

  isPast(): boolean {
    return this.date.getTime() < Date.now()
  }

  isFuture(): boolean {
    return this.date.getTime() > Date.now()
  }

  isToday(): boolean {
    return this.isSameDay(new Date())
  }

  isLeapYear(): boolean {
    const y = this.date.getFullYear()
    return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
  }

  // ── Difference ───────────────────────────────────────

  diffInSeconds(other: DateTime | Date): number {
    const otherTime = other instanceof DateTime ? other.timestamp : other.getTime()
    return Math.floor((this.date.getTime() - otherTime) / 1000)
  }

  diffInMinutes(other: DateTime | Date): number {
    return Math.floor(this.diffInSeconds(other) / 60)
  }

  diffInHours(other: DateTime | Date): number {
    return Math.floor(this.diffInSeconds(other) / 3600)
  }

  diffInDays(other: DateTime | Date): number {
    return Math.floor(this.diffInSeconds(other) / 86400)
  }

  // ── Conversion ───────────────────────────────────────

  toNativeDate(): Date {
    return new Date(this.date.getTime())
  }

  toJSON(): string {
    return this.toISOString()
  }

  valueOf(): number {
    return this.date.getTime()
  }
}

/**
 * Get the current date/time as a DateTime instance.
 * Inspired by Laravel's `now()` helper.
 *
 * @example
 * ```ts
 * now().toDateString()        // '2024-03-15'
 * now().format('MMMM D, YYYY') // 'March 15, 2024'
 * now().addDays(7).toDateString()
 * now().startOfMonth().toDateString()
 * now().diffInDays(someOtherDate)
 * ```
 */
export function now(): DateTime {
  return DateTime.now()
}
