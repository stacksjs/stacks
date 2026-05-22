/**
 * AI usage tracking (stacksjs/stacks#1878 A-6).
 *
 * Background: `AIResult.usage` returns token counts per-call but
 * nothing aggregates them. Apps that want "this user has spent
 * $X this month" build the aggregation themselves — wiring a
 * listener on every model invocation, persisting the running
 * total, etc.
 *
 * This module ships a singleton recorder that drivers emit to on
 * each completion. Apps install one or more `UsageReporter`
 * functions that get called with `{ provider, model, prompt_tokens,
 * completion_tokens, timestamp, durationMs }` and decide what to
 * do (store to DB, push to Datadog, etc.). Default behavior with
 * no reporter is a no-op — the framework doesn't impose a sink.
 */

export interface UsageRecord {
  /** Provider name (e.g. `'openai'`, `'anthropic'`). */
  provider: string
  /** Model id from the response (e.g. `'gpt-4o'`, `'claude-sonnet-4'`). */
  model: string
  /** Prompt-side token count. */
  promptTokens: number
  /** Completion-side token count. */
  completionTokens: number
  /** Total tokens (`promptTokens + completionTokens`). */
  totalTokens: number
  /** Wall-clock duration of the completion in ms. */
  durationMs: number
  /** Wall-clock timestamp the completion finished, in epoch ms. */
  timestamp: number
  /** Optional caller-supplied tag (user id, request id, etc.). */
  metadata?: Record<string, unknown>
}

/**
 * A reporter is called once per recorded completion. Multiple
 * reporters can be installed simultaneously; they fire in
 * registration order. Reporters MUST NOT throw — errors are
 * caught and logged but otherwise ignored so a flaky metrics
 * sink doesn't break the user's completion call.
 */
export type UsageReporter = (record: UsageRecord) => void | Promise<void>

const reporters: UsageReporter[] = []

/**
 * Register a usage reporter. Returns an `unregister` callback for
 * apps that want to swap reporters at runtime (test setup/teardown,
 * tenant isolation, etc.).
 */
export function onUsage(reporter: UsageReporter): () => void {
  reporters.push(reporter)
  return () => {
    const idx = reporters.indexOf(reporter)
    if (idx >= 0) reporters.splice(idx, 1)
  }
}

/**
 * Drop every registered reporter. Useful for tests.
 */
export function clearUsageReporters(): void {
  reporters.length = 0
}

/**
 * Emit a usage record to every registered reporter. Called by
 * driver completion paths after the response lands. Reporter
 * errors are caught + logged so a misbehaving sink doesn't
 * propagate up to the caller.
 */
export function recordUsage(record: UsageRecord): void {
  for (const reporter of reporters) {
    try {
      const result = reporter(record)
      if (result && typeof (result as Promise<void>).then === 'function') {
        (result as Promise<void>).catch((err) => {
          // eslint-disable-next-line no-console
          console.error('[ai/usage] reporter rejected:', err)
        })
      }
    }
    catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ai/usage] reporter threw:', err)
    }
  }
}

/**
 * Snapshot the currently-registered reporters. Useful for tests
 * to assert behavior without exposing the internal array.
 */
export function listUsageReporters(): readonly UsageReporter[] {
  return reporters
}
