/**
 * The notes a mobile release hands its testers: TestFlight's "What to Test",
 * the GitHub release, and Google Play's "What's new".
 *
 * They are written from the conventional commits since the previous mobile
 * release tag (`v*-build.*` reachable from the release), parsed and grouped by
 * logsmith, the generator bumpx and `buddy changelog` use, so a commit lands
 * in the same section here as in CHANGELOG.md. What a tester reads differs
 * from a changelog: plain lines, no hashes, no authors, the scope as context,
 * and only the kinds of change a tester can see (features, fixes, speed,
 * reverts). Release commits, CI, tests, docs and chores stay out.
 *
 * A person can say it better: `--notes` / `--notes-file` win, then
 * RELEASE_NOTES / RELEASE_NOTES_FILE, then `release.notes` / `release.notesFile`
 * in config/mobile.ts, then the generated notes.
 */

import type { CommitInfo } from '@stacksjs/logsmith'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { defaultConfig, getCommits, groupCommits } from '@stacksjs/logsmith'

/** App Store Connect's limit on a build's "What to Test". */
export const TESTFLIGHT_NOTES_LIMIT = 4000

/**
 * The cap for `TestFlight/WhatToTest.<locale>.txt`. Apple documents 4000
 * characters for the field, but Xcode Cloud has been seen to log "Found notes"
 * and then show nothing for a file over about 2 KB (developer forums, thread
 * 810627), so the file stays well under that. The App Store Connect API path
 * (`--wait`, `buddy release:notes --testflight`) sets the full 4000.
 */
export const XCODE_CLOUD_NOTES_LIMIT = 1000

/** Google Play's limit on a release's "What's new", per language. */
export const PLAY_NOTES_LIMIT = 500

/** The commit types a tester notices, in the order bumpx's changelog lists them. */
export const DEFAULT_NOTE_TYPES = ['feat', 'fix', 'perf', 'revert']

/** Scopes that never describe something a tester sees. */
export const DEFAULT_EXCLUDED_SCOPES = ['release', 'ci', 'deps', 'deps-dev', 'test', 'tests', 'docs', 'lint']

const SECTION_TITLES: Record<string, string> = {
  feat: 'Features',
  fix: 'Fixes',
  perf: 'Performance',
  refactor: 'Changes',
  revert: 'Reverted',
  style: 'Styles',
  build: 'Build',
  docs: 'Documentation',
}

/** What `config/mobile.ts` may say about release notes (`MobileConfig.release`). */
export interface ReleaseNotesConfig {
  notes?: string
  notesFile?: string
  noteTypes?: string[]
  excludeScopes?: string[]
  locales?: string[]
}

export interface TesterNotesOptions {
  /** Commit types that make the notes. Default {@link DEFAULT_NOTE_TYPES}. */
  types?: string[]
  /** Scopes left out. Default {@link DEFAULT_EXCLUDED_SCOPES}. */
  excludeScopes?: string[]
  /** Bold section titles and spacing for Markdown (a GitHub release) instead of plain lines. */
  markdown?: boolean
}

const BANG = /^(\w+)(?:\(([^)]+)\))?!: (.+)$/

/** logsmith's parse reads `feat!: x` as no type at all; this one keeps the type. */
function normalized(commit: CommitInfo): CommitInfo {
  const bang = commit.type === 'misc' ? BANG.exec(commit.message) : null
  return bang ? { ...commit, type: bang[1]!, scope: bang[2] || undefined, description: bang[3]!, breaking: true } : commit
}

