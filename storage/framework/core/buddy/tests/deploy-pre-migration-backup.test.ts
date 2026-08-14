/**
 * The deploy takes a dump before it migrates production (stacksjs/stacks#2313).
 *
 * `buddy deploy` runs `migrate` on every release, against the only copy of the
 * app's data, with nothing to go back to. The dump is spliced into the OWNER
 * site's preStart immediately ahead of the migrate step - the same site
 * `applyPersistentStatePaths` picks, because that is the one whose database is
 * about to change.
 *
 * Every mistake available here is a silent one. Backing up the wrong site backs
 * up nothing (the other sites do not own a database). Landing AFTER migrate
 * captures the damage instead of preventing it. Writing inside the release tree
 * means the release pruner deletes the backup along with the release. None of
 * those fail loudly, which is why each has a test.
 */

import { describe, expect, it } from 'bun:test'
import { applyPreMigrationBackup, buddyInvocationFrom, preMigrationBackupCommand, projectDatabaseTarget } from '../src/commands/deploy'

const BACKUPS = projectDatabaseTarget('acme', 'backups')

/** One codebase, two server apps, one of them the database owner. */
function sites(): Record<string, any> {
  return {
    main: {
      start: 'bun storage/framework/runtime/production/serve.js',
      preStart: [
        'bun install',
        'bun build --production ...',
        'bun --conditions development storage/framework/core/buddy/src/cli.ts migrate',
      ],
    },
    api: {
      start: 'bun storage/framework/runtime/production/api.js',
      preStart: ['bun install', 'bun build --production ...'],
    },
    docs: { root: 'dist/docs' },
  }
}

function preStartOf(result: Record<string, any>, site: string): string[] {
  return result[site].preStart
}

describe('the pre-migration dump lands where it can do its job', () => {
  it('runs before migrate, not after it', () => {
    // After the migration, a dump captures the damage rather than what was
    // there before it.
    const out = applyPreMigrationBackup(sites(), BACKUPS)
    const preStart = preStartOf(out, 'main')

    const backupAt = preStart.findIndex(c => c.includes('db:backup'))
    const migrateAt = preStart.findIndex(c => /\bmigrate\b/.test(c))

    expect(backupAt).toBeGreaterThan(-1)
    expect(backupAt).toBeLessThan(migrateAt)
  })

  it('goes to the site that owns the database and no other', () => {
    const out = applyPreMigrationBackup(sites(), BACKUPS)

    expect(preStartOf(out, 'api').some(c => c.includes('db:backup'))).toBe(false)
    expect(out.docs).toEqual(sites().docs)
  })

  it('writes outside every release tree, so the release pruner cannot take it', () => {
    // A dump under `releases/<sha>/` is deleted with the release that wrote it,
    // which is exactly when the previous database would have been wanted.
    const out = applyPreMigrationBackup(sites(), BACKUPS)
    const backup = preStartOf(out, 'main').find(c => c.includes('db:backup'))!

    expect(backup).toContain('/var/www/acme-shared/backups')
    expect(backup).not.toContain('releases/')
  })

  it('tells the command it is running inside a deploy', () => {
    // `--before-migrations` is what lets a first-ever deploy, with no database
    // yet, succeed instead of failing the release over a missing file.
    const out = applyPreMigrationBackup(sites(), BACKUPS)

    expect(preStartOf(out, 'main').find(c => c.includes('db:backup'))).toContain('--before-migrations')
  })

  it('invokes buddy the same way the migrate step does', () => {
    // A release tree has no built binary, so in the monorepo the migrate step
    // runs buddy from source — and the dump has to go the same way.
    const monorepo = 'bun --conditions development storage/framework/core/buddy/src/cli.ts migrate'

    expect(preMigrationBackupCommand('/tmp/b', monorepo))
      .toBe('bun --conditions development storage/framework/core/buddy/src/cli.ts db:backup --before-migrations --out /tmp/b')
  })

  /**
   * The invocation used to be hard-coded to the monorepo's source path. An app
   * that installs Stacks from npm has no `storage/framework/…` directory, so
   * every one of those deploys died in preStart with "Module not found" —
   * before migrate, so the release was never promoted, and the failure had
   * nothing to do with anything the app had changed.
   */
  it('uses the installed CLI when that is what the app runs', () => {
    const installed = {
      api: {
        start: 'bun node_modules/@stacksjs/actions/dist/serve/api.js',
        preStart: [
          'bun install --frozen-lockfile',
          'bun node_modules/@stacksjs/buddy/dist/cli.js migrate --no-auth --force',
        ],
      },
    }

    const backup = applyPreMigrationBackup(installed, BACKUPS).api.preStart[1]

    expect(backup).toBe(`bun node_modules/@stacksjs/buddy/dist/cli.js db:backup --before-migrations --out ${BACKUPS}`)
    expect(backup).not.toContain('storage/framework')
  })

  it('reads the invocation off the migrate step, whatever shape it takes', () => {
    expect(buddyInvocationFrom('./buddy migrate')).toBe('./buddy')
    expect(buddyInvocationFrom('buddy migrate --force')).toBe('buddy')
    expect(buddyInvocationFrom('bunx buddy db:migrate')).toBe('bunx buddy')
    expect(buddyInvocationFrom('bun node_modules/@stacksjs/buddy/dist/cli.js migrate:fresh')).toBe('bun node_modules/@stacksjs/buddy/dist/cli.js')
  })
})

