#!/usr/bin/env bun
// Preserve Stacks' documented entrypoint; the pinned CLI supports legacy deliver too.
process.env.ARCHIFY_UPDATE_CHECK_DISABLED = '1'
await import('./archify.mjs')
