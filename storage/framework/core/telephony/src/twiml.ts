import { invalid, phone, secureUrl } from './validation.ts'

export type VoiceStep = { type: 'say', text: string }
  | { type: 'hangup' }
  | { type: 'reject', reason?: 'busy' | 'rejected' }
  | { type: 'dial', number: string }
  | { type: 'stream', url: string, parameters?: Record<string, string> }

function xml(value: string): string {
  if (typeof value !== 'string' || value.length > 4000) invalid('TwiML content must contain at most 4000 characters.')
  for (const character of value) {
    const code = character.codePointAt(0)!
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || (code >= 0xD800 && code <= 0xDFFF) || code === 0xFFFE || code === 0xFFFF) invalid('TwiML contains an invalid XML character.')
  }
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/\r/g, '&#13;').replace(/\n/g, '&#10;').replace(/\t/g, '&#9;')
}

/** Small safe vocabulary for incoming-call responses. Raw TwiML passed to call APIs must already be trusted. */
export function voiceResponse(steps: readonly VoiceStep[]): string {
  if (steps.length > 50) invalid('TwiML has too many instructions.')
  const content = steps.map((step) => {
    if (step.type === 'say') return `<Say>${xml(step.text)}</Say>`
    if (step.type === 'hangup') return '<Hangup/>'
    if (step.type === 'reject') {
      const reason = step.reason ?? 'rejected'
      if (reason !== 'busy' && reason !== 'rejected') invalid('Invalid rejection reason.')
      return `<Reject reason="${reason}"/>`
    }
    if (step.type === 'dial') return `<Dial><Number>${phone(step.number)}</Number></Dial>`
    if (step.type === 'stream') {
      const url = secureUrl(step.url, 'wss:')
      if (new URL(url).search) invalid('Media Stream URLs cannot contain query parameters.')
      const parameters = Object.entries(step.parameters ?? {})
      if (parameters.length > 20) invalid('Too many Media Stream custom parameters.')
      const children = parameters.map(([name, value]) => {
        if (!name || name.length + value.length >= 500) invalid('Stream parameter names and values must total fewer than 500 characters.')
        return `<Parameter name="${xml(name)}" value="${xml(value)}"/>`
      }).join('')
      return `<Connect><Stream url="${xml(url)}">${children}</Stream></Connect>`
    }
    return invalid('Unsupported TwiML instruction.')
  }).join('')
  const result = `<?xml version="1.0" encoding="UTF-8"?><Response>${content}</Response>`
  if (result.length > 4000) invalid('TwiML exceeds the 4000 character call API limit.')
  return result
}