/** One line for a tester: the description as a sentence, the scope after it. */
function line(description: string, scope: string | undefined): string {
  const text = description.replace(/\s*\((?:#\d+(?:,\s*)?)+\)\s*$/, '').replace(/\s+/g, ' ').trim()
  const sentence = text.charAt(0).toUpperCase() + text.slice(1)
  const context = scope?.split(',').map(part => part.trim()).filter(Boolean).join(', ')
  return context ? `${sentence} (${context})` : sentence
}

/**
 * The notes for these commits, grouped the way logsmith groups a changelog.
 * Empty when none of them is something a tester sees.
 */
export function testerNotes(commits: CommitInfo[], options: TesterNotesOptions = {}): string {
  const types = options.types?.length ? options.types : DEFAULT_NOTE_TYPES
  const sections = groupCommits(commits.map(normalized), {
    ...defaultConfig,
    verbose: false,
    includeCommitTypes: types,
    excludeCommitTypes: [],
    excludeScopes: options.excludeScopes ?? DEFAULT_EXCLUDED_SCOPES,
    includeScopes: [],
    excludeAuthors: [],
    includeAuthors: [],
    excludeMessages: [],
    groupBreakingChanges: false,
    maxCommitsPerSection: 0,
    minCommitsForSection: 1,
    maxDescriptionLength: 0,
  })

  const blocks: string[] = []
  for (const section of sections) {
    const type = section.commits[0]?.type ?? ''
    const seen = new Set<string>()
    const lines = section.commits
      .map(entry => line(entry.description, entry.scope))
      .filter(text => text && !seen.has(text.toLowerCase()) && seen.add(text.toLowerCase()))
      .map(text => `- ${text}`)
    if (!lines.length)
      continue
    const title = SECTION_TITLES[type] ?? type.charAt(0).toUpperCase() + type.slice(1)
    blocks.push([options.markdown ? `**${title}**` : title, ...(options.markdown ? [''] : []), ...lines].join('\n'))
  }
  return blocks.join('\n\n')
}

/** What testers read when nothing since the last build is theirs to see. */
export const NO_VISIBLE_CHANGES = 'Maintenance build: no visible changes since the previous build.'

/**
 * Notes cut to `limit` characters on whole lines, saying how many items were
 * left out ("…and 12 more"). A section heading whose items were all cut goes
 * too; a single line longer than the limit is cut at a word.
 */
export function fitNotes(text: string, limit: number): string {
  const notes = text.trim()
  if (notes.length <= limit)
    return notes
  const lines = notes.split('\n')
  const isItem = (value: string) => /^\s*(?:[-*•]|\d+\.)\s/.test(value)
  const suffix = (omitted: number) => omitted > 0 ? `\n…and ${omitted} more` : '…'

  const kept: string[] = []
  let index = 0
  for (; index < lines.length; index++) {
    const rest = lines.slice(index + 1).filter(isItem).length
    const candidate = [...kept, lines[index]!].join('\n')
    if (candidate.length + suffix(rest).length > limit)
      break
    kept.push(lines[index]!)
  }

  // Drop trailing blanks and a heading whose items did not fit.
  const trim = () => {
    while (kept.length && !kept[kept.length - 1]!.trim()) kept.pop()
  }
  trim()
  if (kept.length && !isItem(kept[kept.length - 1]!) && lines[kept.length] !== undefined && isItem(lines[kept.length]!) && kept.some(isItem)) {
    kept.pop()
    trim()
  }

  const omitted = lines.slice(kept.length).filter(isItem).length
  if (!kept.length || (omitted === 0 && !kept.some(isItem))) {
    // Prose (or one line too long): cut at a word.
    const room = limit - 1
    const cut = notes.slice(0, room)
    const word = cut.lastIndexOf(' ')
    return `${(word > room / 2 ? cut.slice(0, word) : cut).trimEnd()}…`
  }
  return `${kept.join('\n')}${suffix(omitted)}`
}

function git(cwd: string, args: string[]): string | null {
  const result = Bun.spawnSync(['git', ...args], { cwd, stdout: 'pipe', stderr: 'ignore' })
  return result.exitCode === 0 ? result.stdout.toString().trim() : null
}

/** The newest mobile release tag (`v*-build.*`) at or before `ref`. */
export function previousMobileTag(cwd: string, ref = 'HEAD'): string | undefined {
  return git(cwd, ['describe', '--tags', '--match', 'v*-build.*', '--abbrev=0', ref]) || undefined
}

/** The conventional commits in `from..to`, parsed by logsmith. */
export function commitsBetween(cwd: string, from: string | undefined, to = 'HEAD'): CommitInfo[] {
  return getCommits(from, to, cwd)
}

export type NotesSource = 'flag' | 'env' | 'config' | 'generated'

export interface ResolveNotesOptions {
  cwd: string
  /** `--notes` and `--notes-file`. */
  flags?: { notes?: string, notesFile?: string }
  env?: Record<string, string | undefined>
  /** `release` from config/mobile.ts. */
  config?: ReleaseNotesConfig
  /** The generated notes, asked for only when nothing overrides them. */
  generate: () => string
}

function readNotesFile(cwd: string, path: string, origin: string): string {
  const absolute = isAbsolute(path) ? path : join(cwd, path)
  if (!existsSync(absolute))
    throw new Error(`${origin} names ${path}, which does not exist`)
  return readFileSync(absolute, 'utf8')
}

/**
 * The notes for a release and where they came from: `--notes`/`--notes-file`,
 * then RELEASE_NOTES/RELEASE_NOTES_FILE, then config/mobile.ts, then generated.
 */
export function resolveNotes(options: ResolveNotesOptions): { text: string, source: NotesSource } {
  const { cwd, flags = {}, env = process.env, config = {} } = options
  const pick = (text: string | undefined, file: string | undefined, origin: [string, string], source: NotesSource) => {
    if (text?.trim() && file?.trim())
      throw new Error(`give either ${origin[0]} or ${origin[1]}, not both`)
    const value = text?.trim() ? text : file?.trim() ? readNotesFile(cwd, file.trim(), origin[1]) : undefined
    return value?.trim() ? { text: value.trim(), source } : null
  }
  const notes = typeof flags.notes === 'string' ? flags.notes : undefined
  const notesFile = typeof flags.notesFile === 'string' ? flags.notesFile : undefined
  return pick(notes, notesFile, ['--notes', '--notes-file'], 'flag')
    ?? pick(env.RELEASE_NOTES, env.RELEASE_NOTES_FILE, ['RELEASE_NOTES', 'RELEASE_NOTES_FILE'], 'env')
    ?? pick(config.notes, config.notesFile, ['release.notes', 'release.notesFile'], 'config')
    ?? { text: options.generate().trim() || NO_VISIBLE_CHANGES, source: 'generated' }
}

const APP_STORE_LOCALES: Record<string, string> = {
  en: 'en-US',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  nl: 'nl-NL',
  pt: 'pt-BR',
  zh: 'zh-Hans',
}

/**
 * App Store locales for the app's languages (`en` → `en-US`, `de` → `de-DE`),
 * always with `en-US` first, the locale an app without localizations uses.
 */
export function appStoreLocales(languages: string[] | undefined): string[] {
  const locales = (languages ?? [])
    .map(language => language.trim().replace('_', '-'))
    .filter(Boolean)
    .map(language => language.includes('-') ? language : (APP_STORE_LOCALES[language.toLowerCase()] ?? language.toLowerCase()))
  return [...new Set(['en-US', ...locales])]
}

/**
 * Write `TestFlight/WhatToTest.<locale>.txt` beside the Xcode project, where
 * Xcode Cloud reads it when it uploads the build to TestFlight. Returns the
 * files written, relative to `root`.
 */
export function writeWhatToTest(root: string, projectDir: string, notes: string, locales: string[]): string[] {
  const dir = join(isAbsolute(projectDir) ? projectDir : join(root, projectDir), 'TestFlight')
  mkdirSync(dir, { recursive: true })
  const text = `${fitNotes(notes, XCODE_CLOUD_NOTES_LIMIT)}\n`
  return locales.map((locale) => {
    const path = join(dir, `WhatToTest.${locale}.txt`)
    writeFileSync(path, text)
    return relative(root, path)
  })
}

/** The What to Test a tag shipped with, as committed beside its Xcode project. */
export function committedWhatToTest(cwd: string, tag: string, projectDir: string, locale = 'en-US'): string | null {
  const path = `${projectDir.replace(/\/$/, '')}/TestFlight/WhatToTest.${locale}.txt`
  return git(cwd, ['show', `${tag}:${path}`])
}
