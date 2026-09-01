/**
 * Internal documentation link checker (stacksjs/stacks#2056).
 *
 * Docs links to other docs pages drift silently when a page is renamed or moved.
 * This walks `docs/**` and verifies every internal markdown link resolves to a
 * real target (handling VitePress clean-URL and `index.md` conventions), so CI
 * can reject a broken cross-reference. External links, mail/tel, and same-page
 * anchors are intentionally left alone.
 *
 * With one exception, which is not really an exception: a link to THIS repo's
 * own GitHub blob/tree URL is an internal link wearing an external costume. It
 * resolves against the working tree with no network call, and it goes stale in
 * exactly the way this checker exists to catch — when a file moves.
 *
 * That is not hypothetical. `docs/bootcamp/desktop.md` linked to
 * `github.com/stacksjs/stacks/blob/main/protocol/evidence/desktop-support.json`
 * as the evidence behind its support-status claims, long after the protocol
 * evidence moved to the stacksjs/protocol repository. Both links 404'd, and a
 * dead evidence link under a claim about what is supported is worse than no
 * link at all.
 *
 * Usage: `bun storage/framework/core/buddy/src/commands/docs/links.ts [--check]`
 */

import { assertFrameworkRepo } from './framework-repo'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

const root = resolve(import.meta.dir, '../../../../../../..')
const docsDir = resolve(root, 'docs')

export interface BrokenDocLink {
  file: string
  line: number
  target: string
}

const INLINE_LINK = /\[[^\]]*\]\(([^)]+)\)/g

/**
 * A path inside this repository, for a GitHub URL that points back at it.
 *
 * Returns null for any other URL — a link to another repository or another
 * site is genuinely external and stays out of scope.
 */
export function selfRepoPath(target: string): string | null {
  const match = target.match(/^https:\/\/github\.com\/stacksjs\/stacks\/(?:blob|tree|raw)\/[^/]+\/(.+)$/i)
  if (!match)
    return null

  // Drop a line anchor (`#L12`) or query, neither of which is part of the path.
  return match[1]!.split('#')[0]!.split('?')[0]!
}

/**
 * Paths git tracks, memoised.
 *
 * Tracked rather than merely present on disk, because the URL is a link to
 * GitHub: a file only someone's working tree has does not exist at that URL for
 * anyone else. Checking `existsSync` instead makes the result depend on whose
 * machine runs it — which this check got wrong on its first CI run. A docs page
 * linked to a `.DS_Store` inside a skill directory; macOS creates that file, so
 * it resolved locally and 404'd for every reader, and CI was the first thing to
 * say so.
 *
 * Falls back to the filesystem when git is unavailable (a tarball, a vendored
 * copy), where a working-tree check is the best answer available.
 */
let tracked: Set<string> | null = null
function trackedFiles(): Set<string> {
  if (tracked)
    return tracked

  try {
    const listing = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    tracked = new Set(listing.split('\0').filter(Boolean))
  }
  catch {
    // No git (a tarball, a vendored copy). A working-tree check is the best
    // answer available, and `isTrackedPath`'s prefix scan is skipped because
    // `has` already answers for a directory here.
    tracked = null
    return {
      has: (path: string) => existsSync(resolve(root, path)),
      [Symbol.iterator]: function* () {},
    } as unknown as Set<string>
  }

  return tracked
}

/**
 * Does this file exist, matching case at EVERY segment?
 *
 * `existsSync` answers from the filesystem, and macOS's is case-insensitive by
 * default — so a docs link to `/Basics/components` resolves against
 * `docs/basics/components.md` on the author's machine and 404s on the deployed
 * site, whose filesystem is not.
 *
 * Every segment, not just the filename: checking only the last one still lets
 * `/Basics/components` through, because `readdirSync('docs/Basics')` happily
 * lists `docs/basics` on a case-insensitive volume. Walking from the root is
 * the only version that actually answers the question. (Measured — the
 * last-segment-only version passed this exact case.)
 */
const listings = new Map<string, Set<string>>()
function entriesOf(dir: string): Set<string> {
  let entries = listings.get(dir)
  if (!entries) {
    entries = existsSync(dir) ? new Set(readdirSync(dir)) : new Set()
    listings.set(dir, entries)
  }
  return entries
}

export function isFileCaseExact(path: string, from: string = root): boolean {
  const relativePath = relative(from, path)

  // Outside the tree we walk (shouldn't happen for docs links) — fall back.
  if (relativePath.startsWith('..'))
    return existsSync(path) && statSync(path).isFile()

  let dir = from
  for (const segment of relativePath.split(sep)) {
    if (!entriesOf(dir).has(segment))
      return false
    dir = join(dir, segment)
  }

  return statSync(path).isFile()
}

