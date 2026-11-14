import { expect, test } from 'bun:test'
import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { attachGitHubReleaseAssets } from '../src/github-release-assets'

// The real receipt file and Git origin are used; only GitHub's HTTP transport
// is substituted. No real release is created or modified by this test.
test('attaches immutable receipts to a standard GitHub release and resumes only identical assets', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'stacks-release-assets-'))
  try {
    Bun.spawnSync(['git', 'init', '--quiet'], { cwd })
    Bun.spawnSync(['git', 'remote', 'add', 'origin', 'https://github.com/fixture/libraries.git'], { cwd })
    const bytes = Buffer.from('{"schemaVersion":1,"verified":true}\n')
    await writeFile(join(cwd, 'registry-receipt.json'), bytes)
    const digest = `sha256:${createHash('sha256').update(bytes).digest('hex')}`
    let asset: Record<string, unknown> | undefined
    let uploads = 0
    const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'POST') {
        expect(url).toStartWith('https://uploads.github.com/repos/fixture/libraries/releases/55/assets?name=registry-receipt-')
        expect(Buffer.from(init.body as Buffer)).toEqual(bytes)
        uploads++
        asset = { name: new URL(url).searchParams.get('name'), digest, size: bytes.length, browser_download_url: 'https://github.com/fixture/libraries/releases/download/v1.0.0/receipt.json' }
        return Response.json(asset)
      }
      expect(url).toBe('https://api.github.com/repos/fixture/libraries/releases/tags/v1.0.0')
      return Response.json({ id: 55, assets: asset ? [asset] : [] })
    }) as typeof fetch
    const options = { cwd, tag: 'v1.0.0', files: ['registry-receipt.json'], token: 'fixture-write-token', fetch: fetcher }
    expect(await attachGitHubReleaseAssets(options)).toEqual(['https://github.com/fixture/libraries/releases/download/v1.0.0/receipt.json'])
    expect(await attachGitHubReleaseAssets(options)).toHaveLength(1)
    expect(uploads).toBe(1)
    asset!.digest = `sha256:${'a'.repeat(64)}`
    await expect(attachGitHubReleaseAssets(options)).rejects.toThrow('identity differs')
    expect(uploads).toBe(1)
  }
  finally { await rm(cwd, { recursive: true, force: true }) }
})
