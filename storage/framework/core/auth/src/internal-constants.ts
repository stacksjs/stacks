/**
 * Internal constants shared across the auth package.
 *
 * Lives in its own file so consumers like `authentication.ts` and
 * `session-auth.ts` can pull the same literal without re-declaring it
 * (stacksjs/stacks#1861 L-1).
 */

/**
 * Pre-computed bcrypt hash of nothing — used to keep timing constant
 * when the lookup-by-email half of a login fails. Without it, the
 * "user not found" branch would short-circuit fast and the "wrong
 * password" branch would always pay the bcrypt cost, leaking
 * "does this email exist?" via response time.
 *
 * The hash itself is intentionally non-verifiable: nothing the
 * attacker types will ever match it, so the dummy compare always
 * returns false but spends the same CPU as a real one would.
 */
export const DUMMY_BCRYPT_HASH = '$2b$12$000000000000000000000uGByljkdFkOJRCRiYZGFOAstyLlSgTSW'
