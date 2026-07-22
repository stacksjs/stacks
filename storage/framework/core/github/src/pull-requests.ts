import type { GitHubClientOptions } from './client'
import { githubJson } from './client'

export interface RepositoryFileChange {
  path: string
  content: string
}

export interface CreatePullRequestWithFilesOptions extends GitHubClientOptions {
  owner: string
  repo: string
  branch: string
  title: string
  body: string
  commitMessage: string
  files: RepositoryFileChange[]
  base?: string
  draft?: boolean
}

export interface CreatedPullRequest {
  number: number
  url: string
  branch: string
  base: string
  commitSha: string
}

export interface RepositoryTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha: string
  size?: number
}

export interface RepositoryTree {
  sha: string
  truncated: boolean
  entries: RepositoryTreeEntry[]
}

function repoPath(owner: string, repo: string): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(repo))
    throw new Error('GitHub owner and repository names contain invalid characters')
  return `/repos/${owner}/${repo}`
}

function validateBranch(branch: string): void {
  if (!branch || branch.length > 240 || branch.startsWith('/') || branch.endsWith('/') || branch.includes('..') || /[~^:?*[\\\s]/.test(branch))
    throw new Error(`Invalid Git branch name: ${branch}`)
}

function validateFiles(files: RepositoryFileChange[]): void {
  if (!files.length)
    throw new Error('At least one file change is required')
  if (files.length > 100)
    throw new Error('A pull request may change at most 100 files')
  const seen = new Set<string>()
  let bytes = 0
  for (const file of files) {
    if (!file.path || file.path.startsWith('/') || file.path.includes('\\') || file.path.split('/').includes('..'))
      throw new Error(`Unsafe repository path: ${file.path}`)
    if (seen.has(file.path))
      throw new Error(`Duplicate repository path: ${file.path}`)
    seen.add(file.path)
    bytes += Buffer.byteLength(file.content)
  }
  if (bytes > 5 * 1024 * 1024)
    throw new Error('Combined file content exceeds the 5 MiB safety limit')
}

export async function fetchRepositoryTree(
  owner: string,
  repo: string,
  ref: string,
  options: GitHubClientOptions = {},
): Promise<RepositoryTree> {
  const payload = await githubJson<{ sha: string, truncated?: boolean, tree?: RepositoryTreeEntry[] }>(
    `${repoPath(owner, repo)}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    {},
    options,
  )
  return { sha: payload.sha, truncated: !!payload.truncated, entries: payload.tree ?? [] }
}

export async function fetchRepositoryFile(
  owner: string,
  repo: string,
  path: string,
  ref: string,
  options: GitHubClientOptions & { maxBytes?: number } = {},
): Promise<string> {
  validateFiles([{ path, content: '' }])
  const payload = await githubJson<{ content?: string, encoding?: string, size?: number, type?: string }>(
    `${repoPath(owner, repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(ref)}`,
    {},
    options,
  )
  if (payload.type !== 'file' || payload.encoding !== 'base64' || typeof payload.content !== 'string')
    throw new Error(`GitHub path is not a base64 encoded file: ${path}`)
  const maxBytes = options.maxBytes ?? 256 * 1024
  if ((payload.size ?? 0) > maxBytes)
    throw new Error(`GitHub file exceeds the ${maxBytes} byte safety limit: ${path}`)
  const content = Buffer.from(payload.content.replace(/\n/g, ''), 'base64')
  if (content.byteLength > maxBytes)
    throw new Error(`Decoded GitHub file exceeds the ${maxBytes} byte safety limit: ${path}`)
  return content.toString('utf8')
}

/**
 * Create one commit containing all file replacements, expose it through a new
 * branch, and open a pull request. The branch is only created after every blob,
 * tree, and commit has succeeded, so partial generation never exposes half a fix.
 */
export async function createPullRequestWithFiles(options: CreatePullRequestWithFilesOptions): Promise<CreatedPullRequest> {
  validateBranch(options.branch)
  validateFiles(options.files)
  const basePath = repoPath(options.owner, options.repo)
  const client: GitHubClientOptions = { token: options.token, apiUrl: options.apiUrl, fetch: options.fetch }

  let base = options.base
  if (!base) {
    const repository = await githubJson<{ default_branch: string }>(basePath, {}, client)
    base = repository.default_branch
  }
  if (!base)
    throw new Error('GitHub repository has no default branch')

  const reference = await githubJson<{ object: { sha: string } }>(
    `${basePath}/git/ref/heads/${encodeURIComponent(base)}`,
    {},
    client,
  )
  const baseCommit = await githubJson<{ tree: { sha: string } }>(`${basePath}/git/commits/${reference.object.sha}`, {}, client)

  const blobs = await Promise.all(options.files.map(async (file) => {
    const blob = await githubJson<{ sha: string }>(`${basePath}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify({ content: file.content, encoding: 'utf-8' }),
    }, client)
    return { path: file.path, mode: '100644', type: 'blob', sha: blob.sha }
  }))

  const tree = await githubJson<{ sha: string }>(`${basePath}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
  }, client)
  const commit = await githubJson<{ sha: string }>(`${basePath}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message: options.commitMessage, tree: tree.sha, parents: [reference.object.sha] }),
  }, client)
  await githubJson(`${basePath}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${options.branch}`, sha: commit.sha }),
  }, client)
  const pull = await githubJson<{ number: number, html_url: string }>(`${basePath}/pulls`, {
    method: 'POST',
    body: JSON.stringify({
      title: options.title,
      body: options.body,
      head: options.branch,
      base,
      draft: options.draft ?? true,
    }),
  }, client)

  return { number: pull.number, url: pull.html_url, branch: options.branch, base, commitSha: commit.sha }
}
