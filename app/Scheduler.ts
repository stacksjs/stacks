import process from 'node:process'
import { schedule } from '@stacksjs/scheduler'

/**
 * **Scheduler**
 *
 * This is your Scheduler. Because Stacks is fully-typed, you may hover any of the
 * options below and the definitions will be provided. In case you have any
 * questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default function () {
  schedule.job('name').everyMinute().setTimeZone('America/Los_Angeles')
  schedule.action('name').everyFiveMinutes()
  schedule.command('echo "Hello, world!"').daily()
}

process.on('SIGINT', () => {
  schedule.gracefulShutdown().then(() => process.exit(0))
})
