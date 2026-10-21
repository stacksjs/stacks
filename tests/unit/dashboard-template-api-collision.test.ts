import { describe, expect, it } from 'bun:test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { defaultsPath } from '@stacksjs/path'

/**
 * No dashboard template may interpolate a name the API client also exports.
 *
 * A `{{ … }}` interpolation is evaluated server-side. A component whose state
 * lives in a `<script client>` block has none of that state in scope there, so
 * a bare identifier is resolved against module and global scope instead. For
 * almost every name in these templates that resolves to nothing and the
 * interpolation is left as a placeholder for hydration to fill, which is the
 * intended arrangement - 50 of them on the posts page alone, all replaced in
 * the browser.
 *
 * `post` was the exception. `functions/api.ts` exports `post()`, so
 * `{{ post() ? 'Save changes' : 'Create post' }}` in the post editor called
 * the HTTP client while the page rendered - with no argument, which is why the
 * logged endpoint was `undefined`. Reproduced on the pinned stx 0.2.607, eight
 * times on one page load, and zero after the rename (stacksjs/stacks#2944).
 *
 * Nothing was sent, only because a relative base URL cannot be fetched
 * off the DOM. `api.ts` now refuses by name rather than relying on that, and
 * this keeps the trigger from coming back: the next component to name a signal
 * `get`, `put`, `patch` or `del` and interpolate it fails here instead of
 * issuing a request mid-render.
 */

const API_EXPORTS = ['get', 'post', 'put', 'patch', 'del', 'useApi', 'createResource']

/** Every `.stx` under the dashboard components tree. */
function templates(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory())
      templates(full, found)
    else if (entry.endsWith('.stx'))
      found.push(full)
  }
  return found
}

/** The `{{ … }}` bodies in a template, with script blocks removed. */
function interpolations(source: string): string[] {
  const markup = source.replace(/<script[\s\S]*?<\/script>/g, '')
  return (markup.match(/\{\{([^}]*)\}\}/g) ?? [])
}

describe('dashboard templates and the API client', () => {
  const root = defaultsPath('resources/components/Dashboard')
  const files = templates(root)

  it('finds the dashboard templates to check', () => {
    // Guards the walk itself: a wrong root would make every assertion below
    // pass over an empty list.
    expect(files.length).toBeGreaterThan(100)
  })

  it('never interpolates a name the API client exports', () => {
    const offenders: string[] = []

    for (const file of files) {
      for (const body of interpolations(readFileSync(file, 'utf8'))) {
        for (const name of API_EXPORTS) {
          // The call form is what matters: `{{ post() … }}` invokes it.
          if (new RegExp(`(?<![\\w.$-])${name}\\s*\\(`).test(body))
            offenders.push(`${relative(root, file)}: ${body.trim()}`)
        }
      }
    }

    expect(offenders).toEqual([])
  })
})
