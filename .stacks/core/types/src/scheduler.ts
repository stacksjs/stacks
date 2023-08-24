export interface Scheduler {
  schedule(schedule: Schedule): void
}

export interface Schedule {
  action(action: string): this
  command(cmd: string): this
  job(job: string): this
  exec(cmd: string): this
  call(callback: () => void): this
  everyMinute(): this
  everySecond(): this
  everyFiveMinutes(): this
  everyTenMinutes(): this
  everyThirtyMinutes(): this
  hourly(): this
  daily(): this
  twiceDaily(hour1: number, hour2: number): this
  weekly(): this
  monthly(): this
  quarterly(): this
  yearly(): this
  weekdays(): this
  weekends(): this
  mondays(): this
  tuesdays(): this
  wednesdays(): this
  thursdays(): this
  fridays(): this
  saturdays(): this
  sundays(): this
  between(startTime: string, endTime: string): this
  timezone(timezone: string): this
  when(callback: () => boolean): this
  at(time: string): this
}
