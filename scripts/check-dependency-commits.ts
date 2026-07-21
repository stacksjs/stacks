const dependencyCommitPattern = /^chore\(deps\)(?::|$)/

export function isDependencyCommit(subject: string): boolean {
  return dependencyCommitPattern.test(subject.trim())
}

export function hasDependencyStateChange(files: string[]): boolean {
  return files.some(file =>
    file === 'bun.lock'
    || file === 'config/deps.ts'
    || file === 'package.json'
    || file.endsWith('/package.json'),
  )
}

function git(...args: string[]): string {
  const result = Bun.spawnSync(['git', ...args], { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0)
    throw new Error(result.stderr.toString().trim() || `git ${args.join(' ')} failed`)
  return result.stdout.toString().trim()
}

function resolveRange(): string {
  const head = process.env.DEPENDENCY_HEAD_SHA || 'HEAD'
  const requestedBase = process.env.DEPENDENCY_BASE_SHA
  const baseIsUsable = requestedBase
    && !/^0+$/.test(requestedBase)
    && Bun.spawnSync(['git', 'cat-file', '-e', `${requestedBase}^{commit}`], { stdout: 'ignore', stderr: 'ignore' }).exitCode === 0
  const base = baseIsUsable ? requestedBase : `${head}^`
  return `${base}..${head}`
}

export function checkDependencyCommits(range: string): string[] {
  const commits = git('rev-list', '--reverse', range).split('\n').filter(Boolean)
  const errors: string[] = []

  for (const commit of commits) {
    const subject = git('show', '-s', '--format=%s', commit)
    if (!isDependencyCommit(subject))
      continue

    const files = git('diff-tree', '--root', '--no-commit-id', '--name-only', '-r', commit)
      .split('\n')
      .filter(Boolean)
    if (!hasDependencyStateChange(files))
      errors.push(`${commit.slice(0, 12)} ${subject}`)
  }

  return errors
}

if (import.meta.main) {
  if (git('ls-files', 'pantry.lock')) {
    console.error('pantry.lock must not be tracked. Bun owns JavaScript dependency locking.')
    process.exit(1)
  }

  const range = resolveRange()
  const errors = checkDependencyCommits(range)
  if (errors.length > 0) {
    console.error('Dependency commits must change package.json, config/deps.ts, or bun.lock:')
    for (const error of errors)
      console.error(`  ${error}`)
    process.exit(1)
  }

  console.log(`Dependency state is consistent across ${range}.`)
}
