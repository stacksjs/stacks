import type { ConfiguredAIOptions } from '@stacksjs/ai'
import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { buddyState, createAIClient } from '@stacksjs/ai'
import { config } from '@stacksjs/config'
import { response } from '@stacksjs/router'
import { buddySystemPrompt, isBuddyProviderConfigured, publicBuddyHistory, resolveBuddyProvider } from './buddy-chat'

export default new Action({
  name: 'BuddyChatAction',
  description: 'Answers a framework question with the configured AI provider without modifying files.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const message = String(request.get('message') || '').trim()
    if (message.length < 3)
      return response.json({ message: 'Question must be at least 3 characters.' }, 422)
    if (message.length > 4_000)
      return response.json({ message: 'Question must be 4,000 characters or fewer.' }, 422)

    const aiConfig = (config.ai || {}) as ConfiguredAIOptions
    const provider = resolveBuddyProvider(aiConfig)
    if (!isBuddyProviderConfigured(provider, aiConfig, process.env)) {
      return response.json({
        message: `${provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY'} is not configured.`,
      }, 503)
    }

    try {
      const history = publicBuddyHistory(buddyState.getState().conversationHistory, 20)
      const result = await createAIClient(aiConfig, provider).generate(
        [...history, { role: 'user', content: message }],
        {
          system: buddySystemPrompt(),
          maxTokens: 1_200,
          temperature: 0.2,
        },
      )

      buddyState.addToHistory({ role: 'user', content: message })
      buddyState.addToHistory({ role: 'assistant', content: result.content })

      return {
        content: result.content,
        provider,
        model: result.model,
        usage: result.usage || null,
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Buddy could not answer the question.',
      }, 502)
    }
  },
})
