import { md5, sha256 } from 'hash-wasm'

export interface DigestCredentials { username: string, password: string }

type Challenge = Record<string, string>

/** Split challenges without splitting commas or escaped quotes inside a quoted value. */
function digestChallenges(header: string): Challenge[] {
  const parts: string[] = []
  let quoted = false
  let escaped = false
  let start = 0
  for (let index = 0; index < header.length; index++) {
    const char = header[index]
    if (escaped) { escaped = false; continue }
    if (quoted && char === '\\') { escaped = true; continue }
    if (char === '"') quoted = !quoted
    if (char === ',' && !quoted) { parts.push(header.slice(start, index)); start = index + 1 }
  }
  if (quoted || escaped) return []
  parts.push(header.slice(start))
  const challenges: Challenge[] = []
  let current: Challenge | undefined
  for (let part of parts) {
    part = part.trim()
    const scheme = /^([a-z][a-z0-9_-]*)[ \t]+(?=[^ \t=])/i.exec(part)
    if (scheme) {
      current = scheme[1]!.toLowerCase() === 'digest' ? Object.create(null) as Challenge : undefined
      if (current) challenges.push(current)
      part = part.slice(scheme[0].length)
    }
    if (!current) continue
    const parameter = /^([a-z][a-z0-9_-]*)\s*=\s*("(?:\\.|[^"\\])*"|[^\s]+)$/i.exec(part)
    if (!parameter) { current = undefined; challenges.pop(); continue }
    const key = parameter[1]!.toLowerCase()
    if (key in current) { current = undefined; challenges.pop(); continue }
    const raw = parameter[2]!
    current[key] = raw.startsWith('"') ? raw.slice(1, -1).replace(/\\(.)/g, '$1') : raw
  }
  return challenges
}

/** RFC 7616 authentication. MD5 is used only when a legacy server challenges with it. */
export async function digestAuthorization(header: string, credentials: DigestCredentials, method: string, url: string, body: Uint8Array): Promise<string | null> {
  const candidates = digestChallenges(header).filter(challenge => /^(?:MD5|SHA-256)(?:-sess)?$/i.test(challenge.algorithm ?? 'MD5'))
    .sort((a, b) => Number(/^SHA-256/i.test(b.algorithm ?? '')) - Number(/^SHA-256/i.test(a.algorithm ?? '')))
  for (const challenge of candidates) {
    if (challenge.realm === undefined || !challenge.nonce) continue
    if (challenge.charset && challenge.charset.toUpperCase() !== 'UTF-8') continue
    // RFC 7616 section 4: UTF-8 challenges require NFC credentials.
    const user = challenge.charset ? credentials.username.normalize('NFC') : credentials.username
    const password = challenge.charset ? credentials.password.normalize('NFC') : credentials.password
    const offered = challenge.qop?.split(',').map(value => value.trim().toLowerCase())
    const qop = offered?.includes('auth') ? 'auth' : offered?.includes('auth-int') ? 'auth-int' : undefined
    if (offered && !qop) continue
    const algorithm = (challenge.algorithm ?? 'MD5').toUpperCase()
    const session = algorithm.endsWith('-SESS')
    const base = algorithm.startsWith('SHA-256') ? 'SHA-256' : 'MD5'
    const hash = base === 'MD5' ? md5 : sha256
    const quote = (value: string) => `"${value.replace(/[\\"]/g, '\\$&')}"`
    const cnonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('')
    const nonceCount = '00000001'
    const target = new URL(url)
    const uri = target.pathname + target.search
    let ha1 = await hash(`${user}:${challenge.realm}:${password}`)
    if (session) ha1 = await hash(`${ha1}:${challenge.nonce}:${cnonce}`)
    const ha2 = await hash(`${method}:${uri}${qop === 'auth-int' ? `:${await hash(body)}` : ''}`)
    const response = await hash(qop ? `${ha1}:${challenge.nonce}:${nonceCount}:${cnonce}:${qop}:${ha2}` : `${ha1}:${challenge.nonce}:${ha2}`)
    const username = challenge.userhash?.toLowerCase() === 'true' ? await hash(`${user}:${challenge.realm}`) : user
    const encodedUsername = encodeURIComponent(username).replace(/['()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
    const usernameField = /[^\x20-\x7E]/.test(username) ? `username*=UTF-8''${encodedUsername}` : `username=${quote(username)}`
    const fields = [usernameField, `realm=${quote(challenge.realm)}`, `nonce=${quote(challenge.nonce)}`, `uri=${quote(uri)}`,
    `algorithm=${base}${session ? '-sess' : ''}`, `response=${quote(response)}`]
    if (qop) fields.push(`qop=${qop}`, `nc=${nonceCount}`)
    if (qop || session) fields.push(`cnonce=${quote(cnonce)}`)
    if (challenge.opaque !== undefined) fields.push(`opaque=${quote(challenge.opaque)}`)
    if (challenge.userhash?.toLowerCase() === 'true') fields.push('userhash=true')
    return `Digest ${fields.join(', ')}`
  }
  return null
}
