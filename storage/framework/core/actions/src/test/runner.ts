import process from 'node:process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const testFiles = new Bun.Glob('**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}')

export async function runTestSuites(suites: string[], timeout?: number): Promise<void> {
  const project = projectPath()
  const filters = suites.flatMap((suite) => {
    const suiteDirectory = join(project, 'tests', suite)
    if (!existsSync(suiteDirectory))
      return []

    return [...testFiles.scanSync({ cwd: suiteDirectory, onlyFiles: true })]
      .map(file => suite ? `./tests/${suite}/${file}` : `./tests/${file}`)
  })

  if (filters.length === 0) {
    log.info('No matching tests found.')
    return
  }

  const args = ['bun', 'test']
  if (timeout)
    args.push('--timeout', String(timeout))
  args.push(...filters)

  const proc = Bun.spawn(args, {
    cwd: project,
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    log.error('Tests failed')
    process.exit(exitCode ?? 1)
  }
}
