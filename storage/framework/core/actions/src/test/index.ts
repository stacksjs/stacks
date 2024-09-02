import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const process = Bun.spawn(['sh', '-c', 'bun test ./tests/feature/** ./tests/unit/**'], {
  cwd: projectPath(),
  stdio: ['inherit', 'inherit', 'inherit'], // Inherit stdio to see the output in the console
  // env: process.env, // Pass the environment variables
})

const exitCode = await process.exited

if (exitCode !== 0) {
  log.error('Tests failed')
  process.exit(exitCode)
}
