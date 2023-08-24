import type { Schedule, Scheduler } from '../.stacks/core/types/src/scheduler'

export default <Scheduler> {
  schedule(schedule: Schedule) {
    schedule.command('bun /home/some/script.js').everySecond()
    schedule.command('bun /home/some/other/script.ts').everyMinute()
    schedule.action('path/to/action').everyFiveMinutes()
    schedule.job('path/to/job').everyTenMinutes()
    schedule.exec('bun /home/some/script.js').everyMinute()
    schedule.call(() => {
      // ...
    }).weekly().mondays().at('13:00').timezone('America/Los_Angeles')
  },
}
