/**
 * Whether this process is a `bun build --compile` binary
 * (stacksjs/stacks#2886).
 *
 * Bun mounts a compiled bundle at a virtual root and reports module paths
 * under it, so the entrypoint is `/$bunfs/root/<name>` instead of a real file.
 * Read off a compiled probe binary rather than taken from documentation:
 *
 *   compiled      Bun.main = /$bunfs/root/probe   import.meta.dir = /$bunfs/root
 *   plain script  Bun.main = /abs/path/probe.ts   import.meta.dir = /abs/path
 *
 * Windows mounts it at `B:\~BUN\root` instead; both separators are accepted
 * because a path can reach here having been normalised either way. That form
 * comes from Bun's own docs and is the one case not verified on this machine.
 *
 * Matched as a whole path SEGMENT. A substring test would read a project
 * directory called `my-$bunfs-notes` as a binary and switch off its model
 * loading, which is a far stranger failure than the one being fixed.
 */
const BUNDLED_ROOT = /(?:^|[/\\])(?:\$bunfs|~BUN)(?:[/\\]|$)/

export function isCompiledBinary(main: string | undefined = Bun.main): boolean {
  // Fail toward the behaviour every non-binary has: if a runtime stops
  // reporting an entrypoint, models should still load rather than silently
  // stop.
  if (!main)
    return false

  return BUNDLED_ROOT.test(main)
}
