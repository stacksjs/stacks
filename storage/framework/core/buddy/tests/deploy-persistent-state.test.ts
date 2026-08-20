/**
 * Regression coverage for "every deploy starts from an empty database".
 *
 * The Hetzner deploy gives each release its own directory under
 * `/var/www/<slug>-<site>/releases/<sha>`, and `database/stacks.sqlite` was a
 * REAL FILE inside it. `migrate` runs in the site's preStart, so it built a
 * fresh, empty database for the new release, the release went live against it,
 * and every production row died with the release it was written into — silently,
 * with nothing in the deploy output to say so. Verified on a live box: a
 * sentinel row inserted into production was gone after the next deploy, and the
 * new release's file was 1.16MB (freshly migrated) against 2.66MB locally.
 *
 * The fix declares the database as a ts-cloud shared path, so it lives in the
 * site's `shared/` dir and is symlinked into each release. That mechanism is
 * exercised end to end in ts-cloud (`shared-state-survives-deploy.test.ts`);
 * what is covered here is the framework deciding WHICH paths a Stacks app needs
 * kept — get that wrong and the mechanism protects nothing.
 */

import { describe, expect, it } from 'bun:test'
import { applyPersistentStatePaths, projectDatabaseTarget, siteSqlitePath, tsCloudPersistentStateSupport } from '../src/commands/deploy'

const appSite = (env: Record<string, any> = {}) => ({ root: '.', start: 'bun serve', port: 3000, env })

/** The site that runs migrations owns the database. */
const migratingSite = (env: Record<string, any> = {}) => ({ ...appSite(env), preStart: ['bun install', 'bun cli.ts migrate'] })

/** The database entry a site ends up with, whatever else it shares. */
const dbEntry = (site: any) => site.sharedPaths.find((p: any) => typeof p === 'object')

describe('siteSqlitePath', () => {
  it('defaults to config/database.ts\'s sqlite path', () => {
    expect(siteSqlitePath({})).toBe('database/stacks.sqlite')
    expect(siteSqlitePath({ DB_CONNECTION: 'sqlite' })).toBe('database/stacks.sqlite')
  })

  it('follows an explicit DB_DATABASE_PATH', () => {
    expect(siteSqlitePath({ DB_DATABASE_PATH: 'database/app.sqlite' })).toBe('database/app.sqlite')
    expect(siteSqlitePath({ DB_DATABASE_PATH: './data/app.sqlite' })).toBe('data/app.sqlite')
  })

  /**
   * `DB_DATABASE` is a database NAME for every other driver — production sets
   * `DB_DATABASE=stacks`. Linking `stacks` as if it were a file would create a
   * bogus shared path and shadow whatever the release ships at that name.
   */
  it('only reads DB_DATABASE when it names a file', () => {
    expect(siteSqlitePath({ DB_DATABASE: 'stacks' })).toBe('database/stacks.sqlite')
    expect(siteSqlitePath({ DB_DATABASE: 'database/legacy.db' })).toBe('database/legacy.db')
  })

  it('is nothing to share for a server-backed database', () => {
    expect(siteSqlitePath({ DB_CONNECTION: 'postgres', DB_DATABASE: 'stacks' })).toBeNull()
    expect(siteSqlitePath({ DB_CONNECTION: 'mysql' })).toBeNull()
  })

  /** Already outside the release tree — the operator placed it somewhere persistent. */
  it('leaves an absolute database path alone', () => {
    expect(siteSqlitePath({ DB_DATABASE_PATH: '/var/lib/stacks/app.sqlite' })).toBeNull()
    expect(siteSqlitePath({ DB_DATABASE_PATH: '~/app.sqlite' })).toBeNull()
  })

  it('refuses a path that escapes the release root', () => {
    expect(siteSqlitePath({ DB_DATABASE_PATH: '../shared/app.sqlite' })).toBeNull()
  })
})

