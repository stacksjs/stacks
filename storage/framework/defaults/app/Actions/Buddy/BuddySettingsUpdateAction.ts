import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { apiKeys } from '@stacksjs/ai'

/**
 * Update API keys for AI drivers
 *
 * Request body:
 * - apiKeys: { anthropic?: string, openai?: string, claudeCliHost?: string }
 */
export default new Action({
  name: 'BuddySettingsUpdateAction',
  description: 'Update API keys for AI drivers',
  method: 'POST',
  async handle(request: RequestInstance) {
    try {
      const body = await request.json() as { apiKeys: { anthropic?: string, openai?: string, claudeCliHost?: string } }
      const newKeys = body.apiKeys

      if (newKeys.anthropic !== undefined) {
        apiKeys.anthropic = newKeys.anthropic || undefined
        console.log(`Anthropic API key ${newKeys.anthropic ? 'set' : 'cleared'}`)
      }
      if (newKeys.openai !== undefined) {
        apiKeys.openai = newKeys.openai || undefined
        console.log(`OpenAI API key ${newKeys.openai ? 'set' : 'cleared'}`)
      }
      if (newKeys.claudeCliHost !== undefined) {
        apiKeys.claudeCliHost = newKeys.claudeCliHost || undefined
        console.log(`Claude CLI Host ${newKeys.claudeCliHost ? `set to ${newKeys.claudeCliHost}` : 'cleared'}`)
      }

      return response.json({
        success: true,
        configured: {
          anthropic: !!apiKeys.anthropic,
          openai: !!apiKeys.openai,
          claudeCliHost: !!apiKeys.claudeCliHost,
        },
      })
    }
    catch (error) {
      return response.json({ success: false, error: (error as Error).message }, { status: 400 })
    }
  },
})
