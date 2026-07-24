/**
 * Invoke a migrated tooling module's `run()` with a synthetic argv so its
 * existing `process.argv` flag parsing (`--check` / `--write` / `--revision` …)
 * sees the flags the buddy command wants, then restore the real argv. Buddy runs
 * one command per process and the action is terminal, so this swap is safe.
 */
export async function runTool(run: () => void | Promise<void>, ...flags: string[]): Promise<void> {
  const saved = process.argv
  process.argv = [saved[0] ?? 'bun', saved[1] ?? 'buddy', ...flags]
  try {
    await run()
  }
  finally {
    process.argv = saved
  }
}
