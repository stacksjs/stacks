import process from 'node:process'
import { join, relative, resolve, sep } from 'node:path'

export const STACKS_BENCHMARK_MODULES = [
  '@stacksjs/actions',
  '@stacksjs/database',
  '@stacksjs/query-builder',
  '@stacksjs/router',
  '@stacksjs/validation',
] as const

export type StacksBenchmarkModule = typeof STACKS_BENCHMARK_MODULES[number]
export type StacksSourceModules = Record<StacksBenchmarkModule, string>

export function stacksSourceIssues(repoRoot: string, modules: StacksSourceModules): string[] {
  const issues: string[] = []
  for (const specifier of STACKS_BENCHMARK_MODULES) {
    const packageName = specifier.slice('@stacksjs/'.length)
    const expectedRoot = resolve(repoRoot, 'storage', 'framework', 'core', packageName, 'src')
    const resolvedPath = resolve(modules[specifier])
    const fromExpectedRoot = relative(expectedRoot, resolvedPath)
    if (fromExpectedRoot === '..' || fromExpectedRoot.startsWith(`..${sep}`) || resolve(expectedRoot, fromExpectedRoot) !== resolvedPath)
      issues.push(`${specifier} resolved outside ${expectedRoot}: ${resolvedPath}`)
  }
  return issues
}

export function resolveStacksSourceModules(repoRoot: string): StacksSourceModules {
  const probe = Bun.spawnSync([
    process.execPath,
    `--config=${join(repoRoot, 'bench', 'routing', 'bunfig.toml')}`,
    join(repoRoot, 'bench', 'routing', 'fixtures', 'source-probe.ts'),
    ...STACKS_BENCHMARK_MODULES,
  ], {
    cwd: repoRoot,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  if (probe.exitCode !== 0)
    throw new Error(`Could not resolve Stacks modules in the benchmark server environment: ${probe.stderr.toString().trim()}`)

  const modules = JSON.parse(probe.stdout.toString()) as StacksSourceModules
  for (const specifier of STACKS_BENCHMARK_MODULES) {
    if (typeof modules[specifier] !== 'string')
      throw new TypeError(`Benchmark server source probe did not resolve ${specifier}`)
  }
  const issues = stacksSourceIssues(repoRoot, modules)
  if (issues.length > 0)
    throw new Error(`Stacks benchmark must execute framework source through public package entry points:\n${issues.join('\n')}`)

  return Object.fromEntries(Object.entries(modules).map(([specifier, path]) => [
    specifier,
    relative(repoRoot, path),
  ])) as StacksSourceModules
}
