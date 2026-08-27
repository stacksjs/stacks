import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { resolveStxSource } from '../src/stx-source'

describe('resolveStxSource', () => {
  const missing = () => false
  const present = () => true

  it('uses the installed dependency when nothing is named', () => {
    expect(resolveStxSource({ value: undefined, exists: present })).toEqual({ kind: 'installed' })
  })

  it('treats an empty or whitespace value as unset', () => {
    // `BUN_PLUGIN_STX_SRC= buddy serve` is an operator clearing the variable,
    // not asking for a copy at the path ''.
    expect(resolveStxSource({ value: '', exists: present })).toEqual({ kind: 'installed' })
    expect(resolveStxSource({ value: '   ', exists: present })).toEqual({ kind: 'installed' })
  })

  it('uses a named copy that is present', () => {
    expect(resolveStxSource({ value: '/srv/stx/serve.js', exists: present }))
      .toEqual({ kind: 'override', path: '/srv/stx/serve.js' })
  })

  it('refuses a named copy that is absent rather than falling back silently', () => {
    // Falling back would answer a request for a specific build by serving a
    // different one, which is the confusion this whole module exists to end.
    expect(resolveStxSource({ value: '/gone/serve.js', exists: missing }))
      .toEqual({ kind: 'missing', path: '/gone/serve.js' })
  })
})

describe('the production server does not prefer untracked local copies (#2369)', () => {
  const source = readFileSync(
    join(import.meta.dir, '../src/production-server.ts'),
    'utf8',
  )
  // Comments explain the history and name both, so only look at real code.
  const code = source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter(line => !line.trim().startsWith('//'))
    .join('\n')

  it('never resolves stx out of the project pantry directory', () => {
    // An app on bun-plugin-stx 0.2.231 rendered every page through a
    // pantry copy of 0.2.76, which predates the page-response read-back, so
    // `notFound()` recorded a 404 that nothing read and deleted pages
    // answered 200. The declared dependency has to win.
    expect(code).not.toContain('pantry/')
  })

  it('never resolves stx out of a hardcoded home directory path', () => {
    expect(code).not.toContain('Code/Tools/stx')
    expect(code).not.toContain('homedir(')
  })

  it('reaches the installed packages by name', () => {
    expect(code).toContain('bun-plugin-stx/serve')
    expect(code).toContain('@stacksjs/stx')
  })
})
