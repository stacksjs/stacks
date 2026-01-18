# AI Package

An AI integration package providing unified access to multiple AI providers including Anthropic (Claude), OpenAI, Ollama, and AWS Bedrock.

## Installation

```bash
bun add @stacksjs/ai
```

## Basic Usage

```typescript
import { anthropic, openai, ollama } from '@stacksjs/ai'

// Using Anthropic Claude
const response = await anthropic.chat({
  messages: [{ role: 'user', content: 'Hello, Claude!' }]
})

// Using OpenAI
const gptResponse = await openai.chat({
  messages: [{ role: 'user', content: 'Hello, GPT!' }]
})

// Using Ollama (local models)
const localResponse = await ollama.chat({
  model: 'llama2',
  messages: [{ role: 'user', content: 'Hello, Llama!' }]
})
```

## Configuration

Configure AI providers in `config/ai.ts`:

```typescript
export default {
  // Default AI provider
  default: 'anthropic',

  // Anthropic configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: 'claude-3-opus-20240229',
    maxTokens: 4096,
  },

  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4-turbo-preview',
    maxTokens: 4096,
    organization: process.env.OPENAI_ORG_ID,
  },

  // Ollama configuration (local)
  ollama: {
    host: 'http://localhost:11434',
    model: 'llama2',
  },

  // AWS Bedrock configuration
  bedrock: {
    region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    model: 'anthropic.claude-3-sonnet-20240229-v1:0',
  },
}
```

## Anthropic (Claude)

### Basic Chat

```typescript
import { anthropic } from '@stacksjs/ai'

const response = await anthropic.chat({
  model: 'claude-3-opus-20240229',
  messages: [
    { role: 'user', content: 'Explain quantum computing in simple terms.' }
  ],
  maxTokens: 1024,
})

console.log(response.content)
```

### Streaming Responses

```typescript
import { anthropic } from '@stacksjs/ai'

const stream = await anthropic.stream({
  model: 'claude-3-sonnet-20240229',
  messages: [
    { role: 'user', content: 'Write a short story about a robot.' }
  ],
})

for await (const chunk of stream) {
  process.stdout.write(chunk.content || '')
}
```

### System Prompts

```typescript
import { anthropic } from '@stacksjs/ai'

const response = await anthropic.chat({
  model: 'claude-3-opus-20240229',
  system: 'You are a helpful coding assistant. Provide concise, accurate answers.',
  messages: [
    { role: 'user', content: 'How do I sort an array in TypeScript?' }
  ],
})
```

### Multi-turn Conversations

```typescript
import { anthropic } from '@stacksjs/ai'

const conversation = [
  { role: 'user', content: 'What is the capital of France?' },
  { role: 'assistant', content: 'The capital of France is Paris.' },
  { role: 'user', content: 'What is its population?' }
]

const response = await anthropic.chat({
  messages: conversation,
})
// Claude knows "its" refers to Paris from context
```

### Vision (Image Analysis)

```typescript
import { anthropic } from '@stacksjs/ai'
import { readFile } from 'node:fs/promises'

const imageData = await readFile('image.png')
const base64Image = imageData.toString('base64')

const response = await anthropic.chat({
  model: 'claude-3-opus-20240229',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: base64Image,
          },
        },
        {
          type: 'text',
          text: 'What do you see in this image?',
        },
      ],
    },
  ],
})
```

## OpenAI

### Basic Chat

```typescript
import { openai } from '@stacksjs/ai'

const response = await openai.chat({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'What is the meaning of life?' }
  ],
})

console.log(response.choices[0].message.content)
```

### Streaming

```typescript
import { openai } from '@stacksjs/ai'

const stream = await openai.stream({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'user', content: 'Tell me a joke.' }
  ],
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) process.stdout.write(content)
}
```

### Function Calling

