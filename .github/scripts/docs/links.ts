/**
 * Internal documentation link checker (stacksjs/stacks#2056).
 *
 * Docs links to other docs pages drift silently when a page is renamed or moved.
 * This walks `docs/**` and verifies every internal markdown link resolves to a
 * real target (handling VitePress clean-URL and `index.md` conventions), so CI
 * can reject a broken cross-reference. External links, mail/tel, and same-page
 * anchors are intentionally left alone.
 *
 * Usage: `bun .github/scripts/docs/links.ts [--check]`
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const root = resolve(import.meta.dir, '../../..')
const docsDir = resolve(root, 'docs')

export interface BrokenDocLink {
  file: string
  line: number
  target: string
}

const INLINE_LINK = /\[[^\]]*\]\(([^)]+)\)/g

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
      if (isSkippableLink(target))
        continue
      const candidates = resolveCandidates(target, dirname(file), docsRoot)
      if (candidates.length === 0)
        continue
      const resolvedOk = candidates.some(candidate => existsSync(candidate) && statSync(candidate).isFile())
      if (!resolvedOk)
        broken.push({ file: relative(docsRoot, file), line, target })
    }
  }

  return broken
}

if (import.meta.main) {
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
