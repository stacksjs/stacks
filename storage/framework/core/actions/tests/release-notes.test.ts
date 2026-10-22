import type { CommitInfo } from '@stacksjs/logsmith'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  appStoreLocales,
  commitsBetween,
  committedWhatToTest,
  fitNotes,
  NO_VISIBLE_CHANGES,
  PLAY_NOTES_LIMIT,
  previousMobileTag,
  resolveNotes,
  TESTFLIGHT_NOTES_LIMIT,
  testerNotes,
  writeWhatToTest,
  XCODE_CLOUD_NOTES_LIMIT,
} from '../src/release-notes'

let sequence = 0
function commit(message: string, body = ''): CommitInfo {
  const match = /^(\w+)(?:\(([^)]+)\))?: (.+)$/.exec(message)
  return {
    hash: `abc${String(sequence++).padStart(4, '0')}`,
    message,
    author: { name: 'Chris Breuer', email: 'chris@stacksjs.com' },
    date: '2026-10-21T00:00:00Z',
    type: match?.[1] ?? 'misc',
    scope: match?.[2],
    description: match?.[3] ?? message,
    body,
    breaking: message.includes('!:'),
    references: [],
  }
}

describe('testerNotes', () => {
  it('groups features, fixes and performance the way the changelog orders them', () => {
    const notes = testerNotes([
      commit('fix(mobile): the month keeps its grid when a day is tapped'),
      commit('perf: warm the public pages first after a deploy'),
      commit('feat(check-ins): a coach\'s check-in is its own thing'),
      commit('feat(hq-coach): a month at once'),
    ])
    expect(notes).toBe([
      'Features',
      '- A coach\'s check-in is its own thing (check-ins)',
      '- A month at once (hq-coach)',
      '',
      'Fixes',
      '- The month keeps its grid when a day is tapped (mobile)',
      '',
      'Performance',
      '- Warm the public pages first after a deploy',
    ].join('\n'))
  })

  it('leaves out release commits, CI, tests, docs, chores and non-conventional subjects', () => {
    const notes = testerNotes([
      commit('chore(release): v1.0.0-build.92'),
      commit('ci: cache the pantry'),
      commit('test(coach): count days in the athlete\'s zone'),
      commit('docs(phone): the Calendar\'s day, week and month'),
      commit('chore(mobile): Craft 0.0.276'),
      commit('Merge branch \'main\' of github.com:stacksjs/hq'),
      commit('fix(ci): bind the e2e server once'),
      commit('feat(deps): bump everything'),
    ])
    expect(notes).toBe('')
  })

  it('keeps breaking changes in their section, without hashes, authors or issue numbers', () => {
    const notes = testerNotes([commit('feat(auth)!: sign in with a passkey (#412)'), commit('fix: crash on launch (#7, #8)')])
    expect(notes).toContain('- Sign in with a passkey (auth)')
    expect(notes).toContain('- Crash on launch')
    expect(notes).not.toMatch(/abc\d|Chris|#\d/)
  })

  it('lists one subject once, and honours the configured types and scopes', () => {
    const commits = [commit('fix(mobile): tidy the bar'), commit('fix(mobile): tidy the bar'), commit('refactor(mobile): one chrome'), commit('feat(web): a page')]
    expect(testerNotes(commits).match(/Tidy the bar/g)).toHaveLength(1)
    const custom = testerNotes(commits, { types: ['refactor', 'feat'], excludeScopes: ['web'] })
    expect(custom).toBe('Changes\n- One chrome (mobile)')
  })

  it('writes markdown headings for a GitHub release', () => {
    expect(testerNotes([commit('feat: a page')], { markdown: true })).toBe('**Features**\n\n- A page')
  })
})

describe('fitNotes', () => {
  const many = (count: number) => testerNotes(Array.from({ length: count }, (_, index) => commit(`feat(area): change number ${index + 1} that a tester can see`)))

  it('leaves notes under the limit alone', () => {
    expect(fitNotes('Features\n- A page', 100)).toBe('Features\n- A page')
  })

  it('cuts on whole items and says how many were left out', () => {
    const notes = many(200)
    const fitted = fitNotes(notes, TESTFLIGHT_NOTES_LIMIT)
    expect(fitted.length).toBeLessThanOrEqual(TESTFLIGHT_NOTES_LIMIT)
    const kept = fitted.split('\n').filter(text => text.startsWith('- ')).length
    expect(fitted).toEndWith(`\n…and ${200 - kept} more`)
    expect(fitted.split('\n').slice(0, -1).every(text => text === 'Features' || /^- Change number \d+ that a tester can see \(area\)$/.test(text))).toBe(true)
  })

  it('fits Play\'s 500 characters and the Xcode Cloud file', () => {
    expect(fitNotes(many(40), PLAY_NOTES_LIMIT).length).toBeLessThanOrEqual(PLAY_NOTES_LIMIT)
    expect(fitNotes(many(40), XCODE_CLOUD_NOTES_LIMIT).length).toBeLessThanOrEqual(XCODE_CLOUD_NOTES_LIMIT)
  })

  it('drops a heading whose items did not fit', () => {
    const notes = 'Features\n- A\n\nFixes\n- A long fix that does not fit in the room left at all'
    const fitted = fitNotes(notes, 40)
    expect(fitted).toBe('Features\n- A\n…and 1 more')
  })

  it('cuts prose at a word', () => {
    const fitted = fitNotes('Please test the new calendar and the coach assistant on a slow network today', 40)
    expect(fitted.length).toBeLessThanOrEqual(40)
    expect(fitted).toEndWith('…')
    expect(fitted).not.toMatch(/\s…$/)
  })
})

describe('resolveNotes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stacks-notes-'))
  const flagFile = join(dir, 'flag.txt')
  const envFile = join(dir, 'env.txt')
  writeFileSync(flagFile, 'From the flag file\n')
  writeFileSync(envFile, 'From the env file\n')
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const generate = () => 'Generated'

  it('lets the flags win, then the environment, then config, then the commits', () => {
    const config = { notes: 'From config' }
    const env = { RELEASE_NOTES: 'From env' }
    expect(resolveNotes({ cwd: dir, flags: { notes: 'From the flag' }, env, config, generate })).toEqual({ text: 'From the flag', source: 'flag' })
    expect(resolveNotes({ cwd: dir, flags: { notesFile: 'flag.txt' }, env, config, generate })).toEqual({ text: 'From the flag file', source: 'flag' })
    expect(resolveNotes({ cwd: dir, env, config, generate })).toEqual({ text: 'From env', source: 'env' })
    expect(resolveNotes({ cwd: dir, env: { RELEASE_NOTES_FILE: envFile }, config, generate })).toEqual({ text: 'From the env file', source: 'env' })
    expect(resolveNotes({ cwd: dir, env: {}, config, generate })).toEqual({ text: 'From config', source: 'config' })
    expect(resolveNotes({ cwd: dir, env: {}, config: { notesFile: 'flag.txt' }, generate })).toEqual({ text: 'From the flag file', source: 'config' })
    expect(resolveNotes({ cwd: dir, env: {}, generate })).toEqual({ text: 'Generated', source: 'generated' })
  })

  it('does not generate when overridden, and says so when nothing is visible', () => {
    let asked = false
    resolveNotes({ cwd: dir, flags: { notes: 'Mine' }, env: {}, generate: () => { asked = true; return '' } })
    expect(asked).toBe(false)
    expect(resolveNotes({ cwd: dir, env: {}, generate: () => '' }).text).toBe(NO_VISIBLE_CHANGES)
  })

  it('treats blank overrides as absent and refuses two at one level or a missing file', () => {
    expect(resolveNotes({ cwd: dir, flags: { notes: '  ' }, env: { RELEASE_NOTES: '' }, generate }).source).toBe('generated')
    expect(() => resolveNotes({ cwd: dir, flags: { notes: 'a', notesFile: 'flag.txt' }, env: {}, generate })).toThrow('either')
    expect(() => resolveNotes({ cwd: dir, flags: { notesFile: 'missing.txt' }, env: {}, generate })).toThrow('does not exist')
  })
})

