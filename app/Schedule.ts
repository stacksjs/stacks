import run from '@stacksjs/scheduler'

export default function () {
  run.command('bun /home/some/script.js').everySecond()
  run.command('bun /home/some/other/script.ts').everyMinute()
  run.job('DummyJob.ts').everyTenMinutes() // scans ./app/Jobs/*
  // schedule.action('SomeAction.ts').everyFiveMinutes() // you may also trigger an action - scans ./app/Actions/*
  run.exec('bun /home/some/script.ts').everyMinute()
  run.call(() => {
    // eslint-disable-next-line no-console
    console.log('a "fancy callback" that runs weekly (Mondays) at 1:00 PM PT')
  }).weekly().mondays().at('13:00').timezone('America/Los_Angeles')
}
