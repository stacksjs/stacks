const dependencyCommitPattern = /^chore\(deps\)(?::|$)/

export function isDependencyCommit(subject: string): boolean {
  return dependencyCommitPattern.test(subject.trim())
}

/**
 * The files a `chore(deps)` commit is allowed to be about.
 *
 * Two kinds. The manifests and lockfiles are dependency STATE - which versions
 * this workspace resolves. The rest is dependency POLICY - which bot proposes
 * changes to that state, and how. Renaming a bot's config to `chore(config)`
 * would be worse than admitting both are dependency work: the guard exists so a
 * `chore(deps)` commit is really about dependencies, and configuring the bot
 * that opens every dependency pull request plainly is (stacksjs/stacks#2574).
 *
 * What stays out is everything else, which is the point: a `chore(deps)` commit
 * touching only source, docs or a changelog is mislabeled.
 */
const DEPENDENCY_POLICY_FILES = new Set([
  'config/deps.ts',
  'config/buddy-bot.ts',
  '.github/renovate.json',
  '.github/dependabot.yml',
  '.github/workflows/buddy-bot.yml',
])

export function hasDependencyStateChange(files: string[]): boolean {
  return files.some(file =>
    file === 'bun.lock'
    || file === 'pantry.lock'
    || file === 'package.json'
    || file.endsWith('/package.json')
    || DEPENDENCY_POLICY_FILES.has(file)
    // The same policy files inside the app template, which a scaffold change
    // touches instead of the ones above.
    || /^storage\/framework\/defaults\/(?:vcs\/github|scaffold\/config)\/.*(?:buddy-bot|renovate|dependabot)/.test(file),
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
  const range = resolveRange()
  const errors = checkDependencyCommits(range)
  if (errors.length > 0) {
    console.error('Dependency commits must change a manifest, a lockfile, or a dependency-bot config:')
    for (const error of errors)
      console.error(`  ${error}`)
    process.exit(1)
  }

  console.log(`Dependency state is consistent across ${range}.`)
}
