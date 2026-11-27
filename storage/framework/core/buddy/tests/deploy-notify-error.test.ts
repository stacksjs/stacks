/**
 * What a failed deploy prints.
 *
 * `withDeployNotification` wraps the whole deploy handler so an outcome is
 * announced exactly once. Its failure branch used to notify and exit(1)
 * without printing anything, which meant a deploy that threw anywhere - a
 * missing token, an unreachable box, a config error - produced an empty
 * terminal and a bare exit code.
 *
 * That is not a hypothetical: `buddy deploy --prod --yes` in the statushq
 * project exited 1 with zero bytes on stdout and nothing on stderr but the
 * env banner, and the only way to see the cause was to patch the installed
 * package. A notification is not a substitute for printing: it goes to
 * whatever channel is configured, and a machine with none configured is
 * exactly the machine whose operator is watching the terminal.
 */
import { describe, expect, it } from 'bun:test'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const SOURCE = path.resolve(import.meta.dir, '../src/deploy-notify.ts')
const source = fs.readFileSync(SOURCE, 'utf8')

/** The body of the catch block in withDeployNotification. */
function failureBranch(): string {
  const wrapper = source.slice(source.indexOf('export function withDeployNotification'))
  const start = wrapper.indexOf('catch (error) {')
  expect(start, 'withDeployNotification must still have a failure branch').toBeGreaterThan(-1)

  return wrapper.slice(start, wrapper.indexOf('process.exit', start))
}

