import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { basename, resolve } from 'node:path'
import { githubHeaders } from '@stacksjs/github'
import { parseGitHubRemote, resolveGitHubToken } from './github-release'
import { boundedBody } from './library/archive'

/** Attach immutable receipt files to the standard release, never overwrite assets. */
export async function attachGitHubReleaseAssets(options: { cwd: string, tag: string, files: string[], token?: string, fetch?: typeof globalThis.fetch }): Promise<string[]> {
  if (!options.files.length || options.files.length > 20 || new Set(options.files).size !== options.files.length) throw new Error('Release assets require one to twenty unique files')
  // Read and validate the complete attachment set before the first provider write.
  const assets = await Promise.all(options.files.map(async (file) => {
    const path = resolve(options.cwd, file)
    const stat = await lstat(path)
    const name = basename(path)
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024 || !/^[\w.-]+\.json$/.test(name)) throw new Error('Release receipts must be bounded ordinary JSON files')
    const bytes = await readFile(path)
    JSON.parse(bytes.toString())
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    return { name: `${name.slice(0, -5)}-${sha256.slice(0, 16)}.json`, bytes, digest: `sha256:${sha256}` }
  }))
  const remote = Bun.spawnSync(['git', 'remote', 'get-url', 'origin'], { cwd: options.cwd, stdout: 'pipe', stderr: 'pipe' })
  const repository = parseGitHubRemote(remote.stdout.toString())
  if (!repository) throw new Error('Release receipts require a GitHub origin')
  const token = options.token ?? resolveGitHubToken()
  if (!token) throw new Error('Attaching release receipts requires a GitHub release token')
  const headers = githubHeaders(token)
  const request = async (url: string, init: RequestInit = {}) => {
    const response = await (options.fetch ?? fetch)(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(30_000), headers: { ...headers, ...init.headers } })
    if (!response.ok) { await response.body?.cancel(); throw new Error(`GitHub release receipt request failed: HTTP ${response.status}`) }
    return JSON.parse(new TextDecoder().decode(await boundedBody(response, 2 * 1024 * 1024))) as Record<string, unknown>
  }
  const base = `https://api.github.com/repos/${repository.owner}/${repository.repo}/releases`
  const release = await request(`${base}/tags/${encodeURIComponent(options.tag)}`)
  if (!Number.isSafeInteger(release.id) || (release.id as number) <= 0 || !Array.isArray(release.assets)) throw new Error('GitHub release has no valid asset inventory')
  const links: string[] = []
  for (const asset of assets) {
    const matching = (release.assets as Array<{ name?: string, size?: number, digest?: string, browser_download_url?: string }>).filter(existing => existing.name === asset.name)
    if (matching.length > 1) throw new Error('GitHub release has duplicate receipt assets')
    const uploaded = matching[0] ?? await request(`https://uploads.github.com/repos/${repository.owner}/${repository.repo}/releases/${release.id}/assets?name=${encodeURIComponent(asset.name)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: asset.bytes })
    if (uploaded.name !== asset.name || uploaded.size !== asset.bytes.length || uploaded.digest !== asset.digest || typeof uploaded.browser_download_url !== 'string') throw new Error('GitHub release receipt asset identity differs')
    links.push(uploaded.browser_download_url)
  }
  return links
}
