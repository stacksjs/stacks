import { afterEach, describe, expect, test } from 'bun:test'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gitCredentialEnvironment } from '../src/credentials'

const directories: string[] = []
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true })
})

function isolatedEnvironment() {
  const home = mkdtempSync(join(tmpdir(), 'stacks-git-credentials-'))
  directories.push(home)
  return { PATH: process.env.PATH, HOME: home, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' }
}

async function fill(url: string, credentials: Record<string, string>) {
  const child = Bun.spawn(['git', 'credential', 'fill'], {
    env: { ...isolatedEnvironment(), ...credentials },
    stdin: new TextEncoder().encode(`url=${url}\n\n`),
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 5000,
  })
  const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
  return { exitCode, stdout, stderr }
}

describe('repository-scoped child Git credentials', () => {
  test('preserves caller runtime Git configuration while resetting credential helpers', async () => {
    const base = { ...isolatedEnvironment(), GIT_CONFIG_COUNT: '2', GIT_CONFIG_KEY_0: 'safe.directory', GIT_CONFIG_VALUE_0: '/controlled/repository', GIT_CONFIG_KEY_1: 'http.sslVerify', GIT_CONFIG_VALUE_1: 'true' }
    const credentials = gitCredentialEnvironment({ url: 'https://forge.invalid/repo.git', username: 'user', password: 'controlled-secret' }, base)
    const child = Bun.spawn(['git', 'config', '--get-all', 'safe.directory'], { env: { ...base, ...credentials }, stdout: 'pipe', stderr: 'pipe', timeout: 5000 })
    const [exitCode, stdout] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode).toBe(0)
    expect(stdout).toBe('/controlled/repository\n')
    expect(credentials.GIT_CONFIG_COUNT).toBe('6')
    expect(credentials.GIT_CONFIG_KEY_2).toBe('credential.helper')
    expect(credentials.GIT_CONFIG_VALUE_2).toBe('')
  })

  test.each([
    { GIT_CONFIG_COUNT: '-1' },
    { GIT_CONFIG_COUNT: 'not-a-count' },
    { GIT_CONFIG_COUNT: '1' },
    { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'safe.directory' },
  ])('rejects incomplete runtime Git configuration', (base) => {
    expect(() => gitCredentialEnvironment({ url: 'https://forge.invalid/repo.git', username: 'user', password: 'controlled-secret' }, base)).toThrow('Git runtime configuration')
  })
  test.each([
    'https://Forge.Invalid/team/repo.git',
    'https://forge.invalid:443/team/repo.git',
    'http://forge.invalid:80/team/repo.git',
    'https://forge.invalid:8443/team/repo.git',
    'https://[::1]:443/team/repo.git',
    'https://forge.invalid/team/repo%20space.git',
    'https://forge.invalid/team/%72epo.git',
    'https://forge.invalid/team%2Frepo.git',
    'https://forge.invalid/team/repo.git//',
  ])('matches Git credential parsing for %s', async (url) => {
    const result = await fill(url, gitCredentialEnvironment({ url, username: 'user', password: 'controlled-secret' }))
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain('password=controlled-secret\n')
  })
  test('Git receives the exact repository credential without shell expansion or credential files', async () => {
    const environment = isolatedEnvironment()
    const marker = join(environment.HOME, 'must-not-exist')
    const password = `secret'\"$(touch ${marker})`
    const credentials = gitCredentialEnvironment({ url: 'https://forge.invalid/git/team/private.git', username: 'x-access-token', password })
    const result = await fill('https://forge.invalid/git/team/private.git', { ...environment, ...credentials })
    expect(result.exitCode).toBe(0)
    expect(result.stdout).toContain(`password=${password}\n`)
    expect(result.stdout).toContain('username=x-access-token\n')
    expect(credentials.GIT_CONFIG_VALUE_1).not.toContain(password)
    expect(existsSync(marker)).toBe(false)
    expect(existsSync(join(environment.HOME, '.git-credentials'))).toBe(false)
    expect(existsSync(join(environment.HOME, '.gitconfig'))).toBe(false)
  })

  test.each([
    'https://forge.invalid/git/team/other.git',
    'https://forge.invalid/git/team/private.git/child',
    'https://other.invalid/git/team/private.git',
    'http://forge.invalid/git/team/private.git',
    'https://forge.invalid:8443/git/team/private.git',
  ])('does not give the credential to %s', async (url) => {
    const result = await fill(url, gitCredentialEnvironment({ url: 'https://forge.invalid/git/team/private.git', username: 'x-access-token', password: 'controlled-secret' }))
    expect(result.exitCode).not.toBe(0)
    expect(result.stdout).not.toContain('controlled-secret')
    expect(result.stderr).not.toContain('controlled-secret')
  })

  test.each(['approve', 'reject'])('Git %s never writes a credential', async (operation) => {
    const environment = isolatedEnvironment()
    const child = Bun.spawn(['git', 'credential', operation], {
      env: { ...environment, ...gitCredentialEnvironment({ url: 'https://forge.invalid/repo.git', username: 'user', password: 'controlled-secret' }) },
      stdin: new TextEncoder().encode('protocol=https\nhost=forge.invalid\npath=repo.git\nusername=user\npassword=controlled-secret\n\n'),
      stdout: 'pipe', stderr: 'pipe', timeout: 5000,
    })
    const [exitCode, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect(exitCode).toBe(0)
    expect(stdout).toBe('')
    expect(stderr).toBe('')
    expect(existsSync(join(environment.HOME, '.git-credentials'))).toBe(false)
    expect(existsSync(join(environment.HOME, '.gitconfig'))).toBe(false)
  })

  test('real HTTP Git authentication works and an authenticated redirect is refused', async () => {
    const requests: { path: string, authenticated: boolean }[] = []
    const expected = `Basic ${Buffer.from('x-access-token:controlled-secret').toString('base64')}`
    const server = Bun.serve({
      hostname: '127.0.0.1', port: 0,
      fetch(request) {
        const path = new URL(request.url).pathname
        const authenticated = request.headers.get('authorization') === expected
        requests.push({ path, authenticated })
        if (!authenticated)
          return new Response('', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="controlled-git-fixture"' } })
        if (path.startsWith('/redirect.git/'))
          return new Response('', { status: 302, headers: { Location: `${server.url}other.git/info/refs?service=git-upload-pack` } })
        // An empty, valid smart-HTTP upload-pack advertisement.
        return new Response('001e# service=git-upload-pack\n00000000', { headers: { 'Content-Type': 'application/x-git-upload-pack-advertisement' } })
      },
    })
    async function remote(repository: string) {
      const url = `${server.url}${repository}`
      const child = Bun.spawn(['git', 'ls-remote', url], {
        env: { ...isolatedEnvironment(), ...gitCredentialEnvironment({ url, username: 'x-access-token', password: 'controlled-secret' }) },
        stdout: 'pipe', stderr: 'pipe', timeout: 5000,
      })
      const [exitCode, stderr] = await Promise.all([child.exited, new Response(child.stderr).text(), new Response(child.stdout).text()])
      return { exitCode, stderr }
    }
    try {
      expect((await remote('private.git')).exitCode).toBe(0)
      expect(requests.some(request => request.path === '/private.git/info/refs' && request.authenticated)).toBe(true)
      const redirected = await remote('redirect.git')
      expect(redirected.exitCode).not.toBe(0)
      expect(redirected.stderr).not.toContain('controlled-secret')
      expect(requests.some(request => request.path.startsWith('/other.git'))).toBe(false)
    }
    finally { server.stop(true) }
  })

  test.each(['file:///repo.git', 'https://forge.invalid/', 'https://user:pass@forge.invalid/repo.git', 'https://forge.invalid/repo.git?secret=value', 'https://forge.invalid/repo.git#fragment', 'https://forge.invalid/repo%0Ausername=intruder.git', 'https://forge.invalid/repo%00.git'])('rejects unsafe repository URL %s', (url) => {
    expect(() => gitCredentialEnvironment({ url, username: 'user', password: 'controlled-secret' })).toThrow(TypeError)
  })

  test.each(['', 'secret\nusername=intruder', 'secret\rvalue', 'secret\0value'])('rejects an invalid credential field', (password) => {
    expect(() => gitCredentialEnvironment({ url: 'https://forge.invalid/repo.git', username: 'user', password })).toThrow('single-line')
  })
})