```typescript
import { openai } from '@stacksjs/ai'

const response = await openai.chat({
  model: 'gpt-4-turbo-preview',
  messages: [
    { role: 'user', content: 'What is the weather in San Francisco?' }
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'get_weather',
        description: 'Get the current weather in a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA',
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
            },
          },
          required: ['location'],
        },
      },
    },
  ],
})

// Handle function call
if (response.choices[0].message.tool_calls) {
  const toolCall = response.choices[0].message.tool_calls[0]
  const args = JSON.parse(toolCall.function.arguments)

  // Call your weather API
  const weather = await getWeather(args.location, args.unit)

  // Continue conversation with function result
  const followUp = await openai.chat({
    model: 'gpt-4-turbo-preview',
    messages: [
      ...messages,
      response.choices[0].message,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(weather),
      },
    ],
  })
}
```

### Embeddings

```typescript
import { openai } from '@stacksjs/ai'

const embedding = await openai.embed({
  model: 'text-embedding-3-small',
  input: 'The quick brown fox jumps over the lazy dog.',
})

console.log(embedding.data[0].embedding) // Vector of floats
```

## Ollama (Local Models)

### Basic Chat

```typescript
import { ollama } from '@stacksjs/ai'

const response = await ollama.chat({
  model: 'llama2',
  messages: [
    { role: 'user', content: 'Hello! How are you?' }
  ],
})

console.log(response.message.content)
```

### Available Models

```typescript
import { ollama } from '@stacksjs/ai'

// List installed models
const models = await ollama.list()
console.log(models)

// Pull a new model
await ollama.pull('mistral')

// Use specific model
const response = await ollama.chat({
  model: 'codellama',
  messages: [
    { role: 'user', content: 'Write a Python function to reverse a string.' }
  ],
})
```

### Streaming with Ollama

```typescript
import { ollama } from '@stacksjs/ai'

const stream = await ollama.stream({
  model: 'llama2',
  messages: [
    { role: 'user', content: 'Explain machine learning.' }
  ],
})

for await (const chunk of stream) {
  process.stdout.write(chunk.message?.content || '')
}
```

## AWS Bedrock

### Using Bedrock Client

```typescript
import {
  createBedrockClient,
  createBedrockRuntimeClient,
  invokeModel,
  checkModelAccess
} from '@stacksjs/ai'

// Create Bedrock client
const client = createBedrockClient({
  region: 'us-east-1',
})

// Check model access
const hasAccess = await checkModelAccess(client, 'anthropic.claude-3-sonnet-20240229-v1:0')

// Create runtime client
const runtimeClient = createBedrockRuntimeClient({
  region: 'us-east-1',
})

// Invoke model
const response = await invokeModel(runtimeClient, {
  modelId: 'anthropic.claude-3-sonnet-20240229-v1:0',
  body: JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: 'Hello!' }
    ],
  }),
})
```

## AI Agents

### Creating Agents

```typescript
import { createAgent } from '@stacksjs/ai'

const agent = createAgent({
  name: 'ResearchAssistant',
  model: 'claude-3-opus-20240229',
  systemPrompt: `You are a research assistant. You help users find and summarize information.
    You have access to web search and can analyze documents.`,
  tools: [
    {
      name: 'web_search',
      description: 'Search the web for information',
      execute: async (query: string) => {
        // Implement web search
        return searchResults
      },
    },
    {
      name: 'read_document',
      description: 'Read and analyze a document',
      execute: async (path: string) => {
        // Read document
        return documentContent
      },
    },
  ],
})

const result = await agent.run('Research the latest AI developments in 2024')
```

### Agent Memory

```typescript
import { createAgent, MemoryStore } from '@stacksjs/ai'

const memory = new MemoryStore()

const agent = createAgent({
  name: 'PersonalAssistant',
  model: 'claude-3-sonnet-20240229',
  memory,
})

// Agent remembers previous conversations
await agent.run('My name is John')
await agent.run('What is my name?') // Remembers "John"
```

## Buddy - Voice AI Assistant

### Using Buddy

