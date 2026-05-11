import process from 'node:process'
import { execSync, log, parseOptions, runCommand } from '@stacksjs/cli'
import { NpmScript } from '@stacksjs/enums'
import { projectPath } from '@stacksjs/path'

// TODO: this should be a loader
log.info('Ensuring Code Style...')

const options = parseOptions()

const result = await runCommand(NpmScript.LintFix, {
  cwd: projectPath(),
  ...options,
})

if (result.isErr) {
  const changedFiles = await filesChangedForLint(projectPath())

  if (changedFiles.length === 0) {
    log.warn('Full-project lint failed, and no changed source files were found for a targeted fallback.')
    console.error(result.error)
    process.exit(1)
  }

  log.warn(`Full-project lint failed; retrying only ${changedFiles.length} changed file(s).`)

  const fallback = await runCommand(`bunx --bun pickier ${changedFiles.map(shellQuote).join(' ')} --fix`, {
    cwd: projectPath(),
    ...options,
  })

  if (fallback.isErr) {
    log.error('There was an error fixing your code style.')
    console.error(fallback.error)
    process.exit(1)
  }
}

log.success('Linted')

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

function shellQuote(value: string): string {
  return `'${value.replaceAll(`'`, `'\\''`)}'`
}
