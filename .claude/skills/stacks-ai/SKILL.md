---
name: stacks-ai
description: Use when integrating AI capabilities into a Stacks application — using Anthropic/OpenAI/Ollama/AWS Bedrock drivers, image generation (DALL-E), vision analysis, RAG/vector search, embeddings, MCP (Model Context Protocol) clients, text summarization, sentiment analysis, content classification, personalization, or the buddy AI assistant. Covers @stacksjs/ai and config/ai.ts.
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
│   └── bedrock.ts        # AWS Bedrock utilities
├── image.ts              # Image generation & vision
├── search.ts             # RAG, embeddings, vector index
├── mcp.ts                # Model Context Protocol client
├── personalization.ts    # Sentiment, classification, recommendations
├── buddy.ts              # AI coding assistant
├── claude-agent.ts       # Claude CLI agent (local & EC2)
├── claude-agent-sdk.ts   # Claude Agent SDK driver
└── text.ts               # Bedrock text summarization
```

## Anthropic Driver

```typescript
import { anthropic } from '@stacksjs/ai'

anthropic.configure({ apiKey: '...', model: 'claude-sonnet-4-20250514', maxTokens: 4096 })
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

const summary = await summarize(longText, { maxLength: 100, style: 'bullet' })

const profile = createProfile('user-123', ['tech', 'gaming'])
recordInteraction(profile, { type: 'view', itemId: 'article-1', weight: 1.0 })
const recs = await recommend(profile, contentItems, { limit: 10 })
const interests = await extractUserInterests(profile, items)
```

## Buddy AI Assistant

```typescript
import { processCommand, buddyProcessStreaming, buddyStreamSimple, getAvailableDrivers } from '@stacksjs/ai'

const drivers = getAvailableDrivers()  // ['anthropic', 'openai', 'ollama']
const context = await getRepoContext('/path/to/repo')
await processCommand('Add error handling to auth.ts', 'anthropic')
// Streaming
for await (const chunk of buddyProcessStreaming('Refactor this function', 'openai', history)) {
  process.stdout.write(chunk)
}
```

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
  default: 'meta.llama2-70b-chat-v1',
  models: ['meta.llama2-70b-chat-v1', ...],  // AWS Bedrock models
  deploy: true
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
- Bedrock utilities are for AWS-hosted model invocation
- Sentiment/classification use AI models — they're not rule-based
