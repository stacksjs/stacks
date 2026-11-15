import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { deploymentIdentityConfig, withDeploymentIdentity } from '../src/deploy-identity'
import { hetznerTarget, sshCliArgs } from '../src/commands/deploy-ssh-target'

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'stacks-ssh-fixture-'))
  const key = join(root, 'key')
  execFileSync('ssh-keygen', ['-t', 'ed25519', '-N', '', '-f', key], { stdio: 'ignore' })
  return { root, key: readFileSync(key, 'utf8'), publicKey: readFileSync(`${key}.pub`, 'utf8').split(' ').slice(0, 2).join(' ') }
}

test('a deployment stages one native SSH identity without replacing the shared runner identity', async () => {
  const fixtureKey = fixture()
  const previous = process.env.TS_CLOUD_SSH_KEY
  process.env.TS_CLOUD_SSH_KEY = '/existing/runner/identity'
  let staged = ''
  try {
    await withDeploymentIdentity(fixtureKey.key, async identity => {
      expect(identity).toBeDefined()
      staged = identity!.privateKeyPath
      expect(readFileSync(staged, 'utf8')).toBe(fixtureKey.key)
      expect(readFileSync(identity!.publicKeyPath, 'utf8').trim().split(' ').slice(0, 2).join(' ')).toBe(fixtureKey.publicKey)
      if (process.platform !== 'win32') {
        expect(statSync(staged).mode & 0o777).toBe(0o600)
        expect(statSync(dirname(staged)).mode & 0o777).toBe(0o700)
      }
      const config = { hetzner: { location: 'fsn1' }, sites: { app: { domain: 'app.example' } } }
      expect(deploymentIdentityConfig(config, identity)).toMatchObject({ hetzner: { location: 'fsn1', sshPrivateKeyPath: staged, sshPublicKeyPath: identity!.publicKeyPath }, sites: config.sites })
      expect(config.hetzner).toEqual({ location: 'fsn1' })
      expect(sshCliArgs(hetznerTarget('127.0.0.1'))).toContain(staged)
      expect(process.env.TS_CLOUD_SSH_KEY).toBe(staged)
    })
    expect(existsSync(dirname(staged))).toBe(false)
    expect(process.env.TS_CLOUD_SSH_KEY).toBe('/existing/runner/identity')
    await expect(withDeploymentIdentity('invalid-private-fixture', async () => {})).rejects.toThrow('valid unencrypted')
    expect(process.env.TS_CLOUD_SSH_KEY).toBe('/existing/runner/identity')
    await withDeploymentIdentity(undefined, async identity => { expect(identity).toBeUndefined() })
  }
  finally {
    if (previous === undefined) delete process.env.TS_CLOUD_SSH_KEY
    else process.env.TS_CLOUD_SSH_KEY = previous
    rmSync(fixtureKey.root, { recursive: true, force: true })
  }
})

test.skipIf(process.platform === 'win32')('termination removes the deployment key before the process exits', async () => {
  const fixtureKey = fixture()
  let child: ReturnType<typeof Bun.spawn> | undefined
  try {
    const script = join(fixtureKey.root, 'deploy.ts')
    writeFileSync(script, `import{withDeploymentIdentity}from ${JSON.stringify(join(import.meta.dir, '../src/deploy-identity.ts'))};await withDeploymentIdentity(await Bun.stdin.text(),async identity=>{console.log(identity.privateKeyPath);await new Promise(()=>{})});`)
    child = Bun.spawn([process.execPath, '--no-env-file', script], { stdin: new TextEncoder().encode(fixtureKey.key), stdout: 'pipe', stderr: 'pipe', cwd: fixtureKey.root })
    const reader = (child.stdout as ReadableStream<Uint8Array>).getReader()
    const output = await reader.read()
    const staged = new TextDecoder().decode(output.value).trim()
    expect(existsSync(staged)).toBe(true)
    child.kill('SIGTERM')
    expect(await child.exited).toBe(143)
    expect(existsSync(dirname(staged))).toBe(false)
    await reader.cancel()
  }
  finally { child?.kill(); rmSync(fixtureKey.root, { recursive: true, force: true }) }
})
