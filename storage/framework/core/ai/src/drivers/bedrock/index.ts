/**
 * Amazon Bedrock Driver
 *
 * Chat completions through Bedrock's Converse API, which takes one request
 * shape for every text model Bedrock serves - Nova, Claude, Llama - so the
 * model is configuration rather than code. Credentials come from the AWS
 * credential chain.
 */

import type { ConverseCommandInput, ConverseCommandOutput } from '@stacksjs/ts-cloud/aws'
import type { AIMessage, AIMessageContent, AIResult, AIStreamEvent, AIToolCall, ChatCompletionOptions } from '../../types'
import { converse, converseStream } from '../../utils/client-bedrock-runtime'
import { streamText } from '../../utils/stream'
import { parseToolArguments } from '../../utils/tools'
import { recordUsage } from '../../utils/usage'

type ConverseMessage = ConverseCommandInput['messages'][number]
type ConverseBlock = ConverseMessage['content'][number]

export interface BedrockDriverConfig {
  /** A model or inference profile id. See `bedrockModels` in @stacksjs/types. */
  model?: string
  /** Defaults to `AWS_REGION`, then `AWS_DEFAULT_REGION`, then us-east-1. */
  region?: string
  maxTokens?: number
}

/**
 * Invocable on demand, with no inference profile and no agreement, so it
 * answers in a fresh account. The Titan Text model this replaces as the
 * default for `ask()` and `summarize()` has been retired.
 */
export const DEFAULT_BEDROCK_MODEL = 'amazon.nova-lite-v1:0'

let globalConfig: BedrockDriverConfig = {}

export function configure(config: BedrockDriverConfig): void {
  globalConfig = { ...globalConfig, ...config }
}

function resolveConfig(): Required<Pick<BedrockDriverConfig, 'model'>> & BedrockDriverConfig {
  return {
    ...globalConfig,
    model: globalConfig.model || process.env.BEDROCK_MODEL_ID || DEFAULT_BEDROCK_MODEL,
  }
}

const IMAGE_FORMATS = new Set(['png', 'jpeg', 'gif', 'webp'])

function imageBlock(mediaType: string, data: string): ConverseBlock {
  const format = mediaType.replace(/^image\//, '').replace('jpg', 'jpeg')
  if (!IMAGE_FORMATS.has(format))
    throw new Error(`Bedrock Converse takes png, jpeg, gif or webp images, not ${mediaType}`)
  return { image: { format: format as 'png' | 'jpeg' | 'gif' | 'webp', source: { bytes: data } } }
}

function contentBlock(part: AIMessageContent): ConverseBlock {
  if (part.type === 'text')
    return { text: part.text ?? '' }
  if (part.type === 'tool_call' && part.toolCall)
    return { toolUse: { toolUseId: part.toolCall.id, name: part.toolCall.name, input: part.toolCall.arguments } }
  if (part.type === 'tool_result' && part.toolResult) {
    return {
      toolResult: {
        toolUseId: part.toolResult.toolCallId,
        content: [{ text: part.toolResult.content }],
        ...(part.toolResult.isError ? { status: 'error' as const } : {}),
      },
    }
  }
  if (part.type === 'image' && part.source)
    return imageBlock(part.source.media_type, part.source.data)
  if (part.type === 'image_url' && part.image_url) {
    const inline = /^data:([^;]+);base64,(.*)$/.exec(part.image_url.url)
    if (!inline)
      throw new Error('Bedrock Converse takes image bytes, not a URL: pass the image as a data: URL or a base64 `image` block')
    return imageBlock(inline[1]!, inline[2]!)
  }
  throw new Error(`Unsupported message content for Bedrock: ${part.type}`)
}

/**
 * Split AI messages into Converse's `system` and `messages`. System messages
 * become system blocks, which Converse keeps apart from the turns.
 */
export function toConverseMessages(messages: AIMessage[], system?: string): Pick<ConverseCommandInput, 'messages' | 'system'> {
  const systemBlocks: Array<{ text: string }> = system ? [{ text: system }] : []
  const turns: ConverseMessage[] = []

  for (const message of messages) {
    if (message.role === 'system') {
      const text = typeof message.content === 'string'
        ? message.content
        : message.content.filter(part => part.type === 'text').map(part => part.text ?? '').join('\n')
      if (text)
        systemBlocks.push({ text })
      continue
    }
    turns.push({
      role: message.role,
      content: typeof message.content === 'string' ? [{ text: message.content }] : message.content.map(contentBlock),
    })
  }

  return { messages: turns, ...(systemBlocks.length > 0 ? { system: systemBlocks } : {}) }
}

/**
 * The tool that captures structured output: the model is made to call it, and
 * its input is the object. The same idiom the Anthropic driver uses, since
 * Converse has no JSON mode of its own.
 */
function structuredOutputTool(format: NonNullable<ChatCompletionOptions['responseFormat']>) {
  if (format.type === 'json_schema') {
    return {
      name: format.json_schema.name,
      description: `Returns the result as JSON matching the '${format.json_schema.name}' schema.`,
      inputSchema: { json: format.json_schema.schema },
    }
  }
  return {
    name: 'structured_output',
    description: 'Returns the result as a JSON object.',
    inputSchema: { json: { type: 'object', additionalProperties: true } },
  }
}

function toolConfig(options: ChatCompletionOptions): ConverseCommandInput['toolConfig'] {
  const { tools = [], toolChoice, responseFormat } = options
  const specs = toolChoice === 'none'
    ? []
    : tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: { json: tool.parameters ?? { type: 'object', properties: {} } },
      }))

  let choice: NonNullable<ConverseCommandInput['toolConfig']>['toolChoice']
  if (toolChoice === 'required')
    choice = { any: {} }
  else if (toolChoice && typeof toolChoice === 'object')
    choice = { tool: { name: toolChoice.name } }
  else if (toolChoice === 'auto')
    choice = { auto: {} }

  if (responseFormat && responseFormat.type !== 'text') {
    const output = structuredOutputTool(responseFormat)
    specs.push(output)
    // The caller's explicit choice wins, as in the Anthropic driver.
    choice = choice ?? { tool: { name: output.name } }
  }

  if (specs.length === 0)
    return undefined
  return { tools: specs.map(toolSpec => ({ toolSpec })), ...(choice ? { toolChoice: choice } : {}) }
}

