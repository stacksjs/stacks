---
name: stacks-ai
description: Use when integrating AI capabilities into a Stacks application - using Anthropic/OpenAI/Ollama/AWS Bedrock drivers, image generation (DALL-E), vision analysis, RAG/vector search, embeddings, text-to-speech and speech-to-text, MCP (Model Context Protocol) clients, text summarization, sentiment analysis, content classification, personalization, or the buddy AI assistant. Covers @stacksjs/ai and config/ai.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks AI

Comprehensive AI/LLM integration with 4 provider drivers, image generation, vision, RAG, MCP support, and personalization.

## Key Paths
- Core package: `storage/framework/core/ai/src/`
- Configuration: `config/ai.ts`

## Source Files
```
ai/src/
├── drivers/
│   ├── anthropic.ts      # Claude driver
│   ├── openai.ts         # GPT + DALL-E + Whisper + TTS
│   ├── ollama.ts         # Local LLM driver
│   └── bedrock/          # Amazon Bedrock, through the Converse API
├── image.ts              # Image generation & vision
├── speech.ts             # Provider-neutral text-to-speech & speech-to-text
├── search.ts             # RAG, embeddings, vector index
├── mcp.ts                # Model Context Protocol client
├── personalization.ts    # Sentiment, classification, recommendations
├── buddy.ts              # AI coding assistant
├── claude-agent.ts       # Claude CLI agent (local & EC2)
├── claude-agent-sdk.ts   # Claude Agent SDK driver
└── text.ts               # ask() / summarize(), on the Bedrock driver
```

## Anthropic Driver

```typescript
import { anthropic } from '@stacksjs/ai'

anthropic.configure({ apiKey: '...', model: 'claude-sonnet-5-5', maxTokens: 4096 })
const result = await anthropic.chat([{ role: 'user', content: 'Hello' }])
const stream = await anthropic.streamChat(messages, options)
const response = await anthropic.prompt('Summarize this text...')
const tokens = anthropic.estimateTokens(text)
```

## OpenAI Driver

```typescript
import { openai } from '@stacksjs/ai'

openai.configure({ apiKey: '...', model: 'gpt-4o', embeddingModel: 'text-embedding-3-small' })
const result = await openai.chat(messages, { temperature: 0.7 })
const stream = await openai.streamChat(messages)
const embeddings = await openai.embed('text to embed')
const image = await openai.generateImage('a sunset over mountains')
const transcription = await openai.transcribe(audioFile)
const speech = await openai.textToSpeech('Hello world')
```

## Bedrock Driver

```typescript
import { bedrock } from '@stacksjs/ai'

bedrock.configure({ model: 'global.anthropic.claude-sonnet-5-5', region: 'us-east-1' })
const result = await bedrock.chat([{ role: 'user', content: 'Hello' }], { system: 'Be brief.' })
```

- Every request goes through Bedrock's Converse API, so one shape serves Nova,
  Claude and Llama; the model is configuration. No streaming yet.
- Credentials come from the AWS credential chain, never config. Region:
  `drivers.bedrock.region`, `AWS_REGION`, `AWS_DEFAULT_REGION`, us-east-1.
- Default model `amazon.nova-lite-v1:0`: on demand, no profile, no agreement.
- Claude and the newer Nova/Llama models are invoked by **inference profile**
  id (`global.anthropic.claude-sonnet-5-5`, `us.meta.llama4-...`). The bare
  `anthropic.claude-...` id is refused by Bedrock. `bedrockModels` in
  `@stacksjs/types` lists the ids Bedrock serves, each in invocable form.
- `buddy ai:access` (or `requestModelAccess()`) makes the models in
  `config/ai.ts` invocable and reports each one.

## Tool Calls

```typescript
import { assistantTurn, toolResultsTurn } from '@stacksjs/ai'

const result = await client.generate(messages, { tools })
// result.toolCalls: [{ id, name, arguments }] - same shape from every driver
messages.push(assistantTurn(result), toolResultsTurn(
  result.toolCalls!.map(call => ({ toolCallId: call.id, name: call.name, content: run(call) })),
))
```

- `content` is the model's text, `''` when it only called tools.
- The `responseFormat` structured-output tool is internal: its JSON is
  `content`, never a tool call.
- Ollama refuses `toolChoice: 'required'` / `{ name }`; it cannot force a call.
- `streamChat()` streams text only.

## Provider-Neutral Client

Use the config-driven client for application features that can run against
Anthropic, OpenAI, Ollama, or Bedrock. `default` is a provider name or a model
id that implies one: `claude-...` Anthropic, `gpt-...` OpenAI, any Bedrock
model or profile id (`amazon.nova-lite-v1:0`, `global.anthropic.claude-...`)
Bedrock. Configuration inspection is safe to return from a
status endpoint because it never includes credentials.

