import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export interface DeploymentIdentity { privateKeyPath: string, publicKeyPath: string }

/** A CI key belongs to this deploy, never to the shared runner's ~/.ssh. */
export async function withDeploymentIdentity<T>(key: string | undefined, run: (identity?: DeploymentIdentity) => Promise<T>): Promise<T> {
  if (!key) return run()
  if (Buffer.byteLength(key) > 65536) throw new Error('The deployment SSH key exceeds its size limit')
  const directory = mkdtempSync(join(process.env.RUNNER_TEMP || tmpdir(), 'stacks-deploy-identity-'))
  chmodSync(directory, 0o700)
  const privateKeyPath = join(directory, 'identity'), publicKeyPath = `${privateKeyPath}.pub`
  const previous = process.env.TS_CLOUD_SSH_KEY
  let disposed = false
  const cleanup = () => {
    if (disposed) return
    disposed = true
    if (previous === undefined) delete process.env.TS_CLOUD_SSH_KEY
    else process.env.TS_CLOUD_SSH_KEY = previous
    rmSync(directory, { recursive: true, force: true })
  }
  const interrupt = () => { cleanup(); process.exit(130) }
  const terminate = () => { cleanup(); process.exit(143) }
  process.once('exit', cleanup)
  process.once('SIGINT', interrupt)
  process.once('SIGTERM', terminate)
  try {
    if (process.platform === 'win32') {
      // chmod does not remove inherited NTFS access. Restrict the directory
      // before writing a key, using the current SID rather than a localized name.
      try {
        const user = execFileSync('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', timeout: 10000 })
        const sid = /"(S-1-\d+(?:-\d+)+)"/.exec(user)?.[1]
        if (!sid) throw new Error('No current user SID')
        execFileSync('icacls.exe', [directory, '/inheritance:r', '/grant:r', `*${sid}:(OI)(CI)F`], { stdio: 'pipe', timeout: 10000 })
      }
      catch { throw new Error('Cannot restrict the deployment identity directory to the current Windows user') }
    }
    writeFileSync(privateKeyPath, key.replaceAll('\r\n', '\n').trimEnd() + '\n', { mode: 0o600, flag: 'wx' })
    let publicKey: string
    try { publicKey = execFileSync('ssh-keygen', ['-y', '-P', '', '-f', privateKeyPath], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000 }).trim() }
    catch { throw new Error('DEPLOY_SSH_KEY must contain a valid unencrypted deployment private key') }
    writeFileSync(publicKeyPath, `${publicKey}\n`, { mode: 0o600, flag: 'wx' })
    process.env.TS_CLOUD_SSH_KEY = privateKeyPath
    return await run({ privateKeyPath, publicKeyPath })
  }
  finally {
    process.off('exit', cleanup)
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', terminate)
    cleanup()
  }
}

export function deploymentIdentityConfig<T extends { hetzner?: Record<string, unknown> }>(config: T, identity?: DeploymentIdentity): T {
  return identity ? { ...config, hetzner: { ...config.hetzner, sshPrivateKeyPath: identity.privateKeyPath, sshPublicKeyPath: identity.publicKeyPath } } : config
}
