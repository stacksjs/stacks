import { describe, expect, it } from 'bun:test'
import { join, resolve } from 'node:path'
import { extractLinks, isFileCaseExact, isSkippableLink, isTrackedPath, resolveCandidates, selfRepoPath } from './links'

describe('docs link checker (stacksjs/stacks#2056)', () => {
  describe('isSkippableLink', () => {
    it('skips external, mail/tel, anchors, protocol-relative, and templated links', () => {
      for (const target of ['https://x.com', 'http://x.com', 'mailto:a@b.c', 'tel:123', '#section', '//cdn.example.com/x', '{{ url }}', 'data:image/png;base64,AAAA', ''])
        expect(isSkippableLink(target)).toBe(true)
    })

    it('does not skip internal relative or absolute links', () => {
      for (const target of ['./foo.md', '../bar/baz.md', '/guide/intro', 'sibling.md'])
        expect(isSkippableLink(target)).toBe(false)
    })
  })

  describe('extractLinks', () => {
    it('extracts inline links with 1-based line numbers', () => {
      const md = 'intro\n\nsee [a](./a.md) and [b](../b.md)\n'
      expect(extractLinks(md)).toEqual([
        { target: './a.md', line: 3 },
        { target: '../b.md', line: 3 },
      ])
    })

    it('strips an optional link title', () => {
      expect(extractLinks('[x](/guide/x "The X page")')).toEqual([{ target: '/guide/x', line: 1 }])
    })

    it('ignores links inside fenced code blocks', () => {
      const md = '```md\n[x](./nope.md)\n```\n[y](./yes.md)\n'
      expect(extractLinks(md)).toEqual([{ target: './yes.md', line: 4 }])
    })

    it('ignores links inside inline code spans', () => {
      expect(extractLinks('use `[x](./nope.md)` but link [y](./yes.md)')).toEqual([{ target: './yes.md', line: 1 }])
    })

    it('ignores links inside HTML comments while preserving line numbers', () => {
      const md = 'line1\n<!-- ![x](./commented.png) -->\nreal [y](./y.md)\n'
      expect(extractLinks(md)).toEqual([{ target: './y.md', line: 3 }])
    })

    it('handles a multi-line HTML comment', () => {
      const md = '<!--\n[x](./a.md)\n-->\n[y](./b.md)\n'
      expect(extractLinks(md)).toEqual([{ target: './b.md', line: 4 }])
    })
  })

  describe('resolveCandidates', () => {
    const docsRoot = '/docs'
    const fileDir = '/docs/guide/components'

    it('resolves a relative link against the file directory', () => {
      expect(resolveCandidates('./tabs.md', fileDir, docsRoot)).toEqual(['/docs/guide/components/tabs.md'])
    })

    it('resolves an absolute link against the docs root', () => {
      expect(resolveCandidates('/guide/intro.md', fileDir, docsRoot)).toEqual(['/docs/guide/intro.md'])
    })

    it('offers .md and index.md candidates for an extensionless (clean-URL) link', () => {
      expect(resolveCandidates('../intro', fileDir, docsRoot)).toEqual([
        '/docs/guide/intro',
        '/docs/guide/intro.md',
        '/docs/guide/intro/index.md',
      ])
    })

    it('offers the .md source for an .html link', () => {
      const candidates = resolveCandidates('./api.html', fileDir, docsRoot)
      expect(candidates).toContain('/docs/guide/components/api.md')
    })

    it('strips the anchor before resolving', () => {
      expect(resolveCandidates('./tabs.md#usage', fileDir, docsRoot)).toEqual(['/docs/guide/components/tabs.md'])
    })

    it('returns no candidates for a pure anchor', () => {
      expect(resolveCandidates('#usage', fileDir, docsRoot)).toEqual([])
    })
  })
})

/**
 * A GitHub URL pointing back at this repository is an internal link wearing an
 * external costume: it resolves against the working tree with no network call,
 * and it goes stale exactly when a file moves.
 *
 * `docs/bootcamp/desktop.md` linked to
 * `github.com/stacksjs/stacks/blob/main/protocol/evidence/desktop-support.json`
 * as the evidence behind its support-status claims, long after that evidence
 * moved to the stacksjs/protocol repository. Both links 404'd — and a dead
 * evidence link under a claim about what is supported is worse than no link.
 */
