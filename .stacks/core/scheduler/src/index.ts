import cron from 'node-cron'

// export interface Scheduler {
//   schedule(schedule: Schedule): void
// }

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

export class ScheduleImpl implements Schedule {
  private actionName: string = ''
  private commandName: string = ''
  private jobName: string = ''
  private execName: string = ''
  private callback: () => void = () => {}
  private whenCallback: () => boolean = () => true
  private startTime: string = ''
  private endTime: string = ''
  private timezoneName: string = ''
  private time: string = ''

  action(action: string): this {
    this.actionName = action
    return this
  }

  command(cmd: string): this {
    this.commandName = cmd
    return this
  }

  job(job: string): this {
    this.jobName = job
    return this
  }

  exec(cmd: string): this {
    this.execName = cmd
    return this
  }

  call(callback: () => void): this {
    this.callback = callback
    return this
  }

  everyMinute(): this {
    // implementation here
    return this
  }

  everySecond(): this {
    // implementation here
    return this
  }

  everyFiveMinutes(): this {
    // implementation here
    return this
  }

  everyTenMinutes(): this {
    // implementation here
    return this
  }

  everyThirtyMinutes(): this {
    // implementation here
    return this
  }

  hourly(): this {
    // implementation here
    return this
  }

  daily(): this {
    // implementation here
    return this
  }

  twiceDaily(hour1: number, hour2: number): this {
    // implementation here
    return this
  }

  weekly(): this {
    // implementation here
    return this
  }

  monthly(): this {
    // implementation here
    return this
  }

  quarterly(): this {
    // implementation here
    return this
  }

  yearly(): this {
    // implementation here
    return this
  }

  weekdays(): this {
    // implementation here
    return this
  }

  weekends(): this {
    // implementation here
    return this
  }

  mondays(): this {
    // implementation here
    return this
  }

  tuesdays(): this {
    // implementation here
    return this
  }

  wednesdays(): this {
    // implementation here
    return this
  }

  thursdays(): this {
    // implementation here
    return this
  }

  fridays(): this {
    // implementation here
    return this
  }

  saturdays(): this {
    // implementation here
    return this
  }

  sundays(): this {
    // implementation here
    return this
  }

  between(startTime: string, endTime: string): this {
    this.startTime = startTime
    this.endTime = endTime
    return this
  }

  timezone(timezone: string): this {
    this.timezoneName = timezone
    return this
  }

  when(callback: () => boolean): this {
    this.whenCallback = callback
    return this
  }

  at(time: string): this {
    this.time = time
    return this
  }
}

export interface Scheduler {
  everySecond: () => void
  everySeconds: (seconds: number) => void
  everyMinute: () => void
  everyMinutes: (minutes: number) => void
  everyTwoMinutes: () => void
  everyThreeMinutes: () => void
  everyFourMinutes: () => void
  everyFiveMinutes: () => void
  everyTenMinutes: () => void
  everyFifteenMinutes: () => void
  everyThirtyMinutes: () => void
  hourly: () => void
  hourlyAt: (minute: number) => void
  everyOddHour: () => void
  everyHours: (hours: number) => void
  everyTwoHours: () => void
  everyThreeHours: () => void
  everyFourHours: () => void
  everySixHours: () => void
  daily: () => void
  dailyAt: (hour: number, minute: number) => void
  everyDays: (days: number) => void
  weekly: () => void
  quarterly: () => void
  yearly: () => void
  cron: (interval: string, timezone?: string) => void
}

// function run(callback: Function): Scheduler {
function run(callback: ((now: Date | 'manual' | 'init') => void) | string): Scheduler {
  return {
    everySecond: () => {
      cron.schedule('* * * * * *', callback)
    },
    everySeconds: (seconds = 1) => {
      cron.schedule(`*/${seconds} * * * * *`, callback)
    },
    everyMinute: () => {
      cron.schedule('* * * * *', callback)
    },
    everyTwoMinutes: () => {
      cron.schedule('*/2 * * * *', callback)
    },
    everyThreeMinutes: () => {
      cron.schedule('*/3 * * * *', callback)
    },
    everyFourMinutes: () => {
      cron.schedule('*/4 * * * *', callback)
    },
    everyFiveMinutes: () => {
      cron.schedule('*/5 * * * *', callback)
    },
    everyTenMinutes: () => {
      cron.schedule('*/10 * * * *', callback)
    },
    everyFifteenMinutes: () => {
      cron.schedule('*/15 * * * *', callback)
    },
    everyThirtyMinutes: () => {
      cron.schedule('*/30 * * * *', callback)
    },
    everyMinutes: (minutes: number) => {
      cron.schedule(`*/${minutes} * * * *`, callback)
    },
    hourly: () => {
      cron.schedule('0 * * * *', callback)
    },
    everyHours: (hours: number) => {
      cron.schedule(`0 */${hours} * * *`, callback)
    },
    hourlyAt: (minute: number) => {
      cron.schedule(`${minute} * * * *`, callback)
    },
    everyOddHour: () => {
      cron.schedule('0 */2 * * *', callback)
    },
    everyTwoHours: () => {
      cron.schedule('0 */2 * * *', callback)
    },
    everyThreeHours: () => {
      cron.schedule('0 */3 * * *', callback)
    },
    everyFourHours: () => {
      cron.schedule('0 */4 * * *', callback)
    },
    everySixHours: () => {
      cron.schedule('0 */6 * * *', callback)
    },
    dailyAt: (hour: number, minute: number) => {
      cron.schedule(`${minute} ${hour} * * *`, callback)
    },
    daily: () => {
      cron.schedule('0 0 * * *', callback)
    },
    everyDays: (days: number) => {
      cron.schedule(`0 0 */${days} * *`, callback)
    },
    weekly: () => {
      cron.schedule('0 0 * * 0', callback)
    },
    quarterly: () => {
      cron.schedule('0 0 1 */3 *', callback)
    },
    yearly: () => {
      cron.schedule('0 0 1 1 *', callback)
    },
    cron: (interval: string, timezone?: string) => {
      timezone ? cron.schedule(interval, callback, { scheduled: true, timezone }) : cron.schedule(interval, callback)
    },
  }
}

export function useScheduler() {
  return {
    run,
  }
}