/**
 * The text and tool calls of a Converse answer. The structured-output tool is
 * internal: its input is the answer, so it is the content, not a call.
 */
function readOutput(output: ConverseCommandOutput, outputTool: string | undefined): Pick<AIResult, 'content' | 'toolCalls'> {
  const blocks = output.output.message?.content ?? []
  const uses = blocks.filter((block): block is Extract<ConverseBlock, { toolUse: unknown }> => 'toolUse' in block)
  const structured = outputTool ? uses.find(block => block.toolUse.name === outputTool) : undefined
  const toolCalls: AIToolCall[] = uses
    .filter(block => block !== structured)
    .map(block => ({ id: block.toolUse.toolUseId, name: block.toolUse.name, arguments: block.toolUse.input ?? {} }))
  const content = structured
    ? JSON.stringify(structured.toolUse.input)
    : blocks.filter((block): block is { text: string } => 'text' in block).map(block => block.text).join('')
  return { content, ...(toolCalls.length > 0 ? { toolCalls } : {}) }
}

/**
 * The Converse request for a chat completion, streamed or not, and the name
 * of the internal structured-output tool when `responseFormat` asks for one.
 */
function converseRequest(messages: AIMessage[], options: ChatCompletionOptions & { system?: string }): { input: ConverseCommandInput, outputTool?: string, region?: string } {
  const config = resolveConfig()
  const model = options.model || config.model

  const inferenceConfig: NonNullable<ConverseCommandInput['inferenceConfig']> = {}
  const maxTokens = options.maxTokens ?? config.maxTokens
  if (maxTokens !== undefined) inferenceConfig.maxTokens = maxTokens
  if (options.temperature !== undefined) inferenceConfig.temperature = options.temperature
  if (options.topP !== undefined) inferenceConfig.topP = options.topP
  if (options.stop !== undefined) inferenceConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop]

  const tools = toolConfig(options)
  const outputTool = options.responseFormat && options.responseFormat.type !== 'text'
    ? structuredOutputTool(options.responseFormat).name
    : undefined

  return {
    input: {
      modelId: model,
      ...toConverseMessages(messages, options.system),
      ...(Object.keys(inferenceConfig).length > 0 ? { inferenceConfig } : {}),
      ...(tools ? { toolConfig: tools } : {}),
    },
    ...(outputTool ? { outputTool } : {}),
    region: config.region,
  }
}

