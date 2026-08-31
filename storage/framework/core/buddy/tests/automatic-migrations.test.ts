import { describe, expect, it } from 'bun:test'
import { applyAutomaticMigrations, applyPreMigrationBackup } from '../src/commands/deploy'

/**
 * Every Stacks deploy migrates, without the app having to remember to.
 *
 * A Stacks app's schema comes from its models and the migrations derived from
 * them are committed — but nothing applied them on release unless the app had
 * put `migrate` in a preStart itself. A release then shipped code expecting
 * columns the database did not have, and it surfaced as the app erroring on a
 * query long after the deploy reported success.
 */

const serverApp = (preStart: string[] = ['bun install']) => ({ start: 'bun serve.js', preStart })

function migrationSteps(site: any): string[] {
  return (site.preStart ?? []).filter((c: unknown) => /migrate|db:backup/.test(String(c)))
}

describe('applyAutomaticMigrations', () => {
  it('adds a migrate step to an app that declares none', () => {
    const out = applyAutomaticMigrations({ main: serverApp(), api: serverApp() })
    expect(migrationSteps(out.main)).toEqual(['./buddy migrate --no-generate'])
    // One site migrates, not all of them: `migrate` is also the marker for
    // which site owns the database, and two owners is no owner.
    expect(migrationSteps(out.api)).toEqual([])
  })

  it('applies committed migrations rather than deriving new ones', () => {
    // Deriving on the server means the schema reaching production is whatever
    // the model diff produces there, which is not necessarily what was
    // reviewed.
    const out = applyAutomaticMigrations({ main: serverApp() })
    expect(out.main.preStart.at(-1)).toContain('--no-generate')
  })

  it('leaves an app that already migrates completely alone', () => {
    // It has said where this belongs; moving it would change the order its own
    // preStart establishes.
    const sites = {
      main: serverApp(),
      api: serverApp(['bun install', './buddy migrate']),
    }
    const out = applyAutomaticMigrations(sites)

    expect(migrationSteps(out.main)).toEqual([])
    expect(migrationSteps(out.api)).toEqual(['./buddy migrate'])
    expect(out.api.preStart).toEqual(sites.api.preStart)
  })

  it('is not fooled by a preStart that only mentions migrations', () => {
    // Apps print progress markers between preStart steps; an echo is not a
    // migration, and treating it as one would leave the deploy not migrating.
    const out = applyAutomaticMigrations({
      main: serverApp(['bun install', 'echo "preStart: migrate"']),
    })
    expect(migrationSteps(out.main)).toContain('./buddy migrate --no-generate')
  })

  it('skips sites that cannot run anything', () => {
    // A redirect or a static site has no process to run a command in.
    const out = applyAutomaticMigrations({
      www: { redirect: { to: 'https://example.com' } },
      main: serverApp(),
    })
    expect(migrationSteps(out.main)).toEqual(['./buddy migrate --no-generate'])
    expect(out.www.preStart).toBeUndefined()
  })

  it('does nothing for a project with no server app at all', () => {
    const sites = { www: { redirect: { to: 'https://example.com' } } }
    expect(applyAutomaticMigrations(sites)).toEqual(sites)
  })

  it('honours migrateOnDeploy: false and moves to the next site', () => {
    // For a release that must not touch the schema — rolling back to code
    // older than the migration, say.
    const out = applyAutomaticMigrations({
      main: { ...serverApp(), migrateOnDeploy: false },
      api: serverApp(),
    })
    expect(migrationSteps(out.main)).toEqual([])
    expect(migrationSteps(out.api)).toEqual(['./buddy migrate --no-generate'])
  })

  it('creates a preStart for a site that has none', () => {
    const out = applyAutomaticMigrations({ main: { start: 'bun serve.js' } })
    expect(out.main.preStart).toEqual(['./buddy migrate --no-generate'])
  })
})

describe('with the pre-migration backup', () => {
  it('dumps the database before the injected migrate runs', () => {
    // The two have to compose: an automatic migration with no dump in front of
    // it is the thing the backup exists to prevent.
    const backups = '/var/www/app-shared/backups'
    const out = applyPreMigrationBackup(
      applyAutomaticMigrations({ main: serverApp(), api: serverApp() }),
      backups,
    )

    expect(migrationSteps(out.main)).toEqual([
      `./buddy db:backup --before-migrations --out ${backups}`,
      './buddy migrate --no-generate',
    ])
  })

  it('leaves the sites that do not migrate without a dump', () => {
    const out = applyPreMigrationBackup(
      applyAutomaticMigrations({ main: serverApp(), api: serverApp() }),
      '/var/www/app-shared/backups',
    )
    expect(migrationSteps(out.api)).toEqual([])
  })
})