```typescript
import { Buddy, createBuddy } from '@stacksjs/ai'

// Create Buddy instance
const buddy = createBuddy({
  name: 'CodeAssistant',
  voice: {
    enabled: true,
    model: 'whisper-1',
  },
})

// Voice input
const transcription = await buddy.listen()

// Process and respond
const response = await buddy.respond(transcription)

// Text-to-speech output
await buddy.speak(response)
```

## Text Utilities

### Text Generation

```typescript
import { generateText, summarize, translate } from '@stacksjs/ai'

// Generate text
const generated = await generateText({
  prompt: 'Write a product description for a smart watch',
  maxTokens: 200,
})

// Summarize text
const summary = await summarize({
  text: longArticle,
  maxLength: 100,
})

// Translate text
const translated = await translate({
  text: 'Hello, how are you?',
  from: 'en',
  to: 'es',
})
```

### Sentiment Analysis

```typescript
import { analyzeSentiment } from '@stacksjs/ai'

const sentiment = await analyzeSentiment(
  'I absolutely love this product! It exceeded all my expectations.'
)
// Returns: { sentiment: 'positive', score: 0.95 }
```

## Error Handling

```typescript
import { anthropic } from '@stacksjs/ai'

try {
  const response = await anthropic.chat({
    messages: [{ role: 'user', content: 'Hello' }],
  })
} catch (error) {
  if (error.status === 429) {
    // Rate limited
    console.log('Too many requests, waiting...')
    await delay(error.headers['retry-after'] * 1000)
  } else if (error.status === 401) {
    // Invalid API key
    console.error('Invalid API key')
  } else if (error.status === 500) {
    // Server error
    console.error('AI provider error')
  }
}
```

## Edge Cases

### Handling Long Conversations

```typescript
import { anthropic } from '@stacksjs/ai'

// Truncate or summarize old messages to stay within token limits
function trimConversation(messages: Message[], maxTokens: number) {
  // Keep system message and recent messages
  const systemMessage = messages.find(m => m.role === 'system')
  const recentMessages = messages.slice(-10)

  return systemMessage
    ? [systemMessage, ...recentMessages]
    : recentMessages
}

const trimmedMessages = trimConversation(conversation, 4096)
const response = await anthropic.chat({ messages: trimmedMessages })
```

### Retrying Failed Requests

```typescript
import { anthropic } from '@stacksjs/ai'

async function chatWithRetry(
  messages: Message[],
  maxRetries = 3
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await anthropic.chat({ messages })
    } catch (error) {
      if (attempt === maxRetries) throw error

      const delay = Math.pow(2, attempt) * 1000 // Exponential backoff
      await new Promise(r => setTimeout(r, delay))
    }
  }
}
```

### Timeout Handling

```typescript
import { anthropic } from '@stacksjs/ai'

const controller = new AbortController()
const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout

try {
  const response = await anthropic.chat({
    messages: [{ role: 'user', content: 'Complex question...' }],
    signal: controller.signal,
  })
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Request timed out')
  }
} finally {
  clearTimeout(timeoutId)
}
```

## API Reference

### Provider Functions

| Function | Description |
|----------|-------------|
| `anthropic.chat(options)` | Chat with Claude |
| `anthropic.stream(options)` | Stream Claude response |
| `openai.chat(options)` | Chat with GPT |
| `openai.stream(options)` | Stream GPT response |
| `openai.embed(options)` | Generate embeddings |
| `ollama.chat(options)` | Chat with local model |
| `ollama.stream(options)` | Stream local model |
| `ollama.list()` | List installed models |
| `ollama.pull(model)` | Download model |

### Bedrock Functions

| Function | Description |
|----------|-------------|
| `createBedrockClient(config)` | Create Bedrock client |
| `createBedrockRuntimeClient(config)` | Create runtime client |
| `invokeModel(client, params)` | Invoke model |
| `checkModelAccess(client, modelId)` | Check access |

### Text Utilities

| Function | Description |
|----------|-------------|
| `generateText(options)` | Generate text |
| `summarize(options)` | Summarize text |
| `translate(options)` | Translate text |
| `analyzeSentiment(text)` | Analyze sentiment |
