import { describe, expect, it } from 'bun:test'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

describe('published cloud entrypoints', () => {
  it('builds importable client exports and mail server subpaths', () => {
    const cwd = new URL('../', import.meta.url).pathname
    const build = Bun.spawnSync({ cmd: [process.execPath, 'build.ts'], cwd, stdout: 'pipe', stderr: 'pipe' })
    expect(build.exitCode, build.stderr.toString()).toBe(0)

    const probe = Bun.spawnSync({
      cmd: [process.execPath, '-e', `
        const cloud = await import('./dist/index.js')
        const upstream = await import('@stacksjs/ts-cloud')
        const aws = await import('@stacksjs/ts-cloud/aws')
        for (const name of ['AWSClient', 'S3Client', 'SecretsManagerClient']) {
          if (cloud[name] !== upstream[name]) throw new Error('Published client binding differs: ' + name)
        }
        if (cloud.buildQueryParams !== aws.buildQueryParams) throw new Error('AWS helper binding differs')
        const smtp = await import('./dist/imap/smtp-server.js')
        if (cloud.SmtpServer !== smtp.SmtpServer) throw new Error('Mail server binding differs')
      `],
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
    })
    expect(probe.exitCode, probe.stderr.toString()).toBe(0)
    for (const entry of ['index', 'imap/smtp-server', 'imap/imap-server']) {
      expect(existsSync(join(cwd, 'dist', `${entry}.js`))).toBe(true)
      expect(existsSync(join(cwd, 'dist', `${entry}.d.ts`))).toBe(true)
    }
  }, 30000)
})
