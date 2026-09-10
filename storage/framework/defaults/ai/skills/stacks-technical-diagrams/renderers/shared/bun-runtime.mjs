// Stacks port. Every child process this skill spawns must run Bun against the
// skill's own empty bunfig: a diagram renderer that inherited the host
// application's `preload` list would boot the framework (env decryption, auto
// imports, plugins) before drawing a rectangle, and `.env` values would leak
// into a process whose only job is to write HTML.

import path from 'node:path';
import { fileURLToPath } from 'node:url';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

export const RUNTIME_FLAGS = Object.freeze([
  `--config=${path.join(skillRoot, 'bunfig.toml')}`,
  '--no-env-file',
]);

/** Prefix the isolation flags onto the argument list for a child Bun process. */
export function runtimeArgs(args) {
  return [...RUNTIME_FLAGS, ...args];
}
