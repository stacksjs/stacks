import { expect, test } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { publicationEnvironment } from '../../actions/tests/helpers/publication-environment'

function git(root: string, ...args: string[]) {
  const result = Bun.spawnSync(['git', '-C', root, ...args], { stdout: 'pipe', stderr: 'pipe' })
  if (result.exitCode !== 0) throw new Error(result.stderr.toString())
  return result.stdout.toString().trim()
}

function iosFixture(root: string) {
  mkdirSync(join(root, 'config'))
  writeFileSync(join(root, 'config/mobile.ts'), 'export default { ios: { version: "1.0.0" } }')
  const tool = join(root, 'pantry/github.com/yonaskolb/XcodeGen/v2.46.0')
  mkdirSync(join(tool, 'bin'), { recursive: true })
  mkdirSync(join(tool, 'share/xcodegen/SettingPresets'), { recursive: true })
  writeFileSync(join(tool, 'share/xcodegen/SettingPresets/base.yml'), '')
  writeFileSync(join(tool, 'bin/xcodegen'), '')
  git(root, 'init', '--initial-branch=main')
  git(root, 'config', 'user.name', 'Publication Fixture')
  git(root, 'config', 'user.email', 'fixture@example.test')
  git(root, 'add', 'config', 'package.json', 'policy.ts')
  git(root, 'commit', '-qm', 'fixture')
}

function previewFixture(root: string) {
  mkdirSync(join(root, 'config'))
  writeFileSync(join(root, '.env.preview'), 'DB_CONNECTION=sqlite\nDB_DATABASE_PATH=database/preview.sqlite\n')
  writeFileSync(join(root, 'config/cloud.ts'), `export const tsCloud = {
    project: { name: 'Fixture', slug: 'fixture' },
    cloud: { provider: 'ssh', previews: { domain: 'preview.example.test' } },
    sites: { main: { start: 'bun run start', port: 3340 } },
  }`)
}

// Cold source imports on shared runners can exceed ten seconds. This is an
// integration fixture; its policy and forbidden-module assertions remain the
// contract, while dedicated startup benchmarks measure command performance.
const PUBLICATION_FIXTURE_TIMEOUT = 30_000

async function command(args: string[], setup?: (root: string) => void, guardStartup = false, removal?: 'success' | 'failure') {
  const checkout = resolve(import.meta.dir, '../../../../..')
  const root = mkdtempSync(join(tmpdir(), 'buddy-publication-entry-'))
  try {
    writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { 'publication:check': 'bun policy.ts' } }))
    writeFileSync(join(root, 'policy.ts'), 'await Bun.write("policy-ran", process.env.STACKS_PUBLICATION_CHANNEL!); process.exit(9)')
    setup?.(root)
    const head = existsSync(join(root, '.git')) ? git(root, 'rev-parse', 'HEAD') : undefined
    const runner = join(root, 'buddy.ts')
    const startupGuard = join(root, 'startup-guard.ts')
    if (guardStartup) {
      // Observe actual runtime module loads in the child without replacing any
      // deployment implementation.
      writeFileSync(startupGuard, `Bun.plugin({ setup(build) {
  build.onLoad({ filter: /[\\\\/]core[\\\\/](?:actions[\\\\/]src[\\\\/]index|buddy[\\\\/]src[\\\\/]commands[\\\\/](?:setup|dev))\\.ts$/ }, (args) => {
    throw new Error('Publication startup loaded deployment machinery: ' + args.path)
  })
} })`)
    }
    if (removal) {
      writeFileSync(startupGuard, `import { mock } from 'bun:test'
import * as cloud from ${JSON.stringify(join(checkout, 'node_modules/@stacksjs/ts-cloud/dist/index.js'))}
const capture = { remote: [], dns: [] }
const save = () => Bun.write('removal-capture.json', JSON.stringify(capture))
mock.module('@stacksjs/ts-cloud', () => ({ ...cloud,
  sshExecOrThrow: async (_host, command) => {
    capture.remote.push(Buffer.from(command.split(' ')[1], 'base64').toString())
    await save()
    if (${removal === 'failure'}) throw new Error('Inert runtime stop failed')
    return ''
  },
  detectDnsProvider: async () => ({ name: 'inert' }),
  removeAddressRecords: async (_provider, zone, host) => {
    capture.dns.push({ zone, host }); await save()
    return { removed: [], warnings: [] }
  },
}))
globalThis.fetch = async () => { throw new Error('No network permitted') }
`)
    }
    writeFileSync(runner, `import { cli } from ${JSON.stringify(join(checkout, 'storage/framework/core/cli/src/index.ts'))}
import { release } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/release.ts'))}
import { deploy } from ${JSON.stringify(join(checkout, 'storage/framework/core/buddy/src/commands/deploy.ts'))}
globalThis.fetch = async () => { throw new Error('No external requests are permitted in this isolated publication fixture') }
const buddy = cli('buddy')
release(buddy)
deploy(buddy)
await buddy.parse()
`)
    const child = Bun.spawn([
      process.execPath, '--no-env-file', '--tsconfig-override', join(checkout, 'storage/framework/tsconfig.framework.json'),
      ...(guardStartup || removal ? ['--preload', startupGuard] : []), runner, ...args,
    ], { cwd: root, env: { ...publicationEnvironment(), GIT_TRACE: join(root, 'git-trace.log'), ...(removal ? { TS_CLOUD_SSH_HOST: '203.0.113.8', CLOUDFLARE_API_TOKEN: 'inert-token' } : {}) }, stdout: 'pipe', stderr: 'pipe', timeout: PUBLICATION_FIXTURE_TIMEOUT })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    return {
      code, output: `${stdout}\n${stderr}`, ran: existsSync(join(root, 'policy-ran')),
      trace: existsSync(join(root, 'git-trace.log')) ? readFileSync(join(root, 'git-trace.log'), 'utf8') : '',
      head, finalHead: head ? git(root, 'rev-parse', 'HEAD') : undefined,
      removal: existsSync(join(root, 'removal-capture.json')) ? JSON.parse(readFileSync(join(root, 'removal-capture.json'), 'utf8')) : undefined,
      pinExists: existsSync(join(root, 'storage/cloud/state/fixture-pr-7-production.json')),
      siblingPinExists: existsSync(join(root, 'storage/cloud/state/fixture-pr-70-production.json')),
    }
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
}

