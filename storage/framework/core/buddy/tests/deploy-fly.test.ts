import { describe, expect, it } from 'bun:test'
import { FLY_DOCKERFILE, FlyDeployError, runFlyDeploy, splitFlyEnv } from '../src/commands/deploy-fly'

/**
 * `buddy deploy` on `cloud.provider: 'fly'`, with the process runner and the
 * ts-cloud API faked: the order of the steps, what each one is given, and
 * that a failing step stops the deploy before it reaches Fly.
 */

function harness(options: { appExists?: boolean, failAt?: string, dockerfile?: boolean } = {}) {
  const calls: string[] = []
  const commands: Array<{ command: string[], stdin?: string }> = []
  let converged: any
  const api = {
    flyDeployOptions: (_config: unknown, input: any) => ({ app: 'acme-production', org: 'personal', image: input.image, env: input.env, secrets: input.secrets, release: input.release }),
    FlyClient: class {
      constructor(readonly init: { token: string }) { calls.push(`client:${init.token}`) }
      async getApp() { calls.push('getApp'); return options.appExists ? { name: 'acme-production' } : null }
      async createApp(app: string, org: string) { calls.push(`createApp:${app}:${org}`) }
    },
    deployToFly: async (_client: unknown, deployOptions: any) => {
      calls.push('deployToFly')
      converged = deployOptions
      return { app: 'acme-production', url: 'https://acme-production.fly.dev', createdApp: false, created: [], updated: ['m1'], untouched: [], ips: [], certificates: [] }
    },
  }
  const deps = {
    api: api as any,
    run: (command: string[], runOptions: { cwd: string, stdin?: string }) => {
      commands.push({ command, stdin: runOptions.stdin })
      calls.push(command.slice(0, 2).join(' '))
      return command[1] === options.failAt ? { exitCode: 1, output: 'denied: not authorized' } : { exitCode: 0, output: '' }
    },
    exists: (path: string) => options.dockerfile !== false && path.endsWith(FLY_DOCKERFILE),
    log: () => {},
  }
  return { deps, calls, commands, converged: () => converged }
}

const input = {
  config: {},
  environment: 'production',
  token: 'fly-token',
  release: 'abc123def456',
  envValues: { APP_KEY: 'base64:k', DB_PASSWORD: 'p', PORT: '8080' },
  projectRoot: '/app',
}

describe('runFlyDeploy', () => {
  it('creates the app, builds and pushes the image to its registry, then converges it', async () => {
    const h = harness()
    const result = await runFlyDeploy(input, h.deps)

    expect(h.calls).toEqual(['client:fly-token', 'getApp', 'createApp:acme-production:personal', 'docker build', 'docker login', 'docker push', 'deployToFly'])
    expect(h.commands[0]!.command).toEqual(['docker', 'build', '--platform', 'linux/amd64', '-t', 'registry.fly.io/acme-production:abc123def456', '-f', FLY_DOCKERFILE, '.'])
    expect(h.commands[1]!.command).toEqual(['docker', 'login', 'registry.fly.io', '--username', 'x', '--password-stdin'])
    // The token travels on stdin, never in argv where `ps` shows it.
    expect(h.commands[1]!.stdin).toBe('fly-token')
    expect(h.commands.flatMap(c => c.command).join(' ')).not.toContain('fly-token')
    expect(h.converged()).toMatchObject({ image: 'registry.fly.io/acme-production:abc123def456', secrets: { APP_KEY: 'base64:k', DB_PASSWORD: 'p' }, env: { APP_ENV: 'production', NODE_ENV: 'production' } })
    expect(result.url).toBe('https://acme-production.fly.dev')
  })

  it('does not create an app that exists', async () => {
    const h = harness({ appExists: true })
    await runFlyDeploy(input, h.deps)
    expect(h.calls.some(call => call.startsWith('createApp'))).toBe(false)
  })

  it('stops at a failed step, before Fly is touched', async () => {
    const h = harness({ failAt: 'push' })
    const error = await runFlyDeploy(input, h.deps).catch(e => e)
    expect(error).toBeInstanceOf(FlyDeployError)
    expect(error.message).toBe('docker push failed (exit 1).')
    expect(error.hint).toBe('denied: not authorized')
    expect(h.calls).not.toContain('deployToFly')
  })

  it('says what is missing before doing anything', async () => {
    const noToken = harness()
    await expect(runFlyDeploy({ ...input, token: undefined }, noToken.deps)).rejects.toThrow('needs an API token')
    expect(noToken.calls).toEqual([])

    const noDockerfile = harness({ dockerfile: false })
    await expect(runFlyDeploy(input, noDockerfile.deps)).rejects.toThrow(`No ${FLY_DOCKERFILE}`)
    expect(noDockerfile.calls).toEqual([])
  })
})

describe('splitFlyEnv', () => {
  it('makes every file value a secret, keeps PORT the Machine\'s own, and names the environment in plain env', () => {
    expect(splitFlyEnv({ APP_KEY: 'k', PORT: '9000' }, 'staging')).toEqual({ secrets: { APP_KEY: 'k' }, env: { APP_ENV: 'staging', NODE_ENV: 'development' } })
  })
})
