---
name: stacks-wizard
description: Use when a procedure needs a human in the loop and the agent has hit a wall it cannot pass alone - provisioning cloud credentials, verifying a sending domain, setting CI secrets, clicking through a registrar or third-party dashboard, or running a one-off cutover. Generates an interactive bash wizard that opens each URL, captures each value, and writes it into .env and GitHub secrets.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript, bash
allowed-tools: Read Edit Write Bash Grep Glob
---

# Wizard

A **wizard** is a bash script that walks a human, step by step, through a manual
procedure that is tedious to do by hand and tedious to re-explain to an agent
every time. It opens each URL, says exactly what to click and copy, captures the
values, writes them where they belong, confirms before anything irreversible, and
shows how many stages are left.

The UX is already solved by [scripts/template.sh](scripts/template.sh):
stage-by-stage progress, confirmation gates, cross-platform URL opening including
WSL, hidden entry for secrets, idempotent `.env` upserts, `gh secret` and
`gh variable` writes, and a closing summary. **Your job is only to scope the
procedure and author its stages.** Everything above the `STAGES` marker is
identical in every wizard, and that consistency is the point. Never hand-edit it.

A wizard is ephemeral by default: built for one run, saved to a scratch path or
`scripts/`, deleted when the job is done. Commit it only when the user wants a
repeatable setup path that should live in the repo.

Credit: adapted from Matt Pocock's `wizard` skill (MIT),
<https://github.com/mattpocock/skills>. The template library is his, unchanged
except for the example stage.

## When this is the right tool

Reach for it the moment you hit a step only the human can take. In a Stacks
project that is a short and predictable list:

- **AWS access** for `buddy deploy` and `buddy cloud`, and the IAM permissions
  behind them.
- **Domains and DNS**: `buddy domains:purchase`, registrar nameserver changes,
  the delegation that has to happen at the registrar rather than in Route53.
- **Email**: SES domain verification, DKIM records, moving out of the sandbox,
  the port 25 request.
- **CI secrets**: every `secrets.*` and `vars.*` reference in
  `.github/workflows/*` is a value the wizard should produce.
- **Server provisioning**: a Hetzner or other provider token, an SSH key added to
  the account, the first-boot steps.
- **Payments**: Stripe keys and webhook endpoints.

If the agent could just do it itself, it should. This is for where a human is
genuinely in the loop.

## Process

### 1. Scope the procedure

Work out every manual step the human must take and every value captured along the
way. Read the repo first, do not ask cold:

- `.env`, `.env.example`, `.env.*`, and `config/services.ts` for what the app
  already expects.
- `config/cloud.ts`, `config/dns.ts`, `config/email.ts` for what the deploy
  targets.
- `.github/workflows/*` for every secret and variable CI reads.
- The relevant skill (`stacks-deploy`, `stacks-cloud`, `stacks-dns`,
  `stacks-email`) for which steps the CLI already automates, so the wizard covers
  only the gap.

Then show the user the ordered list of stages and the values each produces, and
confirm. They may add, drop or reorder.

**Done when** every stage is named in order, and for each captured value you know
(a) where the human gets it, (b) where it is written (`.env`, a GitHub secret,
both, or nowhere, since some stages are pure actions), and (c) whether it is
secret and so needs hidden entry.

### 2. Map each stage's journey

For each stage, write the precise path a human follows: which URL to open, what
to do there, where the value is shown, which variable it fills. For example
"Route53 console, Hosted zones, pick the domain, copy the four NS records".

Where you do not know the current UI or the exact command, say so and ask the
user or check the docs. Never invent steps that may not exist.

**Done when** every stage traces to concrete instructions a stranger could
follow.

### 3. Author the wizard

Copy `scripts/template.sh` to the target path. Replace the example stage with one
`stage` per step, in dependency order. Set `TOTAL_STAGES` to the number you
wrote. Use the library helpers: `stage`, `say`, `step`, `note`, `warn`,
`open_url`, `ask`, `ask_secret`, `write_env`, `set_secret`, `set_var`, `pause`,
`confirm`.

Hold the bar the template sets:

- Open the URL before asking for its value.
- `ask_secret` for anything secret.
- `write_env` every persisted value.
- `set_secret` only the values CI actually needs.
- `confirm` before anything irreversible.
- One focused task per `stage`, because each stage clears the screen and anything
  the human still needs must not have scrolled away.

In a Stacks project, finish with a stage that encrypts what you just wrote:
`./buddy env:encrypt`, and for a production file the matching
`buddy env:keypair` / `buddy env:rotate` step. A wizard that leaves plaintext
credentials in `.env.production` has done half a job. `buddy env:check` is the
verification line for the closing stage.

### 4. Verify and hand off

- `bash -n <script>`, and `shellcheck` if it is available.
- `chmod +x <script>`.
- Do not run it end to end yourself. It opens browsers and blocks on human input.
  Trace it statically instead: every value from step 1 is captured and lands
  where step 1 said, and every `set_secret` name matches a `secrets.*` reference
  in CI exactly.
- Tell the user how to run it. If it is a repeatable setup path, commit it under
  `scripts/` and link it from the README so the next person runs the script
  instead of asking an agent.

## Downstream

> Credentials in place? `/stacks-deploy` for the deploy workflow itself, and
> `/stacks-guard` before anything touches production.
