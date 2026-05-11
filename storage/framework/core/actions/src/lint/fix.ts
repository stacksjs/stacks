import process from 'node:process'
import { execSync, log } from '@stacksjs/cli'
import { projectPath } from '@stacksjs/path'

// TODO: this should be a loader
log.info('Ensuring Code Style...')

const cwd = projectPath()

const result = await runPickier(['.'], cwd)

if (!result.ok) {
  const changedFiles = await filesChangedForLint(cwd)

  if (changedFiles.length === 0) {
    log.warn('Full-project lint failed, and no changed source files were found for a targeted fallback.')
    console.error(result.error)
    process.exit(1)
  }

  log.warn(`Full-project lint failed; retrying only ${changedFiles.length} changed file(s).`)

  const fallback = await runPickier(changedFiles, cwd)

  if (!fallback.ok) {
    log.error('There was an error fixing your code style.')
    console.error(fallback.error)
    process.exit(1)
  }
}

log.success('Linted')

async function runPickier(targets: string[], cwd: string): Promise<{ ok: true } | { ok: false, error: Error }> {
  const proc = Bun.spawn(['bunx', '--bun', 'pickier', ...targets, '--fix'], {
    cwd,
    env: { ...process.env },
    stdin: 'inherit',
    stdout: 'inherit',
    stderr: 'inherit',
  })

  const exitCode = await proc.exited
  if (exitCode === 0)
    return { ok: true }

  return {
    ok: false,
    error: new Error(`pickier exited with code ${exitCode ?? 'unknown'} for ${targets.join(', ')}`),
  }
}

async function filesChangedForLint(cwd: string): Promise<string[]> {
  const tracked = await execSync('git diff --name-only --diff-filter=ACMR', { cwd, silent: true })
  const untracked = await execSync('git ls-files --others --exclude-standard', { cwd, silent: true })

  const candidates = `${tracked}\n${untracked}`
    .split('\n')
    .map(file => file.trim())
    .filter(Boolean)

  const lintable = new Set<string>()
  for (const file of candidates) {
    if (!/\.(?:ts|js|json|md|ya?ml)$/.test(file))
      continue

    if (
      file.includes('/dist/')
      || file.startsWith('dist/')
      || file.startsWith('node_modules/')
      || file.startsWith('pantry/')
      || file.includes('/storage/framework/cache/')
    ) {
      continue
    }

    lintable.add(file)
  }

  return [...lintable]
}
