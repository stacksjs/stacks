import { dirname } from 'node:path'
import process from 'node:process'
import { command, envValues } from './io'

export interface ResticSnapshot {
  id: string
  time: string
}

export class ResticArchive {
  readonly repository: string
  private readonly env: Record<string, string | undefined>

  constructor(config: string, provider: string, requireS3Credentials = false) {
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
  }

  run(...args: string[]): Promise<string> {
    return command(['restic', '--retry-lock', '5m', ...args], { env: this.env, timeoutMs: 6 * 3_600_000 })
  }

  async snapshots(...args: string[]): Promise<ResticSnapshot[]> {
    return JSON.parse(await this.run('snapshots', '--json', ...args))
  }

  async restore(snapshot: string, path: string, destination: string): Promise<void> {
    await command(['restic', '--retry-lock', '5m', 'dump', snapshot, path], {
      env: this.env,
      output: destination,
      timeoutMs: 6 * 3_600_000,
    })
  }
}
