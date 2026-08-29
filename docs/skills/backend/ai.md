---
title: "AI skill"
description: "Use when integrating AI capabilities into a Stacks application."
---
# AI

`stacks-ai` · Backend and API · model-invoked

The AI layer: Anthropic, OpenAI, Ollama and AWS Bedrock drivers, image generation,
vision, RAG and embeddings, MCP clients, and the higher-level helpers for
summarization, sentiment and classification.

## When to reach for it

- Using Anthropic/OpenAI/Ollama/AWS Bedrock drivers
- Image generation (DALL-E)
- Vision analysis
- RAG/vector search
- Embeddings
- MCP (Model Context Protocol) clients
- Text summarization
- Sentiment analysis
- Content classification
- Personalization
- The buddy AI assistant

## Covers

`@stacksjs/ai`, `config/ai.ts`.

## Inside the skill

The sections an agent reads once the skill loads.

- Key Paths
- Source Files
- Anthropic Driver
- OpenAI Driver
- Provider-Neutral Client
- Ollama Driver (Local LLMs)
- Image Generation
- RAG & Vector Search
- MCP (Model Context Protocol)
- Personalization
- Buddy AI Assistant
- Compact Project Context
- Claude Agent
- Claude Agent SDK
- config/ai.ts
- Gotchas

## Where the code lives

- Core package: `storage/framework/core/ai/src/`
- Configuration: `config/ai.ts`

## Using it

This one is **model-invoked**. Your agent reaches for it on its own when the task
matches, and you can also call it by name:

```
/stacks-ai
```

Source: [`stacks-ai/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-ai/SKILL.md).
Shadow it for one project with `app/Skills/stacks-ai/SKILL.md`, then re-run
`buddy setup:ai`. See [Writing your own](/skills/writing).
