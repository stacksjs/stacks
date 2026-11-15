import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../actions/tests/helpers/publication-environment'

// Native orchestration + installed release/gateway generator. Only external
// process/SSH/provider transports are inert; this does not prove host ownership
// or sandbox trusted config/build/application code.
async function nativeDeploy(execution?: 'preview', defense = false, selection?: { deploy: 'bucket' | 'server', site?: string }) {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'preview-native-'))
  try {
    mkdirSync(join(root, 'config'))
    mkdirSync(join(root, 'app'))
    writeFileSync(join(root, 'package.json'), '{"name":"native-fixture"}')
    writeFileSync(join(root, '.env.preview'), 'DB_CONNECTION=sqlite\nDB_DATABASE_PATH=database/preview.sqlite\n')
    writeFileSync(join(root, 'app/Scheduler.ts'), 'schedule.command("native:job").everyMinute()')
    writeFileSync(join(root, 'build-marker.ts'), 'await Bun.write("build-ran", "assets")')
    // The internal mode is defense in depth: even a separately loaded native
    // email policy must not enter mail reconciliation or credential persistence.
    writeFileSync(join(root, 'config/email.ts'), `export default { domain: 'production.example.test', server: { enabled: ${defense}, generatePasswords: true }, mailboxes: ['support'] }`)
    writeFileSync(join(root, 'capture.ts'), `
import { mock } from 'bun:test'
import * as processes from 'node:child_process'
import * as cloud from ${JSON.stringify(join(checkout, 'node_modules/@stacksjs/ts-cloud/dist/index.js'))}
const execLocal = processes.execSync
const commands = []
const requests = []
const external = []
mock.module('node:child_process', () => ({ ...processes, execSync(command, options) {
  commands.push({ command, input: options?.input })
  if (command.startsWith('tar ')) {
    // Real local packaging; no source/build implementation is replaced.
    return execLocal(command, options)
  }
  if (command === 'bun build-marker.ts') return execLocal(command, options)
  if (command.startsWith('git ')) return Buffer.from('syntheticsha')
  if (command.startsWith('ssh ')) return ''
  throw new Error('Unexpected external process: ' + command)
} }))
mock.module('@stacksjs/ts-cloud', () => ({ ...cloud, sshExecOrThrow: async (_host, command) => { commands.push({ command }); return '' } }))
globalThis.fetch = async () => { external.push('fetch'); throw new Error('No external requests') }
const { overridesReady } = await import('@stacksjs/config/overrides')
await overridesReady
const { runSshDeploy, applyScheduledWork, mailProvisioningEnabled } = await import(${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/deploy.ts'))})
const driver = {
  provisionComputeInfrastructure: async () => { throw new Error('Attached preview must not provision') },
  getComputeOutputs: async () => ({ appPublicIp: '203.0.113.8', deployStoragePath: '/var/ts-cloud/staging' }),
  findComputeTargets: async () => [{ id: 'inert', publicIp: '203.0.113.8' }],
  uploadRelease: async () => ({ artifactRef: '/inert/release.tar.gz' }),
  runRemoteDeploy: async (request) => {
    requests.push(request)
    return { success: true, instanceCount: 1, perInstance: [{ instanceId: 'inert', status: 'Success', output: '' }] }
  },
}
const deploy = async (config) => runSshDeploy({
  execution: ${execution ? JSON.stringify(execution) : 'undefined'}, environment: 'production', envFile: '.env.preview',
  tsCloudConfig: config,
  provider: 'ssh', sshTarget: { host: '203.0.113.8', user: 'root', port: 22 }, verbose: false, docker: false,
  createCloudDriver: () => driver, deployAllComputeSites: cloud.deployAllComputeSites,
  ensureManagementDashboard: () => { external.push('dashboard') }, resolveSiteKind: cloud.resolveSiteKind, shipsARelease: cloud.shipsARelease,
})
const config = { project: { name: 'Fixture', slug: 'fixture' }, cloud: { provider: 'ssh' },
  ...(${defense} ? { infrastructure: { compute: { proxy: { cdn: { provider: 'cloudflare', frontedHosts: ['production.example.test'], purge: true } } } } } : {}),
  sites: { main: { start: 'bun run start', port: 3340, domain: 'base.example.test', env: { DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: 'database/preview.sqlite' }, ...(${(execution ? JSON.stringify(execution) : 'undefined')} === 'preview' ? { scheduler: false } : {}) } } }
const selection = ${JSON.stringify(selection) ?? 'undefined'}
if (selection) {
  config.sites = { assets: { deploy: selection.deploy, port: 3339, ...(selection.deploy === 'bucket' ? { start: 'bun run unused' } : {}), build: 'bun build-marker.ts', scheduler: false }, ...config.sites }
  config.cloud.previews = { site: selection.site }
}
let selected
let error
let discoveries = 0
try {
if (${execution === 'preview' && !defense}) {
  const { email } = await import('@stacksjs/config')
  const { runPreviewDeploy } = await import(${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/preview-deploy.ts'))})
  await runPreviewDeploy({ config: { ...config, sites: applyScheduledWork(config.sites, 'app/Scheduler.ts') },
    name: 'pr-7', domain: 'preview.example.test', context: { hasMailProvisioning: mailProvisioningEnabled(email, true) } }, {
    discoverPorts: async (target) => { discoveries++; selected = target.site; return new Map([[3340, 'fixture']]) }, deploy,
  })
} else {
  await deploy({ ...config, project: { ...config.project, slug: 'fixture-pr-7' }, cloud: { ...config.cloud, attachTo: 'fixture' } })
}
} catch (caught) { error = caught.message }
await Bun.write('capture.json', JSON.stringify({ commands, requests, external, selected, error, discoveries }))
`)
    const child = Bun.spawn([process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'), join(root, 'capture.ts')], {
      cwd: root, env: { ...publicationEnvironment(), TS_CLOUD_GITHUB_DEPLOYMENTS: '0' }, stdout: 'pipe', stderr: 'pipe', timeout: 30_000,
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code, stdout + stderr).toBe(0)
    return { capture: JSON.parse(readFileSync(join(root, 'capture.json'), 'utf8')), buildRan: existsSync(join(root, 'build-ran')), productionEnvWritten: existsSync(join(root, '.env.production')), output: stdout + stderr }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test('native preview execution ships local SQLite without inferred scheduler or ancillary production effects', async () => {
  const { capture, productionEnvWritten, output } = await nativeDeploy('preview')
  expect(capture.requests.length, output).toBeGreaterThan(0)
  expect(capture.error).toBeUndefined()
  const generated = JSON.stringify(capture.requests)
  expect(generated).toContain('/var/www/fixture-pr-7-shared/database/preview.sqlite')
  expect(generated).toContain('pr-7.preview.example.test')
  expect(generated).not.toContain('native:job')
  expect(generated).not.toContain('fixture-pr-7-main-scheduler.service')
  expect(generated).not.toContain('production.example.test')
  expect(capture.external).toEqual([])
  expect(JSON.stringify(capture.commands)).not.toContain('mail-health')
  expect(productionEnvWritten).toBe(false)
}, 45_000)

test.each(['bucket', 'server'] as const)('native preview selects the sole server app after %s assets with stale server fields', async (deploy) => {
  const { capture, buildRan, output } = await nativeDeploy('preview', false, { deploy })
  expect(capture.error, output).toBeUndefined()
  expect(buildRan).toBe(false)
  expect(capture.selected).toBe('main')
  expect(capture.requests.length).toBeGreaterThan(0)
  expect(JSON.stringify(capture.requests)).toContain('fixture-pr-7-main')
  expect(JSON.stringify(capture.requests)).not.toContain('fixture-pr-7-assets')
}, 45_000)

test.each(['bucket', 'server'] as const)('native preview honors explicit runtime selection beside %s assets', async (deploy) => {
  const { capture, buildRan, output } = await nativeDeploy('preview', false, { deploy, site: 'main' })
  expect(capture.error, output).toBeUndefined()
  expect(capture.selected).toBe('main')
  expect(capture.requests.length).toBeGreaterThan(0)
  expect(JSON.stringify(capture.requests)).not.toContain('fixture-pr-7-assets')
  expect(buildRan).toBe(false)
}, 45_000)

test.each(['bucket', 'server'] as const)('native preview refuses explicit %s assets before discovery or build', async (deploy) => {
  const { capture, buildRan } = await nativeDeploy('preview', false, { deploy, site: 'assets' })
  expect(capture.error).toContain('selected preview site must be the self-contained server runtime')
  expect(capture.discoveries).toBe(0)
  expect(capture.requests).toEqual([])
  expect(capture.commands).toEqual([])
  expect(capture.external).toEqual([])
  expect(buildRan).toBe(false)
}, 45_000)


test('ordinary native deployment still infers and installs the application scheduler', async () => {
  const { capture, productionEnvWritten } = await nativeDeploy()
  expect(capture.error).toBeUndefined()
  expect(JSON.stringify(capture.requests)).toContain('fixture-pr-7-main-scheduler.service')
  expect(productionEnvWritten).toBe(false)
}, 45_000)


test('native preview execution cannot enter inherited CDN/mail policy or persist production credentials', async () => {
  const { capture, productionEnvWritten, output } = await nativeDeploy('preview', true)
  expect(capture.error).toBeUndefined()
  expect(capture.external).toEqual([])
  expect(output).not.toContain('Mail:')
  expect(output).not.toContain('Cloudflare CDN:')
  expect(JSON.stringify(capture.commands)).not.toContain('mail-health')
  expect(JSON.stringify(capture.commands)).not.toContain('production.example.test')
  expect(productionEnvWritten).toBe(false)
}, 45_000)
