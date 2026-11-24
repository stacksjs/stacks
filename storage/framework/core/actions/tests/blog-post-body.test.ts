/**
 * A blog post body is Markdown written by people the reader cannot vet, so
 * `renderBlog` must show HTML in it as text, drop unsafe links, and never
 * treat the body as a template or an include directive (../src/blog.ts).
 */
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

let root: string
let previousCwd: string
let renderBlog: (req: Request) => Promise<Response | null>

const POST = `---
title: Probe
date: 2026-11-24
published: true
---

Hello <script>alert(1)</script>

<img src=x onerror="alert(2)">

[x](javascript:alert(3))

Value: {{ 7*191 }}

<!--@include: ../../secret.txt-->

Inline \`<b>code</b>\` here.

\`\`\`html
<div>block</div>
\`\`\`
`

async function body(slug: string): Promise<string> {
  const res = await renderBlog(new Request(`http://localhost/blog/${slug}`))
  expect(res?.status).toBe(200)
  const html = await res!.text()
  // Only the post body: the page shell carries scripts of its own.
  return html.slice(html.indexOf('</h1>'), html.indexOf('blog-share'))
}

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), 'stacks-blog-'))
  mkdirSync(join(root, 'content/blog'), { recursive: true })
  writeFileSync(join(root, 'secret.txt'), 'secret-file-contents')
  writeFileSync(join(root, 'content/blog/probe.md'), POST)
  previousCwd = process.cwd()
  // blog.ts reads content/blog relative to the working directory at import,
  // so import a fresh copy here: another test file may have loaded it already.
  process.chdir(root)
  renderBlog = (await import(`../src/blog.ts?post-body=${Date.now()}`)).renderBlog
})

afterAll(() => {
  process.chdir(previousCwd)
  rmSync(root, { recursive: true, force: true })
})

describe('renderBlog post bodies', () => {
  it('shows a script tag as text', async () => {
    const html = await body('probe')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('shows an event handler attribute as text', async () => {
    const html = await body('probe')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('onerror=&quot;alert(2)&quot;')
  })

  it('drops a javascript: link', async () => {
    const html = await body('probe')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('<a>x</a>')
  })

  it('never evaluates templates or includes files', async () => {
    const html = await body('probe')
    expect(html).toContain('{{ 7*191 }}')
    expect(html).not.toContain('1337')
    expect(html).not.toContain('secret-file-contents')
  })

  it('keeps code showing < as text, highlighted', async () => {
    const html = await body('probe')
    expect(html).toContain('<code>&lt;b&gt;code&lt;/b&gt;</code>')
    expect(html).toContain('<pre data-lang="html"><code class="language-html">')
    expect(html).not.toContain('&amp;lt;')
    expect(html).not.toContain('<div>block')
  })
})
