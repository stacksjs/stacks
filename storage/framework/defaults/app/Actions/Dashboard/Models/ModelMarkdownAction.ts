import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { sanitize } from '@stacksjs/sanitizer'
import { dashboardOperationalError } from '../dashboard-response'

/** The most Markdown a preview takes: what the largest text column is asked to hold. */
const MAX_MARKDOWN = 100_000

/** Markdown as the HTML it reads as: the parser Stacks content uses, then sanitized. */
export function renderMarkdownPreview(markdown: string): string {
  return sanitize(Bun.markdown.html(markdown), 'markdown')
}

/**
 * `POST /api/dashboard/markdown`.
 *
 * How a field's Markdown reads, for the preview beside its editor
 * (`dashboard.fields.<name>.input: 'markdown'`). Rendered here and not in the
 * browser so the preview is the parser Stacks content is rendered with, and
 * sanitized: the page shows it in a frame that runs no script either way.
 * Nothing is stored.
 */
export default new Action({
  name: 'Dashboard Markdown Preview',
  description: 'Renders Markdown to sanitized HTML for a form\'s preview.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const text = request.get('text', '')
    if (typeof text !== 'string')
      return response.json({ message: 'The text to preview must be text.' }, 422)
    if (text.length > MAX_MARKDOWN)
      return response.json({ message: 'That is too long to preview.' }, 422)
    try {
      return { html: renderMarkdownPreview(text) }
    }
    catch (error) {
      return dashboardOperationalError(error, 'The preview could not be made.', 'ModelMarkdownAction', 500)
    }
  },
})
