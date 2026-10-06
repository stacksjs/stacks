/**
 * Amazon Bedrock Driver
 *
 * Chat completions through Bedrock's Converse API, which takes one request
 * shape for every text model Bedrock serves - Nova, Claude, Llama - so the
 * model is configuration rather than code. Credentials come from the AWS
 * credential chain.
 */

import type { ConverseCommandInput, ConverseCommandOutput } from '@stacksjs/ts-cloud/aws'
import type { AIMessage, AIMessageContent, AIResult, AIToolCall, ChatCompletionOptions } from '../../types'
import { converse } from '../../utils/client-bedrock-runtime'
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
 * One chat completion. `options.model` overrides the configured model.
 */
export async function chat(messages: AIMessage[], options: ChatCompletionOptions & { system?: string } = {}): Promise<AIResult> {
  const config = resolveConfig()
  const model = options.model || config.model
  const startedAt = Date.now()

  const inferenceConfig: NonNullable<ConverseCommandInput['inferenceConfig']> = {}
  const maxTokens = options.maxTokens ?? config.maxTokens
  if (maxTokens !== undefined) inferenceConfig.maxTokens = maxTokens
  if (options.temperature !== undefined) inferenceConfig.temperature = options.temperature
  if (options.topP !== undefined) inferenceConfig.topP = options.topP
  if (options.stop !== undefined) inferenceConfig.stopSequences = Array.isArray(options.stop) ? options.stop : [options.stop]

  const tools = toolConfig(options)
  const response = await converse({
    modelId: model,
    ...toConverseMessages(messages, options.system),
    ...(Object.keys(inferenceConfig).length > 0 ? { inferenceConfig } : {}),
    ...(tools ? { toolConfig: tools } : {}),
  }, config.region)

  const outputTool = options.responseFormat && options.responseFormat.type !== 'text'
    ? structuredOutputTool(options.responseFormat).name
    : undefined
  const result: AIResult = {
    ...readOutput(response, outputTool),
    model,
    usage: {
      promptTokens: response.usage?.inputTokens ?? 0,
      completionTokens: response.usage?.outputTokens ?? 0,
      totalTokens: response.usage?.totalTokens ?? 0,
    },
    finishReason: response.stopReason,
  }

  recordUsage({
    provider: 'bedrock',
    model,
    promptTokens: result.usage!.promptTokens,
    completionTokens: result.usage!.completionTokens,
    totalTokens: result.usage!.totalTokens,
    durationMs: Date.now() - startedAt,
    timestamp: Date.now(),
  })

  return result
}

export const bedrock = { configure, chat }
