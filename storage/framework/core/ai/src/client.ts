import type {
  AIMessage,
  AIMessageContent,
  AIProvider,
  AIResult,
  ChatCompletionOptions,
  ConfiguredAIClient,
  ConfiguredAIOptions,
  GenerateObjectOptions,
} from './types'
import * as anthropic from './drivers/anthropic'
import * as ollama from './drivers/ollama'
import * as openai from './drivers/openai'

function textContent(content: string | AIMessageContent[]): string {
  if (typeof content === 'string')
    return content
  return content.filter(block => block.type === 'text').map(block => block.text ?? '').join('\n')
}

function providerFromConfig(config: ConfiguredAIOptions, override?: AIProvider): AIProvider {
  if (override)
    return override
  const configured = String(config.default || '').toLowerCase()
  if (configured === 'anthropic' || configured.startsWith('anthropic.'))
    return 'anthropic'
  if (configured === 'openai' || configured.startsWith('gpt-') || configured.startsWith('o1') || configured.startsWith('o3'))
    return 'openai'
  if (configured === 'ollama')
    return 'ollama'
  throw new Error(`Unsupported configured AI driver: ${config.default || '(empty)'}. Expected anthropic, openai, or ollama.`)
}

function parseObject(content: string): unknown {
  const trimmed = content.trim()
  const unfenced = trimmed.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    return JSON.parse(unfenced)
  }
  catch {
    const start = unfenced.indexOf('{')
    const end = unfenced.lastIndexOf('}')
    if (start >= 0 && end > start)
      return JSON.parse(unfenced.slice(start, end + 1))
    throw new Error('AI response did not contain a valid JSON object')
  }
}

function typeMatches(value: unknown, type: string): boolean {
  if (type === 'array') return Array.isArray(value)
  if (type === 'integer') return typeof value === 'number' && Number.isInteger(value)
  if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value)
  if (type === 'null') return value === null
  return typeof value === type
}

function validateSchema(value: unknown, schema: Record<string, any>, path = '$'): string[] {
  const errors: string[] = []
  if (schema.type) {
    const allowed = Array.isArray(schema.type) ? schema.type : [schema.type]
    if (!allowed.some((type: string) => typeMatches(value, type)))
      return [`${path} must be ${allowed.join(' or ')}`]
  }
  if (schema.enum && !schema.enum.some((candidate: unknown) => Object.is(candidate, value)))
    errors.push(`${path} must be one of ${schema.enum.join(', ')}`)
  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength)
      errors.push(`${path} must contain at least ${schema.minLength} characters`)
    if (schema.maxLength !== undefined && value.length > schema.maxLength)
      errors.push(`${path} must contain at most ${schema.maxLength} characters`)
  }
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum)
      errors.push(`${path} must be at least ${schema.minimum}`)
    if (schema.maximum !== undefined && value > schema.maximum)
      errors.push(`${path} must be at most ${schema.maximum}`)
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      errors.push(`${path} must contain at least ${schema.minItems} items`)
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      errors.push(`${path} must contain at most ${schema.maxItems} items`)
    if (schema.items) {
      value.forEach((item, index) => errors.push(...validateSchema(item, schema.items, `${path}[${index}]`)))
    }
  }
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const record = value as Record<string, unknown>
    for (const key of schema.required ?? []) {
      if (!(key in record))
        errors.push(`${path}.${key} is required`)
    }
    for (const [key, child] of Object.entries(schema.properties ?? {})) {
      if (key in record)
        errors.push(...validateSchema(record[key], child as Record<string, any>, `${path}.${key}`))
    }
    if (schema.additionalProperties === false) {
      const known = new Set(Object.keys(schema.properties ?? {}))
      for (const key of Object.keys(record)) {
        if (!known.has(key))
          errors.push(`${path}.${key} is not allowed`)
      }
    }
  }
  return errors
}

function createGenerate(config: ConfiguredAIOptions, provider: AIProvider) {
  if (provider === 'anthropic') {
    const driver = config.drivers?.anthropic ?? {}
    anthropic.configure({
      apiKey: driver.apiKey || process.env.ANTHROPIC_API_KEY || '',
      model: driver.model,
      maxTokens: driver.maxTokens,
      anthropicVersion: driver.anthropicVersion,
    })
    return async (messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): Promise<AIResult> => {
      const systemMessages = messages.filter(message => message.role === 'system').map(message => textContent(message.content))
      const nonSystem = messages.filter(message => message.role !== 'system')
      return anthropic.chat(nonSystem, {
        ...options,
        system: [options.system, ...systemMessages].filter(Boolean).join('\n\n') || undefined,
      })
    }
  }
  if (provider === 'openai') {
    const driver = config.drivers?.openai ?? {}
    openai.configure({
      apiKey: driver.apiKey || process.env.OPENAI_API_KEY || '',
      model: driver.model,
      maxTokens: driver.maxTokens,
      baseUrl: driver.baseUrl,
      embeddingModel: driver.embeddingModel,
    })
    return (messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): Promise<AIResult> => {
      const finalMessages = options.system
        ? [{ role: 'system' as const, content: options.system }, ...messages]
        : messages
      return openai.chat(finalMessages, options)
    }
  }
  const driver = config.drivers?.ollama ?? {}
  ollama.configure({
    host: driver.host || driver.baseUrl,
    model: driver.model,
    embeddingModel: driver.embeddingModel,
  })
  return (messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): Promise<AIResult> => {
    const finalMessages = options.system
      ? [{ role: 'system' as const, content: options.system }, ...messages]
      : messages
    return ollama.chat(finalMessages, options)
  }
}

/**
 * Create a provider-neutral AI client from an application's `config/ai.ts`.
 * Secrets remain server-side and may be supplied by config or provider env vars.
 */
export function createAIClient(config: ConfiguredAIOptions, override?: AIProvider): ConfiguredAIClient {
  const provider = providerFromConfig(config, override)
  const generate = createGenerate(config, provider)
  return {
    provider,
    generate,
    async generateObject<T>(messages: AIMessage[], schema: Record<string, unknown>, options: GenerateObjectOptions = {}) {
      const { attempts = 2, system, ...completionOptions } = options
      const history = [...messages]
      let lastError: Error | undefined
      for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
        const result = await generate(history, {
          ...completionOptions,
          system,
          responseFormat: {
            type: 'json_schema',
            json_schema: { name: 'structured_output', schema, strict: true },
          },
        })
        try {
          const data = parseObject(result.content)
          const errors = validateSchema(data, schema)
          if (errors.length)
            throw new Error(`AI response failed schema validation: ${errors.slice(0, 8).join('; ')}`)
          return { data: data as T, result }
        }
        catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error))
          if (attempt < attempts) {
            history.push({ role: 'assistant', content: result.content })
            history.push({
              role: 'user',
              content: `Return only a corrected JSON object. Validation error: ${lastError.message}`,
            })
          }
        }
      }
      throw lastError ?? new Error('AI object generation failed')
    },
  }
}

export { parseObject as parseAIObject, validateSchema as validateAISchema }
