#!/usr/bin/env bash
#
# Claude Code PreToolUse hook: block destructive commands before they run.
#
# Reads the tool call on stdin, exits 2 with a message on stderr when the
# command matches a blocked pattern, and exits 0 otherwise.
#
# Adapted from Matt Pocock's `git-guardrails-claude-code` skill (MIT),
# https://github.com/mattpocock/skills
#
# Install: see the stacks-guard skill. Customise the two pattern lists below;
# they are a starting point, not a policy.

set -uo pipefail

INPUT=$(cat)

if command -v jq >/dev/null 2>&1; then
  COMMAND=$(printf '%s' "$INPUT" | jq -r '.tool_input.command // empty')
else
  # No jq: fall back to the raw payload. Coarser, but it still matches.
  COMMAND="$INPUT"
fi

[[ -z "$COMMAND" ]] && exit 0

# Unrecoverable. These destroy work or data that no command brings back.
BLOCKED=(
  'rm[[:space:]]+-[a-zA-Z]*[rR][a-zA-Z]*f?[[:space:]]+(/|~|\.)([[:space:]]|$)'
  'git[[:space:]]+push[[:space:]].*--force'
  'git[[:space:]]+push[[:space:]].*-f([[:space:]]|$)'
  'git[[:space:]]+reset[[:space:]]+--hard'
  'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'
  'git[[:space:]]+branch[[:space:]]+-D'
  'git[[:space:]]+checkout[[:space:]]+--[[:space:]]+\.'
  'git[[:space:]]+restore[[:space:]]+\.'
  'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)'
  'TRUNCATE[[:space:]]+TABLE'
)

# Destructive only against production. Same commands are routine locally.
PROD_BLOCKED=(
  '(buddy|bud|stacks)[[:space:]]+migrate:fresh'
  '(buddy|bud|stacks)[[:space:]]+seed[[:space:]].*--fresh'
  '(buddy|bud|stacks)[[:space:]]+cloud:remove'
  '(buddy|bud|stacks)[[:space:]]+cloud:cleanup'
)

for pattern in "${BLOCKED[@]}"; do
  if printf '%s' "$COMMAND" | grep -qE "$pattern"; then
    printf 'BLOCKED: this command matches the destructive pattern /%s/ and the user has not authorised it. Ask them to run it themselves, or propose a reversible alternative.\n' "$pattern" >&2
    exit 2
  fi
done

# A command is production-facing when it says so, or when it is reading a
# production env file.
if printf '%s' "$COMMAND" | grep -qE '(APP_ENV=production|NODE_ENV=production|--env[= ]production|\.env\.production)'; then
  for pattern in "${PROD_BLOCKED[@]}"; do
    if printf '%s' "$COMMAND" | grep -qE "$pattern"; then
      printf 'BLOCKED: this command matches /%s/ against production. It drops or removes live infrastructure. Ask the user to run it themselves.\n' "$pattern" >&2
      exit 2
    fi
  done
fi

exit 0
