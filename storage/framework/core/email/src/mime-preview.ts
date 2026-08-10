interface MimePart {
  contentType: string
  encoding: string
  body: string
}

function splitHeaders(value: string): { headers: Record<string, string>, body: string } {
  const normalized = value.replace(/\r\n/g, '\n')
  const separator = normalized.indexOf('\n\n')
  if (separator < 0)
    return { headers: {}, body: normalized }

  const headerLines = normalized.slice(0, separator).replace(/\n[ \t]+/g, ' ').split('\n')
  const headers: Record<string, string> = {}
  for (const line of headerLines) {
    const match = line.match(/^([^:]+):\s*(.*)$/)
    if (match)
      headers[match[1]!.toLowerCase()] = match[2] || ''
  }

  return { headers, body: normalized.slice(separator + 2) }
}

function decodeQuotedPrintable(value: string): string {
  const input = value.replace(/\r\n/g, '\n').replace(/=\n/g, '')
  const bytes: number[] = []
  const encoder = new TextEncoder()

  for (let index = 0; index < input.length; index++) {
    const encoded = input.slice(index, index + 3)
    if (/^=[0-9a-f]{2}$/i.test(encoded)) {
      bytes.push(Number.parseInt(encoded.slice(1), 16))
      index += 2
    }
    else {
      bytes.push(...encoder.encode(input[index]!))
    }
  }

  return new TextDecoder().decode(Uint8Array.from(bytes))
}

function normalizedMimeBody(value: string, requestedType: 'text/html' | 'text/plain'): string {
  const normalized = value.replace(/\r\n/g, '\n').trim()
  const fragmentBoundary = normalized.match(/^--([^\n]+)\n/)?.[1]?.replace(/--$/, '')
  const hasMimeHeaders = /^(?:content-type|content-transfer-encoding|mime-version):/i.test(normalized)
  const source = fragmentBoundary
    ? `Content-Type: multipart/mixed; boundary="${fragmentBoundary.replace(/["\\]/g, '')}"\n\n${normalized}`
    : normalized

  if (fragmentBoundary || hasMimeHeaders) {
    const parts = mimeParts(source)
    const selected = parts.find(part => part.contentType.startsWith(requestedType))
    if (selected)
      return decodeBody(selected.body, selected.encoding).trim()
  }

  return decodeQuotedPrintable(stripLegacyMimePreamble(normalized)).trim()
}

function decodeBody(body: string, encoding: string): string {
  if (encoding === 'base64') {
    try {
      return Buffer.from(body.replace(/\s+/g, ''), 'base64').toString('utf8')
    }
    catch {
      return body
    }
  }
  if (encoding === 'quoted-printable')
    return decodeQuotedPrintable(body)
  return body
}

function mimeParts(value: string): MimePart[] {
  const { headers, body } = splitHeaders(value)
  const contentType = (headers['content-type'] || 'text/plain').toLowerCase()
  const boundary = headers['content-type']?.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean)

  if (contentType.startsWith('multipart/') && boundary) {
    return body
      .split(`--${boundary}`)
      .slice(1)
      .filter(part => !part.trimStart().startsWith('--'))
      .flatMap(mimeParts)
  }

  return [{
    contentType,
    encoding: (headers['content-transfer-encoding'] || '').toLowerCase(),
    body,
  }]
}

function stripLegacyMimePreamble(value: string): string {
  let result = value.trim()
  result = result.replace(/^[-=_]{2,}[^\s]*\s+/, '')

  for (let pass = 0; pass < 6; pass++) {
    const next = result
      .replace(/^content-transfer-encoding:\s*[^\s]+\s*/i, '')
      .replace(/^mime-version:\s*[^\s]+\s*/i, '')
      .replace(/^content-description:\s*[^\s]+\s*/i, '')
      .replace(/^content-type:\s*[^\s;]+(?:;\s*(?:charset|boundary|name)\s*=\s*(?:"[^"]*"|[^\s]+))*\s*/i, '')
    if (next === result)
      break
    result = next
  }

  return result.replace(/^[-=_]{4,}[^\s]*\s*/, '')
}

function plainText(value: string): string {
  return decodeQuotedPrintable(stripLegacyMimePreamble(value))
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, '\'')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractEmailPreview(rawEmail: string, maxLength = 200): string {
  const parts = mimeParts(rawEmail)
  const selected = parts.find(part => part.contentType.startsWith('text/plain'))
    || parts.find(part => part.contentType.startsWith('text/html'))

  return plainText(selected ? decodeBody(selected.body, selected.encoding) : rawEmail).slice(0, maxLength)
}

export function normalizeEmailPreview(preview: string, maxLength = 200): string {
  return plainText(preview).slice(0, maxLength)
}

export function normalizeEmailTextBody(body: string): string {
  return normalizedMimeBody(body, 'text/plain')
}

export function normalizeEmailHtmlBody(body: string): string {
  return normalizedMimeBody(body, 'text/html')
}
