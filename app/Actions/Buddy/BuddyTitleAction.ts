import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

/**
 * Generate a short title for a chat based on the initial prompt
 *
 * Uses Claude to summarize the user's first message into a concise title.
 */
export default new Action({
  name: 'BuddyTitleAction',
  description: 'Generate a chat title from initial prompt',
  method: 'POST',

  async handle(request: RequestInstance) {
    try {
      const prompt = request.get('prompt') as string

      if (!prompt) {
        return response.json({ error: 'Prompt is required' }, 422)
      }

      const { $ } = await import('bun')

      // Use Claude to generate a short title (max 5 words)
      const titlePrompt = `Summarize this user request into a very short title (2-5 words max, no quotes, no punctuation at end). Just output the title, nothing else.

User request: "${prompt.substring(0, 500)}"`

      try {
        const result = await $`claude --print --dangerously-skip-permissions ${titlePrompt}`.quiet()
        const title = result.text().trim()
          .replace(/^["']|["']$/g, '') // Remove surrounding quotes
          .replace(/[.!?]$/, '') // Remove trailing punctuation
          .substring(0, 50) // Max 50 chars

        return response.json({ title })
      }
      catch (error) {
        // Fallback: just truncate the prompt
        const fallbackTitle = prompt.substring(0, 30).trim() + (prompt.length > 30 ? '...' : '')
        return response.json({ title: fallbackTitle })
      }
    }
    catch (error) {
      console.error('[BuddyTitleAction] Error:', error)
      return response.json({ error: (error as Error).message }, 500)
    }
  },
})
