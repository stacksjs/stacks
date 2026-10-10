---
title: "AI skill"
description: "Use when integrating AI capabilities into a Stacks application - using Anthropic/OpenAI/Ollama/AWS Bedrock drivers, image generation (DALL-E), vision analysis, RAG/vector search, embeddings, text-to-speech and speech-to-text, MCP (Model Context Protocol) clients, text summarization, sentiment analysis, content classification, personalization, or the buddy AI assistant. Covers @stacksjs/ai and config/ai.ts."
---
# AI

`stacks-ai` · Native Stacks · model-invoked

Use when integrating AI capabilities into a Stacks application - using Anthropic/OpenAI/Ollama/AWS Bedrock drivers, image generation (DALL-E), vision analysis, RAG/vector search, embeddings, text-to-speech and speech-to-text, MCP (Model Context Protocol) clients, text summarization, sentiment analysis, content classification, personalization, or the buddy AI assistant. Covers @stacksjs/ai and config/ai.ts.

Read the skill for the implementation workflow and its current signatures. The
[Native capabilities](/skills/platform/native) catalog maps the package to
source and retained evidence; driver limits are explicit.

## Inside the skill

- Key Paths
- Source Files
- Anthropic Driver
- OpenAI Driver
- Bedrock Driver
- Tool Calls
- Provider-Neutral Client
- Speech (Text-to-Speech, Speech-to-Text)
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
- Usage, retries and multimodal messages

## Using it

This skill is **model-invoked**. Your agent can select it for matching tasks, and you can call it directly.

```text
/stacks-ai
```

Source: [`stacks-ai/SKILL.md`](https://github.com/stacksjs/stacks/blob/main/storage/framework/defaults/ai/skills/stacks-ai/SKILL.md).

It ships in `@stacksjs/defaults` with its supporting files. Run
`buddy setup:ai` to refresh the agent setup. Override it per project with
`app/Skills/stacks-ai/SKILL.md`. See [Using skills](/skills/using).
