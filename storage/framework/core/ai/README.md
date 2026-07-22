# Stacks AI

This package contains a set of tools to help you build AI-powered applications.

1. Request model access from AWS: <https://us-east-1.console.aws.amazon.com/bedrock/home?region=us-east-1#/modelaccess>

2.

## ☘️ Features

- Chatbots
- Image Generation
- Text Generation & Summaries
- git Diff Interpreter
- GitHub PR integration
- UI Generator
- Zero-config

## TODO

- [ ] Driver: Bedrock

## 🤖 Usage

```bash
bun install -d @stacksjs/ai
```

You may now use:

```ts
import { useAI } from '@stacksjs/ai'

const client = useAI()
// client...
```

## Compact project context

Stacks conventions reduce the amount of application-owned code a coding model
must generate. A model can describe domain shape once, use known Model-View-Action
locations, and rely on framework traits and generators for migrations, validation,
routes, API artifacts, and types where those paths are supported. Installed
dependencies still exist, but their `node_modules` implementation is package-manager
state, not application context an LLM should ingest or reproduce.

Generate a deterministic context payload for any coding model or agent:

```bash
buddy ai:context
buddy ai:context --json
buddy ai:context --json --output .stacks/ai-context.json
buddy ai:context --max-chars 4000 --model claude-sonnet-4
```

The versioned JSON contract identifies canonical source roles, instruction files,
available application surfaces, safe package metadata, and representative source
paths. It excludes dependency, build, cache, lock, environment, credential, key,
and secret paths by default. Existing Buddy AI calls consume the same compact text
representation.

Output metrics include the enforced character budget and a heuristic token estimate.
They also compare the payload with the previous unstructured context shape. This is
evidence about prompt size only. It is not evidence that a particular model will
write correct code, and exact billing tokens require the selected provider's
tokenizer.

Learn more in the docs.

## 🧪 Testing

```bash
bun test
```

## 📈 Changelog

Please see our [releases](https://github.com/stacksjs/stacks/releases) page for more information on what has changed recently.

## 🚜 Contributing

Please review the [Contributing Guide](https://github.com/stacksjs/contributing) for details.

## 🏝 Community

For help, discussion about best practices, or any other conversation that would benefit from being searchable:

[Discussions on GitHub](https://github.com/stacksjs/stacks/discussions)

For casual chit-chat with others using this package:

[Join the Stacks Discord Server](https://discord.gg/stacksjs)

## 📄 License

The MIT License (MIT). Please see [LICENSE](https://github.com/stacksjs/stacks/tree/main/LICENSE.md) for more information.

Made with 💙
