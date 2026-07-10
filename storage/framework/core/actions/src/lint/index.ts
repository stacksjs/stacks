#!/usr/bin/env bun
// Thin CLI entrypoint for `runAction(Action.Lint)`, which spawns this file by
// path. The real logic lives in `./lint` (exported for direct import); here we
// only map its result onto a process exit code. Never imported — only spawned —
// so the top-level call is unconditional (an `import.meta.main` guard would be
// dead-branch-eliminated by the bundler).
import process from 'node:process'
import { lintProject } from './lint'

const { ok } = await lintProject()
process.exit(ok ? 0 : 1)