/**
 * Is this path tracked, as a file or as a directory?
 *
 * `git ls-files` lists files, so a `/tree/` link to a directory needs the
 * prefix test — those links are legitimate and several docs pages use them to
 * point at a whole skills folder.
 */
export function isTrackedPath(path: string, files: Set<string> = trackedFiles()): boolean {
  if (files.has(path))
    return true

  const asDirectory = `${path.replace(/\/+$/, '')}/`
  for (const tracked of files) {
    if (tracked.startsWith(asDirectory))
      return true
  }

  return false
}

/** True for links this checker deliberately does not resolve on disk. */
export function isSkippableLink(target: string): boolean {
  return (
    target === ''
    || target.startsWith('#') // same-page anchor
    || /^[a-z][\w+.-]*:/i.test(target) // http:, https:, mailto:, tel:, data:, etc.
    || target.startsWith('//') // protocol-relative
    || target.startsWith('{{') // template interpolation
    || target.includes('<') // contains markup/placeholder
  )
}

/** Extract inline-link targets with 1-based line numbers, skipping code. */
export function extractLinks(content: string): Array<{ target: string, line: number }> {
  const out: Array<{ target: string, line: number }> = []
  // Blank out HTML comments (a commented-out `![](img)` is not a live link)
  // while preserving newlines so reported line numbers stay accurate.
  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\n]/g, ' '))
  const lines = withoutComments.split('\n')
  let inFence = false

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]!
    if (/^\s*(```|~~~)/.test(raw)) {
      inFence = !inFence
      continue
    }
    if (inFence)
      continue

    // Drop inline code spans so `[x](y)` inside backticks isn't treated as a link.
    const line = raw.replace(/`[^`]*`/g, '')
    for (const match of line.matchAll(INLINE_LINK)) {
      let target = match[1]!.trim()
      // Strip an optional link title: [text](/path "Title").
      const space = target.search(/\s/)
      if (space !== -1)
        target = target.slice(0, space)
      out.push({ target, line: index + 1 })
    }
  }

  return out
}

/**
 * On-disk paths a link could legitimately resolve to. Absolute (`/x`) links are
 * rooted at `docsRoot`; relative links at the file's directory. Extensionless
 * links also try `.md` and `index.md` (VitePress clean URLs), and `.html` links
 * try their `.md` source.
 */
export function resolveCandidates(target: string, fileDir: string, docsRoot: string): string[] {
  const clean = target.split('#')[0]!.split('?')[0]!
  if (!clean)
    return []

  const base = clean.startsWith('/') ? join(docsRoot, clean.slice(1)) : resolve(fileDir, clean)
  const candidates = [base]

  if (!/\.\w+$/.test(clean))
    candidates.push(`${base}.md`, join(base, 'index.md'))
  else if (clean.endsWith('.html'))
    candidates.push(base.replace(/\.html$/, '.md'), join(base.replace(/\.html$/, ''), 'index.md'))

  return candidates
}

function walkMarkdown(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.'))
        continue
      files.push(...walkMarkdown(full))
    }
    else if (entry.name.endsWith('.md')) {
      files.push(full)
    }
  }
  return files
}

export function checkDocsLinks(docsRoot = docsDir): BrokenDocLink[] {
  const broken: BrokenDocLink[] = []

  for (const file of walkMarkdown(docsRoot)) {
    const content = readFileSync(file, 'utf8')
    for (const { target, line } of extractLinks(content)) {
      // A GitHub URL pointing back at this repo is checked against what git
      // TRACKS, before the external-link skip below sends it on its way.
      const selfPath = selfRepoPath(target)
      if (selfPath !== null) {
        if (!isTrackedPath(selfPath))
          broken.push({ file: relative(docsRoot, file), line, target })
        continue
      }

      if (isSkippableLink(target))
        continue
      const candidates = resolveCandidates(target, dirname(file), docsRoot)
      if (candidates.length === 0)
        continue
      const resolvedOk = candidates.some(candidate => isFileCaseExact(candidate))
      if (!resolvedOk)
        broken.push({ file: relative(docsRoot, file), line, target })
    }
  }

  return broken
}

export async function run(): Promise<void> {
  // This tool writes into the framework repository. See framework-repo.ts:
  // run from an application it would edit another project's files.
  assertFrameworkRepo(root, 'docs:links')

  const broken = checkDocsLinks()
  if (broken.length === 0) {
    console.log('✓ All internal documentation links resolve.')
  }
  else {
    console.error(`✗ ${broken.length} broken internal documentation link(s):`)
    for (const link of broken)
      console.error(`  ${link.file}:${link.line} -> ${link.target}`)
    if (process.argv.includes('--check'))
      process.exit(1)
  }
}

if (import.meta.main)
  await run()
