import { expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'

/**
 * The CI workflow a new app is scaffolded with installs from its lockfile.
 *
 * A plain `bun install` quietly rewrites a lockfile that no longer matches
 * package.json and passes. The app's deploy then runs a frozen install, so the
 * first place the mismatch surfaced was a failed production deploy after a
 * green CI run (marioadrion, 2026-09-24, after `buddy upgrade` rewrote the
 * framework manifests under storage/framework).
 */
const template = readFileSync(new URL('../../../defaults/vcs/github/workflows/ci.yml', import.meta.url), 'utf8')
const workflow = Bun.YAML.parse(template) as { jobs: Record<string, { steps?: Array<{ run?: string }> }> }

test('every install step in the scaffolded CI is frozen', () => {
  const installs = Object.values(workflow.jobs)
    .flatMap(job => job.steps ?? [])
    .map(step => step.run?.trim())
    .filter((run): run is string => Boolean(run && /^bun install\b/.test(run)))

  expect(installs.length).toBeGreaterThan(0)
  for (const run of installs)
    expect(run).toContain('--frozen-lockfile')
})
