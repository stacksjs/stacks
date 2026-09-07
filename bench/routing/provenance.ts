import { relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  const modules = Object.fromEntries(STACKS_BENCHMARK_MODULES.map(specifier => [
    specifier,
    fileURLToPath(import.meta.resolve(specifier)),
  ])) as StacksSourceModules
  const issues = stacksSourceIssues(repoRoot, modules)
  if (issues.length > 0)
    throw new Error(`Stacks benchmark must execute framework source through public package entry points:\n${issues.join('\n')}`)

  return Object.fromEntries(Object.entries(modules).map(([specifier, path]) => [
    specifier,
    relative(repoRoot, path),
  ])) as StacksSourceModules
}
