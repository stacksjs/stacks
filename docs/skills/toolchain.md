---
title: "Toolchain skills"
description: "The buddy CLI, building, serving, deploying, testing and linting."
---
# Toolchain

The buddy CLI, building, serving, deploying, testing and linting.

The commands you actually run: building, serving, deploying, testing, linting and
releasing.

20 skills.

| Skill | What it is for |
|---|---|
| [Analytics](/skills/toolchain/analytics) | Privacy-friendly analytics through Fathom or a self-hosted backend, and the tracking script generation behind it. |
| [Buddy](/skills/toolchain/buddy) | The CLI in full: every command with its flags, the `make:*` scaffolding, the dev, build and deploy commands, environment management, and how to add your own commands in `app/Commands/`. |
| [Build](/skills/toolchain/build) | Building component and function libraries, CLI binaries, server images, docs and the framework core, plus the library packaging that publishes slices of `resources/` to npm. |
| [CLI](/skills/toolchain/cli) | The package you build commands *with*: argument parsing, option handling, coloured output, tables, progress indicators and prompts. |
| [Cloud](/skills/toolchain/cloud) | The AWS infrastructure: CloudFormation and CDK, server mode on EC2 behind an ALB, serverless mode on Lambda, jump boxes, Route53, S3, SES, edge computing, security groups and IAM. |
| [Deploy](/skills/toolchain/deploy) | The deploy workflow: build then deploy, the pre and post hooks, choosing server or serverless, first-time setup, and what to do when it fails. |
| [Development](/skills/toolchain/development) | The development environment: the dev server, hot reload, the reverse proxy, SSL and the day-to-day workflow. |
| [DNS](/skills/toolchain/dns) | DNS through Route53: hosted zones, records and nameserver management. |
| [Docs](/skills/toolchain/docs) | The documentation site: BunPress setup, generation, navigation and sidebar structure, and the page metadata that feeds SEO. |
| [Git](/skills/toolchain/git) | Commit conventions, hooks, changelog generation, the scope and type vocabulary, and resolving an in-progress merge or rebase conflict by intent. |
| [Lint](/skills/toolchain/lint) | Linting and formatting, which in a Stacks project means pickier and never eslint directly. |
| [Plugins](/skills/toolchain/plugins) | The preload chain: the env plugin, the framework preloader, how auto-imports reach `globalThis`, and why a given command does or does not see the framework globals. |
| [Registry](/skills/toolchain/registry) | The extension registry: framework extension metadata and package discovery. |
| [REPL](/skills/toolchain/repl) | Interactive TypeScript sessions against the running app. The fastest loop for poking at a model, a relationship or a config value. |
| [Scaffolding](/skills/toolchain/scaffolding) | The `buddy make:*` generators and the project templates behind them. |
| [Server](/skills/toolchain/server) | The server itself, in development and production: configuration, middleware and startup. |
| [Shell](/skills/toolchain/shell) | Running system commands and managing processes, wrapping Bun's native `$` operator. |
| [Testing](/skills/toolchain/testing) | The test utilities and setup: the database helpers, DynamoDB testing, feature test patterns, the CLI flags and the `bunfig.toml` preload. |
| [Tunnel](/skills/toolchain/tunnel) | Tunnels for webhook testing locally, and custom tunnels deployed to your own EC2, with event callbacks and subdomain configuration. |
| [WHOIS](/skills/toolchain/whois) | WHOIS lookups: single and batch queries, TLD server discovery, response parsing and SOCKS proxy support. |

Every page here describes one `SKILL.md` under
[`storage/framework/defaults/ai/skills`](https://github.com/stacksjs/stacks/tree/main/storage/framework/defaults/ai/skills).
See [Using skills](/skills/using) to wire them into your agent.