test.each(['deploy', 'deploy:preview'])('%s rejects policy before loading deployment machinery', async (name) => {
  const result = await command(name === 'deploy' ? [name] : [name, 'policy-fixture'], name === 'deploy:preview' ? previewFixture : undefined, true)
  expect(result.output).not.toContain('Publication startup loaded deployment machinery:')
  expect(result.output).toContain('publication:check failed with exit code 9')
  expect(result.ran).toBe(true)
}, 45_000)

for (const args of [
  ['deploy'], ['deploy:preview', 'policy-fixture'], ['release:ios'], ['release:github', 'fixture-tag'],
]) {
  test(`the direct Buddy ${args[0]} command blocks publication policy failure`, async () => {
    const result = await command(args, args[0] === 'deploy:preview' ? previewFixture : undefined)
    expect(result.code, result.output).not.toBe(0)
    expect(result.output).toContain('publication:check failed with exit code 9')
    expect(result.ran).toBe(true)
  }, 45_000)
}

test('preview preflight refuses managed DB/API before the real publication script or deploy machinery', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    writeFileSync(join(root, 'config/cloud.ts'), `export const tsCloud = {
      project: { name: 'Fixture', slug: 'fixture' },
      cloud: { provider: 'ssh', previews: { domain: 'preview.example.test', site: 'main' } },
      infrastructure: { appDatabase: { engine: 'postgres', name: 'synthetic-production', username: 'synthetic-production', password: 'synthetic-secret' } },
      sites: {
        main: { start: 'bun run start', port: 3340, env: { DB_CONNECTION: 'postgres', DB_USERNAME: 'synthetic-production', API_URL: 'http://127.0.0.1:3348' } },
        api: { start: 'bun buddy serve:api', port: 3348 },
      },
    }`)
  }, true)
  expect(result.code, result.output).not.toBe(0)
  expect(result.output).toContain('Preview preflight refused')
  expect(result.output).not.toContain('synthetic-secret')
  expect(result.output).not.toContain('synthetic-production')
  expect(result.output).not.toContain('Publication startup loaded deployment machinery:')
  expect(result.ran).toBe(false)
}, 45_000)