describe('applyPersistentStatePaths', () => {
  it('keeps the database and the logs of a server-app site across deploys', () => {
    const out = applyPersistentStatePaths({ main: appSite({ DB_CONNECTION: 'sqlite' }) }, 'acme')

    expect(dbEntry(out.main).path).toBe('database/stacks.sqlite')
    expect(out.main.sharedPaths).toContain('storage/logs')
  })

  it('shares only the logs when the app is not on SQLite', () => {
    const out = applyPersistentStatePaths({ main: appSite({ DB_CONNECTION: 'postgres' }) }, 'acme')

    expect(out.main.sharedPaths).toEqual(['storage/logs'])
  })

  it("is additive - a site's own sharedPaths are never dropped", () => {
    const site = { ...appSite(), sharedPaths: ['storage/uploads'] }
    const out = applyPersistentStatePaths({ main: site }, 'acme')

    expect(out.main.sharedPaths[0]).toBe('storage/uploads')
    expect(out.main.sharedPaths).toContain('storage/logs')
  })

  it('does not duplicate a path the site already declared', () => {
    const site = { ...appSite(), sharedPaths: ['database/stacks.sqlite'] }
    const out = applyPersistentStatePaths({ main: site }, 'acme')

    expect(out.main.sharedPaths.filter((p: any) => (typeof p === 'string' ? p : p.path) === 'database/stacks.sqlite')).toHaveLength(1)
  })

  /**
   * A hand-written site-scoped declaration reads identically to the accident it
   * would recreate, so the framework's project-level target wins. Opting a site
   * onto its own database is done with DB_DATABASE_PATH.
   */
  it('upgrades a hand-declared site-scoped database to the project target', () => {
    const site = { ...appSite(), sharedPaths: ['database/stacks.sqlite'] }
    const out = applyPersistentStatePaths({ main: site }, 'acme')

    expect(dbEntry(out.main).target).toBe('/var/www/acme-shared/database/stacks.sqlite')
  })

  /**
   * Static sites are pure build output shipped to /var/www/<site>, and bucket
   * sites never touch the box's disk — neither writes state worth keeping, and
   * linking into them would only give ts-cloud dirs to create for nothing.
   */
  it('leaves static and bucket sites untouched', () => {
    const out = applyPersistentStatePaths({
      docs: { deploy: 'server', root: 'dist/docs', path: '/docs' },
      assets: { deploy: 'bucket', root: 'dist/assets' },
    }, 'acme')

    expect(out.docs.sharedPaths).toBeUndefined()
    expect(out.assets.sharedPaths).toBeUndefined()
  })

  it('survives a null site entry', () => {
    const out = applyPersistentStatePaths({ main: null }, 'acme')
    expect(out.main).toBeNull()
  })
})

/**
 * The divergence bug: ts-cloud installs each site under `/var/www/<slug>-<site>`,
 * so `main` and `api` each opened `database/stacks.sqlite` relative to their OWN
 * release — two files, and only `main` was ever migrated.
 */
