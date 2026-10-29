// This contract deliberately checks emitted declarations: source imports hide
// declaration-generator regressions from consumers.
// eslint-disable-next-line pickier/no-import-dist
import { Auth } from '../dist/authentication'
// eslint-disable-next-line pickier/no-import-dist
import type { ImpersonationSession } from '../dist/impersonation'

// Consumers compile against the published declaration, not the source's
// inferred factory return. Declaration generation must retain this contract.
export function publishedImpersonationResult(): void {
  const issued: Promise<{ credential: string, session: ImpersonationSession }> = Auth.startImpersonation(2, 'Investigate missing workouts')
  void issued
}
