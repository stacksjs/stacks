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
