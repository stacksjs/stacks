export type TelephonyErrorCode = 'configuration' | 'validation' | 'authentication' | 'not_found' | 'rate_limited' | 'rejected' | 'transport' | 'invalid_response' | 'operation_conflict' | 'operation_pending' | 'write_uncertain' | 'capacity' | 'invalid_signature' | 'invalid_media'

/** Messages are fixed locally. Provider bodies, credentials and fetch errors are never exposed. */
export class TelephonyError extends Error {
  constructor(
    public readonly code: TelephonyErrorCode,
    message: string,
    public readonly details: { status?: number, providerCode?: number, operationKey?: string } = {},
  ) {
    super(message)
    this.name = 'TelephonyError'
  }
}
