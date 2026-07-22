import { describe, expect, it } from 'bun:test'
import { extractLinks, isSkippableLink, resolveCandidates } from './links'

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