describe('selfRepoPath', () => {
  it('extracts the path from a blob URL for this repo', () => {
    expect(selfRepoPath('https://github.com/stacksjs/stacks/blob/main/docs/index.md')).toBe('docs/index.md')
  })

  it('handles tree and raw URLs, and any ref', () => {
    expect(selfRepoPath('https://github.com/stacksjs/stacks/tree/main/storage')).toBe('storage')
    expect(selfRepoPath('https://github.com/stacksjs/stacks/raw/v0.74.1/README.md')).toBe('README.md')
  })

  it('drops a line anchor or query, which are not part of the path', () => {
    expect(selfRepoPath('https://github.com/stacksjs/stacks/blob/main/config/app.ts#L12')).toBe('config/app.ts')
    expect(selfRepoPath('https://github.com/stacksjs/stacks/blob/main/config/app.ts?plain=1')).toBe('config/app.ts')
  })

  it('leaves another repository alone, which is genuinely external', () => {
    // The fix for the stale links pointed HERE, and it must stay out of scope.
    expect(selfRepoPath('https://github.com/stacksjs/protocol/blob/main/evidence/craft.json')).toBeNull()
    expect(selfRepoPath('https://github.com/stacksjs/stx/blob/main/README.md')).toBeNull()
  })

  it('leaves non-GitHub and non-blob URLs alone', () => {
    expect(selfRepoPath('https://stacksjs.com/docs')).toBeNull()
    expect(selfRepoPath('https://github.com/stacksjs/stacks/issues/2059')).toBeNull()
    expect(selfRepoPath('/guide/intro')).toBeNull()
  })
})

/**
 * Self-repo links resolve against what git TRACKS, not against the working
 * tree, because the URL is a link to GitHub: a file only one machine has does
 * not exist at that URL for anyone else.
 *
 * This check's own first CI run proved the point. `docs/skills/design/
 * technical-diagrams.md` linked to a `.DS_Store` inside a skill directory —
 * macOS creates that file, so it resolved on the author's machine and 404'd
 * for every reader, and CI was the first thing to say so.
 */
describe('isTrackedPath', () => {
  const tracked = new Set(['docs/index.md', 'storage/framework/core/buddy/src/cli.ts'])

  it('accepts a tracked file', () => {
    expect(isTrackedPath('docs/index.md', tracked)).toBe(true)
  })

  it('accepts a tracked directory, which /tree/ links point at', () => {
    expect(isTrackedPath('storage/framework/core', tracked)).toBe(true)
    expect(isTrackedPath('storage/framework/core/', tracked)).toBe(true)
  })

  it('rejects a path git does not track, even if the machine has the file', () => {
    // The .DS_Store case: present locally, absent for every reader.
    expect(isTrackedPath('storage/framework/core/buddy/.DS_Store', tracked)).toBe(false)
  })

  it('does not treat a partial segment match as a directory', () => {
    // `docs/ind` is a prefix of `docs/index.md` as a STRING but not as a path.
    expect(isTrackedPath('docs/ind', tracked)).toBe(false)
  })
})

/**
 * Case matters, at every segment.
 *
 * macOS's filesystem is case-insensitive by default, so `existsSync` reports
 * that `docs/Basics/components.md` exists when only `docs/basics/…` does. The
 * link then 404s on the deployed site, whose filesystem is not — the author is
 * the one person who cannot see it.
 *
 * Checking only the FILENAME's case is not enough and was measured to be not
 * enough: `readdirSync('docs/Basics')` lists `docs/basics` on such a volume, so
 * a wrong-cased directory sails through. The walk has to start at the root.
 */
describe('isFileCaseExact', () => {
  const root = resolve(import.meta.dir, '../../../../../../..')

  it('accepts a real path with the right case', () => {
    expect(isFileCaseExact(join(root, 'docs/index.md'), root)).toBe(true)
  })

  it('rejects a wrong-cased filename', () => {
    expect(isFileCaseExact(join(root, 'docs/Index.md'), root)).toBe(false)
  })

  it('rejects a wrong-cased directory, which the filename-only check allowed', () => {
    expect(isFileCaseExact(join(root, 'Docs/index.md'), root)).toBe(false)
  })

  it('rejects a path that does not exist at all', () => {
    expect(isFileCaseExact(join(root, 'docs/definitely-not-here.md'), root)).toBe(false)
  })
})
