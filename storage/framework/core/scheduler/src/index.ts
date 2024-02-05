/* eslint-disable no-new */
import { CronJob } from 'cron'

export interface Schedule {
  action: (action: string) => this
  command: (cmd: string) => this
  job: (job: string) => this
  exec: (cmd: string) => this
  call: (callback: () => void) => this
  everyMinute: () => this
  everySecond: () => this
  everyFiveMinutes: () => this
  everyTenMinutes: () => this
  everyThirtyMinutes: () => this
  hourly: () => this
  daily: () => this
  twiceDaily: (hour1: number, hour2: number) => this
  weekly: () => this
  monthly: () => this
  quarterly: () => this
  yearly: () => this
  weekdays: () => this
  weekends: () => this
  mondays: () => this
  tuesdays: () => this
  wednesdays: () => this
  thursdays: () => this
  fridays: () => this
  saturdays: () => this
  sundays: () => this
  between: (startTime: string, endTime: string) => this
  timezone: (timezone: string) => this
  when: (callback: () => boolean) => this
  at: (time: string) => this
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

interface SchedulerOption {
  timezone: string // TODO: create a better type
  enable: boolean
}

export function run(callback: Function, options?: SchedulerOption): Scheduler {
  return {
    everySecond: () => {
      new CronJob(
        '* * * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everySeconds: (seconds = 1) => {
      new CronJob(
        `*/${seconds} * * * * *`,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyMinute: () => {
      new CronJob(
        '0 * * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyTwoMinutes: () => {
      new CronJob(
        '*/2 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyThreeMinutes: () => {
      new CronJob(
        '*/3 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyFourMinutes: () => {
      new CronJob(
        '*/4 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyFiveMinutes: () => {
      new CronJob(
        '*/5 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyTenMinutes: () => {
      new CronJob(
        '*/10 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyFifteenMinutes: () => {
      new CronJob(
        '*/15 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyThirtyMinutes: () => {
      new CronJob(
        '*/30 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyMinutes: (minutes: number) => {
      new CronJob(
        `*/${minutes} * * * *`,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    hourly: () => {
      new CronJob(
        '0 * * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyHours: (hours: number) => {
      new CronJob(
        `0 */${hours} * * *`,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    hourlyAt: (minute: number) => {
      new CronJob(
        `${minute} * * * *`,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyOddHour: () => {
      new CronJob(
        '0 */2 * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyTwoHours: () => {
      new CronJob(
        '0 */2 * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyThreeHours: () => {
      new CronJob(
        '0 */3 * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyFourHours: () => {
      new CronJob(
        '0 */4 * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everySixHours: () => {
      // cron.schedule('0 */6 * * *', callback)
      new CronJob(
        '0 */6 * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    dailyAt: (hour: number, minute: number) => {
      new CronJob(
        `${minute} ${hour} * * *`,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    daily: () => {
      new CronJob(
        '0 0 * * *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    everyDays: (days: number) => {
      new CronJob(
        `0 0 */${days} * *`,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    weekly: () => {
      new CronJob(
        '0 0 * * 0',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    quarterly: () => {
      new CronJob(
        '0 0 1 */3 *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    yearly: () => {
      new CronJob(
        '0 0 1 1 *',
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        options?.timezone ?? 'America/Los_Angeles',
      )
    },

    cron: (interval: string, timezone?: string) => {
      new CronJob(
        interval,
        () => {
          callback()
        },
        null,
        options?.enable ?? true,
        timezone ?? options?.timezone ?? 'America/Los_Angeles',
      )
    },
  }
}

export { CronJob } from 'cron'

export function useScheduler() {
  return {
    run,
  }
}
