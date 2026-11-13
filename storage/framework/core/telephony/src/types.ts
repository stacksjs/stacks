export type PhoneCountry = 'US' | 'CA'
export type CallStatus = 'queued' | 'ringing' | 'in-progress' | 'completed' | 'busy' | 'failed' | 'no-answer' | 'canceled'
export interface AvailableNumber {
  phoneNumber: string
  country: PhoneCountry
  locality?: string
  region?: string
  voice: boolean
  sms: boolean
}
export interface PhoneNumber {
  sid: string
  phoneNumber: string
  voiceUrl: string | null
}
export interface Call {
  sid: string
  from: string
  to: string
  status: CallStatus
  direction: string
}
export interface NumberSearch {
  country: PhoneCountry
  areaCode?: string
  limit?: number
}
export interface ProvisionNumber {
  phoneNumber: string
  voiceUrl: string
  statusCallback?: string
  /** Provider-approved regulatory bundle/address, when required by the number. */
  bundleSid?: string
  addressSid?: string
}
export type CallInstructions = { twiml: string, url?: never } | { url: string, twiml?: never }
export type CreateCall = CallInstructions & { from: string, to: string, statusCallback?: string }
export interface WriteOptions {
  /** Stable application operation ID. Never generate a fresh key when retrying a job. */
  operationKey: string
}
export interface Telephony {
  searchNumbers: (input: NumberSearch) => Promise<AvailableNumber[]>
  listNumbers: (phoneNumber?: string) => Promise<PhoneNumber[]>
  provisionNumber: (input: ProvisionNumber, options: WriteOptions) => Promise<PhoneNumber>
  releaseNumber: (sid: string, options: WriteOptions) => Promise<void>
  configureNumber: (sid: string, voiceUrl: string, options: WriteOptions) => Promise<PhoneNumber>
  createCall: (input: CreateCall, options: WriteOptions) => Promise<Call>
  getCall: (sid: string) => Promise<Call>
  listCalls: (filter?: { from?: string, to?: string }) => Promise<Call[]>
  redirectCall: (sid: string, instructions: CallInstructions, options: WriteOptions) => Promise<Call>
  endCall: (sid: string, status: 'completed' | 'canceled', options: WriteOptions) => Promise<Call>
}