```typescript
import { createAIClient, getAIProviderConfiguration } from '@stacksjs/ai'
import aiConfig from './config/ai'

const configuration = getAIProviderConfiguration(aiConfig)
// { provider: 'openai', model: 'gpt-4o-mini', configured: true, source: 'environment' }

if (configuration.configured) {
  const client = createAIClient(aiConfig)
  const result = await client.generate([{ role: 'user', content: 'Draft a launch plan.' }])
}
```

## Speech (Text-to-Speech, Speech-to-Text)

Provider-neutral, in `ai/src/speech.ts`. The driver is the `driver` option, else
`default` from `config/ai.ts`. Only `openai` implements speech (`SPEECH_DRIVERS`);
any other driver throws naming itself and the supported ones - do not catch that
and fall back to a different provider.

```typescript
import { speechToText, storeSpeech, textToSpeech } from '@stacksjs/ai'

const speech = await textToSpeech('Hello', { voice: 'nova', format: 'mp3', speed: 1.1 })
// { audio: Uint8Array, mimeType: 'audio/mpeg', format, driver, model, voice }
await storeSpeech(speech, 'audio/hello.mp3', { disk: 'public' }) // disk name or adapter
const { text } = await speechToText(Bun.file('memo.m4a'), { language: 'en' })
```

Defaults: model `gpt-4o-mini-tts`, voice `alloy`, format `mp3`, speed omitted
(provider default 1.0); transcription model `whisper-1`. `instructions` is
rejected for `tts-1` / `tts-1-hd`. OpenAI caps input at 4096 characters per
request. HTTP failures throw with the status and a body snippet. In tests, mock
`globalThis.fetch` and pass `config` explicitly (see `ai/tests/speech.test.ts`).

## Ollama Driver (Local LLMs)

```typescript
import { ollama } from '@stacksjs/ai'

ollama.configure({ host: 'http://localhost:11434', model: 'llama3' })
const result = await ollama.chat(messages)
const stream = await ollama.streamChat(messages)
const text = await ollama.generate('Write a poem')
const embeddings = await ollama.embed('text')
const models = await ollama.listModels()
await ollama.pullModel('llama3', (progress) => console.log(progress))
await ollama.deleteModel('old-model')
const info = await ollama.showModel('llama3')
const running = await ollama.isRunning()
```

## Image Generation

```typescript
import { generateImage, editImage, createImageVariation, analyzeImage, analyzeImages } from '@stacksjs/ai'

// Generate (DALL-E 3)
const result = await generateImage('a cat in space', {
  model: 'dall-e-3', size: '1024x1024', quality: 'hd', style: 'vivid', n: 1
})

// Edit (DALL-E 2)
await editImage(imageInput, 'add a hat', { mask: maskInput })

// Variations
await createImageVariation(imageInput, { n: 3 })

// Vision (GPT-4 Vision / Claude)
const analysis = await analyzeImage({ url: 'https://...' }, 'What is in this image?')
const multiAnalysis = await analyzeImages([img1, img2], 'Compare these')
```

Image inputs: `{ url: string }`, `{ base64: string }`, `{ file: string }` (auto-converted)

## RAG & Vector Search

```typescript
import { createEmbedding, rag, VectorIndex, chunkText, indexText } from '@stacksjs/ai'

// Create embeddings
const embedding = await createEmbedding('text to embed')

// Vector similarity
cosineSimilarity(vecA, vecB)
dotProduct(vecA, vecB)
euclideanDistance(vecA, vecB)

// Text chunking
const chunks = chunkText(longText, { chunkSize: 500, overlap: 50 })

// Build index
const index = await indexText(text, { chunkSize: 500 })

// RAG query
const answer = await rag('What is X?', index, { model: 'claude-sonnet-4-20250514', maxTokens: 1000 })

// VectorIndex class
const idx = new VectorIndex({ dimensions: 1536 })
await idx.add([{ id: '1', content: 'Hello', metadata: {} }])
const results = await idx.search('greeting', 5)
const results2 = await idx.searchByVector(queryEmbedding, 5)
idx.remove('1')
idx.clear()
idx.size      // number of documents
idx.ids       // all document IDs
```

## MCP (Model Context Protocol)

```typescript
import { MCPClient, MCPManager, connectStdio, connectHTTP } from '@stacksjs/ai'

// Single server
const client = new MCPClient({ name: 'my-server', transport: 'stdio', command: 'npx', args: ['my-mcp-server'] })
await client.connect()
const tools = await client.listTools()
const resources = await client.listResources()
const prompts = await client.listPrompts()
const result = await client.callTool('tool-name', { arg: 'value' })
const resource = await client.readResource('resource://path')
const prompt = await client.getPrompt('prompt-name', { arg: 'value' })
const anthropicTools = client.toAnthropicTools()
const openaiTools = client.toOpenAITools()

// Multiple servers
const manager = new MCPManager()
manager.addServer({ name: 'server1', transport: 'stdio', command: '...' })
manager.addServer({ name: 'server2', transport: 'streamable-http', url: '...' })
const allTools = await manager.getAllTools()
await manager.callTool('server1/tool-name', args)
await manager.disconnectAll()

// Convenience functions
const client = await connectStdio('name', 'command', ['args'])
const client = await connectHTTP('name', 'https://server.com', headers)
```

