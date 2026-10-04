/**
 * Profile pictures as HTTP responses. Contacts and WhatsApp store photos
 * without a type, so it is read from the bytes; remote pictures are only
 * fetched from the provider's own image hosts, never an arbitrary URL.
 */

export function imageType(bytes: Uint8Array): string {
  if (bytes[0] === 0xFF && bytes[1] === 0xD8)
    return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47)
    return 'image/png'
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
    return 'image/gif'
  if (bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return 'image/webp'
  if (String.fromCharCode(bytes[4] ?? 0, bytes[5] ?? 0, bytes[6] ?? 0, bytes[7] ?? 0) === 'ftyp')
    return 'image/heic'
  return 'application/octet-stream'
}

export function imageResponse(bytes: Uint8Array | null): Response {
  if (!bytes || bytes.length === 0)
    return new Response('Not found', { status: 404 })
  return new Response(Uint8Array.from(bytes), { headers: { 'content-type': imageType(bytes) } })
}

/** Whether `ref` is an https URL on one of `hosts` (or a subdomain of one). */
export function onHost(ref: string, hosts: string[]): boolean {
  try {
    const url = new URL(ref)
    return url.protocol === 'https:' && hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))
  }
  catch {
    return false
  }
}
