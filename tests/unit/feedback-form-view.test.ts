import { describe, expect, it } from 'bun:test'
import { join } from 'node:path'
import { renderTemplate } from '@stacksjs/stx'
import {
  FEEDBACK_MAX_DESCRIPTION,
  FEEDBACK_MAX_TITLE,
} from '../../storage/framework/defaults/app/Actions/Dashboard/Feedback/feedback-token'

/**
 * The page a feedback link lands on, at `/feedback/{token}`.
 *
 * Rendered rather than read as source. The page is three lines that resolve a
 * component by tag name and pass it two server-side constants, and every way
 * that goes wrong - a component the resolver cannot find, a prop that never
 * arrives - leaves a page that looks fine in the diff and is blank or inert in
 * a browser (stacksjs/stacks#2872).
 */

const root = join(import.meta.dir, '../..')
const VIEW = join(root, 'storage/framework/defaults/resources/views/feedback/[token].stx')
const COMPONENTS = join(root, 'storage/framework/defaults/resources/components/Dashboard')

/**
 * Both shapes an unresolved component takes. `@stacksjs/stx` dumped the ENOENT
 * into the page up to 0.2.343 and leaves a comment from 0.2.345
 * (stacksjs/stx#2004), so looking for only one of them reports every component
 * as resolved.
 */
const UNRESOLVED = ['Error loading component', 'could not be resolved']

let cached: string | undefined
async function html(): Promise<string> {
  cached ??= String(await renderTemplate(VIEW, { options: { componentsDir: COMPONENTS } }))
  return cached
}

describe('the feedback form page', () => {
  it('resolves FeedbackForm from the defaults components tree', async () => {
    const out = await html()
    for (const marker of UNRESOLVED)
      expect(out).not.toContain(marker)
    // Asserted on the markup too, not only on the absence of a marker: a
    // check that can only say "nothing went wrong" passes when the marker it
    // looks for is the thing that changed.
    expect(out).toContain('Send feedback')
    expect(out).toContain('x-model="title"')
    expect(out).toContain('x-model="description"')
  })

  it('hands the client script down, so the page is not inert', async () => {
    // A component script reached from a layout keeps its raw imports and never
    // hydrates, which renders a perfect page whose button does nothing
    // (stacksjs/stacks#1989). The scope marker and the script are what say
    // this one will hydrate.
    const out = await html()
    expect(out).toContain('data-stx-scope')
    expect(out).toContain('<script')
  })

  it('posts to the intake route and nowhere else', async () => {
    const out = await html()
    expect(out).toContain('/api/feedback/')
    // Quote-agnostic: the bundler rewrites the script's single quotes.
    expect(out).toMatch(/method:\s*["']POST["']/)
  })

  it('renders the limits the action enforces, not its own guesses', async () => {
    // The page reads the action's constants and passes them down. Hardcoding
    // them in the template would drift: a `maxlength` under the server's limit
    // stops a reviewer typing something that would have been accepted, and one
    // over it lets them write a report that is refused on submit.
    const out = await html()
    expect(out).toContain(`&quot;maxTitle&quot;:&quot;${FEEDBACK_MAX_TITLE}&quot;`)
    expect(out).toContain(`&quot;maxDescription&quot;:&quot;${FEEDBACK_MAX_DESCRIPTION}&quot;`)
  })

  it('tells the visitor what the link can and cannot do', async () => {
    const out = await html()
    expect(out).toContain('does not sign you in')
  })

  it('says nothing about whether the link is valid', async () => {
    // There is no read endpoint for feedback tokens, by design, so the page
    // cannot know. Rendering a verdict here would mean building one.
    const out = await html()
    expect(out).not.toContain('Checking your link')
  })
})
