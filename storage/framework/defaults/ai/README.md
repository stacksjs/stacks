# AI agent defaults

Templates that `buddy setup:ai` uses to wire a project up for whichever AI coding
agent you use. Nothing here is read at runtime - it is scaffolding, in the same
spirit as `storage/framework/defaults/ide/`.

```
ai/
├── AGENTS.md          starter guidance, copied to the project root if absent
├── claude/
│   └── launch.json    Claude Code run configurations, copied to .claude/
└── skills/            the framework's agent skills (agentskills.io format)
```

## Why the generated directories are not committed

`AGENTS.md` is the one file every agent reads, so it lives in the project root
and is committed - it is shared guidance, and it belongs in review.

Everything else is per-developer. Which agent you use is a personal choice, so
`.claude/`, `.codex/`, `.cursor/`, `.gemini/` and
`.github/copilot-instructions.md` are gitignored and generated on demand:

```sh
buddy setup:ai                  # pick an agent interactively
buddy setup:ai claude           # or name it
buddy setup:ai claude --copy    # copy the skills instead of symlinking them
```

## Skills

`skills/` holds the framework's agent skills, one directory per skill, each with
a `SKILL.md` carrying `name` and `description` frontmatter. They document the
framework subsystem by subsystem, so an agent can read the authoritative
reference for a task instead of guessing at an API.

`buddy setup:ai` writes one entry per skill into the agent's directory, and
symlinks by default so skills stay in sync when you upgrade the framework. Pass
`--copy` if you would rather edit them per project.

To add a project-specific skill, or to shadow a bundled one, create
`app/Skills/<name>/SKILL.md`. `@stacksjs/skills` searches `app/Skills` first and
falls back to this directory - the same app-overrides-defaults model the rest of
the framework uses - and `setup:ai` links the winner, so a project skill also
wins in the agent's directory.
