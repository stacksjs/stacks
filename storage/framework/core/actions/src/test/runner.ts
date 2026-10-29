import process from 'node:process'
import { existsSync, realpathSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
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

/**
 * The paths named on the command line, as `buddy test <paths>` passed them.
 *
 * They travel in the environment rather than argv because `buddyOptionArgs`
 * renders an array as one comma-joined value, which cannot round-trip a path
 * containing a comma. `runAction` merges `options.env` into the child process,
 * which is how STACKS_DEV_SERVER already reaches an action.
 */
export function namedTestPaths(): string[] {
  const raw = process.env.STACKS_TEST_PATHS
  if (!raw)
    return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((path): path is string => typeof path === 'string') : []
  }
  catch {
    return []
  }
}

/**
 * Test files under the paths a caller named, as `./`-prefixed paths relative
 * to the project.
 *
 * A path matching no test file THROWS. `buddy test <path>` used to discard the
 * path and run the whole suite, so it reported `0 fail` and exit 0 for a file
 * it never opened: naming a test with 20 failures printed a green
 * (stacksjs/stacks#2973). Falling back to the suite is exactly what turns a
 * typo into a false green, so there is no fallback.
 *
 * The `./` prefix is not cosmetic. bunfig sets `[test] root = "tests"`, so a
 * bare project-relative path matches nothing and `bun test` would report a
 * clean run over no files.
 */
export function resolveNamedTestFiles(project: string, paths: readonly string[]): string[] {
  const found = new Set<string>()

  for (const named of paths) {
    const absolute = resolve(project, named)
    const rel = relative(project, absolute).split('\\').join('/')
    if (rel === '..' || rel.startsWith('../'))
      throw new Error(`Cannot run ${named}: it is outside the project at ${project}`)

    if (!existsSync(absolute))
      throw new Error(`Cannot run ${named}: no such file or directory`)

    if (statSync(absolute).isDirectory()) {
      const under = [...new Bun.Glob(testFilePattern).scanSync({ cwd: absolute, onlyFiles: true })]
        .map(file => `./${rel ? `${rel}/` : ''}${file.split('\\').join('/')}`)
      if (under.length === 0)
        throw new Error(`Cannot run ${named}: it holds no test files`)
      for (const file of under) found.add(file)
      continue
    }

    if (!new Bun.Glob(testFilePattern).match(rel))
      throw new Error(`Cannot run ${named}: a test file is named *.test.ts or *.spec.ts (or .js, .tsx, .mts, ...)`)

    found.add(`./${rel}`)
  }

  return [...found].sort()
}

/**
 * Narrow named test files to one suite, for `test:unit` and `test:feature`.
 *
 * A path outside the suite is an error naming the command that does run it,
 * rather than an empty run reported as a pass.
 */
export function withinSuite(files: readonly string[], suite: string, paths: readonly string[]): string[] {
  const prefix = `./tests/${suite}/`
  const inSuite = files.filter(file => file.startsWith(prefix))
  if (inSuite.length === 0)
    throw new Error(`No ${suite} tests under ${paths.join(' ')}. Run \`buddy test ${paths.join(' ')}\` for the tests that are there.`)
  return inSuite
}

export async function runTestSuites(suites: string[], timeout?: number, paths?: readonly string[]): Promise<void> {
  const project = projectPath()

  let filters: string[]
  if (paths?.length) {
    try {
      const named = resolveNamedTestFiles(project, paths)
      // `['']` is the whole project; a real suite name narrows to it.
      const suite = suites.find(Boolean)
      filters = suite ? withinSuite(named, suite, paths) : named
    }
    catch (error) {
      await log.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    }
  }
  else {
    filters = resolveTestSuiteFilters(project, suites)
  }

  if (filters.length === 0) {
    log.info('No matching tests found.')
    return
  }

  // A subprocess separates tests from Buddy; Bun's file isolation separates
  // each file's globals and module mocks from the next file in that process.
  const args = ['bun', 'test', '--isolate']
  if (timeout)
    args.push('--timeout', String(timeout))
  args.push(...filters)

  const proc = Bun.spawn(args, {
    cwd: project,
    stdio: ['inherit', 'inherit', 'inherit'],
  })
  const exitCode = await proc.exited

  if (exitCode !== 0) {
    await log.error('Tests failed')
    process.exit(exitCode ?? 1)
  }
}