describe('sibling sites cannot end up on different databases', () => {
  const project = () => ({
    main: migratingSite({ DB_CONNECTION: 'sqlite' }),
    api: { ...appSite({ DB_CONNECTION: 'sqlite' }), port: 3008 },
  })

  it('points every server-app site at one project-level file', () => {
    const out = applyPersistentStatePaths(project(), 'acme')

    expect(dbEntry(out.main).target).toBe('/var/www/acme-shared/database/stacks.sqlite')
    expect(dbEntry(out.api).target).toBe(dbEntry(out.main).target)
  })

  /**
   * The target must not mention which site is asking, or the two sites can
   * disagree again the moment one of them is renamed.
   */
  it('derives the target from the project alone', () => {
    expect(projectDatabaseTarget('acme', 'database/stacks.sqlite')).toBe('/var/www/acme-shared/database/stacks.sqlite')
    expect(projectDatabaseTarget('acme', 'database/stacks.sqlite')).not.toContain('main')
  })

  it('lets only the migrating site create and seed it', () => {
    const out = applyPersistentStatePaths(project(), 'acme')

    expect(dbEntry(out.main).seed).toBe(true)
    expect(dbEntry(out.api).seed).toBe(false)
  })

  /** Site order in config must not decide who owns the data. */
  it('picks the migrating site however the config is ordered', () => {
    const { main, api } = project()
    const out = applyPersistentStatePaths({ api, main }, 'acme')

    expect(dbEntry(out.main).seed).toBe(true)
    expect(dbEntry(out.api).seed).toBe(false)
  })

  /** No site migrates: someone still has to create the file, or nobody does. */
  it('falls back to the first server-app site when nothing migrates', () => {
    const out = applyPersistentStatePaths({
      main: appSite({ DB_CONNECTION: 'sqlite' }),
      api: { ...appSite({ DB_CONNECTION: 'sqlite' }), port: 3008 },
    }, 'acme')

    expect(dbEntry(out.main).seed).toBe(true)
    expect(dbEntry(out.api).seed).toBe(false)
  })

  /** A deliberate second database is still allowed — it takes saying so. */
  it('honours a site that asks for its own database by path', () => {
    const out = applyPersistentStatePaths({
      main: migratingSite({ DB_CONNECTION: 'sqlite' }),
      api: { ...appSite({ DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/api.sqlite' }), port: 3008 },
    }, 'acme')

    expect(dbEntry(out.api).target).toBe('/var/www/acme-shared/database/api.sqlite')
    expect(dbEntry(out.api).target).not.toBe(dbEntry(out.main).target)
  })
})

/**
 * Declaring shared paths against a ts-cloud that honours them WITHOUT adopting
 * existing state is the one combination that destroys data rather than merely
 * failing to protect it, so the deploy has to be able to see the difference.
 */
describe('tsCloudPersistentStateSupport', () => {
  const target = '/var/www/probe-shared/database/probe.sqlite'

  it('accepts a builder that adopts live state and honours explicit targets', () => {
    const build = () => [`cp -a "/var/www/probe-probe/current/database/probe.sqlite" "${target}"`, `ln -sfn ${target} /var/www/probe-probe/releases/probe/database/probe.sqlite`]
    expect(tsCloudPersistentStateSupport(build)).toEqual({ ok: true, missing: [] })
  })

  it('rejects a builder that links shared paths but never adopts', () => {
    const build = () => [`ln -sfn ${target} /var/www/probe-probe/releases/probe/database/probe.sqlite`]
    const support = tsCloudPersistentStateSupport(build)

    expect(support.ok).toBe(false)
    expect(support.missing).toContain('adoption of existing state into shared/')
  })

  it('rejects a builder that ignores the explicit target', () => {
    const build = () => ['cp -a "/var/www/probe-probe/current/x" "/var/www/probe-probe/shared/x"', 'ln -sfn /var/www/probe-probe/shared/database/probe.sqlite /var/www/probe-probe/releases/probe/database/probe.sqlite']
    const support = tsCloudPersistentStateSupport(build)

    expect(support.ok).toBe(false)
    expect(support.missing).toContain('shared paths with an explicit target')
  })

  it('rejects a ts-cloud with no script builder at all', () => {
    expect(tsCloudPersistentStateSupport(undefined)).toEqual({ ok: false, missing: ['buildSiteDeployScript'] })
  })

  /**
   * A ts-cloud that only knows string shared paths treats the spec object as a
   * string and throws — which is itself the answer, and must be reported as
   * such rather than as "no builder".
   */
  it('reads a throw on the spec form as the capability being absent', () => {
    const build = () => { throw new TypeError('p.split is not a function') }
    expect(tsCloudPersistentStateSupport(build)).toEqual({ ok: false, missing: ['shared paths with an explicit target'] })
  })
})
