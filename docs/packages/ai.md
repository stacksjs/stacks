---
title: AI Package
description: "An AI integration package providing unified access to multiple AI providers including Anthropic (Claude), OpenAI, Ollama, and AWS Bedrock."
---
# AI Package

An AI integration package providing unified access to multiple AI providers including Anthropic (Claude), OpenAI, Ollama, and AWS Bedrock.

## Installation

```bash
bun add @stacksjs/ai
```

## Basic Usage

```typescript
import { anthropic, bedrock, ollama, openai } from '@stacksjs/ai'

const messages = [{ role: 'user' as const, content: 'Hello!' }]

// Each driver's chat() takes the messages, then the options.
const claude = await anthropic.chat(messages)
const gpt = await openai.chat(messages, { temperature: 0.7 })
const local = await ollama.chat(messages, { model: 'llama3.2' })
const nova = await bedrock.chat(messages, { model: 'amazon.nova-lite-v1:0' })

console.log(claude.content, claude.usage)
```

## Configuration

Configure AI providers in `config/ai.ts`. `default` picks the provider: a
provider name, or a model id that implies one (`claude-...` is Anthropic,
`gpt-...` is OpenAI, a Bedrock id such as `amazon.nova-lite-v1:0` or
`global.anthropic.claude-sonnet-5-5` is Bedrock).

```typescript
import type { AiConfig } from '@stacksjs/types'

export default {
  default: 'anthropic',

  // The Amazon Bedrock models this app uses; `buddy ai:access` makes them
  // invocable in the AWS account.
  models: ['amazon.nova-lite-v1:0', 'amazon.titan-embed-text-v2:0'],

  deploy: false,

  drivers: {
    anthropic: { model: 'claude-sonnet-5-5', maxTokens: 4096 }, // key: ANTHROPIC_API_KEY
    openai: { model: 'gpt-4o' }, // key: OPENAI_API_KEY
    ollama: { host: 'http://localhost:11434', model: 'llama3.2' },
    // Credentials come from the AWS credential chain, never from this file.
    bedrock: { model: 'amazon.nova-lite-v1:0', region: 'us-east-1' },
  },
} satisfies AiConfig
```

## Drivers

Every driver has the same shape: `configure(config)` once, then
`chat(messages, options)` resolving to an `AIResult` -
`{ content, toolCalls?, model, usage, finishReason }` - and `streamChat(messages, options)`
yielding text. A system prompt is `options.system` (Anthropic, Bedrock) or a
`system` message (all of them).

### Anthropic (Claude)

```typescript
import { anthropic } from '@stacksjs/ai'

anthropic.configure({ apiKey: process.env.ANTHROPIC_API_KEY!, model: 'claude-sonnet-5-5' })

const result = await anthropic.chat(
  [
    { role: 'user', content: 'What is the capital of France?' },
    { role: 'assistant', content: 'Paris.' },
    { role: 'user', content: 'What is its population?' },
  ],
  { system: 'Answer in one sentence.', maxTokens: 200 },
)
console.log(result.content)

for await (const text of anthropic.streamChat([{ role: 'user', content: 'Write a haiku.' }]))
  process.stdout.write(text)

// Images are content blocks
const described = await anthropic.chat([{
  role: 'user',
  content: [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64Image } },
    { type: 'text', text: 'What do you see?' },
  ],
}])
```

### OpenAI

```typescript
import { openai } from '@stacksjs/ai'

openai.configure({ apiKey: process.env.OPENAI_API_KEY!, model: 'gpt-4o' })

const result = await openai.chat([
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Tell me a joke.' },
], { temperature: 0.7 })

for await (const text of openai.streamChat([{ role: 'user', content: 'Count to five.' }]))
  process.stdout.write(text)

// One string gives one vector, an array gives one per string
const vector = await openai.embed('The quick brown fox') as number[]
```

### Ollama (local models)

```typescript
import { ollama } from '@stacksjs/ai'

ollama.configure({ host: 'http://localhost:11434', model: 'llama3.2' })

if (await ollama.isRunning()) {
  await ollama.pullModel('llama3.2', status => console.log(status))
  const result = await ollama.chat([{ role: 'user', content: 'Hello!' }])
  const installed = await ollama.listModels()
}
```

### Tool calls

Offer tools with `tools`, run what the model asks for, and send the results
back. `AIResult.toolCalls` is the same shape from every driver -
`{ id, name, arguments }`, with `arguments` already parsed - and
`assistantTurn()` / `toolResultsTurn()` build the next request's messages,
which each driver translates to its provider's format.

