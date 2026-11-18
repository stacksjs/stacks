---
title: AI Package
description: "AI providers, speech, retrieval, and MCP servers generated from Stacks router APIs and useApi models."
---
# AI Package

An AI integration package providing unified access to multiple AI providers including Anthropic (Claude), OpenAI, Ollama, and AWS Bedrock.
It also [generates MCP servers from your API](#generate-an-mcp-server-from-your-api),
including model-driven CRUD, without requiring an AI provider.

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

## Generate an MCP server from your API

Stacks can expose registered API routes as MCP tools, including the CRUD routes
generated by a model's `traits.useApi`. Add this to `routes/api.ts`:

```typescript
import { mountRouterMCPServer } from '@stacksjs/ai/router-mcp'

mountRouterMCPServer({
  name: 'my-app',
  version: '1.0.0',
  authenticate: request => authenticateIntegrationToken(request),
})
```

`authenticateIntegrationToken` is your application's credential check: return a
principal, or a 401/403 `Response`. Authenticate integration bearer tokens rather
than ambient browser sessions. The example mounts `/api/mcp`, because
`routes/api.ts` has the `/api` prefix. It registers POST, GET and DELETE using the
native stateless Streamable HTTP transport. No AI provider or API key is needed.

Tools are generated automatically from this router's registrations on the first
POST, after route files and model APIs have loaded. No generated file or second
model registry is required. By default, GET/POST/PUT/PATCH/DELETE endpoints under
`/api` are included. The MCP endpoint excludes itself. Wildcard, optional and
constrained path parameters are omitted. Tools keep a stable, unique name derived
from their HTTP method and path. The tool list stays fixed for that server's
lifetime; restart after changing routes.

A call uses separate `path`, `query` and `body` arguments:

```json
{
  "path": { "id": 42 },
  "query": { "include": ["author", "tags"] },
  "body": { "title": "Updated title" }
}
```

Path parameters are required and encoded, query arrays become repeated query
parameters, and `body` is JSON for write methods. Generated schemas describe
these HTTP containers; action and model field validation still runs in the API.
Tool results contain `{ status, body }` in both text and `structuredContent`.
Non-success API responses set `isError`; 204 responses have `body: null`.
Server error details are redacted and response reads default to a 1 MiB limit.
SSE responses are rejected; unfinished response reads cancel when the caller aborts.

Each call goes through the original router pipeline, retaining middleware,
validation, authorization, ownership, hidden-field filtering and rate limits.
Only the incoming Authorization header is forwarded by default. MCP
authentication does not automatically sign the principal into the API: its
credential must also satisfy the API's guards. Model API selection through
`security.api.models` or `STACKS_MODEL_APIS`, route subsets in `useApi.routes`,
and user route overrides are respected because only registered routes are read.

### A model with `useApi`

For example, define a shared catalog model in `app/Models/CatalogItem.ts`:

```typescript
import { defineModel } from '@stacksjs/orm'
import { schema } from '@stacksjs/validation'

export default defineModel({
  name: 'CatalogItem',
  table: 'catalog_items',
  traits: {
    useApi: {
      uri: 'catalog-items', prefix: 'v1',
      routes: ['index', 'show'], middleware: ['auth'],
    },
  },
  attributes: {
    title: { fillable: true, required: true, validation: { rule: schema.string().max(120) } },
    internalNote: { hidden: true },
  },
})
```

Generate and review its migration, then apply it:

```bash
./buddy generate:migrations
./buddy migrate
```

With the MCP mount above, this model contributes tools for
`GET /api/v1/catalog-items` and `GET /api/v1/catalog-items/{id}`. Both require the
API's `auth` middleware, and `internal_note` stays hidden. The model's declared
route list publishes no writes. App models are selected by default; if you have
restricted `security.api.models` or `STACKS_MODEL_APIS`, include `CatalogItem`.
See [model API selection and authorization](/skills/data/models).

### Connect and call a generated tool

A client should discover tool names rather than reconstruct their generated
hash suffix. This example uses the native Stacks MCP client and an existing row
with ID 42. Set `STACKS_INTEGRATION_TOKEN` to a credential accepted by both your
MCP authentication callback and the API's auth middleware:

```typescript
import { MCPClient } from '@stacksjs/ai/mcp'

const token = process.env.STACKS_INTEGRATION_TOKEN
if (!token) throw new Error('Set STACKS_INTEGRATION_TOKEN')

const client = new MCPClient({
  name: 'catalog',
  transport: {
    type: 'streamable-http',
    url: 'http://localhost:3008/api/mcp', // use your API server's URL
    headers: { Authorization: `Bearer ${token}` },
  },
})

try {
  await client.connect()
  const show = client.listTools().find(tool => tool.description === 'GET /api/v1/catalog-items/{id}')
  if (!show) throw new Error('Catalog show tool is not exposed')
  const result = await client.callTool(show.name, { path: { id: 42 } })
  console.log(result)
}
finally {
  await client.disconnect()
}
```

### Customize the generated server

```typescript
import { mountRouterMCPServer } from '@stacksjs/ai/router-mcp'
import { mcpTextResult } from '@stacksjs/ai/mcp-server'

mountRouterMCPServer({
  name: 'my-app', version: '1.0.0',
  path: '/integrations/mcp', // relative to the current route-file/group prefix
  prefix: '/api/v1',         // absolute API prefix to expose
  origin: 'https://api.example.com', // URL context; calls stay in-process
  authenticate: request => authenticateIntegrationToken(request),
  allowedOrigins: ['https://trusted-host.example'],
  filter: endpoint => !endpoint.path.startsWith('/api/v1/internal'),
  configureTool(endpoint, tool) {
    if (endpoint.method === 'DELETE') return false
    return {
      ...tool,
      description: `My application: ${tool.description}`,
      available: principal => principal.scopes.includes(endpoint.method === 'GET' ? 'api:read' : 'api:write'),
    }
  },
  requestHeaders: ({ principal }) => ({ Authorization: `Bearer ${principal.apiToken}` }),
  tools: [{
    name: 'integration_help', description: 'Explain this integration',
    inputSchema: { type: 'object', additionalProperties: false },
    execute: () => mcpTextResult({ guide: 'Start by listing your projects.' }),
  }],
})
```

`configureTool` can change names, descriptions, input/output schemas, annotations,
security metadata, availability and execution. Returning `false` omits the tool.
For detailed field schemas, replace `inputSchema.properties.body` or
`inputSchema.properties.query` with the desired supported MCP schema. The
original router remains authoritative for validation and access checks when you
retain the generated `execute`. A replacement `execute` owns those checks.

All native MCP server options remain available, including custom tools,
resources, prompts, instructions, OAuth resource metadata, discovery page size,
body limits, response headers and error diagnostics. `maxResponseBytes` controls
the API response limit. `router` selects a custom `createStacksRouter()` instance;
`prefix: ''` includes routes outside `/api`. The default request URL origin is
`http://stacks-mcp.internal`; configure `origin` for host-sensitive API behavior.

For manual endpoint registration, `createRouterMCPServer(options)` returns
`{ handle }`. Mount its POST handler with `.parseBody(false).skipCsrf()`, and
mount GET/DELETE as described by the native MCP server. The first request's
endpoint path is excluded from generated tools; filter out any additional MCP
aliases if you mount the handler at multiple paths.

### Router MCP options

| Option | Default | Purpose |
| --- | --- | --- |
| `router` | Default Stacks router | Select the router whose registrations are exposed and invoked. |
| `path` | `/mcp` | Mount path, relative to the current route group; accepted by `mountRouterMCPServer`. |
| `prefix` | `/api` | Absolute API path prefix. An empty string includes all registered paths. |
| `origin` | `http://stacks-mcp.internal` | Exact HTTP(S) origin used for in-process API requests, without a trailing slash. |
| `filter(endpoint)` | Include eligible routes | Return `false` to exclude a method/path. |
| `configureTool(endpoint, tool)` | Generated tool | Return a customized tool or `false` to omit it. Runs once during discovery. |
| `requestHeaders(context, endpoint)` | Forward Authorization | Supply API credentials or other headers; accepts an async callback. |
| `maxResponseBytes` | `1048576` | Bound the API response read in UTF-8 bytes. |
| `authenticate(request)` | Required | Return the authenticated principal or a 401/403 `Response`; accepts an async callback. |

`endpoint` contains `method` and `path`; `context` contains `principal`, the MCP
`request`, and its abort `signal`. Tool `available(principal)` runs for each
discovery and call, so it can restrict visibility per authenticated caller.
Custom names must be unique across generated and additional tools.

### Troubleshooting

- **No model tools:** verify the model declares `useApi`, is selected for API
  registration, and falls under the configured `prefix`. Mount MCP before
  starting the server, then restart after changing routes or models.
- **HTTP 401/403:** the MCP credential check and the API's own authorization
  both apply. For browser clients, configure the exact `allowedOrigins`; bearer
  authentication does not bypass the origin allowlist.
- **A call returns `isError`:** inspect `structuredContent.status` and `body`
  for API validation, authorization or rate-limit failures. Transport exceptions
  use a redacted message; `onError` provides server-side diagnostics.
- **Different mount URL:** a default mount in `routes/api.ts` is `/api/mcp`,
  while a mount outside a prefixed route group is `/mcp`. `path` changes the
  endpoint URL; `prefix` selects the API routes exposed as tools.

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
