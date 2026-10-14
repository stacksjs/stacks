import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createGitHubRelease,
  describeGitHubRelease,
  fitReleaseBody,
  MAX_RELEASE_BODY,
  parseGitHubRemote,
  previousTag,
  publishGitHubRelease,
  resolveGitHubToken,
} from '../src/github-release'

describe('parseGitHubRemote', () => {
  it('reads https, ssh and scp-style GitHub remotes', () => {
    expect(parseGitHubRemote('https://github.com/stacksjs/hq.training.git')).toEqual({ owner: 'stacksjs', repo: 'hq.training' })
    expect(parseGitHubRemote('https://x-access-token:abc@github.com/stacksjs/stacks')).toEqual({ owner: 'stacksjs', repo: 'stacks' })
    expect(parseGitHubRemote('git@github.com:stacksjs/stacks.git')).toEqual({ owner: 'stacksjs', repo: 'stacks' })
    expect(parseGitHubRemote('ssh://git@github.com/stacksjs/stacks.git')).toEqual({ owner: 'stacksjs', repo: 'stacks' })
  })

  it('refuses other hosts and local paths', () => {
    expect(parseGitHubRemote('https://gitlab.com/stacksjs/stacks.git')).toBeNull()
    expect(parseGitHubRemote('/tmp/remote.git')).toBeNull()
    expect(parseGitHubRemote(undefined)).toBeNull()
  })
})

describe('resolveGitHubToken', () => {
  const nothing = () => ({ exitCode: 1, stdout: '' })

  it('prefers the environment, then the GitHub CLI, then the git credential', () => {
    expect(resolveGitHubToken({ GITHUB_TOKEN: 'env-token' }, nothing)).toBe('env-token')
    expect(resolveGitHubToken({ GH_TOKEN: 'gh-env' }, nothing)).toBe('gh-env')
    expect(resolveGitHubToken({}, cmd => cmd[0] === 'gh' ? { exitCode: 0, stdout: 'gho_cli\n' } : nothing())).toBe('gho_cli')
    const inputs: string[] = []
    const fromGit = resolveGitHubToken({}, (cmd, input) => {
      if (cmd[0] !== 'git')
        return { exitCode: 127, stdout: '' }
      inputs.push(input ?? '')
      return { exitCode: 0, stdout: 'protocol=https\nhost=github.com\nusername=chris\npassword=gho_git\n' }
    })
    expect(fromGit).toBe('gho_git')
    expect(inputs[0]).toContain('host=github.com')
  })

  it('returns null when none has a token', () => {
    expect(resolveGitHubToken({}, nothing)).toBeNull()
  })
})

describe('fitReleaseBody', () => {
  it('keeps a body that fits and cuts one that does not, at a line', () => {
    expect(fitReleaseBody('short')).toBe('short')
    const long = Array.from({ length: 20_000 }, (_, i) => `- change ${i}`).join('\n')
    const cut = fitReleaseBody(long, 'https://github.com/o/r/compare/a...b')
    expect(cut.length).toBeLessThanOrEqual(MAX_RELEASE_BODY)
    expect(cut).toContain('[every change](https://github.com/o/r/compare/a...b)')
    expect(cut.split('\n').filter(line => line.startsWith('- change')).every(line => /^- change \d+$/.test(line))).toBe(true)
  })
})

describe('createGitHubRelease', () => {
  const repository = { owner: 'stacksjs', repo: 'hq.training' }
  const draft = { tag: 'v1.0.0-build.39', name: '1.0.0 (build 39)', body: 'notes' }

  it('creates the release when the tag has none', async () => {
    const calls: { url: string, init?: RequestInit }[] = []
    const fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init })
      if (!init?.method)
        return new Response('{"message":"Not Found"}', { status: 404 })
      return Response.json({ html_url: 'https://github.com/stacksjs/hq.training/releases/tag/v1.0.0-build.39' }, { status: 201 })
    }) as typeof globalThis.fetch

    const result = await createGitHubRelease(repository, draft, { token: 't0k', fetch })
    expect(result).toEqual({ url: 'https://github.com/stacksjs/hq.training/releases/tag/v1.0.0-build.39', created: true })
    expect(calls[0]!.url).toBe('https://api.github.com/repos/stacksjs/hq.training/releases/tags/v1.0.0-build.39')
    expect(calls[1]!.url).toBe('https://api.github.com/repos/stacksjs/hq.training/releases')
    expect((calls[1]!.init!.headers as Record<string, string>).Authorization).toBe('Bearer t0k')
    expect(JSON.parse(calls[1]!.init!.body as string)).toEqual({ tag_name: draft.tag, name: draft.name, body: 'notes', draft: false, prerelease: false })
  })

  it('leaves an existing release alone', async () => {
    let posted = false
    const fetch = (async (_url: string, init?: RequestInit) => {
      posted ||= init?.method === 'POST'
      return Response.json({ html_url: 'https://github.com/o/r/releases/tag/v1' })
    }) as typeof globalThis.fetch
    expect(await createGitHubRelease(repository, draft, { token: 't', fetch })).toEqual({ url: 'https://github.com/o/r/releases/tag/v1', created: false })
    expect(posted).toBe(false)
  })

  it('throws GitHub\'s message on an API error', async () => {
    const fetch = (async (_url: string, init?: RequestInit) => init?.method
      ? Response.json({ message: 'Resource not accessible by integration' }, { status: 403 })
      : new Response('', { status: 404 })) as typeof globalThis.fetch
    await expect(createGitHubRelease(repository, draft, { token: 't', fetch })).rejects.toThrow('403 creating the release for v1.0.0-build.39: Resource not accessible by integration')
  })
})

