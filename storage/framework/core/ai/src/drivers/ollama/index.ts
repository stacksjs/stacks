/**
 * Ollama API Driver
 *
 * Local LLM integration via Ollama.
 */

import type { AIDriver, AIDriverConfig, AIMessage, OllamaAPIResponse } from '../../types'

export interface OllamaDriverConfig extends AIDriverConfig {
  host?: string
  model?: string
}

const DEFAULT_HOST = 'http://localhost:11434'
const DEFAULT_MODEL = 'llama3.2'

export function createOllamaDriver(config: OllamaDriverConfig = {}): AIDriver {
  const {
    host = process.env.OLLAMA_HOST || DEFAULT_HOST,
    model = process.env.OLLAMA_MODEL || DEFAULT_MODEL,
  } = config

  return {
    name: 'Ollama',

    async process(command: string, systemPrompt: string, history: AIMessage[]): Promise<string> {
      const response = await fetch(`${host}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...history,
            { role: 'user', content: command },
          ],
          stream: false,
        }),
      })

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`Ollama API error: ${error}`)
      }

      const data = (await response.json()) as OllamaAPIResponse
      return data.message.content
    },
  }
}

export const ollamaDriver: { create: typeof createOllamaDriver } = {
  create: createOllamaDriver,
}
