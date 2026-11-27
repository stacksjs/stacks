import { describe, expect, it } from 'bun:test'
import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertNpmLatestMayAdvance, npmLatestVersion } from './npm-publication'
import { npmReleaseChannel } from './npm-release-channel'

const stacks = { name: 'stacks', version: '0.75.709' }
const support = { name: '@stacksjs/support', version: '0.75.709' }

describe('npm release channels', () => {
  it('keeps a delayed older cohort off latest once the umbrella has advanced', async () => {
    const read = async (url: string) => Response.json({ latest: url.includes('support') ? '0.75.708' : '0.75.711' })
    expect(await npmReleaseChannel([stacks, support], stacks.version, read)).toBe('backfill-0.75.709')
  })

  it('checks scoped packages even if the umbrella has not advanced', async () => {
    const read = async (url: string) => Response.json({ latest: url.includes('support') ? '0.75.710' : '0.75.708' })
    expect(await npmReleaseChannel([stacks, support], stacks.version, read)).toBe('backfill-0.75.709')
  })

  it('permits a current or newer release and a genuinely absent package', async () => {
    const read = async (url: string) => url.includes('support') ? new Response(null, { status: 404 }) : Response.json({ latest: '0.75.709', staging: '0.75.712' })
    expect(await npmReleaseChannel([stacks, support], stacks.version, read)).toBe('latest')
    await assertNpmLatestMayAdvance(support, 'https://registry.npmjs.org', read)
  })

  it('refuses unexpected or malformed registry responses', async () => {
    await expect(npmLatestVersion(stacks.name, 'https://registry.npmjs.org', async () => new Response(null, { status: 503 }))).rejects.toThrow('HTTP 503')
    await expect(npmLatestVersion(stacks.name, 'https://registry.npmjs.org', async () => Response.json({ latest: 'unexpected' }))).rejects.toThrow('invalid latest')
    await expect(npmLatestVersion(stacks.name, 'https://registry.npmjs.org', async () => Response.json(null))).rejects.toThrow('invalid dist-tags')
  })

  it('refuses a latest write after a newer release appears between checks', async () => {
    let latest = '0.75.708'
    const read = async () => Response.json({ latest })
    expect(await npmReleaseChannel([stacks], stacks.version, read)).toBe('latest')
    latest = '0.75.710'
    await expect(assertNpmLatestMayAdvance(stacks, 'https://registry.npmjs.org', read)).rejects.toThrow('stacks@0.75.709 would move latest backward from 0.75.710')
  })

  it('refuses a direct latest upload and lets the same archive proceed on its backfill tag', async () => {
    const root = await mkdtemp(join(tmpdir(), 'stacks-npm-channel-'))
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => Response.json({ latest: '0.75.711' }) })
    try {
      const bin = join(root, 'bin')
      await mkdir(bin)
      await Bun.write(join(root, 'package.json'), JSON.stringify(stacks))
      await Bun.write(join(root, 'registry.ts'), `const read = globalThis.fetch; globalThis.fetch = (url, init) => read(new URL(new URL(String(url)).pathname, ${JSON.stringify(server.url.href)}), init)`)
      await Bun.write(join(bin, 'bun'), '#!/usr/bin/env bash\nexec "$FIXTURE_BUN" --preload "$FIXTURE_ROOT/registry.ts" "$@"\n')
      await Bun.write(join(bin, 'pantry'), '#!/usr/bin/env bash\nprintf "%s\\n" "$@" >> "$FIXTURE_ROOT/uploads"\n')
      await Promise.all([chmod(join(bin, 'bun'), 0o755), chmod(join(bin, 'pantry'), 0o755)])
      const publish = (tag: string) => Bun.spawn([
        'bash', fileURLToPath(new URL('./publish-npm.sh', import.meta.url)), '--npm', '--tag', tag, root,
      ], { cwd: root, env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FIXTURE_BUN: process.execPath, FIXTURE_ROOT: root }, stdout: 'pipe', stderr: 'pipe' })
      const refused = publish('latest')
      const [status, reason] = await Promise.all([refused.exited, new Response(refused.stderr).text()])
      expect(status).toBe(1)
      expect(reason).toContain('would move latest backward from 0.75.711')
      expect(await Bun.file(join(root, 'uploads')).exists()).toBe(false)

      const allowed = publish('backfill-0.75.709')
      expect(await allowed.exited).toBe(0)
      expect(await Bun.file(join(root, 'uploads')).text()).toBe(`publish\n--npm\n--tag\nbackfill-0.75.709\n${root}\n`)
    }
    finally {
      server.stop(true)
      await rm(root, { recursive: true, force: true })
    }
  })
})
