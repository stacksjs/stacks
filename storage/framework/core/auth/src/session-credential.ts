import { createHash, randomBytes } from 'node:crypto'

const CREDENTIAL_PREFIX = 'bs1_'
const IDENTIFIER_PREFIX = 'bs1:'

/** Browser credentials are distinct from the non-secret identifier saved in SQL. */
export function createBrowserSessionCredential(): string {
  return `${CREDENTIAL_PREFIX}${randomBytes(40).toString('hex')}`
}

export function browserSessionIdentifier(credential: string): string | undefined {
  if (!/^bs1_[a-f0-9]{80}$/.test(credential)) return undefined
  return `${IDENTIFIER_PREFIX}${createHash('sha256').update(credential).digest('hex')}`
}

/** Keep legacy session credentials readable, but never accept a saved browser identifier. */
export function sessionCredentialIdentifier(credential: string): string | undefined {
  if (!credential || /^(?:bs1|access):/i.test(credential)) return undefined
  if (credential.startsWith(CREDENTIAL_PREFIX)) return browserSessionIdentifier(credential)
  return credential
}