test('preview refuses scheduler work inferred from app/Scheduler.ts before publication', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    mkdirSync(join(root, 'app'))
    writeFileSync(join(root, 'app/Scheduler.ts'), 'schedule.command("native:job").everyMinute()')
  }, true)
  expect(result.output).toContain('Preview preflight refused')
  expect(result.output).not.toContain('Publication startup loaded deployment machinery:')
  expect(result.ran).toBe(false)
}, 45_000)

test('preview refuses native proxyTo precedence over stale server fields before publication', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    const file = join(root, 'config/cloud.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace("port: 3340", "port: 3340, proxyTo: '127.0.0.1:3348'"))
  }, true)
  expect(result.output).toContain('Preview preflight refused')
  expect(result.ran).toBe(false)
}, 45_000)

for (const deploy of ['bucket', 'server']) {
  for (const site of [undefined, 'main', 'assets']) {
    test(`preview ${site ? `selecting ${site}` : 'implicitly selecting the runtime'} beside ${deploy} assets validates before publication`, async () => {
      const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
        previewFixture(root)
        writeFileSync(join(root, 'config/cloud.ts'), `export const tsCloud = {
          project: { name: 'Fixture', slug: 'fixture' },
          cloud: { provider: 'ssh', previews: { domain: 'preview.example.test', site: ${JSON.stringify(site) ?? 'undefined'} } },
          sites: {
            assets: { deploy: '${deploy}', port: 3339, ${deploy === 'bucket' ? "start: 'bun run unused'," : ''} build: 'bun build-marker.ts' },
            main: { start: 'bun run start', port: 3340 },
          },
        }`)
        writeFileSync(join(root, 'build-marker.ts'), 'throw new Error("Unvalidated assets build ran")')
      }, true)
      expect(result.output).not.toContain('Publication startup loaded deployment machinery:')
      expect(result.output).not.toContain('Unvalidated assets build ran')
      if (site === 'assets') {
        expect(result.output).toContain('Preview preflight refused')
        expect(result.ran).toBe(false)
      }
      else {
        expect(result.output).toContain('publication:check failed with exit code 9')
        expect(result.output).not.toContain('Preview preflight refused')
        expect(result.ran).toBe(true)
      }
    }, 45_000)
  }
}

test('preview refuses inherited explicit CDN production hosts before publication', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    const file = join(root, 'config/cloud.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace("sites: {", "infrastructure: { compute: { proxy: { cdn: { provider: 'cloudflare', frontedHosts: ['production.example.test'], purge: true } } } }, sites: {"))
  }, true)
  expect(result.output).toContain('Preview preflight refused')
  expect(result.output).not.toContain('production.example.test')
  expect(result.ran).toBe(false)
}, 45_000)

test('preview refuses effective native email provisioning before publication', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    writeFileSync(join(root, 'config/email.ts'), "export default { domain: 'production.example.test', server: { enabled: true, generatePasswords: true, attachTo: 'mail-owner' }, mailboxes: ['support'] }")
  }, true)
  expect(result.output).toContain('Preview preflight refused')
  expect(result.output).not.toContain('production.example.test')
  expect(result.ran).toBe(false)
}, 45_000)

test('explicit scheduler and native mail opt-outs preserve eligible local previews', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    mkdirSync(join(root, 'app'))
    writeFileSync(join(root, 'app/Scheduler.ts'), 'schedule.command("native:job").everyMinute()')
    const file = join(root, 'config/cloud.ts')
    writeFileSync(file, readFileSync(file, 'utf8').replace('port: 3340', 'port: 3340, scheduler: false'))
    writeFileSync(join(root, 'config/email.ts'), "export default { domain: 'production.example.test', server: { enabled: false } }")
  }, true)
  expect(result.output).toContain('publication:check failed with exit code 9')
  expect(result.output).not.toContain('Preview preflight refused')
  expect(result.ran).toBe(true)
}, 45_000)

test('an unreadable encrypted preview env refuses before explicit cloud reload or publication', async () => {
  const result = await command(['deploy:preview', 'policy-fixture'], (root) => {
    previewFixture(root)
    writeFileSync(join(root, '.env.preview'), 'DB_PASSWORD=encrypted:v2:synthetic-unreadable\n')
    writeFileSync(join(root, 'config/cloud.ts'), 'if (import.meta.url.includes("?env=")) throw new Error("preview cloud reload reached"); export const tsCloud = {}')
  })
  expect(result.output).toContain('Cannot load deployment environment from .env.preview')
  expect(result.output).not.toContain('synthetic-unreadable')
  expect(result.output).not.toContain('preview cloud reload reached')
  expect(result.ran).toBe(false)
}, 45_000)

