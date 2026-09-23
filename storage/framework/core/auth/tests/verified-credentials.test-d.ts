import { Auth } from '../src/authentication'

// Compile-only assertions: a custom multi-step login retains its callback's
// result type, while rejection remains explicitly nullable.
export async function verifiedCredentialResult(): Promise<void> {
  const result = await Auth.withVerifiedCredentials({ email: 'fixture@example.invalid', password: 'synthetic' }, async user => ({
    kind: 'challenge' as const,
    userId: user.id,
  }))
  if (result) {
    const kind: 'challenge' = result.kind
    void kind
    // @ts-expect-error callback results are not widened to any
    const unknown: boolean = result.notAField
    void unknown
  }
  // @ts-expect-error credentials can fail, so the result is nullable
  const unchecked: 'challenge' = result.kind
  void unchecked
}