```typescript
import type { AIMessage, AITool } from '@stacksjs/ai'
import { assistantTurn, createAIClient, toolResultsTurn } from '@stacksjs/ai'

const tools: AITool[] = [{
  name: 'get_weather',
  description: 'Current weather for a city',
  parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
}]

const client = createAIClient({ default: 'anthropic' })
const messages: AIMessage[] = [{ role: 'user', content: 'Is it raining in Paris?' }]

let result = await client.generate(messages, { tools })
while (result.toolCalls) {
  const outputs = await Promise.all(result.toolCalls.map(async call => ({
    toolCallId: call.id,
    name: call.name, // Ollama matches results by name
    content: JSON.stringify(await getWeather(call.arguments.city as string)),
  })))
  messages.push(assistantTurn(result), toolResultsTurn(outputs))
  result = await client.generate(messages, { tools })
}
console.log(result.content)
```

`toolChoice` is `'auto'`, `'required'`, `'none'` or `{ name }`. Ollama has no
way to force a call, so `'required'` and `{ name }` are refused there rather
than ignored.

### Streaming with tools

`streamChat()` yields the text as it is written, and every driver accepts the
same `tools`, `toolChoice` and `responseFormat` as `chat()`. When the stream
ends, the generator returns the whole result, tool calls included. To act on a
call as soon as the model makes it, iterate `streamChatEvents()` instead:

```typescript
import { anthropic } from '@stacksjs/ai'

for await (const event of anthropic.streamChatEvents(messages, { tools })) {
  if (event.type === 'text')
    process.stdout.write(event.text)
  else if (event.type === 'tool_call')
    console.log('calling', event.call.name, event.call.arguments)
  else // 'done', always last, in the shape chat() returns
    console.log(event.result.usage)
}
```

A tool call arrives whole, once its arguments have finished streaming. The
structured-output tool `responseFormat` uses streams as text, as its JSON is
`content` in `chat()`. A provider error in the middle of a stream throws rather
than ending it as if the model had finished.

### Structured output

`responseFormat` asks any driver for JSON, and `createAIClient().generateObject()`
validates it against a schema and retries once on a mismatch. Anthropic and
Bedrock implement it with a forced tool call, OpenAI natively, Ollama through
its `format` option.

```typescript
import { createAIClient } from '@stacksjs/ai'

const client = createAIClient({ default: 'anthropic' })
const { data } = await client.generateObject<{ city: string }>(
  [{ role: 'user', content: 'Which city is the Eiffel Tower in?' }],
  { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
)
```

## AWS Bedrock

The `bedrock` driver sends every request through Bedrock's Converse API, so one
request shape works for each text model Bedrock serves - Nova, Claude, Llama -
and the model is configuration. Credentials come from the AWS credential chain
(environment keys, a shared profile, the instance role). The region is
`drivers.bedrock.region`, then `AWS_REGION`, then `AWS_DEFAULT_REGION`, then
us-east-1.

```typescript
import { bedrock, createAIClient } from '@stacksjs/ai'

// Directly
const answer = await bedrock.chat(
  [{ role: 'user', content: 'Name three primary colours.' }],
  { model: 'global.anthropic.claude-sonnet-5-5', maxTokens: 200 },
)

// Or through config/ai.ts, with `default: 'bedrock'` or a Bedrock model id
const client = createAIClient({ default: 'bedrock', drivers: { bedrock: { model: 'amazon.nova-lite-v1:0' } } })
const { data } = await client.generateObject(
  [{ role: 'user', content: 'Give me a colour as JSON' }],
  { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
)
```

### Which model id to use

Claude and the newer Nova and Llama generations are served only through
an **inference profile**, so they are invoked by profile id - `global.` or a
geography such as `us.` in front of the model id. Invoking the bare
`anthropic.claude-...` id is refused. `bedrockModels` in `@stacksjs/types`
lists the ids Bedrock serves, in the form each is invoked by, and is what the
`models` autocompletion in `config/ai.ts` offers.

The default, `amazon.nova-lite-v1:0`, is invocable on demand with no profile
and no agreement, so it answers in a fresh account.

### Model access

```bash
buddy ai:access                                      # every model in config/ai.ts
buddy ai:access global.anthropic.claude-sonnet-5-5   # just this one
```

For each model this reports `available` (invocable now), `requested` (an
agreement was made from the model's public offer, and Bedrock is processing
it) or `failed` with the reason - for instance an account that still owes
Anthropic's first-use form. The same is `requestModelAccess(models?)` in code.

### Lower level

