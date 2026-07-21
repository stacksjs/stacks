---
title: Code Quality
description: Check and fix TypeScript, STX, Markdown, and configuration files with Pickier.
---
# Linting

Stacks uses Pickier for code quality and formatting.

```bash
./buddy lint
./buddy lint --fix
```

Run the check before committing and keep generated files out of manual formatting passes. When a rule reports an error, fix the source rather than weakening the shared configuration.

See [Linting](/guide/linting) for editor integration and repository conventions.
