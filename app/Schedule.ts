import type { Schedule, Scheduler } from '../.stacks/core/types/src/scheduler'

export default {
  schedule(schedule: Schedule) {
    schedule.command('bun /home/some/script.js').everySecond()
    schedule.command('bun /home/some/other/script.ts').everyMinute()
    schedule.action('./actions/SomeAction.ts').everyFiveMinutes() // could use a better dummy example 😅
    schedule.job('./jobs/DummyJob.ts').everyTenMinutes()
    schedule.exec('bun /home/some/script.ts').everyMinute()
    schedule.call(() => {
      // ...
    }).weekly().mondays().at('13:00').timezone('America/Los_Angeles')
  },
} satisfies Scheduler