test('iOS dry-run inspects local source without pulling, fetching, building or changing refs', async () => {
  const result = await command(['release:ios', '--dry-run', '--skip-github-release'], iosFixture)
  expect(result.code, result.output).toBe(0)
  expect(result.ran).toBe(false)
  expect(result.finalHead).toBe(result.head)
  expect(result.trace).not.toMatch(/built-in: git (?:pull|fetch|add|commit|push|tag -a)/)
  expect(result.output).toContain('v1.0.0-build.1')
}, 45_000)

test('iOS release rechecks policy after pulling newer source', async () => {
  const result = await command(['release:ios', '--skip-github-release'], (root) => {
    writeFileSync(join(root, 'policy.ts'), 'await Bun.write("policy-ran", "initial policy passed")')
    iosFixture(root)
    // A local bare remote advertises a newer main whose policy refuses release.
    const remote = join(root, 'remote.git')
    git(root, 'clone', '--bare', root, remote)
    const old = git(root, 'rev-parse', 'HEAD')
    writeFileSync(join(root, 'policy.ts'), 'await Bun.write("policy-ran", "new policy refused"); process.exit(9)')
    git(root, 'add', 'policy.ts')
    git(root, 'commit', '-qm', 'restricted content')
    git(root, 'push', remote, 'main')
    git(root, 'reset', '--hard', old)
    git(root, 'remote', 'add', 'origin', remote)
  })
  expect(result.code, result.output).not.toBe(0)
  expect(result.finalHead).not.toBe(result.head)
  expect(result.output).toContain('publication:check failed with exit code 9')
  expect(result.trace).toContain('git pull')
  expect(result.trace).not.toMatch(/built-in: git (?:add|commit|push|tag -a)/)
}, 60_000)

test.each(['release:ios', 'release:github'])('%s dry-run does not execute an application publication script', async (name) => {
  const result = await command([name, '--dry-run'])
  expect(result.ran).toBe(false)
  expect(result.output).not.toContain('publication:check failed')
}, 45_000)


for (const deploy of ['bucket', 'server']) {
  test(`registered preview removal cleans both ${deploy}-first identities with one DNS and local cleanup`, async () => {
    const result = await command(['deploy:preview:remove', 'pr-7'], (root) => {
      previewFixture(root)
      const file = join(root, 'config/cloud.ts')
      writeFileSync(file, readFileSync(file, 'utf8').replace('sites: {', `sites: { assets: { deploy: '${deploy}', port: 3339 },`))
      mkdirSync(join(root, 'storage/cloud/state'), { recursive: true })
      writeFileSync(join(root, 'storage/cloud/state/fixture-pr-7-production.json'), '{}')
      writeFileSync(join(root, 'storage/cloud/state/fixture-pr-70-production.json'), '{}')
    }, false, 'success')
    expect(result.code, result.output).toBe(0)
    expect(result.removal.remote).toHaveLength(1)
    expect(result.removal.remote[0]).toContain('/var/www/fixture-pr-7-main ')
    expect(result.removal.remote[0]).toContain('/var/www/fixture-pr-7-assets ')
    expect(result.removal.dns).toEqual([{ zone: 'pr-7.preview.example.test', host: 'pr-7.preview.example.test' }])
    expect(result.pinExists).toBe(false)
    expect(result.siblingPinExists).toBe(true)
    expect(result.ran).toBe(false)
  }, 45_000)
}

test('registered removal keeps DNS and local state after a remote stop failure', async () => {
  const result = await command(['deploy:preview:remove', 'pr-7'], (root) => {
    previewFixture(root)
    mkdirSync(join(root, 'storage/cloud/state'), { recursive: true })
    writeFileSync(join(root, 'storage/cloud/state/fixture-pr-7-production.json'), '{}')
  }, false, 'failure')
  expect(result.code, result.output).not.toBe(0)
  expect(result.output).toContain('Inert runtime stop failed')
  expect(result.removal.remote).toHaveLength(1)
  expect(result.removal.dns).toEqual([])
  expect(result.pinExists).toBe(true)
})
