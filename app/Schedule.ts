import { run } from '@stacksjs/scheduler'

export default function scheduler() {
  run.command('bun /home/some/script.js').everySecond()
  run.command('bun /home/some/other/script.ts').everyMinute()
  run.action('./actions/SomeAction.ts').everyFiveMinutes() // could use a better dummy example 😅
  run.job('./jobs/DummyJob.ts').everyTenMinutes()
  run.exec('bun /home/some/script.ts').everyMinute()
  run.call(() => {
    // ...
  }).weekly().mondays().at('13:00').timezone('America/Los_Angeles')
}
