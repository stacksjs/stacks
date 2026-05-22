/**
 * Token-counting + prompt-sanitization utils (stacksjs/stacks#1878 A-7).
 *
 * These are heuristic helpers — not exact-tokenizer replacements.
 * Real exact counts come from the provider's tokenizer (tiktoken
 * for OpenAI, anthropic's tokenizer endpoint). Both are heavy
 * dependencies / network calls; this module ships a quick estimate
 * that's good enough for cost projection and prompt-budget checks
 * without paying the install/runtime cost.
 *
 * Calibration: empirical "chars-per-token" ratios from each
 * provider's documentation. English prose hits ~4 chars/token on
 * average; code and JSON skew lower (~3.5). The estimator picks a
 * conservative ratio per model family so estimates over-count
 * slightly — better to budget too tight than blow your context.
 */

/**
 * Rough chars-per-token for a model. Tightened down to the
 * conservative end of each provider's published range so apps
 * pre-checking against the model's context window don't get
 * blindsided by a slightly higher actual count.
 */
function charsPerToken(model: string): number {
  const m = model.toLowerCase()
  // GPT-4 / GPT-4o / GPT-5: ~4 chars/token average; conservative 3.5.
  if (m.startsWith('gpt-')) return 3.5
  // Claude family: roughly 4 chars/token; conservative 3.5.
  if (m.startsWith('claude')) return 3.5
  // Ollama / local models vary widely; fall through to default.
  // Default: 3.5 — undercounts long English prose slightly, which
  // is the safer direction.
  return 3.5
}

/**
 * Estimate the number of tokens in `text` for the given model.
 * Heuristic only — for exact counts, use the provider's tokenizer.
 *
 * @example
 * ```ts
 * if (estimateTokens(prompt, 'gpt-4o') > 100_000) {
 *   throw new Error('prompt too long; consider chunking')
 * }
 * ```
 */
export function estimateTokens(text: string, model: string = 'gpt-4o'): number {
  if (!text) return 0
  const ratio = charsPerToken(model)
  // Add 1 to the divisor so very short strings round up to a
  // non-zero estimate (single-char inputs still cost a token).
  return Math.max(1, Math.ceil(text.length / ratio))
}

/**
 * Estimate total tokens for a chat-completion request: sum of
 * every message's content plus a fixed per-message overhead
 * (matches the rough "+4 per message + 2 for the conversation"
 * heuristic OpenAI's docs publish).
 */
export function estimateMessageTokens(
  messages: Array<{ role: string, content: string | unknown }>,
  model: string = 'gpt-4o',
): number {
  const PER_MESSAGE_OVERHEAD = 4
  const CONVERSATION_OVERHEAD = 2
  let total = CONVERSATION_OVERHEAD
  for (const msg of messages) {
    total += PER_MESSAGE_OVERHEAD
    if (typeof msg.content === 'string') {
      total += estimateTokens(msg.content, model)
    }
    else if (Array.isArray(msg.content)) {
      // Multi-modal content arrays — count text blocks. Image blocks
      // are model-specific (Anthropic ~85+ tokens per image, OpenAI
      // tile-based); the heuristic adds 100 tokens per image as a
      // round-number proxy. Apps that need real counts pre-flight via
      // the provider's tokenizer.
      for (const block of msg.content as Array<{ type: string, text?: string }>) {
        if (block.type === 'text' && block.text)
          total += estimateTokens(block.text, model)
        else if (block.type === 'image' || block.type === 'image_url')
          total += 100
      }
    }
  }
  return total
}

/**
 * Patterns that match common prompt-injection / jailbreak attempts.
 * NOT exhaustive — adversarial input is an open research problem.
 * This catches the most common patterns ("ignore previous instructions",
 * etc.) so apps have a cheap first-line defense; layered defenses
 * (system-prompt isolation, output-side guards) are still required.
 */
const INJECTION_PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?\b/i,
  /\bdisregard\s+(?:all\s+)?(?:previous|prior|above)\b/i,
  /\bforget\s+(?:everything|all)\s+(?:you|i)\b/i,
  /\byou\s+are\s+now\s+a\s+\w+/i, // "you are now a pirate AI"
  /\bnew\s+instructions?:\s*/i,
  /\bsystem\s*[:>]\s*/i, // injection attempts framed as system prompts
  /\b(?:reveal|show|print|output|display)\s+(?:your|the)\s+(?:system\s+)?prompt\b/i,
  /<\s*\/?\s*system\s*>/i, // pseudo-system XML tags
  /\[INST\]|\[\/INST\]/i, // llama-instruct framing
  /^\s*###\s+(?:instruction|system)/im,
]

export interface SanitizeResult {
  /** True when no injection patterns matched. */
  ok: boolean
  /** List of pattern descriptions that matched (empty when ok). */
  matched: string[]
  /** The input, with matched patterns replaced by `[redacted]`. */
  cleaned: string
}

/**
 * Inspect `text` for common prompt-injection patterns. Returns
 * `{ ok, matched, cleaned }`. Apps decide what to do with the
 * result — reject the request (`if (!result.ok) throw...`), pass
 * the cleaned text on (`useText(result.cleaned)`), or just log
 * for audit while letting the original through.
 *
 * **Limits:** this is heuristic. Adversarial inputs can paraphrase
 * around any specific pattern. Use as a cheap first filter; for
 * real defense, isolate the user input from the system prompt
 * structurally (different roles, JSON-mode for the system layer)
 * and guard the output side too.
 *
 * @example
 * ```ts
 * const check = sanitizePrompt(userInput)
 * if (!check.ok) {
 *   log.warn('possible injection attempt', { patterns: check.matched })
 *   // option A: reject
 *   throw new HttpError(400, 'invalid input')
 *   // option B: pass cleaned
 *   await chat([{ role: 'user', content: check.cleaned }])
 * }
 * ```
 */
export function sanitizePrompt(text: string): SanitizeResult {
  if (!text) return { ok: true, matched: [], cleaned: text }
  const matched: string[] = []
  let cleaned = text
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(cleaned)) {
      matched.push(pattern.toString())
      cleaned = cleaned.replace(pattern, '[redacted]')
    }
  }
  return {
    ok: matched.length === 0,
    matched,
    cleaned,
  }
}
