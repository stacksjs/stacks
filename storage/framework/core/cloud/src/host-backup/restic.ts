import { lstatSync, realpathSync, renameSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, sep } from 'node:path'
import process from 'node:process'
import { command, envValues, withScratch } from './io'

export interface ResticSnapshot {
  id: string
  time: string
}

export class ResticArchive {
  readonly repository: string
  private readonly env: Record<string, string | undefined>

  constructor(config: string, provider: string, requireS3Credentials = false, private readonly policy = { lock: '5m', timeoutMs: 6 * 3_600_000 }) {
    const env = { ...process.env }
    for (const key of Object.keys(env)) {
      if (key.startsWith('RESTIC_') || key.startsWith('AWS_'))
        delete env[key]
    }
    const credentials = envValues(config)
    if (!credentials.RESTIC_REPOSITORY || (!credentials.RESTIC_PASSWORD_FILE && !credentials.RESTIC_PASSWORD))
      throw new Error(`Incomplete Restic repository configuration for ${provider}`)
    if (requireS3Credentials && (!credentials.RESTIC_PASSWORD_FILE || !credentials.AWS_ACCESS_KEY_ID || !credentials.AWS_SECRET_ACCESS_KEY))
      throw new Error(`Missing explicit S3 credentials or Restic password file for ${provider}`)
    this.repository = credentials.RESTIC_REPOSITORY
    this.env = { ...env, RESTIC_CACHE_DIR: `${dirname(config)}/cache-${provider}`, ...credentials }
    // The Hetzner endpoint can cancel full pack reads on HTTP/2 even after
    // retries. Keep the HTTPS request and use Go's HTTP/1.1 transport there.
    if (provider === 'hetzner')
      this.env.GODEBUG = [this.env.GODEBUG, 'http2client=0'].filter(Boolean).join(',')
  }

  run(...args: string[]): Promise<string> {
    return command(['restic', '--retry-lock', this.policy.lock, ...args], { env: this.env, timeoutMs: this.policy.timeoutMs, interruptOnTimeout: true })
  }

  async snapshots(...args: string[]): Promise<ResticSnapshot[]> {
    return JSON.parse(await this.run('snapshots', '--json', ...args))
  }

  async checkPackPartition(partition: number, log: string): Promise<void> {
    await command(['restic', '--retry-lock', '5m', '--verbose', 'check', `--read-data-subset=${partition}/7`], {
      env: this.env,
      output: log,
      logErrorsToOutput: true,
      timeoutMs: 6 * 3_600_000,
      interruptOnTimeout: true,
    })
  }

  async restore(snapshot: string, path: string, destination: string): Promise<void> {
    await command(['restic', '--retry-lock', this.policy.lock, 'dump', snapshot, path], {
      env: this.env,
      output: destination,
      timeoutMs: this.policy.timeoutMs,
      interruptOnTimeout: true,
    })
  }

  async restoreVerifiedFile(snapshot: string, path: string, destination: string): Promise<void> {
    if (!isAbsolute(path))
      throw new Error('The Restic file path must be absolute')
    const archivePath = normalize(path)
    const include = archivePath.replace(/[\\*?()[\]{}]/g, '\\$&')
    // Restic's file restore fetches the needed packs in parallel and verifies
    // the extracted file. This avoids a stalled range read blocking the
    // entire sequential dump stream during large database drills.
    await withScratch(join(dirname(destination), '.restic-'), async (scratch) => {
      await this.run('restore', snapshot, '--include', include, '--target', scratch, '--verify')
      const restored = join(scratch, archivePath)
      if (!lstatSync(restored, { throwIfNoEntry: false })?.isFile() || !realpathSync(restored).startsWith(realpathSync(scratch) + sep))
        throw new Error('Restic did not restore the requested file')
      renameSync(restored, destination)
    })
  }
}
