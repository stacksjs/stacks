---
title: Writing your own skills
description: "Add a project skill under app/Skills, with the frontmatter validateSkill() enforces, the invocation choice, and the rules that decide whether a skill actually fires."
---
# Writing your own

A project skill is a directory under `app/Skills/` with a `SKILL.md` in it. That
is the whole mechanism. Create the file and it is live, because `listSkills()`
reads the directory rather than a registry.

```
app/Skills/
└── acme-billing/
    ├── SKILL.md
    ├── EXAMPLES.md          reference the skill points at
    └── scripts/
        └── reconcile.sh
```

Then re-run `buddy setup:ai <agent>` to link it into your agent's directory, and
add a row to the feature-to-skill table in `AGENTS.md` so a human can find it
too.

Before you write anything, read
[Writing for agents](/skills/craft/writing-for-agents). This page is the
mechanics; that skill is the craft, and it is the difference between a skill
that fires and one that sits in the directory unread.

## Frontmatter

```yaml
---
name: acme-billing
description: Use when working with Acme billing - creating a subscription, reconciling an invoice, handling a dunning webhook, or reading the ledger. Covers app/Actions/Billing and config/payment.ts.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---
```

`validateSkill()` enforces four rules, and the framework's own test suite runs it
over every bundled skill, so a broken one fails CI:

- `name` is required, 1 to 64 characters, lowercase letters, numbers and hyphens.
- `name` must equal the directory name.
- `description` is required and at most 1024 characters.

Two more the validator does not catch but the parsers do:

- **Keep `: ` out of the description.** The frontmatter parser splits each line
  on its first colon and takes the rest verbatim, and a bare `: ` inside an
  unquoted YAML scalar is invalid YAML besides. Use a hyphen or a comma.
- **Keep the em-dash out of everything.** The project-wide rule in `AGENTS.md`
  applies to skills as much as to UI copy.

Optional fields: `disable-model-invocation`, `user-invocable`, `argument-hint`,
`context`, `agent`, `model`, `effort`, and a free-form `metadata` map.

## Write the description last, and hardest

The description is the skill's only trigger. It sits in the agent's context every
turn whether or not it fires, so every word is paid for on every turn, and the
wording decides how reliably the skill is reached. A perfect skill body behind a
vague description is a skill that never runs.

The bundled set follows one shape, and yours should too:

```
Use when <situation> - <branch>, <branch>, <branch>. Covers <package> and <config file>.
```

- **Front-load the trigger.** The first few words do the work.
- **One trigger per branch.** Synonyms that rename a single case are one branch
  written twice.
- **Keep the `Covers` clause.** It is how an agent holding a package name or a
  file path finds the skill that owns it.
- **Cut identity the body already carries.** The description does not need to
  explain what a queue is.

## Choose an invocation

**Model-invoked** is the default and the right choice for anything an agent
should find on its own. Omit `disable-model-invocation` and write the
model-facing description above. Other skills can also reach it, which makes a
model-invoked reference skill the one good home for vocabulary several skills
share.

**User-invoked** strips the description from the agent's reach entirely. Zero
context load, but you become the index that has to remember it exists. Set
`disable-model-invocation: true` and rewrite the `description` for a human: a
one-line summary with the trigger list stripped.

```yaml
---
name: acme-release
description: Cut an Acme release and publish it.
disable-model-invocation: true
argument-hint: "Which package?"
---
```

Pick model-invocation only when the agent must reach the skill on its own, or
another skill must. If it only ever fires by hand, make it user-invoked and pay
no context load.

## Supporting files

`getSkill()` reports three well-known subdirectories beside `SKILL.md`:

| Directory | For |
|---|---|
| `scripts/` | runnable helpers the skill invokes |
| `references/` | disclosed reference the body points at |
| `assets/` | templates, images, fixtures |

A plain sibling `.md` file works too, and is the lightest form of progressive
disclosure. [Technical diagrams](/skills/design/technical-diagrams) keeps three
dozen of them behind one `SKILL.md`; the main file stays legible and each
reference loads only when its pointer fires.

Push a section out into a sibling file when only *some* runs need it. Keep
inline what *every* run needs.

## Shadow a bundled skill

Reuse the bundled name and yours wins:

```bash
mkdir -p app/Skills/stacks-auth
cp storage/framework/defaults/ai/skills/stacks-auth/SKILL.md app/Skills/stacks-auth/
```

Now every agent in the repo reads your version. This is the right move when your
project genuinely differs from the framework default, and a much better one than
adding a contradicting paragraph to `AGENTS.md` and hoping the agent weighs it
correctly.

## Before you commit it

- Every line changes behaviour versus the model's default. Delete the rest.
- Every meaning lives in exactly one place.
- Nothing restates what `buddy <command> --help` or a config file already says.
  The environment is a source of truth and it cannot go stale.
- The description names distinct branches and front-loads the trigger.
- `./buddy lint` is clean. Markdown is linted too.
