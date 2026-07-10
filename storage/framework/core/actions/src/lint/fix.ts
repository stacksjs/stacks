#!/usr/bin/env bun
// Thin CLI entrypoint for `runAction(Action.LintFix)` (used by the release
// pipeline), which spawns this file by path. The real logic lives in `./lint`
// (exported for direct import); here we only map its result onto an exit code.
import process from 'node:process'
import { lintFix } from './lint'

const { ok } = await lintFix()
process.exit(ok ? 0 : 1)