describe('appStoreLocales', () => {
  it('maps the app\'s languages to App Store locales, en-US first', () => {
    expect(appStoreLocales(undefined)).toEqual(['en-US'])
    expect(appStoreLocales(['en', 'de'])).toEqual(['en-US', 'de-DE'])
    expect(appStoreLocales(['de', 'fr-CA', 'ja'])).toEqual(['en-US', 'de-DE', 'fr-CA', 'ja'])
  })
})

describe('mobile release history', () => {
  let repo: string
  const run = (...args: string[]) => {
    const result = Bun.spawnSync(['git', ...args], { cwd: repo, stdout: 'pipe', stderr: 'pipe', env: { ...process.env, GIT_AUTHOR_NAME: 'T', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 'T', GIT_COMMITTER_EMAIL: 't@example.com' } })
    if (result.exitCode !== 0)
      throw new Error(result.stderr.toString())
    return result.stdout.toString().trim()
  }
  const change = (message: string) => {
    writeFileSync(join(repo, 'file.txt'), `${message}\n`)
    run('add', 'file.txt')
    run('commit', '-q', '-m', message)
  }

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), 'stacks-mobile-release-'))
    run('init', '-q', '-b', 'main')
    change('feat: the first screen')
    run('tag', 'v1.0.0-build.1')
    change('fix(mobile): the tab bar stays put')
    run('tag', 'android-v1.0.0-build.1-extra')
    run('tag', 'v2.0.0')
    change('feat(coach): weekly check-ins')
    change('chore(release): v1.0.0-build.2')
  })
  afterAll(() => rmSync(repo, { recursive: true, force: true }))

  it('runs from the previous build tag, past other tags, up to the release', () => {
    const from = previousMobileTag(repo, 'HEAD')
    expect(from).toBe('v1.0.0-build.1')
    expect(testerNotes(commitsBetween(repo, from, 'HEAD'))).toBe('Features\n- Weekly check-ins (coach)\n\nFixes\n- The tab bar stays put (mobile)')
    expect(previousMobileTag(repo, 'v1.0.0-build.1^')).toBeUndefined()
  })

  it('writes What to Test for each locale beside the Xcode project, and reads it back from the tag', () => {
    const notes = testerNotes(commitsBetween(repo, 'v1.0.0-build.1', 'HEAD'))
    const written = writeWhatToTest(repo, 'storage/framework/mobile/ios', notes, ['en-US', 'de-DE'])
    expect(written).toEqual([
      'storage/framework/mobile/ios/TestFlight/WhatToTest.en-US.txt',
      'storage/framework/mobile/ios/TestFlight/WhatToTest.de-DE.txt',
    ])
    expect(readFileSync(join(repo, written[1]!), 'utf8')).toBe(`${notes}\n`)
    run('add', '.')
    run('commit', '-q', '--amend', '--no-edit')
    run('tag', 'v1.0.0-build.2')
    expect(committedWhatToTest(repo, 'v1.0.0-build.2', 'storage/framework/mobile/ios')).toBe(notes)
    expect(committedWhatToTest(repo, 'v1.0.0-build.1', 'storage/framework/mobile/ios')).toBeNull()
  })

  it('cuts the file to what Xcode Cloud reliably shows', () => {
    const long = Array.from({ length: 200 }, (_, index) => `- Item number ${index}`).join('\n')
    const [path] = writeWhatToTest(repo, 'ios', `Features\n${long}`, ['en-US'])
    const text = readFileSync(join(repo, path!), 'utf8')
    expect(text.length).toBeLessThanOrEqual(XCODE_CLOUD_NOTES_LIMIT + 1)
    expect(text).toMatch(/…and \d+ more\n$/)
  })
})
