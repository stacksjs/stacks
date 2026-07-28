import process from 'node:process'
import { existsSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

const testFilePattern = '**/*.{test,spec}.{js,jsx,ts,tsx,mjs,mts,cjs,cts}'

export function resolveTestSuiteFilters(project: string, suites: string[]): string[] {
  const visitedDirectories = new Set<string>()

  return suites.flatMap((suite) => {
    const suiteDirectory = join(project, 'tests', suite)
    if (!existsSync(suiteDirectory))
      return []
    const canonicalDirectory = realpathSync(suiteDirectory)
    if (visitedDirectories.has(canonicalDirectory))
      return []
    visitedDirectories.add(canonicalDirectory)

    return [...new Bun.Glob(testFilePattern).scanSync({ cwd: suiteDirectory, onlyFiles: true })]
      .map(file => suite ? `./tests/${suite}/${file}` : `./tests/${file}`)
  })
}

export async function runTestSuites(suites: string[], timeout?: number): Promise<void> {
  const project = projectPath()
  const filters = resolveTestSuiteFilters(project, suites)

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