`invokeModel` and `invokeModelWithResponseStream` from `@stacksjs/ai` call
Bedrock with the model's own request body; the stream yields each chunk's
decoded model output. `converse` and `converseStream` take Converse's request
shape; the stream yields its events (`contentBlockDelta`, `messageStop`,
`metadata`, ...).

## AI Agents

### Creating Agents

There is no `createAgent` with a tools array. Agents in Stacks are **drivers**
that delegate to the Claude CLI - locally or over SSH on an EC2 box - and the
tools are the CLI's own:

```typescript
import { claudeAgent } from '@stacksjs/ai'

// Runs the `claude` CLI in a working directory
const local = claudeAgent.createLocal({ cwd: process.cwd() })

// Or over SSH, from BUDDY_EC2_HOST / BUDDY_EC2_USER / BUDDY_EC2_KEY
const remote = claudeAgent.createEC2({ ec2Host: 'agent.example.com' })

const answer = await local.process(
  'Summarize the recent changes in this repository',
  context,
  history,
)
```

`local.process(command, context, history)` is the driver interface: the history
is passed in, so a driver holds no conversation state of its own.

For streaming, and for sessions that resume:

```typescript
import { claudeAgentSDK, processCommandStreaming } from '@stacksjs/ai'

const result = await processCommandStreaming('Refactor this module', process.cwd())

const sessionId = claudeAgentSDK.getLastSessionId()
await claudeAgentSDK.resumeSession(sessionId, 'Now add tests')
claudeAgentSDK.clearSession()
```

### Conversation memory

There is no `MemoryStore` class. Conversation state lives in `buddyState`,
which the Buddy command loop reads and writes:

```typescript
import { buddyState } from '@stacksjs/ai'

buddyState.addToHistory({ role: 'user', content: 'My name is John' })
const { conversationHistory } = buddyState.getState()
buddyState.clearHistory()
```

## Buddy - Voice AI Assistant

### Using Buddy

Buddy is a repository-scoped command loop, not a voice assistant class - there
is no `Buddy`, no `createBuddy`, and no speech in the package. It opens a repo,
then processes commands against it:

```typescript
import { buddyState, openRepository, processCommand } from '@stacksjs/ai'

// Clone or open a repository; the path or a GitHub URL both work.
const repo = await openRepository('https://github.com/stacksjs/stacks')
buddyState.setRepo(repo)

const answer = await processCommand('What does the queue package do?')
```

`processCommand` throws if no repository is open - it is the context every
command is answered against. Streaming has the same shape:

```typescript
import { buddyProcessStreaming } from '@stacksjs/ai'

// A ReadableStream to consume now, plus the assembled text when it ends -
// so a caller can render as it arrives and still log the whole answer.
const { stream, fullResponse } = await buddyProcessStreaming('Explain the router')

for await (const chunk of stream)
  process.stdout.write(chunk)

const complete = await fullResponse
```

## Text Utilities

### Text Generation

`ask()` and `summarize()` run on the Bedrock driver: `drivers.bedrock` in
config/ai.ts, `BEDROCK_MODEL_ID`, then `amazon.nova-lite-v1:0`. `modelId`
overrides it for one call.

```typescript
import { analyzeSentiment, ask, classifyText, summarize } from '@stacksjs/ai'

// Free-form generation. The prompt is the first argument, not an option.
const generated = await ask('Write a product description for a smart watch', {
  maxTokenCount: 200,
})

const summary = await summarize(longArticle, { maxTokenCount: 100 })

// Sentiment and classification take the text first, then their own arguments.
const sentiment = await analyzeSentiment('This product exceeded my expectations')
const category = await classifyText(ticket, ['billing', 'bug', 'feature request'])
```

There is no `translate`. Ask for it:

```typescript
const translated = await ask(`Translate to Spanish: ${'Hello, how are you?'}`)
```

### Sentiment Analysis

```typescript
import { analyzeSentiment } from '@stacksjs/ai'

const sentiment = await analyzeSentiment(
  'I absolutely love this product! It exceeded all my expectations.'
)
// Returns: { sentiment: 'positive', score: 0.95 }
```

## Text-to-Speech and Speech-to-Text

`textToSpeech()` and `speechToText()` are provider-neutral. They use the driver
you pass as `driver`, or `default` from `config/ai.ts` when you pass none. Only
the OpenAI driver implements speech today; any other driver throws an error that
names it and lists the drivers that do support speech, instead of quietly
switching provider.

