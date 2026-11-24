/**
 * A release is a directory the next deploy replaces. Only the database and
 * `storage/logs` are kept between releases, so anything else an app writes on
 * the box (uploads, generated media, a cache file) is gone after the next
 * deploy, and nothing said so (stacksjs/stacks#3367).
 *
 * Two warnings now say so: one before upload, from the configuration, and one
 * on the box, from what the outgoing release actually wrote.
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, utimesSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { applyReleaseWriteCheck, RELEASE_LIVE_MARKER, releaseTreeStorageWarnings, releaseWritesCommand } from '../src/release-writes'

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** `/var/www/<site>` as ts-cloud lays it out: releases/<id>, and current -> the live one. */
function site(): { base: string, release: (id: string) => string, live: (id: string) => void } {
  const base = mkdtempSync(join(tmpdir(), 'stacks-release-writes-'))
  scratch.push(base)
  return {
    base,
    release: (id) => {
      const dir = join(base, 'releases', id)
      mkdirSync(dir, { recursive: true })
      return dir
    },
    live: (id) => {
      rmSync(join(base, 'current'), { force: true })
      symlinkSync(join(base, 'releases', id), join(base, 'current'))
    },
  }
}

function write(path: string, body = 'x'): void {
  mkdirSync(join(path, '..'), { recursive: true })
  writeFileSync(path, body)
}

/** Run the preStart step the way ts-cloud does: bash, strict mode, from inside the new release. */
function runStep(release: string): { code: number, out: string } {
  const result = Bun.spawnSync(['bash', '-c', `set -euo pipefail\ncd ${JSON.stringify(release)}\n${releaseWritesCommand()}`], { stdout: 'pipe', stderr: 'pipe' })
  return { code: result.exitCode ?? -1, out: `${result.stdout.toString()}${result.stderr.toString()}` }
}

/** A release that went live an hour ago. */
function wentLive(release: string): void {
  write(join(release, RELEASE_LIVE_MARKER), '')
  const hourAgo = new Date(Date.now() - 3_600_000)
  utimesSync(join(release, RELEASE_LIVE_MARKER), hourAgo, hourAgo)
}

describe('the on-box check, run in the new release before it goes live', () => {
  it('lists what the outgoing release wrote under its own tree, by directory', () => {
    const box = site()
    const old = box.release('old')
    write(join(old, 'app/Actions/Shipped.ts'))
    wentLive(old)
    // Shipped with the release, from before it went live.
    const before = new Date(Date.now() - 7_200_000)
    utimesSync(join(old, 'app/Actions/Shipped.ts'), before, before)
    // Written while it was live.
    write(join(old, 'storage/app/postline-media/a.png'))
    write(join(old, 'storage/app/postline-media/b.png'))
    write(join(old, 'public/uploads/avatar.jpg'))
    // Rebuilt by every release, and losing it costs nothing.
    write(join(old, 'node_modules/pkg/index.js'))
    write(join(old, 'storage/framework/stx/page.js'))
    box.live('old')

    const { code, out } = runStep(box.release('new'))

    expect(code).toBe(0)
    expect(out).toContain('The release going live now does not have them')
    expect(out).toMatch(/2 storage\/app/)
    expect(out).toMatch(/1 public\/uploads/)
    expect(out).not.toContain('app/Actions')
    expect(out).not.toContain('node_modules')
    expect(out).not.toContain('storage/framework')
  })

  it('does not count what a shared path holds: that is kept', () => {
    const box = site()
    const old = box.release('old')
    wentLive(old)
    const shared = join(box.base, 'shared/storage/logs')
    write(join(shared, 'stacks.log'))
    mkdirSync(join(old, 'storage'), { recursive: true })
    symlinkSync(shared, join(old, 'storage/logs'))
    box.live('old')

    const { code, out } = runStep(box.release('new'))
    expect(code).toBe(0)
    expect(out).toBe('')
  })

  it('marks the new release live, so the next deploy can tell what it wrote', () => {
    const box = site()
    const release = box.release('first')
    const { code, out } = runStep(release)

    // The first deploy: no outgoing release, nothing to say, and never a failure.
    expect(code).toBe(0)
    expect(out).toBe('')
    expect(existsSync(join(release, RELEASE_LIVE_MARKER))).toBe(true)
  })

  it('stays quiet about a release that predates the marker', () => {
    const box = site()
    const old = box.release('old')
    write(join(old, 'storage/app/a.png'))
    box.live('old')
    const { code, out } = runStep(box.release('new'))
    expect(code).toBe(0)
    expect(out).toBe('')
  })
})

describe('applyReleaseWriteCheck', () => {
  it('ends every server app\'s preStart with the check, once', () => {
    const sites = {
      app: { start: 'bun run server', preStart: ['bun install', './buddy migrate --no-generate'] },
      docs: { root: 'dist' },
    }
    const once = applyReleaseWriteCheck(sites)
    expect(once.app.preStart).toEqual(['bun install', './buddy migrate --no-generate', releaseWritesCommand()])
    expect(once.docs).toEqual({ root: 'dist' })
    expect(applyReleaseWriteCheck(once).app.preStart).toHaveLength(3)
  })

  it('gives a server app with no preStart one', () => {
    expect(applyReleaseWriteCheck({ app: { start: 'bun run server' } }).app.preStart).toEqual([releaseWritesCommand()])
  })
})

describe('releaseTreeStorageWarnings, before anything is uploaded', () => {
  it('warns when the local disk writes inside the release, which is the default', () => {
    const warnings = releaseTreeStorageWarnings({ app: { start: 'bun run server', env: {} } })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('"app"')
    expect(warnings[0]).toContain('storage/app')
    expect(warnings[0]).toContain('sharedPaths')
  })

  it('is satisfied by a shared storage/app, or a parent of it', () => {
    expect(releaseTreeStorageWarnings({ app: { start: 's', env: {}, sharedPaths: ['storage/app'] } })).toEqual([])
    expect(releaseTreeStorageWarnings({ app: { start: 's', env: {}, sharedPaths: [{ path: 'storage', target: '/srv/x' }] } })).toEqual([])
    expect(releaseTreeStorageWarnings({ app: { start: 's', env: {}, sharedPaths: ['storage/logs'] } })).toHaveLength(1)
  })

  it('is satisfied by a storage root outside the release, or a remote disk', () => {
    expect(releaseTreeStorageWarnings({ app: { start: 's', env: { STORAGE_ROOT: '/srv/acme-files' } } })).toEqual([])
    expect(releaseTreeStorageWarnings({ app: { start: 's', env: { STORAGE_DRIVER: 's3' } } })).toEqual([])
  })

  it('says the public disk cannot be fixed by sharing public/', () => {
    const [warning] = releaseTreeStorageWarnings({ app: { start: 's', env: { STORAGE_DRIVER: 'public' } } })
    expect(warning).toContain('public/')
    expect(warning).toContain('STORAGE_ROOT')
    expect(warning).not.toContain('sharedPaths')
  })

  it('ignores sites that do not run on the box', () => {
    expect(releaseTreeStorageWarnings({ docs: { root: 'dist' }, assets: { deploy: 'bucket', root: 'public' } })).toEqual([])
  })
})