Transport types: `'stdio'` | `'sse'` | `'streamable-http'`

## Personalization

```typescript
import { analyzeSentiment, classifyText, summarize, recommend, createProfile } from '@stacksjs/ai'

const sentiment = await analyzeSentiment('I love this product!')
// { sentiment: 'positive', score: 0.95, confidence: 0.98, aspects: [...] }

const classification = await classifyText('Fix the login bug', ['bug', 'feature', 'question'])
// { label: 'bug', confidence: 0.92, allLabels: [...] }

const summary = await summarize(longText, { maxTokenCount: 100 })

const profile = createProfile('user-123', ['tech', 'gaming'])
recordInteraction(profile, { type: 'view', itemId: 'article-1', weight: 1.0 })
const recs = await recommend(profile, contentItems, { limit: 10 })
const interests = await extractUserInterests(profile, items)
```

## Buddy AI Assistant

```typescript
import { processCommand, buddyProcessStreaming, buddyStreamSimple, getAvailableDrivers } from '@stacksjs/ai'

const drivers = getAvailableDrivers()  // ['claude-cli-local', 'claude-cli-ec2', 'claude', 'claude-sdk', 'openai', 'ollama', 'mock']
const context = await getRepoContext('/path/to/repo')
await processCommand('Add error handling to auth.ts', 'anthropic')
// Streaming
for await (const chunk of buddyProcessStreaming('Refactor this function', 'openai', history)) {
  process.stdout.write(chunk)
}
```

## Compact Project Context

Use the native context contract instead of sending dependency internals, lockfiles,
or an arbitrary repository dump to a coding model:

```bash
buddy ai:context
buddy ai:context --json
buddy ai:context --json --output storage/framework/runtime/ai-context.json
buddy ai:context --max-chars 4000 --model claude-sonnet-4
```

Programmatic callers use `buildProjectContext(projectRoot, options)`. Existing
`getRepoContext(projectRoot)` calls return its compact text payload. The contract
is deterministic, reports a heuristic token estimate, and describes canonical
Model-View-Action roles, application overrides, instruction files, scripts,
dependency names, and representative application files. It excludes
`node_modules`, build output, caches, lockfiles, environment files, credentials,
private keys, and secret files by default.

The character budget applies to the prompt payload. JSON adds a versioned metadata
envelope for tools. Token estimates are planning heuristics, not provider billing
counts or evidence that model output is correct.

## Claude Agent

```typescript
import { createClaudeLocalAgent, createClaudeEC2Agent } from '@stacksjs/ai'

const agent = createClaudeLocalAgent({ cwd: '/project' })
for await (const chunk of agent.processCommandStreaming('Fix the tests')) {
  process.stdout.write(chunk)
}

// Remote EC2 agent
const remoteAgent = createClaudeEC2Agent({ ec2Host: '...', ec2User: '...', ec2Key: '...' })
```

## Claude Agent SDK

```typescript
import { createClaudeAgentSDKDriver } from '@stacksjs/ai'

const driver = createClaudeAgentSDKDriver({
  maxTurns: 10, cwd: '/project', permissionMode: 'auto',
  allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
  customSystemPrompt: 'You are a Stacks expert'
})

for await (const chunk of driver.processStreaming('Build a user registration flow')) {
  process.stdout.write(chunk)
}
const sessionId = driver.getLastSessionId()
await driver.resumeSession(sessionId, 'Add validation')
```

## config/ai.ts

```typescript
{
  default: 'anthropic',                       // or 'openai', 'ollama', 'bedrock', a model id
  models: ['amazon.nova-lite-v1:0'],          // Bedrock models `buddy ai:access` enables
  deploy: false,
  drivers: {
    anthropic: { model: 'claude-sonnet-5-5' },
    bedrock: { model: 'global.anthropic.claude-sonnet-5-5' },
  },
}
```

## Gotchas
- API keys should be in `.env` — `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- Ollama requires a local server running on port 11434
- Image generation uses OpenAI DALL-E by default
- Vision supports both GPT-4V and Claude models
- VectorIndex is in-memory — not persisted between restarts
- RAG combines chunking + embedding + vector search + LLM generation
- MCP supports stdio (subprocess), SSE, and HTTP transports
- The buddy assistant has git integration (commit, push, apply changes)
- Claude Agent SDK wraps the Claude Code CLI for agentic workflows
- A Bedrock id as `default` selects the Bedrock driver; it never reaches api.anthropic.com
- Sentiment/classification use AI models — they're not rule-based