describe('leaving alone what it should leave alone', () => {
  it('adds nothing to a project that never migrates', () => {
    const noMigrate = {
      main: { start: 'bun serve.js', preStart: ['bun install'] },
    }

    expect(applyPreMigrationBackup(noMigrate, BACKUPS)).toEqual(noMigrate)
  })

  it('is idempotent, so re-running the deploy pipeline cannot stack dumps up', () => {
    const once = applyPreMigrationBackup(sites(), BACKUPS)
    const twice = applyPreMigrationBackup(once, BACKUPS)

    expect(preStartOf(twice, 'main').filter(c => c.includes('db:backup'))).toHaveLength(1)
    expect(twice).toEqual(once)
  })

  it('respects an app that placed the dump itself', () => {
    // An app that already runs `db:backup` has chosen its own ordering, and
    // adding a second one would dump twice on every release.
    const custom = {
      main: {
        start: 'bun serve.js',
        preStart: ['./buddy db:backup --out /mnt/backups', './buddy migrate'],
      },
    }

    expect(applyPreMigrationBackup(custom, BACKUPS)).toEqual(custom)
  })

  it('leaves a site alone when its migrate step is not a buddy call', () => {
    // `bun run migrate` is a package script, `docker exec … migrate` is another
    // machine's shell. Splicing `<that prefix> db:backup` in front of either
    // one produces a command that does not exist, and a preStart that exits
    // non-zero takes the release down — the failure this whole path is meant
    // to prevent. No dump beats no deploy.
    const scripted = {
      main: { start: 'bun serve.js', preStart: ['bun install', 'bun run migrate'] },
    }

    expect(applyPreMigrationBackup(scripted, BACKUPS)).toEqual(scripted)
    expect(buddyInvocationFrom('bun run migrate')).toBeUndefined()
    expect(buddyInvocationFrom('docker compose exec api migrate')).toBeUndefined()
    expect(buddyInvocationFrom('migrate')).toBeUndefined()
  })

  it('does not mutate the sites it was handed', () => {
    const input = sites()
    applyPreMigrationBackup(input, BACKUPS)

    expect(input.main.preStart).toHaveLength(3)
  })

  it('dumps once when a site migrates more than once', () => {
    // Before the FIRST migrate: the point is the schema the release inherited.
    const twice = {
      main: {
        start: 'bun serve.js',
        preStart: ['bun install', './buddy migrate', 'echo mid', './buddy migrate'],
      },
    }

    const preStart = applyPreMigrationBackup(twice, BACKUPS).main.preStart
    expect(preStart.filter((c: string) => c.includes('db:backup'))).toHaveLength(1)
    expect(preStart.findIndex((c: string) => c.includes('db:backup'))).toBe(1)
  })
})
