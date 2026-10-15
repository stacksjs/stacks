/**
 * Whether a value is dotenvx ciphertext rather than something usable.
 *
 * Its own module, and a leaf, because of who needs it. The preloader and the
 * parser ask this on a hot path, and `@stacksjs/database/runtime` reaches them
 * through the env runtime entry. `plaintext.ts`, where this lived, also carries
 * the committed-secret scanner, so importing it from there pulled that whole
 * module into the database runtime's static graph, which
 * `database/tests/runtime-entry.test.ts` forbids and which turned main red for
 * three releases (stacksjs/stacks#2904).
 *
 * `encrypted:` is the current envelope (`encrypted:v2:` with the versioned
 * header); `enc:` is the short alias. One definition, here: it was written out
 * four separate times across this package before it was given a home, and
 * consolidating it into the larger module is what cost the graph.
 */
export function isEncryptedValue(value: string | undefined | null): boolean {
  return typeof value === 'string' && (value.startsWith('encrypted:') || value.startsWith('enc:'))
}
