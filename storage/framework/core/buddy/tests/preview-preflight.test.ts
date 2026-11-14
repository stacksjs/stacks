import { describe, expect, test } from 'bun:test'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { apiDeploymentProblem, applyPersistentStatePaths, mergeSiteDeployEnv } from '../src/commands/deploy'
import { previewHasSymlinkPaths, previewPreflightProblems, runPreviewDeploy } from '../src/commands/preview-deploy'

// Public preview orchestration: catches refusal before the actual discovery and
// deployment callbacks; it does not prove provider behavior or app-code isolation.
const local = {
  project: { name: 'Fixture', slug: 'fixture' },
  cloud: { provider: 'ssh', previews: { domain: 'preview.example.test' } },
  sites: { main: { start: 'bun run start', port: 3340, env: { DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/app.sqlite' } } },
}

describe('preview preflight before effects', () => {
  test('preserves a self-contained single-site relative SQLite/local preview', async () => {
    const before = structuredClone(local)
    const deployed: any[] = []
    await runPreviewDeploy({ config: local, name: 'pr-7', domain: 'preview.example.test' }, {
      discoverPorts: async () => new Map([[3340, 'fixture']]),
      deploy: async (config, target, port) => { deployed.push({ config, target, port }) },
    })
    expect(deployed).toHaveLength(1)
    expect(deployed[0].port).toBe(3341)
    expect(deployed[0].config.sites.main.env).toEqual({ DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/app.sqlite', APP_URL: 'https://pr-7.preview.example.test' })
    expect(deployed[0].config.project.slug).toBe('fixture-pr-7')
    expect(applyPersistentStatePaths(deployed[0].config.sites, 'fixture-pr-7').main.sharedPaths).toContainEqual({
      path: 'database/app.sqlite', target: '/var/www/fixture-pr-7-shared/database/app.sqlite', seed: true,
    })
    expect(local).toEqual(before)
  })

  test('refuses a missing API dependency but preserves a self-contained API runtime', async () => {
    const sites = { api: { ...local.sites.main, start: 'bun buddy serve:api' } }
    expect(previewPreflightProblems({ ...local, sites }, { requiresApiRuntime: Boolean(apiDeploymentProblem(sites, true)) })).toEqual([])
    const effects: string[] = []
    await expect(runPreviewDeploy({ config: local, name: 'pr-7', domain: 'preview.example.test', context: { requiresApiRuntime: true } }, {
      discoverPorts: async () => { effects.push('discovery'); return new Map() },
      deploy: async () => { effects.push('deploy') },
    })).rejects.toThrow('separately isolated API runtime')
    expect(effects).toEqual([])
  })
  test('refuses the HQ-shaped API and managed production database before discovery or deployment', async () => {
    const effects: string[] = []
    const config = {
      ...local,
      infrastructure: { appDatabase: { engine: 'postgres', name: 'production-db', username: 'production-role', password: 'synthetic-secret' } },
      sites: {
        main: { ...local.sites.main, env: { DB_CONNECTION: 'postgres', DB_DATABASE: 'production-db', DB_USERNAME: 'production-role', API_URL: 'http://127.0.0.1:3348', PORT_API: '3348' } },
        api: { start: 'bun buddy serve:api', port: 3348 },
      },
    }
    await expect(runPreviewDeploy({ config, name: 'pr-7', domain: 'preview.example.test' }, {
      discoverPorts: async () => { effects.push('SSH discovery'); return new Map() },
      deploy: async () => { effects.push('hooks/build/state/DB/provider/SSH') },
    })).rejects.toThrow('Preview preflight refused')
    expect(effects).toEqual([])
  })

  test('checks the real final merge: site production credentials override the preview file', async () => {
    const config = {
      ...local,
      sites: mergeSiteDeployEnv({ main: { ...local.sites.main, env: { DB_CONNECTION: 'postgres', DB_DATABASE: 'production-db', DB_USERNAME: 'production-role' } } }, {
        DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/preview.sqlite', CACHE_PREFIX: 'preview-only', QUEUE_PREFIX: 'preview-only',
      }),
    }
    const calls: string[] = []
    await expect(runPreviewDeploy({ config, name: 'pr-7', domain: 'preview.example.test' }, {
      discoverPorts: async () => { calls.push('SSH'); return new Map() },
      deploy: async () => { calls.push('deploy') },
    })).rejects.toThrow('external database')
    expect(calls).toEqual([])
  })

  const unsupported = [
    { infrastructure: { appDatabase: { engine: 'postgres', name: 'synthetic-production', username: 'synthetic-production', password: 'synthetic-secret' } } },
    { infrastructure: { compute: { database: { engine: 'postgres' } } } },
    { infrastructure: { compute: { managedServices: { redis: {} } } } },
    { infrastructure: { storage: { uploads: { bucket: 'synthetic-production' } } } },
    { stateDir: '/srv/shared/state' },
    { hooks: { beforeDeploy: 'touch /synthetic-production' } },
    ...[
      { API_URL: 'http://127.0.0.1:3348' }, { PORT_API: '3348' },
      { DB_CONNECTION: 'postgres', DB_PASSWORD: 'synthetic-secret' }, { DATABASE_URL: 'postgres://synthetic:synthetic-secret@example.test/prod' },
      { REDIS_PASSWORD: 'synthetic-secret', CACHE_PREFIX: 'preview', REDIS_DB: '2' },
      { CACHE_DRIVER: 'redis', CACHE_PREFIX: 'preview' }, { QUEUE_DRIVER: 'redis', QUEUE_PREFIX: 'preview' }, { SESSION_DRIVER: 'redis' },
      { STORAGE_DRIVER: 's3', AWS_S3_BUCKET: 'synthetic-production' },
      { STORAGE_ROOT: '/srv/production' }, { BLOB_LOCAL_ROOT: '../production' }, { TS_CLOUD_STATE_DIR: 'storage/cloud' },
      { DB_DATABASE_PATH: '/srv/production.sqlite' }, { DB_DATABASE_PATH: '../production.sqlite' }, { DB_DATABASE_PATH: 'C:\\production.sqlite' },
    ].map(env => ({ sites: { main: { ...local.sites.main, env } } })),
    ...[
      { sharedPaths: ['/srv/shared/uploads'] }, { sharedPaths: ['../uploads'] }, { sharedPaths: [{ path: 'uploads', target: '/srv/production' }] },
      { root: '../production' }, { preStart: ['bun arbitrary.ts'] }, { build: 'bun arbitrary.ts' }, { deployScript: ['custom'] },
      { scheduler: true }, { queues: [{}] }, { daemons: [{}] }, { ssl: { domains: ['production.example.test'] } },
      { start: 'bun server.ts --port 3340' }, { start: 'bun server.ts; touch /synthetic-production' },
    ].map(site => ({ sites: { main: { ...local.sites.main, ...site } } })),
  ]
  for (const [index, override] of unsupported.entries()) {
    test(`refuses unsupported inherited state ${index + 1} with zero effects and redacted errors`, async () => {
      const calls: string[] = []
      let message = ''
      try {
        await runPreviewDeploy({ config: { ...local, ...override }, name: 'pr-7', domain: 'preview.example.test' }, {
          discoverPorts: async () => { calls.push('discovery'); return new Map() },
          deploy: async () => { calls.push('publication/hooks/build/state/DB/provider/SSH') },
        })
      }
      catch (error) { message = (error as Error).message }
      expect(message).toContain('Preview preflight refused')
      expect(message).not.toContain('synthetic-secret')
      expect(message).not.toContain('synthetic-production')
      expect(calls).toEqual([])
    })
  }

  test('refuses application hook files and symlinked configured state before effects', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'preview-paths-'))
    try {
      mkdirSync(join(directory, 'database'))
      symlinkSync('/synthetic-production', join(directory, 'database', 'app.sqlite'))
      const context = { hasSymlinkPaths: previewHasSymlinkPaths(local, directory), hasDeployHooks: true }
      const effects: string[] = []
      await expect(runPreviewDeploy({ config: local, name: 'pr-7', domain: 'preview.example.test', context }, {
        discoverPorts: async () => { effects.push('discovery'); return new Map() },
        deploy: async () => { effects.push('deploy') },
      })).rejects.toThrow('Symlinked')
      expect(effects).toEqual([])
      expect(previewPreflightProblems(local, context)).toContain('Custom deployment hooks are unsupported for previews.')
    }
    finally { rmSync(directory, { force: true, recursive: true }) }
  })
})