function report(model: string, usage: NonNullable<AIResult['usage']>, startedAt: number): void {
  recordUsage({
    provider: 'bedrock',
    model,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    durationMs: Date.now() - startedAt,
    timestamp: Date.now(),
  })
}

/**
 * One chat completion. `options.model` overrides the configured model.
 */
export async function chat(messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): Promise<AIResult> {
  const startedAt = Date.now()
  const { input, outputTool, region } = converseRequest(messages, options)
  const response = await converse(input, region)

  const result: AIResult = {
    ...readOutput(response, outputTool),
    model: input.modelId,
    usage: {
      promptTokens: response.usage?.inputTokens ?? 0,
      completionTokens: response.usage?.outputTokens ?? 0,
      totalTokens: response.usage?.totalTokens ?? 0,
    },
    finishReason: response.stopReason,
  }

  report(input.modelId, result.usage!, startedAt)
  return result
}

/**
 * A streamed chat completion, as events: text as it is written, each tool
 * call once its arguments have streamed, then the whole result.
 *
 * Converse streams a tool call as a `contentBlockStart` carrying its id and
 * name, then `toolUse.input` fragments of one JSON string, so a call is
 * reported at its `contentBlockStop`, whole. The structured-output tool is
 * internal, as in `chat()`: its JSON streams as text. Usage arrives last, in
 * `metadata`.
 */
export async function* streamChatEvents(messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): AsyncGenerator<AIStreamEvent> {
  const startedAt = Date.now()
  const { input, outputTool, region } = converseRequest(messages, options)
  const { stream } = await converseStream(input, region)

  const toolBlocks = new Map<number, { id: string, name: string, json: string, structured: boolean }>()
  const toolCalls: AIToolCall[] = []
  let content = ''
  let usage: AIResult['usage']
  let finishReason: string | undefined

  for await (const event of stream) {
    if ('contentBlockStart' in event) {
      const use = event.contentBlockStart.start.toolUse
      if (use)
        toolBlocks.set(event.contentBlockStart.contentBlockIndex, { id: use.toolUseId, name: use.name, json: '', structured: use.name === outputTool })
    }
    else if ('contentBlockDelta' in event) {
      const { contentBlockIndex, delta } = event.contentBlockDelta
      if (delta.text) {
        content += delta.text
        yield { type: 'text', text: delta.text }
      }
      else if (delta.toolUse) {
        const block = toolBlocks.get(contentBlockIndex)
        if (!block)
          continue
        block.json += delta.toolUse.input
        if (block.structured && delta.toolUse.input) {
          content += delta.toolUse.input
          yield { type: 'text', text: delta.toolUse.input }
        }
      }
    }
    else if ('contentBlockStop' in event) {
      const block = toolBlocks.get(event.contentBlockStop.contentBlockIndex)
      if (block && !block.structured) {
        const call: AIToolCall = { id: block.id, name: block.name, arguments: parseToolArguments(block.json, block.name) }
        toolCalls.push(call)
        yield { type: 'tool_call', call }
      }
    }
    else if ('messageStop' in event) {
      finishReason = event.messageStop.stopReason
    }
    else if ('metadata' in event) {
      usage = {
        promptTokens: event.metadata.usage.inputTokens,
        completionTokens: event.metadata.usage.outputTokens,
        totalTokens: event.metadata.usage.totalTokens,
      }
    }
  }

  if (usage)
    report(input.modelId, usage, startedAt)

  yield {
    type: 'done',
    result: {
      content,
      ...(toolCalls.length > 0 ? { toolCalls } : {}),
      model: input.modelId,
      ...(usage ? { usage } : {}),
      ...(finishReason ? { finishReason } : {}),
    },
  }
}

/**
 * Stream chat completion: the text as it is written. Tool calls, usage and
 * the stop reason are in the result the generator returns; iterate
 * {@link streamChatEvents} to act on a tool call as soon as it arrives.
 */
export function streamChat(messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): AsyncGenerator<string, AIResult, undefined> {
  return streamText(streamChatEvents(messages, options))
}

export const bedrock = { configure, chat, streamChat, streamChatEvents }