describe('a deploy that throws', () => {
  it('drains the real logger before the failed process exits', async () => {
    const marker = 'stacks-deploy-cold-logger-fixture'
    const program = `import {withDeployNotification} from ${JSON.stringify(SOURCE)}; await withDeployNotification(async () => { throw new Error(${JSON.stringify(marker)}) })('production')`
    const child = Bun.spawn([process.execPath, '-e', program], {
      cwd: path.resolve(import.meta.dir, '../../../../..'),
      env: { ...process.env, DEPLOY_WEBHOOK_URL: '' },
      stdout: 'pipe', stderr: 'pipe',
    })
    const [code, out, err] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(code).not.toBe(0)
    expect(`${out}${err}`).toContain(marker)
  })

  it('prints the reason before exiting', () => {
    const branch = failureBranch()

    expect(branch).toContain('log.error')
    // The message has to carry the error itself, not just "deploy failed".
    expect(branch).toMatch(/log\.error\([^)]*getDeployErrorMessage\(error\)/)
  })

  it('prints the reason BEFORE notifying, so a broken notifier cannot eat it', () => {
    const branch = failureBranch()

    expect(branch.indexOf('log.error')).toBeLessThan(branch.indexOf('notifyDeployOutcome'))
  })

  it('keeps the stack available behind --verbose', () => {
    expect(failureBranch()).toContain('log.debug(stack)')
  })

  it('reports the actual Buddy CLI target in failures and notifications', () => {
    const checkout = path.resolve(import.meta.dir, '../../../../..')
    const workspace = fs.mkdtempSync(path.join(tmpdir(), 'buddy-deploy-notification-'))
    try {
      for (const directory of ['cloud', 'config', 'storage/framework/core'])
        fs.mkdirSync(path.join(workspace, directory), { recursive: true })
      fs.symlinkSync(path.join(checkout, 'node_modules'), path.join(workspace, 'node_modules'), 'dir')
      fs.symlinkSync(path.join(checkout, 'storage/framework/core/buddy'), path.join(workspace, 'storage/framework/core/buddy'), 'dir')
      fs.writeFileSync(path.join(workspace, 'package.json'), '{"name":"deploy-notification-fixture","private":true}')
      fs.writeFileSync(path.join(workspace, 'bunfig.toml'), 'preload = []')
      fs.writeFileSync(path.join(workspace, 'target.env'), 'APP_KEY=fixture-only-key\n')
      fs.writeFileSync(path.join(workspace, 'config/cloud.ts'), `export const tsCloud = {
        project: { slug: 'deploy-notification-fixture' },
        cloud: { provider: 'ssh' },
        ssh: { hosts: [{ host: '127.0.0.1', user: 'fixture' }] },
        sites: { web: { domain: 'web.example.test', start: 'bun serve.ts' } },
      }`)
      fs.writeFileSync(path.join(workspace, 'cloud/deploy-script.ts'), `
        export function beforeDeploy({ environment }: { environment: string }) {
          throw new Error('fixture hook reached for ' + environment)
        }
      `)
      const preload = path.join(workspace, 'preload.ts')
      const webhook = 'http://127.0.0.1:1/fixture-deploy-webhook'
      const capturePrefix = 'FIXTURE_DEPLOY_MESSAGE='
      fs.writeFileSync(preload, `
        import { awaitConfig } from ${JSON.stringify(path.join(checkout, 'storage/framework/core/config/src/index.ts'))}
        await awaitConfig()
        globalThis.fetch = async (input, init) => {
          if (String(input) !== ${JSON.stringify(webhook)} || init?.method !== 'POST')
            throw new Error('unexpected fixture request')
          console.log(${JSON.stringify(capturePrefix)} + JSON.stringify(await new Response(init.body).json()))
          return new Response('ok')
        }
      `)
      const run = (args: string[]) => {
        const child = Bun.spawnSync([
          process.execPath, '--no-env-file', '--preload', preload,
          path.join(checkout, 'storage/framework/core/buddy/src/cli.ts'),
          'deploy', ...args, '--env-file', 'target.env', '--yes',
        ], {
          cwd: workspace,
          env: {
            PATH: process.env.PATH, STACKS_BUDDY_ROOT: workspace, NODE_ENV: 'development', APP_ENV: 'development',
            DEPLOY_WEBHOOK_URL: webhook, DEPLOY_WEBHOOK_DRIVER: 'slack', DEPLOY_WEBHOOK_NOTIFY: 'all',
          },
          stdout: 'pipe', stderr: 'pipe',
        })
        return { exitCode: child.exitCode, output: child.stdout.toString() + child.stderr.toString() }
      }

      for (const { args, expected } of [
        { args: ['--staging'], expected: 'staging' },
        { args: ['staging'], expected: 'staging' },
        { args: ['--dev'], expected: 'development' },
        { args: ['dev', '--staging'], expected: 'development' },
        { args: ['--prod'], expected: 'production' },
        { args: [], expected: 'production' },
      ]) {
        const { exitCode, output } = run(args)
        expect(exitCode).not.toBe(0)
        expect(output).toContain(`Deploy to ${expected} failed: fixture hook reached for ${expected}`)
        const messages = output.split('\n').filter(line => line.startsWith(capturePrefix))
        expect(messages).toHaveLength(1)
        const payload = JSON.parse(messages[0]!.slice(capturePrefix.length)) as { text: string }
        expect(payload.text.split('\n')[0]).toEndWith(expected)
        expect(payload.text).toContain(`fixture hook reached for ${expected}`)
      }

      const preview = run(['--staging', '--dry-run', '--json'])
      expect(preview.exitCode, preview.output).toBe(0)
      expect(preview.output).toContain('"environment":"staging"')
      expect(preview.output).not.toContain('fixture hook reached')
      expect(preview.output).not.toContain(capturePrefix)
    }
    finally {
      fs.rmSync(workspace, { recursive: true, force: true })
    }
  }, 30_000)
})

describe('the message builder', () => {
  it('handles the shapes that reach a catch block', async () => {
    // An Error with no message used to print "undefined", which is barely
    // better than the silence this replaced.
    const { getDeployErrorMessage } = await import('../src/deploy-notify')

    expect(getDeployErrorMessage(new Error('no Hetzner API token found'))).toBe('no Hetzner API token found')
    expect(getDeployErrorMessage('a thrown string')).toBe('a thrown string')
    expect(getDeployErrorMessage({ code: 'ENOENT' })).toContain('ENOENT')
    expect(getDeployErrorMessage(new Error(''))).toContain('no message')
    expect(getDeployErrorMessage(undefined)).toContain('no message')
  })
})
