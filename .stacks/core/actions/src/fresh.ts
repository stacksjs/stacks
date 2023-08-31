import process from 'node:process'
import { ExitCode } from '@stacksjs/types'
import { runCommand } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'
import { cleanProject } from '@stacksjs/utils'

console.log('Cleaning project...')
await cleanProject()

console.log('Installing dependencies...')

const result = await runCommand('bun install', {
  cwd: projectPath()
})

if (result.isErr()) {
  handleError(result.error)
  process.exit(ExitCode.FatalError)
}
