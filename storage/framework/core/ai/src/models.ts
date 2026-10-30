/**
 * Default model ids for the first-party provider APIs.
 *
 * These were spelled inline at seven call sites, all of them
 * `claude-sonnet-4-20250514`: two generations behind, and carrying a date
 * suffix that current Anthropic model ids do not use. Nothing coordinated
 * them, so a bump meant finding all seven.
 *
 * Why the Sonnet tier rather than the most capable model: the framework had
 * already chosen Sonnet, and tier is a cost decision that belongs to the
 * application, not to a dependency's default. This moves the generation
 * forward and leaves the tier alone.
 *
 * Override per application with the `model` option on any call, which every
 * one of these sites already honours.
 */
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-5-5'

/**
 * The fast, small model class for latency-bound features such as inline
 * completions, where a suggestion is worth nothing if it lands after the next
 * keystroke. Haiku on Anthropic, and on Bedrock the Haiku inference profile
 * from `bedrockModels`. An app overrides either with `ai.completion.model` in
 * config/ai.ts, or by listing a Haiku in `ai.models`, which wins over these.
 */
export const DEFAULT_ANTHROPIC_FAST_MODEL = 'claude-haiku-4-5'
export const DEFAULT_BEDROCK_FAST_MODEL = 'global.anthropic.claude-haiku-4-5-20251001-v1:0'
