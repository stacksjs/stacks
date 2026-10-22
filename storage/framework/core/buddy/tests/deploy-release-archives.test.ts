/**
 * A deploy's release archives go when the deploy does.
 *
 * `deploy` packaged each site straight into the temp dir and never removed the
 * archive, so a CI runner's /tmp held every release of every site: HQ's runner
 * kept 138 of them, 3.7 GB, until a later job ran out of disk installing a
 * browser. They now live in a directory of the deploy's own, removed once the
 * release has shipped and again on exit, for a deploy refused before it ships.
 */
import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const source = readFileSync(
  join(new URL('../', import.meta.url).pathname, 'src/commands/deploy.ts'),
  'utf-8',
)

describe('release archives', () => {
  it('are packaged in a directory of the deploy\'s own', () => {
    expect(source).toContain('const releaseDir = mkdtempSync(join(tmpdir(), `${slug}-release-`))')
    expect(source).toContain('const tarballPath = join(releaseDir, `${slug}-${siteName}-${sha}.tar.gz`)')
    expect(source).not.toContain('join(tmpdir(), `${slug}-${siteName}-${sha}.tar.gz`)')
  })

  it('are removed after shipping, and on exit', () => {
    expect(source).toContain('process.once(\'exit\', removeReleaseDir)')
    const shipped = source.indexOf('const ok = await deployAllComputeSites(')
    const removed = source.indexOf('removeReleaseDir()', shipped)
    expect(shipped).toBeGreaterThan(-1)
    expect(removed).toBeGreaterThan(shipped)
    expect(removed).toBeLessThan(source.indexOf('const dnsAllowed', shipped))
  })
})
