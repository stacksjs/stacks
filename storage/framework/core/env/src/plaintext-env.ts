/** Ciphertext preloaded by Bun is not a usable environment value. */
export function isEncryptedValue(value: string | undefined): boolean {
  return typeof value === 'string' && (value.startsWith('encrypted:') || value.startsWith('enc:'))
}

/**
 * Keep genuine plaintext, excluding copies of known ciphertext that Bun may
 * have interpolated into another variable before the framework loader runs.
 */
export function plaintextEnv(
  values: Record<string, string | undefined>,
  encryptedKeys: readonly string[] = Object.keys(values),
): Record<string, string | undefined> {
  const ciphertext = encryptedKeys.map(key => values[key]).filter((value): value is string => isEncryptedValue(value))
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value === undefined || !ciphertext.some(encrypted => value.includes(encrypted))),
  )
}