describe('publishGitHubRelease', () => {
  let repo: string
  const git = (...args: string[]) => {
    const result = Bun.spawnSync(['git', '-c', 'user.name=Release Test', '-c', 'user.email=release@test.local', ...args], { cwd: repo, stderr: 'pipe' })
    if (result.exitCode !== 0)
      throw new Error(result.stderr.toString())
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'stacks-github-release-'))
    git('init', '-q', '-b', 'main')
    writeFileSync(join(repo, 'a.txt'), 'a')
    git('add', 'a.txt')
    git('commit', '-qm', 'feat: the first thing')
    git('tag', '-a', 'v1.0.0-build.1', '-m', 'v1.0.0-build.1')
    writeFileSync(join(repo, 'b.txt'), 'b')
    git('add', 'b.txt')
    git('commit', '-qm', 'fix(player): the timer stops at zero')
    git('tag', '-a', 'v1.0.0-build.2', '-m', 'v1.0.0-build.2')
    writeFileSync(join(repo, 'c.txt'), 'c')
    git('add', 'c.txt')
    git('commit', '-qm', 'feat(relax): a sleep timer')
  })
  afterAll(() => rmSync(repo, { recursive: true, force: true }))

  it('finds the tag before a tag', () => {
    expect(previousTag(repo, 'v1.0.0-build.2')).toBe('v1.0.0-build.1')
    expect(previousTag(repo, 'v1.0.0-build.1')).toBeUndefined()
  })

  it('skips a repository whose origin is not on GitHub', async () => {
    const result = await publishGitHubRelease({ cwd: repo, tag: 'v1.0.0-build.2' })
    expect(result.status).toBe('skipped')
    expect(describeGitHubRelease('v1.0.0-build.2', result)).toContain('origin is not a GitHub repository')
  })

  it('drafts notes from the previous tag, and creates nothing on a dry run', async () => {
    git('remote', 'add', 'origin', 'https://github.com/stacksjs/release-test.git')
    let fetched = false
    const fetch = (async () => {
      fetched = true
      return new Response('', { status: 500 })
    }) as unknown as typeof globalThis.fetch

    const result = await publishGitHubRelease({ cwd: repo, tag: 'v1.0.0-build.2', name: '1.0.0 (build 2)', summary: 'TestFlight build **2**', dryRun: true, fetch })
    expect(result.status).toBe('skipped')
    expect(fetched).toBe(false)
    expect(result.draft!.name).toBe('1.0.0 (build 2)')
    expect(result.draft!.body.startsWith('TestFlight build **2**\n\n')).toBe(true)
    expect(result.draft!.body).toContain('the timer stops at zero')
    expect(result.draft!.body).not.toContain('the first thing')
    expect(result.draft!.body).toContain('github.com/stacksjs/release-test/compare/v1.0.0-build.1...v1.0.0-build.2')
    expect(result.draft!.body).not.toContain('release@test.local')

    // A tag that is not cut yet: the notes run from the newest tag to HEAD.
    const upcoming = await publishGitHubRelease({ cwd: repo, tag: 'v1.0.0-build.3', ref: 'HEAD', dryRun: true })
    expect(upcoming.draft!.body).toContain('a sleep timer')
    expect(upcoming.draft!.body).not.toContain('the timer stops at zero')
  })

  it('creates the release with the token it finds, and reports a failure without throwing', async () => {
    const posted: Record<string, unknown>[] = []
    const fetch = (async (_url: string, init?: RequestInit) => {
      if (!init?.method)
        return new Response('', { status: 404 })
      posted.push(JSON.parse(init.body as string))
      return Response.json({ html_url: 'https://github.com/stacksjs/release-test/releases/tag/v1.0.0-build.2' }, { status: 201 })
    }) as typeof globalThis.fetch

    const created = await publishGitHubRelease({ cwd: repo, tag: 'v1.0.0-build.2', env: { GITHUB_TOKEN: 't' }, fetch })
    expect(created.status).toBe('created')
    expect(posted[0]!.tag_name).toBe('v1.0.0-build.2')

    const noToken = await publishGitHubRelease({ cwd: repo, tag: 'v1.0.0-build.2', env: {}, run: () => ({ exitCode: 1, stdout: '' }), fetch })
    expect(noToken.status).toBe('failed')
    expect(describeGitHubRelease('v1.0.0-build.2', noToken)).toContain('buddy release:github v1.0.0-build.2')

    const broken = (async () => {
      throw new Error('offline')
    }) as unknown as typeof globalThis.fetch
    const failed = await publishGitHubRelease({ cwd: repo, tag: 'v1.0.0-build.2', env: { GITHUB_TOKEN: 't' }, fetch: broken })
    expect(failed).toEqual({ status: 'failed', reason: 'offline' })
  })
})