```typescript
import { speechToText, storeSpeech, textToSpeech } from '@stacksjs/ai'

const speech = await textToSpeech('Your order has shipped.', {
  voice: 'nova', // default 'alloy'
  format: 'mp3', // mp3 | opus | aac | flac | wav | pcm, default 'mp3'
  model: 'gpt-4o-mini-tts', // the default; 'tts-1' and 'tts-1-hd' also work
  speed: 1.1, // 0.25 to 4.0, omitted means 1.0
  instructions: 'Calm and friendly.', // gpt-4o-mini-tts only
})
// { audio: Uint8Array, mimeType: 'audio/mpeg', format, driver, model, voice }

// Serve it directly...
return new Response(speech.audio, { headers: { 'Content-Type': speech.mimeType } })

// ...or write it to a storage disk (the default disk when `disk` is omitted)
await storeSpeech(speech, 'audio/order-shipped.mp3', { disk: 'public' })

// Transcribe a recording
const { text } = await speechToText(Bun.file('storage/app/memo.m4a'), { language: 'en' })
```

Credentials come from `drivers.openai.apiKey` in `config/ai.ts` or the
`OPENAI_API_KEY` environment variable, and `drivers.openai.baseUrl` points the
requests at a proxy. OpenAI accepts at most 4096 characters per speech request,
so split longer text yourself. `storeSpeech()` also accepts any storage adapter
as `disk`, for example `Storage.disk('s3')` or `createMemoryStorage()` in tests.

The lower-level `openai.textToSpeech()` and `openai.transcribe()` driver
functions remain available when you want the raw OpenAI response.

## Error Handling

A driver that gets an error status throws an `Error` whose message carries the
provider's own response body, so the reason (an invalid key, an unknown model, a
rate limit) is in `error.message`. The Bedrock driver's errors also carry
`statusCode` and `code` from AWS, and a rejected credential names where it came
from.

```typescript
import { createAIClient } from '@stacksjs/ai'

try {
  const result = await createAIClient({ default: 'anthropic' }).generate([{ role: 'user', content: 'Hello' }])
}
catch (error) {
  console.error((error as Error).message)
}
```

Rate limits are retried for you: the drivers send their requests through
`fetchWithRetry`, which backs off exponentially on 429 and 5xx and honours
`Retry-After`, and the Bedrock client retries throttling the same way.

### Long conversations

Nothing trims history for you. Keep the system prompt and the recent turns:

```typescript
import type { AIMessage } from '@stacksjs/ai'

function trimConversation(messages: AIMessage[], keep = 10): AIMessage[] {
  const system = messages.filter(message => message.role === 'system')
  const turns = messages.filter(message => message.role !== 'system')
  return [...system, ...turns.slice(-keep)]
}
```

## API Reference

### Provider Functions

Each of `anthropic`, `openai`, `ollama` and `bedrock`:

| Function | Description |
|----------|-------------|
| `configure(config)` | Set the model, key or host for later calls |
| `chat(messages, options)` | One completion, an `AIResult` |
| `streamChat(messages, options)` | Text as it is generated; returns the full `AIResult` when it ends |
| `streamChatEvents(messages, options)` | `text`, `tool_call` and a final `done` event |
| `openai.embed(input, model?)` / `ollama.embed(input, model?)` | Embedding vectors |
| `ollama.listModels()` / `ollama.pullModel(name, onProgress?)` | Local models |
| `assistantTurn(result)` / `toolResultsTurn(results)` | The messages that answer `result.toolCalls` |

### Speech Functions

| Function | Description |
|----------|-------------|
| `textToSpeech(text, options)` | Synthesize speech, returns `{ audio, mimeType, format, driver, model, voice }` |
| `storeSpeech(speech, path, { disk })` | Write synthesized audio to a storage disk |
| `speechToText(audio, options)` | Transcribe audio, returns `{ text, driver, model }` |

### Bedrock Functions

| Function | Description |
|----------|-------------|
| `bedrock.chat(messages, options)` | A completion through the Converse API |
| `converse(params, region?)` / `converseStream(params, region?)` | Converse with Bedrock's own request shape, whole or as events |
| `invokeModel(params)` / `invokeModelWithResponseStream(params)` | The model's native request body |
| `listFoundationModels(params)` | What Bedrock offers |
| `requestModelAccess(models?, { region })` | Make models invocable; `buddy ai:access` |
| `isBedrockModelId(id)` | Whether an id names a Bedrock model or profile |

### Text Utilities

| Function | Description |
|----------|-------------|
| `ask(question, options)` | Generate text |
| `summarize(text, options)` | Summarize text |

| `analyzeSentiment(text)` | Analyze sentiment |
