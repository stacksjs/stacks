/**
 * Tool calls across drivers.
 *
 * A tool round trip is: the model answers with `AIResult.toolCalls`, the
 * application runs them, and the next request carries the assistant's turn
 * (its text and the calls) and a user turn with one result per call.
 * `assistantTurn()` and `toolResultsTurn()` build those two messages, which
 * every driver translates to its provider's wire shape.
 */

import type { AIMessage, AIMessageContent, AIResult, AIToolCall, AIToolResult } from '../types'
import { normalizeMessagesForProvider } from './vision'

/**
 * The assistant message that records `result`, to send back with the results.
 */
export function assistantTurn(result: Pick<AIResult, 'content' | 'toolCalls'>): AIMessage {
  if (!result.toolCalls?.length)
    return { role: 'assistant', content: result.content }
  const content: AIMessageContent[] = result.content ? [{ type: 'text', text: result.content }] : []
  for (const call of result.toolCalls)
    content.push({ type: 'tool_call', toolCall: call })
  return { role: 'assistant', content }
}

/**
 * The user message that answers the calls of the previous assistant turn.
 */
export function toolResultsTurn(results: AIToolResult[]): AIMessage {
  return { role: 'user', content: results.map(toolResult => ({ type: 'tool_result', toolResult })) }
}

/**
 * Parse a tool call's arguments. OpenAI sends them as a JSON string, the
 * others as an object; a string that is not a JSON object is a model error,
 * reported rather than swallowed.
 */
export function parseToolArguments(raw: unknown, tool: string): Record<string, unknown> {
  if (raw === undefined || raw === null || raw === '')
    return {}
  if (typeof raw !== 'string')
    return raw as Record<string, unknown>
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
      return parsed as Record<string, unknown>
  }
  catch {
    // fall through to the error below
  }
  throw new Error(`The model called "${tool}" with arguments that are not a JSON object: ${raw.slice(0, 200)}`)
}

function blocksOf(message: AIMessage): AIMessageContent[] {
  return typeof message.content === 'string' ? [{ type: 'text', text: message.content }] : message.content
}

function textOf(blocks: AIMessageContent[]): string {
  return blocks.filter(block => block.type === 'text').map(block => block.text ?? '').join('')
}

/**
 * Messages in the OpenAI chat-completions shape, which Ollama shares: an
 * assistant's calls ride on the message as `tool_calls`, and each result is a
 * message of its own with role `tool`. Everything else is normalised as before.
 */
export function toChatCompletionMessages(
  messages: AIMessage[],
  options: { argumentsAsString: boolean },
): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = []

  for (const message of messages) {
    const blocks = blocksOf(message)
    const calls = blocks.filter(block => block.type === 'tool_call' && block.toolCall).map(block => block.toolCall!)
    const results = blocks.filter(block => block.type === 'tool_result' && block.toolResult).map(block => block.toolResult!)

    if (calls.length === 0 && results.length === 0) {
      out.push(normalizeMessagesForProvider([message], 'openai')[0] as unknown as Record<string, unknown>)
      continue
    }

    if (calls.length > 0) {
      out.push({
        role: 'assistant',
        content: textOf(blocks) || null,
        tool_calls: calls.map((call: AIToolCall) => ({
          id: call.id,
          type: 'function',
          function: {
            name: call.name,
            arguments: options.argumentsAsString ? JSON.stringify(call.arguments) : call.arguments,
          },
        })),
      })
    }

    for (const result of results) {
      out.push({
        role: 'tool',
        tool_call_id: result.toolCallId,
        ...(result.name ? { tool_name: result.name } : {}),
        content: result.content,
      })
    }

    // Text sent alongside results stays a user message of its own.
    const remaining = blocks.filter(block => block.type !== 'tool_call' && block.type !== 'tool_result')
    if (calls.length === 0 && remaining.length > 0)
      out.push(normalizeMessagesForProvider([{ role: message.role, content: remaining }], 'openai')[0] as unknown as Record<string, unknown>)
  }

  return out
}

/**
 * Messages in Ollama's `/api/chat` shape: `content` is a string, images ride
 * in `images` as bare base64, a call's arguments are an object, and a result
 * names its tool. Content arrays used to be sent as they were, which Ollama
 * rejects.
 */
export function toOllamaMessages(messages: AIMessage[]): Array<Record<string, unknown>> {
  return toChatCompletionMessages(messages, { argumentsAsString: false }).map((message) => {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        content: message.content,
        ...(message.tool_name ? { tool_name: message.tool_name } : {}),
      }
    }

    const out: Record<string, unknown> = { role: message.role }
    if (Array.isArray(message.content)) {
      const parts = message.content as Array<{ type: string, text?: string, image_url?: { url: string } }>
      out.content = parts.filter(part => part.type === 'text').map(part => part.text ?? '').join('')
      const images = parts.filter(part => part.type === 'image_url').map((part) => {
        const inline = /^data:[^;]+;base64,(.*)$/.exec(part.image_url?.url ?? '')
        if (!inline)
          throw new Error('Ollama takes image bytes, not a URL: pass the image as a data: URL or a base64 `image` block')
        return inline[1]!
      })
      if (images.length > 0)
        out.images = images
    }
    else {
      out.content = message.content ?? ''
    }

    if (message.tool_calls) {
      out.tool_calls = (message.tool_calls as Array<{ function: unknown }>).map(call => ({ function: call.function }))
    }
    return out
  })
}
