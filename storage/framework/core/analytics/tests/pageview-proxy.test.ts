import { expect, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// stacksjs/stacks#3154: behind rpx, a click between two of the site's own pages
// was stored as a referral from the site, because the self-referral check used
// the upstream address rpx connects to rather than the site's host.
test('a page view behind rpx records the site host and never refers the site to itself', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'stacks-pageview-proxy-'))
  try {
    const preload = join(directory, 'preload.ts')
    const config = join(directory, 'bunfig.toml')
    writeFileSync(preload, 'export {}\n')
    writeFileSync(config, `preload = [${JSON.stringify(preload)}]\n`)
    const child = Bun.spawn([process.execPath, `--config=${config}`, '--no-env-file', join(import.meta.dir, 'fixtures/pageview-proxy.ts')], {
      env: { ...process.env, APP_ENV: 'test', DB_CONNECTION: 'sqlite', DB_DATABASE_PATH: join(directory, 'test.sqlite') },
      stdout: 'pipe', stderr: 'pipe',
    })
    const watchdog = setTimeout(() => child.kill(), 20_000)
    try {
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect(code, `${stdout}\n${stderr}`).toBe(0)
      const rows = JSON.parse(stdout.trim().split('\n').at(-1)!) as Array<{ path: string, host: string, referrer: string | null }>
      expect(rows.map(({ path, host, referrer }) => ({ path, host, referrer }))).toEqual([
        { path: '/pricing', host: 'shop.example.com', referrer: null },
        { path: '/', host: 'shop.example.com', referrer: 'www.google.com' },
        { path: '/about', host: 'shop.example.com', referrer: null },
      ])
    }
    finally { clearTimeout(watchdog); child.kill() }
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 25_000)
